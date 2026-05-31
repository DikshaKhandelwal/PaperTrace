import numpy as np
import re

try:
    from sentence_transformers import SentenceTransformer  # type: ignore
except Exception:
    SentenceTransformer = None

# Load model lazily
_model = None


def _fallback_embed(texts, dim: int = 384):
    vectors = []
    for text in texts:
        vec = np.zeros(dim, dtype=np.float32)
        tokens = re.findall(r"[a-z0-9]+", (text or "").lower())
        for token in tokens:
            idx = hash(token) % dim
            vec[idx] += 1.0
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        vectors.append(vec)
    return np.vstack(vectors) if vectors else np.zeros((0, dim), dtype=np.float32)

def get_model():
    global _model
    if _model is None:
        if SentenceTransformer is None:
            raise RuntimeError("sentence-transformers is unavailable")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model

def embed_texts(texts):
    try:
        model = get_model()
        return model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    except Exception:
        return _fallback_embed(texts)

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    if a is None or b is None:
        return 0.0
    if a.ndim == 1:
        a = a.reshape(1, -1)
    if b.ndim == 1:
        b = b.reshape(1, -1)
    a_norm = a / np.maximum(np.linalg.norm(a, axis=1, keepdims=True), 1e-12)
    b_norm = b / np.maximum(np.linalg.norm(b, axis=1, keepdims=True), 1e-12)
    sim = np.dot(a_norm, b_norm.T)
    return float(sim[0,0])
