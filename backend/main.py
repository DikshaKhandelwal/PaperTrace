import uvicorn
from datetime import datetime
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from embeddings import embed_texts, cosine_similarity
import services
import re
import os
import requests

app = FastAPI(title="PaperTrace Backend")

# Allow CORS for hackathon / extension usage
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CitationIn(BaseModel):
    id: Optional[str]
    text: str
    doi: Optional[str] = None
    year: Optional[int] = None
    authors: Optional[str] = None
    abstract: Optional[str] = None


class CitationInstanceIn(BaseModel):
    sentence: str
    claim: Optional[str] = None
    citationMarker: Optional[str] = None
    refId: Optional[str] = None
    refData: Optional[Dict[str, Any]] = None
    citationType: Optional[str] = None
    year: Optional[int] = None
    title: Optional[str] = None
    doi: Optional[str] = None

class AnalyzeRequest(BaseModel):
    title: str
    authors: List[str]
    year: int
    abstractText: Optional[str] = ""
    fullText: Optional[str] = ""
    citations: Optional[List[CitationIn]] = []
    citationInstances: Optional[List[CitationInstanceIn]] = []


class ParsePdfUrlRequest(BaseModel):
    pdfUrl: str


CONTRASTIVE_CUES = ["unlike", "in contrast", "contrary", "whereas", "however", "instead of"]
NOVELTY_CUES = ["novel", "propose", "introduce", "first", "innovative", "outperform", "state-of-the-art"]
METHOD_CUES = ["method", "methods", "methodology", "approach", "procedure", "materials and methods", "experiment"]
RESULT_CUES = ["result", "results", "experiment", "evaluation", "findings", "performance"]
CONCLUSION_CUES = ["conclusion", "conclude", "overall", "therefore", "in summary"]


def _split_surnames(author_text: str) -> List[str]:
    if not author_text:
        return []
    parts = re.split(r",|;|\band\b", author_text, flags=re.IGNORECASE)
    surnames: List[str] = []
    for part in parts:
        token = part.strip().split()
        if not token:
            continue
        candidate = token[-1].strip(".(),")
        if candidate:
            surnames.append(candidate.lower())
    return surnames


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name or "").strip().lower()


def _paper_body_text(full_text: str) -> str:
    if not full_text:
        return ""
    body = re.split(r"\breferences\b", full_text, flags=re.IGNORECASE)[0]
    return body.strip()


def _find_section(full_text: str, keywords: List[str], next_keywords: Optional[List[str]] = None) -> str:
    return services.extract_section(full_text, keywords, next_keywords=next_keywords)


def _citation_contexts(full_text: str, citations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sentences = services.split_sentences(_paper_body_text(full_text))
    contexts: List[Dict[str, Any]] = []

    for citation in citations:
        terms: List[str] = []
        if citation.get("authors"):
            terms.extend(_split_surnames(str(citation.get("authors"))))
        if citation.get("year"):
            terms.append(str(citation.get("year")))
        if citation.get("text"):
            text_tokens = re.split(r"\s+", str(citation.get("text")).strip())[:8]
            terms.extend([t.strip(".,;:()[]").lower() for t in text_tokens if len(t) > 2])
        if citation.get("doi"):
            terms.append(str(citation.get("doi")).lower())

        matched_index = None
        for idx, sentence in enumerate(sentences):
            lowered = sentence.lower()
            if any(term and term in lowered for term in terms[:12]):
                matched_index = idx
                break

        if matched_index is None and sentences:
            matched_index = 0

        window_start = max(0, (matched_index or 0) - 1)
        window_end = min(len(sentences), (matched_index or 0) + 2)
        context = " ".join(sentences[window_start:window_end]).strip()
        contrastive = any(cue in context.lower() for cue in CONTRASTIVE_CUES)
        contexts.append({"context": context, "contrastive": contrastive, "matchedIndex": matched_index})

    return contexts


def _resolve_source_metadata(citations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    dois = [c.get("doi") for c in citations if c.get("doi")]
    batch_info = services.fetch_papers_batch(dois) if dois else []
    batch_map: Dict[str, Dict[str, Any]] = {}
    for paper in batch_info:
        ext = paper.get("externalIds") or {}
        doi = ext.get("DOI") or ext.get("ArXiv")
        if doi:
            batch_map[str(doi).lower()] = paper
        paper_id = paper.get("paperId")
        if paper_id:
            batch_map[str(paper_id).lower()] = paper

    resolved: List[Dict[str, Any]] = []
    for citation in citations:
        source = None
        citation_doi = str(citation.get("doi") or "").lower()
        if citation_doi and citation_doi in batch_map:
            source = batch_map[citation_doi]
        if not source and citation.get("text"):
            source = services.search_semantic_scholar_by_title(str(citation.get("text")))

        if not source and citation.get("doi"):
            source = services.fetch_semantic_scholar_by_doi(str(citation.get("doi")))

        resolved.append({
            "citation": citation,
            "source": source or {},
            "abstract": (source or {}).get("abstract") or "",
            "year": (source or {}).get("year") or citation.get("year"),
        })

    return resolved


def _field_threshold_adjustment(field_names: List[str]) -> float:
    field_blob = " ".join(field_names).lower()
    if any(token in field_blob for token in ["mathemat", "theory", "algebra", "physics"]):
        return -0.05
    if any(token in field_blob for token in ["medicine", "clinical", "biology", "psychology", "public health"]):
        return 0.05
    return 0.0


def _detect_paper_fields(paper_meta: Dict[str, Any]) -> List[str]:
    fields = paper_meta.get("fieldsOfStudy") if paper_meta else []
    if isinstance(fields, list):
        return [str(f) for f in fields if f]
    if isinstance(fields, str):
        return [fields]
    return []


def _extract_numeric_tokens(text: str) -> List[str]:
    if not text:
        return []
    tokens = re.findall(r"\b(?:\d+(?:\.\d+)?%?|N\s*=\s*\d+|\d{1,3}(?:,\d{3})+(?:\.\d+)?)\b", text, flags=re.IGNORECASE)
    cleaned = []
    for token in tokens:
        token = token.replace(" ", "")
        if token not in cleaned:
            cleaned.append(token)
    return cleaned


def _score_signal(score_pass: float, score_warn: float, pass_score: int, warn_score: int, fail_score: int) -> tuple[int, str]:
    if score_pass <= 0:
        return fail_score, "red"
    if score_pass >= 0.7:
        return pass_score, "green"
    if score_pass >= 0.35:
        return warn_score, "yellow"
    return fail_score, "red"


@app.post("/parse-pdf")
async def parse_pdf(file: UploadFile = File(...)):
    try:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Uploaded PDF is empty")

        parsed = services.parse_pdf_with_citations(data)
        return parsed
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {str(e)}")


@app.post("/parse-pdf-url")
async def parse_pdf_url(req: ParsePdfUrlRequest):
    try:
        pdf_url = (req.pdfUrl or "").strip()
        if not pdf_url:
            raise HTTPException(status_code=400, detail="A PDF URL is required")

        response = requests.get(
            pdf_url,
            timeout=90,
            headers={
                "User-Agent": "PaperTrace/1.0",
                "Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
            },
        )
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Failed to fetch PDF URL ({response.status_code})")

        data = response.content
        if not data:
            raise HTTPException(status_code=400, detail="Fetched PDF is empty")

        content_type = response.headers.get("content-type", "").lower()
        if "pdf" not in content_type and not data.startswith(b"%PDF"):
            raise HTTPException(status_code=400, detail="Fetched URL did not return a valid PDF")

        parsed = services.parse_pdf_with_citations(data)
        return parsed
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF URL parsing failed: {str(e)}")

@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    try:
        full_text = req.fullText or ""
        abstract = req.abstractText or ""
        citations = [c.model_dump() if hasattr(c, "model_dump") else c.dict() for c in (req.citations or [])]
        citation_instances = [c.model_dump() if hasattr(c, "model_dump") else c.dict() for c in (req.citationInstances or [])]
        paper_meta = services.search_semantic_scholar_by_title(req.title) or {}
        field_names = _detect_paper_fields(paper_meta)
        field_adjust = _field_threshold_adjustment(field_names)

        citation_summary = await services.run_citation_integrity_pipeline(full_text or abstract, citations, citation_instances)
        citation_result_rows = list(citation_summary.get("citationResults", []))
        citation_detected_count = int(citation_summary.get("detectedCitations") or len(citation_instances) or len(citations))
        citation_verified_count = int(citation_summary.get("verifiedCitations") or 0)
        citation_partial_count = int(citation_summary.get("partialCitations") or 0)
        citation_mismatch_count = int(citation_summary.get("mismatchCitations") or 0)
        citation_unverifiable_count = int(citation_summary.get("unverifiableCitations") or 0)
        citation_integrity_score = citation_summary.get("score")

        resolved_sources = _resolve_source_metadata(citations)

        source_abstracts = [r.get("abstract", "") for r in resolved_sources] or [item.get("sourceAbstract", "") for item in citation_result_rows]

        # Temporal impossibility
        temporal_issues: List[Dict[str, Any]] = []
        for idx, resolved in enumerate(resolved_sources):
            citation = resolved["citation"]
            source = resolved.get("source") or {}
            year_candidates = [resolved.get("year"), citation.get("year")]
            crossref = services.fetch_crossref_metadata(citation.get("doi")) if citation.get("doi") else None
            for key in ["published-print", "published-online", "created", "issued"]:
                node = (crossref or {}).get(key)
                if node and node.get("date-parts"):
                    parts = node.get("date-parts")
                    year_candidates.append(parts[0][0] if parts and parts[0] else None)
            pub_year = next((y for y in year_candidates if isinstance(y, int) and y > 0), None)
            if pub_year and pub_year > req.year + 1:
                temporal_issues.append({"index": idx, "pub_year": pub_year, "citation": citation.get("text")})

        # Statistic provenance
        stats = services.extract_numeric_claims(full_text or abstract)
        statistic_findings: List[Dict[str, Any]] = []
        for claim in stats:
            claim_text = claim.get("context") or claim.get("sentence") or ""
            claim_numbers = _extract_numeric_tokens(claim_text)
            best_similarity = 0.0
            best_source = ""
            matched_number = False
            for source_abstract in source_abstracts:
                if not source_abstract:
                    continue
                source_numbers = _extract_numeric_tokens(source_abstract)
                if any(num in source_abstract for num in claim_numbers):
                    matched_number = True
                if claim_text and source_abstract:
                    sim = cosine_similarity(embed_texts([claim_text])[0], embed_texts([source_abstract])[0])
                    if sim > best_similarity:
                        best_similarity = sim
                        best_source = source_abstract
            status = "pass" if matched_number else "warning" if best_similarity > 0.3 else "fail"
            statistic_findings.append({
                "claim": claim_text[:220],
                "numbers": claim_numbers,
                "status": status,
                "details": f"best similarity={best_similarity:.2f}",
                "sourceSnippet": best_source[:220],
            })

        # Methodology vs claim novelty gap
        novelty_sentences = [s for s in services.split_sentences(abstract) if any(cue in s.lower() for cue in NOVELTY_CUES)]
        methods_section = _find_section(full_text, METHOD_CUES, next_keywords=["results", "discussion", "conclusion", "references"])
        novelty_context = " ".join(novelty_sentences) or abstract
        methodology_similarity = 0.0
        if methods_section and novelty_context:
            methodology_similarity = cosine_similarity(embed_texts([novelty_context])[0], embed_texts([methods_section])[0])
        methodology_score = 20
        methodology_details = ["No strong novelty claim detected"] if not novelty_sentences else []
        if novelty_sentences:
            if methodology_similarity >= 0.45:
                methodology_score = 20
                methodology_details = ["Novelty claims are reflected in the methods section"]
            elif methodology_similarity >= 0.25:
                methodology_score = 45
                methodology_details = ["Novelty claims are only partially reflected in methods"]
            else:
                methodology_score = 75
                methodology_details = ["Abstract claims novelty that the methods section does not really describe"]

        # Internal consistency
        results_section = _find_section(full_text, RESULT_CUES, next_keywords=["discussion", "conclusion", "references"])
        conclusion_section = _find_section(full_text, CONCLUSION_CUES, next_keywords=["references"])
        results_numbers = set(_extract_numeric_tokens(results_section))
        conclusion_numbers = set(_extract_numeric_tokens(conclusion_section))
        mismatched_conclusion_numbers = sorted([num for num in conclusion_numbers if num not in results_numbers])
        sample_sizes = re.findall(r"\bN\s*=\s*(\d+)\b", full_text, flags=re.IGNORECASE)
        consistency_warnings = []
        if mismatched_conclusion_numbers:
            consistency_warnings.append(f"Conclusion mentions numbers not present in results: {', '.join(mismatched_conclusion_numbers[:6])}")
        if len(set(sample_sizes)) > 1:
            consistency_warnings.append(f"Multiple sample sizes detected: {', '.join(sorted(set(sample_sizes)))}")
        consistency_score = 20 if not consistency_warnings else min(85, 35 + 15 * len(consistency_warnings))

        # Author footprint coherence
        parsed_authors = req.authors or []
        paper_authors = [(a.get("name") if isinstance(a, dict) else str(a)) for a in (paper_meta.get("authors") or [])]
        parsed_surnames = set(_split_surnames(", ".join(parsed_authors)))
        paper_surnames = set(_split_surnames(", ".join(paper_authors))) if paper_authors else set()
        author_overlap = len(parsed_surnames & paper_surnames) / max(len(parsed_surnames or {"x"}), 1)
        if not parsed_authors:
            author_score = 55
            author_details = ["No parsed author names available"]
        elif paper_authors and author_overlap < 0.4:
            author_score = 60
            author_details = ["Parsed authors do not strongly overlap with Semantic Scholar metadata"]
        else:
            author_score = 20
            author_details = ["Parsed authors align with metadata or at least were extracted successfully"]

        # Aggregate overall score as a suspiciousness metric
        citation_score = min(95, 15 + int((1 - float(citation_integrity_score or 0)) * 80))
        temporal_score = min(95, 15 + len(temporal_issues) * 20)
        statistic_score = 25 if statistic_findings and any(s["status"] == "fail" for s in statistic_findings) else 40 if statistic_findings else 20

        signals = [
            {
                "signal": "citation",
                "signalName": "Citation Integrity",
                "score": citation_score,
                "severity": "red" if citation_score >= 70 else "yellow" if citation_score >= 40 else "green",
                "details": [
                    f"{citation_verified_count} citations verified, {citation_mismatch_count} mismatches, {citation_unverifiable_count} unverifiable",
                    f"{citation_detected_count} citation instance(s) detected in total",
                ],
                "evidence": [
                    {
                        "claim": f"Citation {i + 1}: {item.get('claim') or item.get('sentence') or 'Unknown'}",
                        "status": item.get("verdict") if item.get("verdict") != "unverifiable" else "warning",
                        "details": (
                            f"verdict={item.get('verdict')}; semantic={item.get('semanticScore', 0):.2f}; "
                            f"keyword={item.get('keywordScore', 0):.2f}; numeric={item.get('numericScore', 0):.2f}; source={item.get('sourceUsed', 'not_found')}"
                        ),
                    }
                    for i, item in enumerate(citation_result_rows[:12])
                ],
                "confidence": 85 if citation_result_rows else 50,
            },
            {
                "signal": "temporal",
                "signalName": "Temporal Impossibility",
                "score": temporal_score,
                "severity": "red" if len(temporal_issues) > 2 else "yellow" if temporal_issues else "green",
                "details": [
                    f"{len(temporal_issues)} impossible or suspicious citation dates detected",
                    "CrossRef + Semantic Scholar publication dates checked where available",
                ],
                "evidence": [
                    {
                        "claim": f"Citation {t['index'] + 1}",
                        "status": "fail",
                        "details": f"Publication year {t['pub_year']} is after paper year {req.year}",
                    }
                    for t in temporal_issues
                ],
                "confidence": 90,
            },
            {
                "signal": "statistics",
                "signalName": "Statistic Provenance",
                "score": statistic_score,
                "severity": "red" if any(s["status"] == "fail" for s in statistic_findings) else "yellow" if statistic_findings else "green",
                "details": [
                    f"{len(statistic_findings)} numeric claims extracted from the paper",
                    "Checked against cited source abstracts where available",
                ],
                "evidence": [
                    {
                        "claim": item["claim"],
                        "status": item["status"],
                        "details": item["details"],
                    }
                    for item in statistic_findings[:12]
                ],
                "confidence": 75,
            },
            {
                "signal": "methodology",
                "signalName": "Methodology Novelty Gap",
                "score": methodology_score,
                "severity": "red" if methodology_score >= 70 else "yellow" if methodology_score >= 40 else "green",
                "details": methodology_details,
                "evidence": [
                    {
                        "claim": "Abstract novelty vs methods",
                        "status": "warning" if methodology_score >= 40 else "pass",
                        "details": f"semantic similarity={methodology_similarity:.2f}",
                    }
                ] if novelty_sentences else [],
                "confidence": 78,
            },
            {
                "signal": "consistency",
                "signalName": "Internal Consistency",
                "score": consistency_score,
                "severity": "red" if consistency_score >= 70 else "yellow" if consistency_score >= 35 else "green",
                "details": consistency_warnings or ["No obvious internal numeric inconsistencies detected"],
                "evidence": [
                    {
                        "claim": "Results vs conclusion numeric consistency",
                        "status": "warning" if consistency_warnings else "pass",
                        "details": warning,
                    }
                    for warning in consistency_warnings
                ],
                "confidence": 70,
            },
            {
                "signal": "author",
                "signalName": "Author Footprint",
                "score": author_score,
                "severity": "red" if author_score >= 70 else "yellow" if author_score >= 40 else "green",
                "details": author_details,
                "evidence": [
                    {
                        "claim": "Parsed author names",
                        "status": "pass" if parsed_authors else "warning",
                        "details": ", ".join(parsed_authors[:8]) if parsed_authors else "No authors parsed from PDF",
                    }
                ],
                "confidence": 60,
            },
        ]

        pipeline_trace = [
            {
                "stage": "PDF parsing",
                "status": "done",
                "detail": f"Loaded {len(full_text.splitlines()) if full_text else 0} lines of text and parsed {len(parsed_authors)} author candidate(s)",
            },
            {
                "stage": "Citation extraction",
                "status": "done" if citation_detected_count else "warning",
                "detail": f"Extracted {citation_detected_count} citation instance(s) using GROBID TEI + fallback parsing",
            },
            {
                "stage": "Citation grounding",
                "status": "done" if citation_result_rows else "warning",
                "detail": f"Resolved {sum(1 for item in citation_result_rows if item.get('sourceUsed') != 'not_found')} citation source(s), chunked passages, and scored claim/source alignment",
            },
            {
                "stage": "Temporal checks",
                "status": "done" if not temporal_issues else "warning",
                "detail": f"Flagged {len(temporal_issues)} possible temporal mismatch(es)",
            },
            {
                "stage": "Statistic provenance",
                "status": "done" if statistic_findings else "warning",
                "detail": f"Scanned {len(statistic_findings)} numeric claim(s) for provenance",
            },
            {
                "stage": "Method novelty vs methods",
                "status": "done",
                "detail": f"Compared novelty claims against methods section similarity ({methodology_similarity:.2f})",
            },
            {
                "stage": "Internal consistency",
                "status": "done" if not consistency_warnings else "warning",
                "detail": f"Detected {len(consistency_warnings)} internal consistency warning(s)",
            },
            {
                "stage": "Author footprint",
                "status": "done" if author_score < 40 else "warning",
                "detail": f"Parsed {len(parsed_authors)} author(s) and checked metadata overlap",
            },
        ]

        overall_score = round(
            citation_score * 0.30
            + temporal_score * 0.20
            + statistic_score * 0.20
            + methodology_score * 0.15
            + consistency_score * 0.10
            + author_score * 0.05
        )

        if overall_score < 20:
            overall_grade = "A"
        elif overall_score < 35:
            overall_grade = "B"
        elif overall_score < 50:
            overall_grade = "C"
        elif overall_score < 70:
            overall_grade = "D"
        else:
            overall_grade = "F"

        report = {
            "title": req.title,
            "authors": parsed_authors,
            "year": req.year,
            "abstract": abstract,
            "methodology": methods_section,
            "overallScore": overall_score,
            "overallGrade": overall_grade,
            "signals": signals,
            "pipelineTrace": pipeline_trace,
            "timestamp": datetime.utcnow().isoformat(),
            "confidence": 85 if citation_result_rows else 65,
            "citationCount": citation_detected_count,
            "verifiedCitations": citation_verified_count,
            "citationDetectedCount": citation_detected_count,
            "citationGroundedCount": citation_verified_count,
            "citationPartialCount": citation_partial_count,
            "citationMismatchCount": citation_mismatch_count,
            "citationUnverifiableCount": citation_unverifiable_count,
            "citationIntegrityScore": citation_integrity_score,
            "citationDetails": citation_result_rows,
            "fieldOfStudy": field_names,
        }

        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
