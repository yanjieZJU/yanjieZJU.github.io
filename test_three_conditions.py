"""
Three-condition retrieval test. Verifies each condition retrieves content that
matches its experimental definition:

  kg   : LLM-extracted modules + community/role routing + graph topology
  flat : SAME extracted module texts, pure vector — NO topology, NO paths
  rag  : raw PDF chunks — NO extraction products, NO topology, NO paths;
         near/far routing over paper-level (title+abstract) embeddings

Bypasses the generation LLM; only exercises retrievers + routing scorers.
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "server"))

import config  # noqa: F401

from agents import RetrieverAgent, get_client

TEST_QUERY = "design a system for coding education towards children"
ANCHORS = [
    {"user_term": "代码编辑器", "description": "children-friendly code editor with syntax highlighting"},
    {"user_term": "错误提示", "description": "real-time error feedback and hints for debugging"},
]
RELATIONS = [
    {"source": "代码编辑器", "target": "错误提示", "type": "FLOWS_TO"},
]

FAILS = []


def check(cond, label):
    status = "OK  " if cond else "FAIL"
    print(f"    [{status}] {label}")
    if not cond:
        FAILS.append(label)
    return cond


def test_mode(mode):
    print(f"\n{'='*70}\n  MODE: {mode.upper()}\n{'='*70}")

    if mode == "rag":
        from retriever_rag import get_rag_store
        get_rag_store()
        vector_store, graph_store = None, None
    elif mode == "flat":
        from retriever_flat import get_flat_store
        get_flat_store()
        vector_store, graph_store = None, None
    else:
        from retriever_neo4j import get_global_stores
        vector_store, graph_store = get_global_stores()

    retriever = RetrieverAgent(vector_store, graph_store, get_client(), retrieval_mode=mode)

    # ── Module retrieval ───────────────────────────────────────────────
    t0 = time.time()
    result = retriever.retrieve_for_module(ANCHORS, top_k=3, include_topology=True)
    print(f"\n  retrieve_for_module done in {time.time()-t0:.1f}s, anchors: {list(result.keys())}")

    all_nodes = [n for nodes in result.values() for n in nodes]
    check(len(all_nodes) > 0, f"{mode}: retrieved {len(all_nodes)} nodes (>0)")
    check(all(len(n.node.text or "") > 30 for n in all_nodes), f"{mode}: all nodes have real text")

    for anchor, nodes in result.items():
        for i, nws in enumerate(nodes[:2]):
            m = nws.node.metadata
            print(f"    {anchor} [{i}] id={nws.node.id_[:28]!r} name={m.get('name','')[:40]!r} "
                  f"type={m.get('type','')} score={nws.score:.4f}")
            print(f"        text[:150]={ (nws.node.text or '')[:150]!r}")

    if mode == "kg":
        check(all(n.node.id_.startswith("MOD_") for n in all_nodes),
              "kg: all node ids are MOD_ (extracted modules)")
        topo_counts = [len((n.node.metadata.get("topology") or {}).get("upstream", []) or []) +
                       len((n.node.metadata.get("topology") or {}).get("downstream", []) or [])
                       for n in all_nodes]
        check(any(c > 0 for c in topo_counts),
              f"kg: topology present on at least one node (edges per node: {topo_counts})")
    elif mode == "flat":
        check(all(n.node.id_.startswith("MOD_") for n in all_nodes),
              "flat: all node ids are MOD_ (same extracted texts as kg)")
        check(all(not any((n.node.metadata.get("topology") or {}).values()) for n in all_nodes),
              "flat: topology metadata is EMPTY on every node (structure ablated)")
    else:  # rag
        check(all(not n.node.id_.startswith(("MOD_", "ART_")) for n in all_nodes),
              "rag: node ids are NOT MOD_/ART_ (no extraction products)")
        check(all((n.node.metadata.get("type") == "ARTICLE") for n in all_nodes),
              "rag: nodes are raw ARTICLE chunks")
        check(all(not any((n.node.metadata.get("topology") or {}).values()) for n in all_nodes),
              "rag: topology metadata is EMPTY on every node")

    # ── Structural paths ───────────────────────────────────────────────
    paths = retriever.retrieve_structure_paths(RELATIONS)
    if mode == "kg":
        print(f"  structure paths: {len(paths)}")
        if paths:
            chain = " -> ".join(n.get("name", "?") for n in paths[0].get("path_nodes", []))
            print(f"    e.g. {chain}")
        check(True, f"kg: structural path retrieval ran ({len(paths)} paths; 0 can be valid)")
    else:
        check(len(paths) == 0, f"{mode}: structure paths == 0 (got {len(paths)})")

    # ── Near/far routing source ────────────────────────────────────────
    if mode == "flat":
        from retriever_flat import flat_score_articles
        scored = flat_score_articles(TEST_QUERY)
        check(len(scored) == 1215 and scored[0][0].startswith("ART_"),
              f"flat: routing scores over {len(scored)} ART_ embeddings, top={scored[0][0]} ({scored[0][1]:.3f})")
        band = [s for _, s in scored if 0.3 <= s <= 0.6]
        print(f"    far-field band (0.3-0.6): {len(band)} articles available")
    elif mode == "rag":
        from paper_router import score_papers, get_paper_text
        scored = score_papers(TEST_QUERY)
        check(len(scored) > 900 and not scored[0][0].startswith(("ART_", "MOD_")),
              f"rag: routing scores over {len(scored)} raw papers, top={scored[0][0][:50]!r} ({scored[0][1]:.3f})")
        top_text = get_paper_text(scored[0][0])
        print(f"    top paper routing text[:120]: {top_text[:120]!r}")
        band = [s for _, s in scored if 0.3 <= s <= 0.6]
        print(f"    far-field band (0.3-0.6): {len(band)} papers available")


if __name__ == "__main__":
    for mode in ["flat", "rag", "kg"]:
        try:
            test_mode(mode)
        except Exception:
            import traceback
            traceback.print_exc()
            FAILS.append(f"{mode}: raised exception")

    print(f"\n{'='*70}\n  SUMMARY\n{'='*70}")
    if FAILS:
        print(f"  {len(FAILS)} FAILURE(S):")
        for f in FAILS:
            print(f"   - {f}")
        sys.exit(1)
    print("  ALL CHECKS PASSED ✅")
    sys.exit(0)
