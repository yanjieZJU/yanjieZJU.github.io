"""
One-time dump: export MOD_/ART_ node texts from Neo4j into a local SQLite file
(server/flat_storage/flat_nodes.sqlite) so the flat retrieval condition can run
without a live Neo4j connection.

Run this on any machine that can reach the Neo4j instance:
    python server/dump_flat_store.py
then copy server/flat_storage/flat_nodes.sqlite to the server.
"""

import os
import sys
import sqlite3

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config import *  # noqa: F401,F403

from retriever_neo4j import get_graph_store, run_with_retry, execute_read_with_session

FLAT_STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flat_storage")
FLAT_DB_PATH = os.path.join(FLAT_STORAGE_DIR, "flat_nodes.sqlite")


def dump():
    os.makedirs(FLAT_STORAGE_DIR, exist_ok=True)
    conn = sqlite3.connect(FLAT_DB_PATH)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS flat_nodes (
        node_id TEXT PRIMARY KEY,
        node_type TEXT,
        name TEXT,
        role TEXT,
        source TEXT,
        text TEXT
    )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_flat_nodes_source ON flat_nodes(source)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_flat_nodes_type ON flat_nodes(node_type)")

    gs = get_graph_store()

    def _fetch(tx):
        cypher = """
        MATCH (n:LlamaNode)
        WHERE n.id STARTS WITH 'MOD_' OR n.id STARTS WITH 'ART_'
        RETURN n.id AS id, n.type AS type, n.name AS name,
               n.role AS role, n.source AS source, n.text AS text
        """
        return [dict(r) for r in tx.run(cypher)]

    print("Fetching MOD_/ART_ nodes from Neo4j...")
    records = run_with_retry(lambda: execute_read_with_session(gs._driver, _fetch))
    print(f"Fetched {len(records)} nodes.")

    for r in records:
        conn.execute(
            "INSERT OR REPLACE INTO flat_nodes (node_id, node_type, name, role, source, text) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (r["id"], r.get("type") or "", r.get("name") or "",
             r.get("role") or "", r.get("source") or "", r.get("text") or ""),
        )
    conn.commit()

    n_mod = conn.execute("SELECT count(*) FROM flat_nodes WHERE node_id LIKE 'MOD_%'").fetchone()[0]
    n_art = conn.execute("SELECT count(*) FROM flat_nodes WHERE node_id LIKE 'ART_%'").fetchone()[0]
    print(f"Done: {n_mod} modules, {n_art} articles -> {FLAT_DB_PATH}")
    conn.close()


if __name__ == "__main__":
    dump()
