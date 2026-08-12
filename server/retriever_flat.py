"""
Condition 2: Structure-ablated flat-module retriever.

Retrieves over the SAME LLM-extracted module texts as the KG condition, but:
- pure vector similarity only (reuses the exact embeddings in graph_storage/embeddings.npy)
- no community routing, no role filter via graph, no edges, no topology expansion

Module/article texts are served from a local SQLite dump (flat_storage/flat_nodes.sqlite)
created by dump_flat_store.py, so no Neo4j connection is needed at runtime.
"""

import os
import sys
import json
import sqlite3
import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import *  # noqa: F401,F403

GRAPH_STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "graph_storage")
FLAT_STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flat_storage")
FLAT_DB_PATH = os.path.join(FLAT_STORAGE_DIR, "flat_nodes.sqlite")

# ── Globals ────────────────────────────────────────────────────────────────────
_MOD_MATRIX = None    # np.ndarray (M, D) — module embeddings only
_MOD_IDS = None       # list[str]
_ART_MATRIX = None    # np.ndarray (A, D) — article embeddings only
_ART_IDS = None       # list[str]
_DB_CONN = None


def get_flat_db():
    global _DB_CONN
    if _DB_CONN is None:
        if not os.path.exists(FLAT_DB_PATH):
            raise RuntimeError(
                f"Flat node store not found at {FLAT_DB_PATH}. "
                "Run `python server/dump_flat_store.py` once (requires Neo4j reachable) "
                "or copy flat_nodes.sqlite from a machine that can reach Neo4j."
            )
        _DB_CONN = sqlite3.connect(FLAT_DB_PATH, check_same_thread=False)
        _DB_CONN.row_factory = sqlite3.Row
    return _DB_CONN


def get_flat_store():
    """Load module/article embedding submatrices from the shared KG vector store."""
    global _MOD_MATRIX, _MOD_IDS, _ART_MATRIX, _ART_IDS
    if _MOD_MATRIX is None:
        npy_path = os.path.join(GRAPH_STORAGE_DIR, "embeddings.npy")
        ids_path = os.path.join(GRAPH_STORAGE_DIR, "embedding_ids.json")
        print("[FLAT] Loading vector store from disk...", flush=True)
        matrix = np.load(npy_path)
        with open(ids_path) as f:
            all_ids = json.load(f)

        mod_idx = [i for i, id_ in enumerate(all_ids) if id_.startswith("MOD_")]
        art_idx = [i for i, id_ in enumerate(all_ids) if id_.startswith("ART_")]
        _MOD_MATRIX = matrix[mod_idx].astype(np.float32)
        _MOD_IDS = [all_ids[i] for i in mod_idx]
        _ART_MATRIX = matrix[art_idx].astype(np.float32)
        _ART_IDS = [all_ids[i] for i in art_idx]
        print(f"[FLAT] Vector store ready: {len(_MOD_IDS)} modules, {len(_ART_IDS)} articles.", flush=True)

        get_flat_db()  # fail fast if the text dump is missing
        print("[FLAT] Node text DB ready.", flush=True)
    return (_MOD_MATRIX, _MOD_IDS), (_ART_MATRIX, _ART_IDS)


def fetch_flat_nodes(node_ids: list[str]) -> dict[str, dict]:
    if not node_ids:
        return {}
    conn = get_flat_db()
    placeholders = ",".join("?" for _ in node_ids)
    rows = conn.execute(
        f"SELECT node_id, node_type, name, role, source, text FROM flat_nodes "
        f"WHERE node_id IN ({placeholders})",
        node_ids,
    ).fetchall()
    return {
        r["node_id"]: {
            "node_type": r["node_type"],
            "name": r["name"],
            "role": r["role"],
            "source": r["source"],
            "text": r["text"],
        }
        for r in rows
    }


def _cosine_search(query_embedding, matrix, ids, top_k):
    q = np.array(query_embedding, dtype=np.float32)
    q = q / (np.linalg.norm(q) + 1e-10)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    scores = (matrix / (norms + 1e-10)) @ q
    k = min(top_k, len(scores))
    top = np.argpartition(scores, -k)[-k:]
    top = top[np.argsort(scores[top])[::-1]]
    return [(ids[i], float(scores[i])) for i in top]


def flat_retrieve_modules(query: str, top_k: int = 6) -> list[dict]:
    """Pure vector retrieval over flattened module records.
    Returns list of dicts: {node_id, name, role, source, text, score}."""
    (mod_matrix, mod_ids), _ = get_flat_store()
    from retriever_neo4j import get_embed_model
    embed_model = get_embed_model()

    q_emb = None
    import time
    for attempt in range(3):
        try:
            q_emb = embed_model.get_query_embedding(query)
            break
        except Exception as e:
            print(f"  [WARN] Embed error (attempt {attempt+1}): {e}")
            time.sleep(2 ** attempt)
    if q_emb is None:
        return []

    ranked = _cosine_search(q_emb, mod_matrix, mod_ids, top_k)
    payload_map = fetch_flat_nodes([nid for nid, _ in ranked])

    results = []
    for nid, score in ranked:
        payload = payload_map.get(nid)
        if not payload:
            continue
        results.append({
            "node_id": nid,
            "name": payload.get("name", ""),
            "role": payload.get("role", ""),
            "source": payload.get("source", ""),
            "text": payload.get("text", ""),
            "score": score,
        })
    print(f"[FLAT] Retrieved {len(results)} modules for query: {query[:60]!r}")
    for r in results:
        print(f"  [{r['score']:.4f}] {r['name']!r:30s} | {r['text'][:100]!r}")
    return results


def flat_score_articles(query: str) -> list[tuple[str, float]]:
    """Score ALL articles against the query (for near/far routing in the planner).
    Returns [(article_id, score)] sorted desc."""
    _, (art_matrix, art_ids) = get_flat_store()
    from retriever_neo4j import get_embed_model
    embed_model = get_embed_model()
    try:
        q_emb = embed_model.get_query_embedding(query)
    except Exception as e:
        print(f"  [WARN] Article routing embed failed: {e}")
        return []
    return _cosine_search(q_emb, art_matrix, art_ids, top_k=len(art_ids))


def article_similarity(art_id_a: str, art_id_b: str) -> float:
    """Cosine similarity between two article embeddings (for far-field neighbor expansion)."""
    _, (art_matrix, art_ids) = get_flat_store()
    try:
        ia, ib = art_ids.index(art_id_a), art_ids.index(art_id_b)
    except ValueError:
        return 0.0
    a, b = art_matrix[ia], art_matrix[ib]
    return float(a @ b / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-10))
