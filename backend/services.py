import asyncio
import os
import re
import time
from typing import Any, Dict, List, Optional

import fitz
import httpx
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from lxml import etree

load_dotenv()

SEMANTIC_SCHOLAR = os.getenv("SEMANTIC_SCHOLAR_API_KEY")
GROBID_URL = os.getenv("GROBID_URL", "http://localhost:8070")
GROBID_FALLBACK_URLS = [
    url.strip().rstrip("/")
    for url in os.getenv(
        "GROBID_FALLBACK_URLS",
        "https://kermitt2-grobid.hf.space,https://cloud.science-miner.com/grobid",
    ).split(",")
    if url.strip()
]
TEI_NS = {
    "tei": "http://www.tei-c.org/ns/1.0",
    "xml": "http://www.w3.org/XML/1998/namespace",
}

# Simple in-memory cache for hackathon use
_cache: Dict[str, Dict] = {}
CACHE_TTL = int(os.getenv("PAPERTRACE_CACHE_TTL", str(60 * 60)))  # seconds

def _get_cached(key: str) -> Optional[dict]:
    ent = _cache.get(key)
    if not ent:
        return None
    if time.time() - ent["ts"] > CACHE_TTL:
        try:
            del _cache[key]
        except KeyError:
            pass
        return None
    return ent["value"]

def _set_cached(key: str, value: dict):
    _cache[key] = {"ts": time.time(), "value": value}


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _openalex_abstract_to_text(inverted_index: Any) -> str:
    if not isinstance(inverted_index, dict) or not inverted_index:
        return ""
    positions: List[tuple[int, str]] = []
    for token, indices in inverted_index.items():
        if not isinstance(indices, list):
            continue
        for index in indices:
            if isinstance(index, int):
                positions.append((index, token.replace("_", " ")))
    positions.sort(key=lambda item: item[0])
    return _normalize_text(" ".join(token for _, token in positions))


def _first_year(text: str | None) -> Optional[int]:
    if not text:
        return None
    match = re.search(r"(19|20)\d{2}", text)
    return int(match.group(0)) if match else None


def _unique(items: List[str]) -> List[str]:
    seen = set()
    deduped = []
    for item in items:
        key = item.lower().strip()
        if key and key not in seen:
            seen.add(key)
            deduped.append(item)
    return deduped


def normalize_doi(doi: Optional[str]) -> Optional[str]:
    if not doi:
        return None
    value = str(doi).strip()
    if not value:
        return None

    for prefix in ("https://doi.org/", "http://doi.org/", "doi.org/", "doi:"):
        if value.lower().startswith(prefix):
            value = value[len(prefix) :]
            break

    value = value.strip().strip(".,;:()[]")
    return value or None


async def resolve_doi_from_title(title: str, year: Optional[int] = None, authors: Optional[str] = None) -> Optional[str]:
    if not title:
        return None

    params: Dict[str, Any] = {
        "query.title": title,
        "rows": 5,
        "select": "DOI,title,published,published-print,published-online,author",
    }
    if year:
        params["filter"] = f"from-pub-date:{year},until-pub-date:{year}"
    author_stub = _surname_stub(authors or "")
    if author_stub:
        params["query.author"] = author_stub

    headers = {"User-Agent": "PaperTrace/1.0 (mailto:anon@example.com)"}
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            response = await client.get("https://api.crossref.org/works", params=params, headers=headers)
            if response.status_code != 200:
                return None
            items = (response.json().get("message") or {}).get("items") or []
            if not items:
                return None

            wanted_title = re.sub(r"\s+", " ", title.lower()).strip(" .:;,")
            best_doi = None
            best_score = float("-inf")
            for item in items:
                item_title = item.get("title") or []
                item_title = item_title[0] if isinstance(item_title, list) and item_title else (item_title if isinstance(item_title, str) else "")
                normalized_item_title = re.sub(r"\s+", " ", str(item_title).lower()).strip(" .:;,")
                score = 0.0
                if normalized_item_title == wanted_title:
                    score += 2.5
                elif wanted_title and wanted_title in normalized_item_title:
                    score += 1.5

                item_year = None
                for key in ["published-print", "published-online", "published"]:
                    node = item.get(key) or {}
                    parts = node.get("date-parts") or []
                    if parts and parts[0]:
                        item_year = parts[0][0]
                        break
                if year and item_year == year:
                    score += 1.5

                item_authors = item.get("author") or []
                item_surnames = {str(author.get("family") or "").lower() for author in item_authors if author.get("family")}
                if author_stub and author_stub in item_surnames:
                    score += 1.0

                if score > best_score:
                    best_score = score
                    best_doi = normalize_doi(item.get("DOI"))

            if best_score < 3.0:
                return None
            return best_doi
        except Exception:
            return None


def _load_tei(xml_text: str):
    parser = etree.XMLParser(recover=True, huge_tree=True)
    return etree.fromstring(xml_text.encode("utf-8"), parser=parser)


def _grobid_base_urls() -> List[str]:
    base_urls = [GROBID_URL] + GROBID_FALLBACK_URLS
    return _unique([url.rstrip("/") for url in base_urls if url])


def _post_grobid_pdf(pdf_bytes: bytes, data: Dict[str, str]) -> Optional[str]:
    files = {"input": ("paper.pdf", pdf_bytes, "application/pdf")}
    for base_url in _grobid_base_urls():
        try:
            response = requests.post(
                f"{base_url}/api/processFulltextDocument",
                files=files,
                data=data,
                timeout=60,
            )
            if response.status_code == 200 and response.text:
                return response.text
        except Exception:
            continue
    return None


def _clean_reference_text(text: str) -> str:
    return re.sub(r"\[[^\]]+\]|\([^\)]*\)", "", _normalize_text(text)).strip(" ,;:.")


def _surname_stub(name: str) -> str:
    if not name:
        return ""
    normalized = re.sub(r"\bet\s+al\.?\b", "", name, flags=re.IGNORECASE)
    normalized = re.split(r",|;|\band\b|&", normalized, maxsplit=1, flags=re.IGNORECASE)[0]
    tokens = re.findall(r"[A-Za-z][A-Za-z'\-]+", normalized)
    if not tokens:
        return ""
    return tokens[0].lower()


def _reference_lookup_key(author_stub: str, year: Optional[int]) -> Optional[str]:
    if not author_stub or not year:
        return None
    return f"{author_stub.lower()}:{int(year)}"


def _extract_reference_authors(raw_text: str) -> Optional[str]:
    if not raw_text:
        return None
    year_match = re.search(r"(19|20)\d{2}[a-z]?", raw_text)
    head = raw_text[: year_match.start()] if year_match else raw_text[:120]
    head = _normalize_text(re.sub(r"^(?:\[\d+\]|\d+[\.)])\s*", "", head))
    head = re.sub(r"\(?$", "", head).strip(" ,;.(")
    return head or None


def _extract_reference_title(raw_text: str, year: Optional[int]) -> Optional[str]:
    if not raw_text:
        return None

    cleaned = _normalize_text(re.sub(r"^(?:\[\d+\]|\d+[\.)])\s*", "", raw_text))
    if not cleaned:
        return None

    if year:
        match = re.search(
            rf"(?:\(|\b){year}[a-z]?(?:\)|\b)\s*[\.,;:]?\s*(.+?)(?:\.[\s]+[A-Z][^.]+|$)",
            cleaned,
            flags=re.IGNORECASE,
        )
        if match:
            title = _normalize_text(match.group(1)).strip('"“” .;:')
            if len(title) >= 8:
                return title

    parts = re.split(r"(?:19|20)\d{2}[a-z]?", cleaned, maxsplit=1, flags=re.IGNORECASE)
    if len(parts) == 2:
        tail = _normalize_text(parts[1]).lstrip(" ).,:;-")
        title = re.split(r"\.[\s]+[A-Z]", tail, maxsplit=1)[0].strip('"“” .;:')
        if len(title) >= 8:
            return title

    return None


def _citation_marker_text(sentence: str, ref_id: str, ref_text: str = "") -> str:
    if ref_text:
        return ref_text
    if ref_id:
        return ref_id
    return sentence


def _extract_sentence_context(sentence: str, marker: str) -> str:
    if not sentence:
        return ""
    marker = marker.strip()
    if not marker:
        return sentence.strip()

    marker_index = sentence.find(marker)
    if marker_index == -1:
        # Return the clause closest to the citation marker using commas/semicolons.
        chunks = re.split(r"(?<=[,;])\s+", sentence)
        return _normalize_text(chunks[0] if chunks else sentence)

    chunks = re.split(r"(?<=[,;])\s+", sentence)
    best_chunk = sentence
    best_distance = float("inf")
    running_index = 0
    for chunk in chunks:
        chunk_index = sentence.find(chunk, running_index)
        running_index = max(running_index, chunk_index + len(chunk)) if chunk_index != -1 else running_index
        if chunk_index == -1:
            continue
        distance = abs((chunk_index + len(chunk)) - marker_index)
        if distance < best_distance:
            best_distance = distance
            best_chunk = chunk

    return _normalize_text(re.sub(r"\[\d+\]|\([^\)]*\d{4}[^\)]*\)", "", best_chunk))


def _classify_sentence(sentence: str) -> str:
    sentence_lower = (sentence or "").lower()
    patterns = {
        "contrastive": r"\b(unlike|contrary to|in contrast to|however|but|although|whereas|while)\b",
        "methodological": r"\b(using|using the|following|based on|as described in|we use|we adopt|we follow)\b",
        "dataset": r"\b(dataset|corpus|benchmark|collection|we use the)\b",
        "supporting": r"\b(show|shows|demonstrate|found|find|report|suggest|indicate|confirm)\b",
        "background": r"\b(has been|have been|is known|are known|it is|are widely)\b",
    }
    for citation_type, pattern in patterns.items():
        if re.search(pattern, sentence_lower):
            return citation_type
    return "supporting"


def _parse_reference_map(root) -> Dict[str, Dict[str, Any]]:
    ref_map: Dict[str, Dict[str, Any]] = {}
    for bibl in root.findall(".//tei:biblStruct", TEI_NS):
        ref_id = bibl.get("{http://www.w3.org/XML/1998/namespace}id")
        if not ref_id:
            continue
        title_el = bibl.find(".//tei:title", TEI_NS)
        doi_el = bibl.find('.//tei:idno[@type="DOI"]', TEI_NS)
        date_el = bibl.find('.//tei:date[@type="published"]', TEI_NS)
        author_nodes = bibl.findall(".//tei:author", TEI_NS)
        authors: List[str] = []
        for author_node in author_nodes:
            forename = author_node.find(".//tei:forename", TEI_NS)
            surname = author_node.find(".//tei:surname", TEI_NS)
            parts = [node.text for node in [forename, surname] if node is not None and node.text]
            author_name = _normalize_text(" ".join(parts))
            if author_name:
                authors.append(author_name)

        raw_text = _normalize_text(" ".join(bibl.itertext()))
        year = _first_year(date_el.get("when") if date_el is not None else None)

        ref_map[ref_id] = {
            "doi": normalize_doi(doi_el.text if doi_el is not None and doi_el.text else None),
            "title": _normalize_text(title_el.text) if title_el is not None and title_el.text else _extract_reference_title(raw_text, year),
            "year": year,
            "authors": authors,
            "referenceText": raw_text,
        }
    return ref_map


def _parse_tei_citation_instances(root) -> List[Dict[str, Any]]:
    ref_map = _parse_reference_map(root)
    instances: List[Dict[str, Any]] = []

    for sentence in root.findall(".//tei:s", TEI_NS):
        sentence_text = _normalize_text(" ".join(sentence.itertext()))
        ref_nodes = sentence.findall('.//tei:ref[@type="bibr"]', TEI_NS)
        if not ref_nodes:
            continue

        for ref_node in ref_nodes:
            target = (ref_node.get("target") or "").lstrip("#")
            ref_text = _normalize_text(" ".join(ref_node.itertext()))
            ref_data = ref_map.get(target, {})
            marker = _citation_marker_text(sentence_text, target, ref_text)
            instances.append(
                {
                    "sentence": sentence_text,
                    "claim": _extract_sentence_context(sentence_text, marker),
                    "citationMarker": marker,
                    "refId": target or None,
                    "refData": ref_data,
                    "citationType": _classify_sentence(sentence_text),
                }
            )

    return instances


def fetch_semantic_scholar_by_doi(doi: str) -> Optional[dict]:
    doi = normalize_doi(doi)
    if not doi:
        return None
    key = f"ss:doi:{doi}"
    cached = _get_cached(key)
    if cached:
        return cached
    headers = {"Accept": "application/json"}
    if SEMANTIC_SCHOLAR:
        headers["x-api-key"] = SEMANTIC_SCHOLAR
    url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}?fields=title,abstract,year,authors,externalIds,fieldsOfStudy,openAccessPdf"
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            _set_cached(key, data)
            return data
    except Exception:
        return None
    return None

def search_semantic_scholar_by_title(title: str) -> Optional[dict]:
    if not title:
        return None
    headers = {"Accept": "application/json"}
    if SEMANTIC_SCHOLAR:
        headers["x-api-key"] = SEMANTIC_SCHOLAR
    params = {"query": title, "limit": 1, "fields": "title,abstract,year,authors,externalIds"}
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    try:
        r = requests.get(url, headers=headers, params=params, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("data"):
                return data["data"][0]
    except Exception:
        return None
    return None


def fetch_papers_batch(ids: List[str], fields: str = "title,abstract,year,authors,externalIds") -> List[dict]:
    """Fetch multiple papers via Semantic Scholar batch endpoint (max 500 ids). Uses cache when possible."""
    if not ids:
        return []
    results: List[dict] = []
    to_query: List[str] = []
    for i in ids:
        key = f"ss:doi:{i}" if i.startswith("10.") or i.startswith("DOI:") else f"ss:id:{i}"
        cached = _get_cached(key)
        if cached:
            results.append(cached)
        else:
            to_query.append(i)

    if to_query:
        # Limit to 500 as per API
        chunk = to_query[:500]
        headers = {"Accept": "application/json"}
        if SEMANTIC_SCHOLAR:
            headers["x-api-key"] = SEMANTIC_SCHOLAR
        url = "https://api.semanticscholar.org/graph/v1/paper/batch"
        try:
            r = requests.post(url, headers=headers, params={"fields": fields}, json={"ids": chunk}, timeout=15)
            if r.status_code == 200:
                data = r.json()
                for entry in data:
                    # cache by paperId and any external DOI
                    pid = entry.get("paperId")
                    if pid:
                        _set_cached(f"ss:id:{pid}", entry)
                    ext = entry.get("externalIds", {}) or {}
                    doi = ext.get("DOI") or ext.get("ArXiv")
                    if doi:
                        _set_cached(f"ss:doi:{doi}", entry)
                results.extend(data)
        except Exception:
            # swallow for hackathon
            pass

    return results

def fetch_crossref_metadata(doi: str) -> Optional[dict]:
    doi = normalize_doi(doi)
    if not doi:
        return None
    url = f"https://api.crossref.org/works/{doi}"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json().get("message")
    except Exception:
        return None
    return None

def fetch_openalex_by_doi(doi: str) -> Optional[dict]:
    doi = normalize_doi(doi)
    if not doi:
        return None
    url = f"https://api.openalex.org/works/https://doi.org/{doi}"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json()
    except Exception:
        return None
    return None

def find_unpaywall(doi: str) -> Optional[str]:
    doi = normalize_doi(doi)
    if not doi:
        return None
    url = f"https://api.unpaywall.org/v2/{doi}?email=anon@example.com"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            data = r.json()
            return data.get("best_oa_location", {}).get("url")
    except Exception:
        return None
    return None


def parse_pdf_text(pdf_bytes: bytes) -> dict:
    """Parse PDF text using PyMuPDF and return extracted sections."""
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        page_texts: List[str] = []
        for page in doc:
            page_texts.append(page.get_text("text") or "")

        text = "\n".join(page_texts).strip()
        metadata = doc.metadata or {}

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    title = metadata.get("title") or (lines[0] if lines else "Untitled Paper")
    authors = _parse_authors_from_text(lines, title, metadata)

    # Find abstract section heuristically.
    abstract = ""
    abstract_match = re.search(
        r"\babstract\b\s*[:\-]?\s*(.{80,2000}?)(?:\n\s*\n|\bintroduction\b|\bkeywords\b)",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if abstract_match:
        abstract = re.sub(r"\s+", " ", abstract_match.group(1)).strip()
    elif lines:
        abstract = " ".join(lines[1:6])[:1200]

    return {
        "title": title,
        "fullText": text,
        "abstractText": abstract,
        "authors": authors,
    }


def _parse_authors_from_text(lines: List[str], title: str, metadata: dict) -> List[str]:
    """Best-effort author extraction from PDF metadata and first-page layout."""
    author_candidates: List[str] = []

    metadata_author = (metadata or {}).get("author") or (metadata or {}).get("authors")
    if isinstance(metadata_author, str) and metadata_author.strip():
        for part in re.split(r",|;|\band\b|\n", metadata_author, flags=re.IGNORECASE):
            cleaned = part.strip()
            if cleaned and len(cleaned) > 2:
                author_candidates.append(cleaned)

    title_index = 0
    for idx, line in enumerate(lines[:20]):
        if title and title.lower() in line.lower():
            title_index = idx
            break

    for line in lines[title_index + 1 : title_index + 12]:
        normalized = line.strip()
        if not normalized:
            continue
        if re.search(r"\babstract\b|\bkeywords\b|\bintroduction\b", normalized, flags=re.IGNORECASE):
            break
        if len(normalized) > 120:
            continue
        if re.search(r"@|\d{4}|\b(university|department|school|institute|laboratory|centre|center|corresponding author)\b", normalized, flags=re.IGNORECASE):
            continue
        if re.search(r"\b[A-Z][a-z]+\b\s*,\s*\b[A-Z][a-z]+\b", normalized):
            author_candidates.extend([p.strip() for p in normalized.split(",") if p.strip()])
            continue
        if re.search(r"\band\b|,", normalized, flags=re.IGNORECASE) and re.search(r"\b[A-Z][a-z]+\b", normalized):
            author_candidates.extend([p.strip() for p in re.split(r",|\band\b", normalized, flags=re.IGNORECASE) if p.strip()])
            continue
        if re.fullmatch(r"(?:[A-Z][A-Za-z'\-]+\s+){1,3}[A-Z][A-Za-z'\-]+", normalized):
            author_candidates.append(normalized)

    cleaned_authors: List[str] = []
    for candidate in author_candidates:
        cleaned = re.sub(r"\s+", " ", candidate).strip(" ,;:\t")
        if cleaned and cleaned not in cleaned_authors:
            cleaned_authors.append(cleaned)

    return cleaned_authors[:12]


def extract_citations_with_grobid(pdf_bytes: bytes, limit: int = 60) -> List[dict]:
    """Extract bibliography entries from GROBID TEI output. Returns empty list on failure."""
    data = {"consolidateCitations": "1", "includeRawCitations": "1"}

    try:
        tei_xml = _post_grobid_pdf(pdf_bytes, data)
        if not tei_xml:
            return []

        root = _load_tei(tei_xml)
        bibl_items = root.findall(".//tei:biblStruct", TEI_NS)
        citations: List[dict] = []

        for i, item in enumerate(bibl_items[:limit]):
            title_node = item.find(".//tei:title", TEI_NS)
            date_node = item.find('.//tei:date[@type="published"]', TEI_NS)
            year = None
            if date_node is not None and date_node.get("when"):
                year = _first_year(date_node.get("when"))

            doi_node = item.find('.//tei:idno[@type="DOI"]', TEI_NS)
            doi = doi_node.text.strip() if doi_node is not None and doi_node.text else None

            authors: List[str] = []
            for author_node in item.findall(".//tei:author", TEI_NS):
                name_parts = []
                forename = author_node.find(".//tei:forename", TEI_NS)
                surname = author_node.find(".//tei:surname", TEI_NS)
                if forename:
                    name_parts.append(_normalize_text(forename.text or ""))
                if surname:
                    name_parts.append(_normalize_text(surname.text or ""))
                author_name = " ".join(name_parts).strip()
                if author_name:
                    authors.append(author_name)

            raw_text = _normalize_text(" ".join(item.itertext()))
            title = _normalize_text(title_node.text) if title_node is not None and title_node.text else raw_text[:200]
            citations.append(
                {
                    "id": f"grobid-{i + 1}",
                    "text": title or raw_text[:200],
                    "title": title or None,
                    "year": year,
                    "authors": ", ".join(_unique(authors)) if authors else None,
                    "doi": doi,
                    "referenceText": raw_text,
                }
            )

        return citations
    except Exception:
        return []


def extract_grobid_citation_instances(pdf_bytes: bytes, limit: int = 120) -> List[dict]:
    """Extract sentence-level citation instances from GROBID TEI output."""
    data = {"consolidateCitations": "1", "includeRawCitations": "1", "segmentSentences": "1"}

    try:
        tei_xml = _post_grobid_pdf(pdf_bytes, data)
        if not tei_xml:
            return []

        root = _load_tei(tei_xml)
        return _parse_tei_citation_instances(root)[:limit]
    except Exception:
        return []


def extract_reference_entries_regex(full_text: str, limit: int = 200) -> List[Dict[str, Any]]:
    if not full_text:
        return []

    refs_match = re.search(r"\breferences\b(.*)$", full_text, flags=re.IGNORECASE | re.DOTALL)
    references_section = refs_match.group(1) if refs_match else full_text[-20000:]
    lines = [line.strip() for line in references_section.splitlines() if line.strip()]
    if not lines:
        return []

    start_pattern = re.compile(r"^(?:\[?\d+\]?\s*|\d+[\.)]\s*)?(?:[A-Z][A-Za-z'\-]+|[A-Z][A-Za-z'\-]+,)")
    year_pattern = re.compile(r"(19|20)\d{2}[a-z]?")
    doi_pattern = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.IGNORECASE)

    merged_lines: List[str] = []
    current = ""
    for line in lines:
        is_new = bool(start_pattern.search(line) and year_pattern.search(line[:160]))
        if current and is_new:
            merged_lines.append(current)
            current = line
        else:
            current = f"{current} {line}".strip() if current else line
    if current:
        merged_lines.append(current)

    references: List[Dict[str, Any]] = []
    for raw_line in merged_lines[:limit]:
        year_match = year_pattern.search(raw_line)
        if not year_match:
            continue
        year = _first_year(year_match.group(0))
        doi_match = doi_pattern.search(raw_line)
        title = _extract_reference_title(raw_line, year)
        references.append(
            {
                "id": f"ref-{len(references) + 1}",
                "text": title or _normalize_text(raw_line[:300]),
                "title": title,
                "authors": _extract_reference_authors(raw_line),
                "year": year,
                "doi": normalize_doi(doi_match.group(0)) if doi_match else None,
                "referenceText": _normalize_text(raw_line),
            }
        )

    return references


def build_reference_lookup(references: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    lookup: Dict[str, Dict[str, Any]] = {}
    for reference in references:
        year = reference.get("year")
        author_blob = reference.get("authors") or reference.get("referenceText") or ""
        candidates = re.split(r",|;|\band\b|&", author_blob, flags=re.IGNORECASE)
        for candidate in candidates[:4]:
            key = _reference_lookup_key(_surname_stub(candidate), year)
            if key and key not in lookup:
                lookup[key] = reference
    return lookup


def extract_citation_instances_regex(full_text: str, limit: int = 120) -> List[Dict[str, Any]]:
    if not full_text:
        return []

    references = extract_reference_entries_regex(full_text, limit=400)
    reference_lookup = build_reference_lookup(references)
    body = re.split(r"\breferences\b", full_text, maxsplit=1, flags=re.IGNORECASE)[0]
    sentences = split_sentences(body)
    instances: List[Dict[str, Any]] = []

    narrative_pattern = re.compile(r"\b([A-Z][A-Za-z'\-]+(?:\s+et\s+al\.|\s+and\s+[A-Z][A-Za-z'\-]+)?)\s*\(((?:19|20)\d{2}[a-z]?)\)")
    parenthetical_pattern = re.compile(r"\(([^()]*?(?:19|20)\d{2}[a-z]?[^()]*)\)")

    def add_instance(sentence: str, marker: str, author_text: Optional[str], year: Optional[int]):
        key = _reference_lookup_key(_surname_stub(author_text or marker), year)
        ref_data = dict(reference_lookup.get(key) or {}) if key else {}
        if author_text and not ref_data.get("authors"):
            ref_data["authors"] = author_text
        if year and not ref_data.get("year"):
            ref_data["year"] = year
        if marker and not ref_data.get("referenceText"):
            ref_data["referenceText"] = marker

        normalized_sentence = _normalize_text(sentence)
        claim = _normalize_text(re.sub(r"\([^\)]*(?:19|20)\d{2}[^\)]*\)", "", normalized_sentence)) or normalized_sentence

        instances.append(
            {
                "sentence": normalized_sentence,
                "claim": claim,
                "citationMarker": marker,
                "refId": ref_data.get("id"),
                "refData": ref_data,
                "citationType": _classify_sentence(normalized_sentence),
                "year": year,
                "title": ref_data.get("title") or ref_data.get("text"),
                "doi": ref_data.get("doi"),
            }
        )

    for sentence in sentences:
        if len(instances) >= limit:
            break

        for match in narrative_pattern.finditer(sentence):
            add_instance(sentence, match.group(0), match.group(1), _first_year(match.group(2)))
            if len(instances) >= limit:
                return instances

        for match in parenthetical_pattern.finditer(sentence):
            parts = [part.strip() for part in match.group(1).split(";") if part.strip()]
            for part in parts:
                year_match = re.search(r"(19|20)\d{2}", part)
                if not year_match:
                    continue
                add_instance(sentence, part, part[: year_match.start()].strip(" ,") or None, _first_year(year_match.group(0)))
                if len(instances) >= limit:
                    return instances

    return instances


def extract_citations_regex(full_text: str, limit: int = 60) -> List[dict]:
    """Fallback citation extraction from in-text author-year patterns and references-style lines."""
    if not full_text:
        return []

    citations: List[dict] = []
    doi_pattern = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.IGNORECASE)
    reference_entries = extract_reference_entries_regex(full_text, limit=max(limit * 3, 100))
    reference_lookup = build_reference_lookup(reference_entries)

    def append_or_enrich(entry: Dict[str, Any]):
        entry_key = (_surname_stub(entry.get("authors") or entry.get("text") or ""), entry.get("year"))
        for existing in citations:
            existing_key = (_surname_stub(existing.get("authors") or existing.get("text") or ""), existing.get("year"))
            if entry_key == existing_key and entry_key[0] and entry_key[1]:
                existing_quality = len(existing.get("text") or "") + (25 if existing.get("doi") else 0)
                entry_quality = len(entry.get("text") or "") + (25 if entry.get("doi") else 0)
                if entry_quality > existing_quality:
                    existing.update({k: v for k, v in entry.items() if v not in (None, "")})
                else:
                    for field in ["doi", "authors", "year", "title", "referenceText"]:
                        if not existing.get(field) and entry.get(field):
                            existing[field] = entry.get(field)
                return
        citations.append(entry)

    # In-text citations such as "Smith et al. (2020)", "Smith and Jones (2020)", or "(Smith, 2020)"
    in_text_patterns = [
        re.compile(r"\b([A-Z][A-Za-z'\-]+(?:\s+et\s+al\.|\s+and\s+[A-Z][A-Za-z'\-]+)?)\s*\(((?:19|20)\d{2})\)"),
        re.compile(r"\(([^()]{2,120}?)\s*,\s*((?:19|20)\d{2}(?:\s*;\s*(?:19|20)\d{2})*)\)"),
    ]

    for pattern in in_text_patterns:
        for match in pattern.finditer(full_text):
            raw = match.group(0)
            authors = match.group(1).strip() if match.lastindex and match.lastindex >= 1 else None
            year_group = match.group(2) if match.lastindex and match.lastindex >= 2 else None
            year_match = re.search(r"(?:19|20)\d{2}", year_group or raw)
            year = int(year_match.group(0)) if year_match else None
            doi_match = doi_pattern.search(raw)
            ref_key = _reference_lookup_key(_surname_stub(authors or raw), year)
            ref_match = reference_lookup.get(ref_key) if ref_key else None
            append_or_enrich(
                {
                    "id": f"regex-{len(citations) + 1}",
                    "text": (ref_match or {}).get("title") or (ref_match or {}).get("referenceText") or raw[:300],
                    "authors": (ref_match or {}).get("authors") or authors,
                    "year": (ref_match or {}).get("year") or year,
                    "doi": (ref_match or {}).get("doi") or (doi_match.group(0) if doi_match else None),
                    "title": (ref_match or {}).get("title"),
                    "referenceText": (ref_match or {}).get("referenceText") or raw[:300],
                }
            )
            if len(citations) >= limit:
                return citations

    for reference in reference_entries:
        append_or_enrich(
            {
                "id": f"regex-{len(citations) + 1}",
                "text": reference.get("title") or reference.get("referenceText") or reference.get("text"),
                "authors": reference.get("authors"),
                "year": reference.get("year"),
                "doi": reference.get("doi"),
                "title": reference.get("title"),
                "referenceText": reference.get("referenceText") or reference.get("text"),
            }
        )
        if len(citations) >= limit:
            break

    return citations


def parse_pdf_with_citations(pdf_bytes: bytes) -> dict:
    """Parse PDF with PyMuPDF and extract citations via GROBID, then regex fallback."""
    parsed = parse_pdf_text(pdf_bytes)
    citations = extract_citations_with_grobid(pdf_bytes)
    source = "grobid"
    citation_instances = extract_grobid_citation_instances(pdf_bytes)
    if not citations:
        citations = extract_citations_regex(parsed.get("fullText", ""))
        source = "regex"

    if not citation_instances:
        citation_instances = extract_citation_instances_regex(parsed.get("fullText", ""))

    if source == "grobid":
        regex_citations = extract_citations_regex(parsed.get("fullText", ""))
        if regex_citations:
            merged: List[dict] = []
            seen = set()
            for citation in citations + regex_citations:
                key = (_surname_stub(citation.get("authors") or citation.get("text") or ""), citation.get("year"))
                if key[0] and key[1] and key in seen:
                    continue
                if key[0] and key[1]:
                    seen.add(key)
                merged.append(citation)
            citations = merged

    parsed["citations"] = citations
    parsed["citationInstances"] = citation_instances
    parsed["citationDetectedCount"] = len(citation_instances) if citation_instances else len(citations)
    parsed["citationReferenceCount"] = len(citations)
    parsed["citationSource"] = source
    parsed["methodologies"] = []
    parsed["coauthorPatterns"] = []
    parsed["fieldHistory"] = []
    return parsed


def extract_section(full_text: str, section_keywords: List[str], next_keywords: Optional[List[str]] = None) -> str:
    """Extract a rough section by heading keywords."""
    if not full_text:
        return ""

    next_keywords = next_keywords or ["results", "discussion", "conclusion", "references", "acknowledgment"]
    lines = [line.strip() for line in full_text.splitlines()]
    joined = []
    start_idx = None
    for idx, line in enumerate(lines):
        if any(re.fullmatch(rf"\s*{kw}\s*[:.-]?\s*", line, flags=re.IGNORECASE) or re.search(rf"\b{kw}\b", line, flags=re.IGNORECASE) for kw in section_keywords):
            start_idx = idx + 1
            break
    if start_idx is None:
        return ""

    for line in lines[start_idx:]:
        if any(re.fullmatch(rf"\s*{kw}\s*[:.-]?\s*", line, flags=re.IGNORECASE) or re.search(rf"\b{kw}\b", line, flags=re.IGNORECASE) for kw in next_keywords):
            break
        joined.append(line)

    return "\n".join(joined).strip()


def split_sentences(text: str) -> List[str]:
    if not text:
        return []
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def extract_numeric_claims(full_text: str, max_items: int = 40) -> List[dict]:
    """Extract numeric claims with local sentence context."""
    sentences = split_sentences(full_text)
    claims: List[dict] = []
    patterns = [
        re.compile(r"\b\d+(?:\.\d+)?\s*(?:%|percent|per\s*100,000|x|times|fold|\bpp\b|\bpts?\b)\b", re.IGNORECASE),
        re.compile(r"\bN\s*=\s*\d+\b", re.IGNORECASE),
        re.compile(r"\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b"),
        re.compile(r"\b\d+(?:\.\d+)?\b"),
    ]

    for idx, sentence in enumerate(sentences):
        if any(p.search(sentence) for p in patterns):
            context = " ".join(sentences[max(0, idx - 1) : min(len(sentences), idx + 2)])
            claims.append({"sentence": sentence, "context": context})
            if len(claims) >= max_items:
                break
    return claims


async def _fetch_pdf_text(pdf_url: str) -> Optional[str]:
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        try:
            response = await client.get(pdf_url)
            if response.status_code != 200 or "pdf" not in response.headers.get("content-type", "").lower():
                return None
            with fitz.open(stream=response.content, filetype="pdf") as doc:
                text = "\n".join(page.get_text("text") or "" for page in doc).strip()
            return text[:50000] if text else None
        except Exception:
            return None


async def _try_semantic_scholar(doi: str, title: Optional[str] = None) -> Optional[dict]:
    doi = normalize_doi(doi)
    if not doi and not title:
        return None
    params = {"fields": "abstract,title,year,authors,openAccessPdf,tldr,fieldsOfStudy"}
    headers = {"Accept": "application/json"}
    if SEMANTIC_SCHOLAR:
        headers["x-api-key"] = SEMANTIC_SCHOLAR
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            if doi:
                url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}"
                for attempt in range(3):
                    response = await client.get(url, params=params, headers=headers)
                    if response.status_code == 429:
                        await asyncio.sleep(int(response.headers.get("Retry-After", str(2**attempt))))
                        continue
                    if response.status_code != 200:
                        return None
                    data = response.json()
                    full_text = None
                    oa_pdf = (data.get("openAccessPdf") or {}).get("url")
                    if oa_pdf:
                        full_text = await _fetch_pdf_text(oa_pdf)
                    return {
                        "abstract": data.get("abstract"),
                        "full_text": full_text,
                        "title": data.get("title"),
                        "source": "semantic_scholar",
                        "metadata": data,
                    }
                return None

            response = await client.get(
                "https://api.semanticscholar.org/graph/v1/paper/search",
                params={"query": title, "limit": 1, **params},
                headers=headers,
            )
            if response.status_code != 200:
                return None
            data = response.json().get("data") or []
            if not data:
                return None
            paper = data[0]
            full_text = None
            oa_pdf = (paper.get("openAccessPdf") or {}).get("url")
            if oa_pdf:
                full_text = await _fetch_pdf_text(oa_pdf)
            return {
                "abstract": paper.get("abstract"),
                "full_text": full_text,
                "title": paper.get("title"),
                "source": "semantic_scholar",
                "metadata": paper,
            }
        except Exception:
            return None


async def _try_openalex(doi: str) -> Optional[dict]:
    doi = normalize_doi(doi)
    if not doi:
        return None
    url = f"https://api.openalex.org/works/https://doi.org/{doi}"
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            response = await client.get(url)
            if response.status_code != 200:
                return None
            data = response.json()
            best_location = data.get("best_oa_location") or {}
            full_text = None
            pdf_url = best_location.get("pdf_url") or best_location.get("url_for_pdf")
            if pdf_url:
                full_text = await _fetch_pdf_text(pdf_url)
            return {
                "abstract": _openalex_abstract_to_text(data.get("abstract_inverted_index")),
                "full_text": full_text,
                "title": data.get("title"),
                "source": "openalex",
                "metadata": data,
            }
        except Exception:
            return None


async def _try_unpaywall(doi: str) -> Optional[dict]:
    doi = normalize_doi(doi)
    if not doi:
        return None
    email = os.getenv("UNPAYWALL_EMAIL", "anon@example.com")
    url = f"https://api.unpaywall.org/v2/{doi}"
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            response = await client.get(url, params={"email": email})
            if response.status_code != 200:
                return None
            data = response.json()
            oa_location = data.get("best_oa_location") or {}
            pdf_url = oa_location.get("url_for_pdf") or oa_location.get("url")
            full_text = await _fetch_pdf_text(pdf_url) if pdf_url else None
            return {
                "abstract": data.get("abstract"),
                "full_text": full_text,
                "title": data.get("title"),
                "source": "unpaywall",
                "metadata": data,
            }
        except Exception:
            return None


async def _try_crossref(doi: str) -> Optional[dict]:
    doi = normalize_doi(doi)
    if not doi:
        return None
    url = f"https://api.crossref.org/works/{doi}"
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            response = await client.get(url)
            if response.status_code != 200:
                return None
            data = response.json().get("message") or {}
            title = data.get("title")
            if isinstance(title, list):
                title = title[0] if title else None
            abstract = data.get("abstract")
            return {
                "abstract": abstract,
                "full_text": None,
                "title": title,
                "source": "crossref",
                "metadata": data,
            }
        except Exception:
            return None


async def resolve_reference_metadata(reference_text: str, year: Optional[int] = None, authors: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if not reference_text:
        return None

    params: Dict[str, Any] = {
        "query.bibliographic": reference_text[:512],
        "rows": 5,
        "select": "DOI,title,published,published-print,published-online,created,issued,author",
    }
    headers = {"User-Agent": "PaperTrace/1.0 (mailto:anon@example.com)"}
    author_stub = _surname_stub(authors or reference_text)

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            response = await client.get("https://api.crossref.org/works", params=params, headers=headers)
            if response.status_code != 200:
                return None

            items = (response.json().get("message") or {}).get("items") or []
            best_item = None
            best_score = float("-inf")
            for item in items:
                score = 0.0
                item_year = None
                for key in ["published-print", "published-online", "published", "created", "issued"]:
                    node = item.get(key) or {}
                    parts = node.get("date-parts") or []
                    if parts and parts[0]:
                        item_year = parts[0][0]
                        break

                if year and item_year == year:
                    score += 2.0
                elif year and item_year:
                    score -= min(1.5, abs(item_year - year) * 0.25)

                item_authors = item.get("author") or []
                item_surnames = {str(author.get("family") or "").lower() for author in item_authors if author.get("family")}
                if author_stub and author_stub in item_surnames:
                    score += 1.5

                item_title = item.get("title") or []
                item_title = item_title[0] if isinstance(item_title, list) and item_title else (item_title if isinstance(item_title, str) else None)
                if item_title and item_title.lower() in reference_text.lower():
                    score += 2.5

                if score > best_score:
                    best_score = score
                    best_item = item

            if not best_item:
                return None

            best_title = best_item.get("title") or []
            best_title = best_title[0] if isinstance(best_title, list) and best_title else (best_title if isinstance(best_title, str) else None)
            best_year = None
            for key in ["published-print", "published-online", "published", "created", "issued"]:
                node = best_item.get(key) or {}
                parts = node.get("date-parts") or []
                if parts and parts[0]:
                    best_year = parts[0][0]
                    break

            if best_score < 1.5:
                return None

            if year and best_year and abs(best_year - year) > 1:
                return {
                    "doi": None,
                    "title": best_title if best_title and best_title.lower() in reference_text.lower() else None,
                    "year": year,
                }

            return {
                "doi": normalize_doi(best_item.get("DOI")),
                "title": best_title,
                "year": best_year,
            }
        except Exception:
            return None


async def _try_arxiv(doi: str, title: Optional[str] = None) -> Optional[dict]:
    candidate = (doi or title or "").lower()
    if "arxiv" not in candidate:
        return None
    return await _try_semantic_scholar(doi, title)


async def retrieve_cited_paper(doi: str, title: str | None = None) -> dict:
    doi = normalize_doi(doi)
    result = await _try_semantic_scholar(doi, title)
    if result:
        return result
    result = await _try_openalex(doi)
    if result:
        return result
    result = await _try_unpaywall(doi)
    if result:
        return result
    result = await _try_crossref(doi)
    if result:
        return result
    result = await _try_arxiv(doi, title)
    if result:
        return result
    return {"abstract": None, "full_text": None, "title": title, "source": "not_found", "metadata": {}}


def extract_relevant_sections(full_text: str) -> str:
    if not full_text:
        return ""
    sections = {
        "abstract": r"(?i)\babstract\b",
        "results": r"(?i)\b(results|findings|experiments?|evaluation)\b",
        "conclusion": r"(?i)\b(conclusion|summary|discussion)\b",
    }
    extracted: List[str] = []
    lower_text = full_text.lower()
    for pattern in sections.values():
        for match in re.finditer(pattern, lower_text):
            start = match.start()
            extracted.append(full_text[start : start + 2000])
    return "\n\n".join(extracted) if extracted else full_text[:4000]


def compute_keyword_overlap(claim: str, source: str) -> float:
    stopwords = {
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "we",
        "our",
        "this",
        "that",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "and",
        "or",
        "with",
        "as",
        "by",
        "from",
        "using",
    }

    def tokenize(text: str) -> set[str]:
        tokens = re.sub(r"[^a-z0-9\s]", " ", (text or "").lower()).split()
        return {token for token in tokens if token not in stopwords and len(token) > 3}

    claim_tokens = tokenize(claim)
    source_tokens = tokenize(source)
    if not claim_tokens:
        return 0.5
    return len(claim_tokens & source_tokens) / len(claim_tokens)


def compute_numeric_consistency(claim: str, source: str) -> float:
    number_pattern = r"\b\d+\.?\d*\b"
    claim_numbers = {
        match
        for match in re.findall(number_pattern, claim or "")
        if not (1900 <= float(match) <= 2030) and float(match) > 1
    }
    if not claim_numbers:
        return 0.7
    source_numbers = set(re.findall(number_pattern, source or ""))
    return len(claim_numbers & source_numbers) / len(claim_numbers)


def _interpret_score(composite: float, semantic: float, numeric: float) -> str:
    if numeric < 0.3 and semantic >= 0.3:
        return "mismatch"
    if composite >= 0.6:
        return "verified"
    if composite >= 0.35:
        return "partial"
    if composite >= 0.15:
        return "mismatch"
    return "unverifiable"


def _interpret_contrastive(composite: float, semantic: float) -> str:
    if composite <= 0.25 or semantic <= 0.25:
        return "verified"
    if composite <= 0.45:
        return "partial"
    return "mismatch"


def compute_confidence(source_content: str) -> str:
    if len(source_content or "") > 5000:
        return "high"
    if len(source_content or "") > 500:
        return "medium"
    return "low"


async def _compare_citation_instance(instance: Dict[str, Any]) -> Dict[str, Any]:
    ref_data = instance.get("refData") or {}
    doi = normalize_doi(ref_data.get("doi") or instance.get("doi"))
    title = ref_data.get("title") or instance.get("title")
    citation_type = instance.get("citationType") or _classify_sentence(instance.get("sentence", ""))
    claim = instance.get("claim") or _extract_sentence_context(instance.get("sentence", ""), instance.get("citationMarker", ""))
    cited_year = ref_data.get("year") or instance.get("year")
    reference_text = ref_data.get("referenceText") or ref_data.get("text")
    reference_authors = ref_data.get("authors")

    if (not doi or not title) and reference_text:
        resolved_reference = await resolve_reference_metadata(reference_text, cited_year, reference_authors)
        if resolved_reference:
            doi = doi or resolved_reference.get("doi")
            title = title or resolved_reference.get("title")
            cited_year = cited_year or resolved_reference.get("year")

    source = await retrieve_cited_paper(doi, title)
    source_text = source.get("full_text") or source.get("abstract") or ""
    if not source_text and not doi and title:
        doi = await resolve_doi_from_title(title, cited_year, reference_authors)
        if doi:
            source = await retrieve_cited_paper(doi, title)
            source_text = source.get("full_text") or source.get("abstract") or ""

    if not source_text:
        return {
            "claim": claim,
            "citationType": citation_type,
            "citedDoi": doi or None,
            "citedTitle": title,
            "citedYear": cited_year,
            "sourceUsed": source.get("source", "not_found"),
            "compositeScore": 0,
            "semanticScore": 0,
            "keywordScore": 0,
            "numericScore": 0,
            "verdict": "unverifiable",
            "confidence": "low",
            "bestMatchingPassage": "",
            "sentence": instance.get("sentence", ""),
            "citationMarker": instance.get("citationMarker", ""),
            "sourceSnippet": "",
            "sourceAbstract": source.get("abstract") or "",
        }

    comparison_text = extract_relevant_sections(source_text)
    if len(source_text) > 1000:
        comparison_text = chunk_and_retrieve(claim, source_text)

    from embeddings import embed_texts, cosine_similarity

    semantic_score = 0.0
    try:
        claim_embedding = embed_texts([claim])[0]
        source_embedding = embed_texts([comparison_text])[0]
        semantic_score = float(cosine_similarity(claim_embedding, source_embedding))
    except Exception:
        semantic_score = 0.0

    keyword_score = compute_keyword_overlap(claim, comparison_text)
    numeric_score = compute_numeric_consistency(claim, comparison_text)
    weights = {
        "supporting": {"semantic": 0.5, "keyword": 0.3, "numeric": 0.2},
        "methodological": {"semantic": 0.4, "keyword": 0.4, "numeric": 0.2},
        "background": {"semantic": 0.6, "keyword": 0.3, "numeric": 0.1},
        "dataset": {"semantic": 0.3, "keyword": 0.5, "numeric": 0.2},
        "contrastive": {"semantic": 0.3, "keyword": 0.4, "numeric": 0.3},
    }.get(citation_type, {"semantic": 0.5, "keyword": 0.3, "numeric": 0.2})

    composite = semantic_score * weights["semantic"] + keyword_score * weights["keyword"] + numeric_score * weights["numeric"]
    if citation_type == "contrastive":
        verdict = _interpret_contrastive(composite, semantic_score)
    else:
        verdict = _interpret_score(composite, semantic_score, numeric_score)

    return {
        "claim": claim,
        "citationType": citation_type,
        "citedDoi": doi or None,
        "citedTitle": title,
        "citedYear": cited_year,
        "sourceUsed": source.get("source", "not_found"),
        "compositeScore": round(composite, 3),
        "semanticScore": round(semantic_score, 3),
        "keywordScore": round(keyword_score, 3),
        "numericScore": round(numeric_score, 3),
        "verdict": verdict,
        "confidence": compute_confidence(source_text),
        "bestMatchingPassage": comparison_text[:1200],
        "sentence": instance.get("sentence", ""),
        "citationMarker": instance.get("citationMarker", ""),
        "sourceSnippet": comparison_text[:1200],
        "sourceAbstract": source.get("abstract") or "",
    }


def _score_citation_summary(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(results)
    verified = sum(1 for result in results if result.get("verdict") == "verified")
    partial = sum(1 for result in results if result.get("verdict") == "partial")
    mismatch = sum(1 for result in results if result.get("verdict") == "mismatch")
    unverifiable = sum(1 for result in results if result.get("verdict") == "unverifiable")
    verifiable = total - unverifiable

    if verifiable <= 0:
        return {
            "score": None,
            "grade": "N/A",
            "reason": "insufficient_data",
            "totalCitations": total,
            "verifiableCitations": verifiable,
            "verifiedCitations": verified,
            "partialCitations": partial,
            "mismatchCitations": mismatch,
            "unverifiableCitations": unverifiable,
            "coverage": 0,
        }

    confidence_multiplier = {"high": 1.0, "medium": 0.85, "low": 0.65}
    verdict_weights = {"verified": 1.0, "partial": 0.5, "mismatch": 0.0, "unverifiable": 0.0}
    weighted_scores = []
    for result in results:
        verdict = result.get("verdict")
        if verdict == "unverifiable":
            continue
        base = verdict_weights.get(verdict, 0.0)
        conf = confidence_multiplier.get(result.get("confidence", "low"), 0.65)
        weighted_scores.append(base * conf)

    raw_score = sum(weighted_scores) / max(len(weighted_scores), 1)
    mismatch_penalty = min(0.3, mismatch * 0.08)
    final_score = max(0, raw_score - mismatch_penalty)

    if final_score >= 0.85:
        grade = "A"
    elif final_score >= 0.70:
        grade = "B"
    elif final_score >= 0.55:
        grade = "C"
    elif final_score >= 0.40:
        grade = "D"
    else:
        grade = "F"

    return {
        "score": round(final_score, 3),
        "grade": grade,
        "totalCitations": total,
        "verifiableCitations": verifiable,
        "verifiedCitations": verified,
        "partialCitations": partial,
        "mismatchCitations": mismatch,
        "unverifiableCitations": unverifiable,
        "coverage": round(verifiable / total, 2) if total else 0,
    }


def chunk_and_retrieve(claim: str, full_text: str, chunk_size: int = 400) -> str:
    words = (full_text or "").split()
    if not words:
        return full_text or ""
    step = max(1, chunk_size // 2)
    chunks: List[str] = []
    for start in range(0, len(words), step):
        chunk = " ".join(words[start : start + chunk_size])
        if len(chunk.split()) > 50:
            chunks.append(chunk)
    if not chunks:
        return full_text

    from embeddings import embed_texts, cosine_similarity

    try:
        claim_embedding = embed_texts([claim])[0]
        chunk_embeddings = embed_texts(chunks)
        similarities = [float(cosine_similarity(claim_embedding, chunk_embedding)) for chunk_embedding in chunk_embeddings]
        if not similarities:
            return full_text[:4000]
        top_indices = sorted(range(len(similarities)), key=lambda index: similarities[index], reverse=True)[:3]
        return "\n\n".join(chunks[index] for index in top_indices)
    except Exception:
        return full_text[:4000]


async def run_citation_integrity_pipeline(
    full_text: str,
    citations: List[Dict[str, Any]],
    citation_instances: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    if citation_instances:
        instances = citation_instances
    else:
        instances = []
        for citation in citations:
            sentence = citation.get("text", "")
            instances.append(
                {
                    "sentence": sentence,
                    "claim": _extract_sentence_context(sentence, sentence),
                    "citationMarker": sentence,
                    "refId": citation.get("id"),
                    "refData": citation,
                    "citationType": _classify_sentence(sentence),
                    "year": citation.get("year"),
                    "title": citation.get("text"),
                    "doi": citation.get("doi"),
                }
            )

    semaphore = asyncio.Semaphore(int(os.getenv("PAPERTRACE_CITATION_CONCURRENCY", "2")))

    async def process_one(instance: Dict[str, Any]) -> Dict[str, Any]:
        async with semaphore:
            return await _compare_citation_instance(instance)

    raw_results = await asyncio.gather(*(process_one(instance) for instance in instances), return_exceptions=True)
    results: List[Dict[str, Any]] = []
    for item in raw_results:
        if isinstance(item, dict):
            results.append(item)

    summary = _score_citation_summary(results)
    summary["detectedCitations"] = len(instances)
    summary["citationResults"] = results
    return summary
