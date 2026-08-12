"""
Paper-level near/far routing for the raw-PDF (rag) baseline condition.

Builds one embedding per paper from its raw title + abstract (falling back to the
first chunk when no abstract was parsed), sourced entirely from rag_nodes.sqlite —
i.e. no KG-extraction products are used. Embeddings are cached on disk.

Selection rule mirrors the KG condition's scene-cluster routing:
- Near  : top-similarity papers
- Far   : sampled from the 0.3–0.6 similarity band, plus up to 2 same-domain
          neighbors (paper-paper sim >= 0.6) from the same band
"""

import os
import sys
import json
import time
import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import *  # noqa: F401,F403

RAG_STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rag_storage")
PAPER_EMB_PATH = os.path.join(RAG_STORAGE_DIR, "paper_route_embeddings.npy")
PAPER_IDS_PATH = os.path.join(RAG_STORAGE_DIR, "paper_route_ids.json")

_PAPER_MATRIX = None   # np.ndarray (P, D)
_PAPER_IDS = None      # list[str] — source filenames
_PAPER_TEXTS = None    # dict[source] = routing text (title + abstract/first chunk)


def _load_paper_texts() -> dict[str, str]:
    """One routing text per paper from the raw chunk DB."""
    from retriever_rag import get_rag_db, init_rag_db
    init_rag_db()
    conn = get_rag_db()
    rows = conn.execute(
        "SELECT source, title, abstract, section, text FROM rag_nodes ORDER BY source"
    ).fetchall()

    papers: dict[str, dict] = {}
    for r in rows:
        src = r["source"]
        entry = papers.setdefault(src, {"title": r["title"] or "", "abstract": "", "fallback": ""})
        if not entry["abstract"] and r["abstract"]:
            entry["abstract"] = r["abstract"]
        if not entry["fallback"] and r["section"] == "abstract" and r["text"]:
            entry["fallback"] = r["text"]
        if not entry["fallback"] and r["text"]:
            entry["fallback"] = r["text"][:1200]

    texts = {}
    for src, e in papers.items():
        body = e["abstract"] or e["fallback"]
        texts[src] = f"{e['title']}\n{body}".strip()[:4000]
    return texts


def get_paper_router():
    """Load (or build once) the per-paper routing embeddings."""
    global _PAPER_MATRIX, _PAPER_IDS, _PAPER_TEXTS
    if _PAPER_MATRIX is not None:
        return _PAPER_MATRIX, _PAPER_IDS

    if _PAPER_TEXTS is None:
        _PAPER_TEXTS = _load_paper_texts()

    if os.path.exists(PAPER_EMB_PATH) and os.path.exists(PAPER_IDS_PATH):
        with open(PAPER_IDS_PATH) as f:
            cached_ids = json.load(f)
        if set(cached_ids) == set(_PAPER_TEXTS.keys()):
            print("[PaperRouter] Loading cached paper embeddings...", flush=True)
            _PAPER_MATRIX = np.load(PAPER_EMB_PATH)
            _PAPER_IDS = cached_ids
            print(f"[PaperRouter] Ready: {len(_PAPER_IDS)} papers.", flush=True)
            return _PAPER_MATRIX, _PAPER_IDS

    print(f"[PaperRouter] Building embeddings for {len(_PAPER_TEXTS)} papers "
          "(one-time, cached afterwards)...", flush=True)
    from retriever_rag import get_embed_model
    embed_model = get_embed_model()

    ids = sorted(_PAPER_TEXTS.keys())
    embeddings = []
    batch_size = 50
    for b in range(0, len(ids), batch_size):
        batch = [_PAPER_TEXTS[i] for i in ids[b: b + batch_size]]
        embs = None
        for attempt in range(3):
            try:
                embs = embed_model.get_text_embedding_batch(batch)
                break
            except Exception as e:
                print(f"  [WARN] Paper embed error (attempt {attempt+1}): {e}")
                time.sleep(2 ** attempt)
        if embs is None:
            raise RuntimeError("Failed to embed paper routing texts.")
        embeddings.extend(embs)
        if (b // batch_size) % 5 == 0:
            print(f"  [PaperRouter] {min(b + batch_size, len(ids))}/{len(ids)}", flush=True)

    _PAPER_MATRIX = np.array(embeddings, dtype=np.float32)
    _PAPER_IDS = ids
    np.save(PAPER_EMB_PATH, _PAPER_MATRIX)
    with open(PAPER_IDS_PATH, "w") as f:
        json.dump(ids, f)
    print(f"[PaperRouter] Built and cached {len(ids)} paper embeddings.", flush=True)
    return _PAPER_MATRIX, _PAPER_IDS


def get_paper_text(source: str) -> str:
    global _PAPER_TEXTS
    if _PAPER_TEXTS is None:
        _PAPER_TEXTS = _load_paper_texts()
    return _PAPER_TEXTS.get(source, "")


def score_papers(query: str) -> list[tuple[str, float]]:
    """Score all papers against the query. Returns [(source, score)] sorted desc."""
    matrix, ids = get_paper_router()
    from retriever_rag import get_embed_model
    embed_model = get_embed_model()
    q_emb = None
    for attempt in range(3):
        try:
            q_emb = embed_model.get_query_embedding(query)
            break
        except Exception as e:
            print(f"  [WARN] Router embed error (attempt {attempt+1}): {e}")
            time.sleep(2 ** attempt)
    if q_emb is None:
        return []

    q = np.array(q_emb, dtype=np.float32)
    q = q / (np.linalg.norm(q) + 1e-10)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    scores = (matrix / (norms + 1e-10)) @ q
    order = np.argsort(scores)[::-1]
    return [(ids[i], float(scores[i])) for i in order]


def paper_similarity(src_a: str, src_b: str) -> float:
    matrix, ids = get_paper_router()
    try:
        ia, ib = ids.index(src_a), ids.index(src_b)
    except ValueError:
        return 0.0
    a, b = matrix[ia], matrix[ib]
    return float(a @ b / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-10))
