"""
Server-side architecture diagram renderer using Graphviz.

Each module renders as a cluster (subgraph) containing its sub_nodes.
internal_flow edges connect sub_nodes within the cluster.
ports.outgoing edges connect modules (or specific sub_nodes) across clusters.

Role → fill color:
  input              #4CAF50  green
  output             #F44336  red
  processing / *     #2196F3  blue
  storage / infra    #FF9800  orange
  (default)          #9E9E9E  grey
"""

import base64
import re
import graphviz

_ROLE_FILL = {
    "input":           "#4CAF50",
    "output":          "#F44336",
    "processing":      "#2196F3",
    "processing_core": "#2196F3",
    "storage":         "#FF9800",
    "infrastructure":  "#FF9800",
}
_DEFAULT_FILL = "#9E9E9E"

# Cluster border is a darkened version of the fill
_ROLE_BORDER = {
    "input":           "#388E3C",
    "output":          "#C62828",
    "processing":      "#1565C0",
    "processing_core": "#1565C0",
    "storage":         "#E65100",
    "infrastructure":  "#E65100",
}
_DEFAULT_BORDER = "#616161"


def _role_fill(role: str) -> tuple[str, str]:
    """Return (fill_color, border_color) for a role string."""
    key = re.split(r"[:\s]", (role or ""))[0].strip().lower().replace(" ", "_")
    return _ROLE_FILL.get(key, _DEFAULT_FILL), _ROLE_BORDER.get(key, _DEFAULT_BORDER)


def _node_id(module_name: str, sub_name: str | None = None) -> str:
    """Stable graphviz node id (no spaces or special chars)."""
    base = re.sub(r"[^A-Za-z0-9_\u4e00-\u9fff]", "_", module_name)
    if sub_name:
        sub = re.sub(r"[^A-Za-z0-9_\u4e00-\u9fff]", "_", sub_name)
        return f"{base}__{sub}"
    return base


def render_plan_png(module_details: list | dict, title: str = "") -> bytes:
    """
    Render module_details to a PNG and return raw bytes.
    module_details may be a list (standard) or dict (legacy keyed by name).
    """
    if isinstance(module_details, dict):
        modules = list(module_details.values())
    else:
        modules = list(module_details)

    dot = graphviz.Digraph(
        name="architecture",
        graph_attr={
            "rankdir":  "LR",
            "splines":  "spline",
            "nodesep":  "0.5",
            "ranksep":  "1.2",
            "fontname": "Helvetica",
            "label":    title,
            "labelloc": "t",
            "fontsize": "16",
            "bgcolor":  "white",
            "compound": "true",   # required for edges between clusters
        },
        node_attr={
            "fontname": "Helvetica",
            "fontsize": "11",
        },
        edge_attr={
            "fontname": "Helvetica",
            "fontsize": "9",
            "color":    "#555555",
        },
    )

    # Index: module_name -> module dict, for edge lookups
    mod_by_name: dict[str, dict] = {m.get("name", ""): m for m in modules}
    valid_names = set(mod_by_name.keys())

    # ── Build one cluster per module ─────────────────────────────────────────
    # We need to track a "proxy node" per cluster so cross-cluster edges can
    # use lhead/ltail (Graphviz compound edge trick).
    cluster_proxy: dict[str, str] = {}   # module_name -> node_id of first sub/header node

    for mod in modules:
        name  = mod.get("name", "")
        role  = mod.get("role", "")
        brief = mod.get("brief_description", "") or mod.get("function", "")
        sub_nodes = mod.get("sub_nodes") or []
        fill, border = _role_fill(role)

        cluster_name = f"cluster_{_node_id(name)}"

        with dot.subgraph(name=cluster_name) as c:
            c.attr(
                label=name,
                style="filled,rounded",
                fillcolor=fill + "22",   # very light tint for cluster bg
                color=border,
                penwidth="2",
                fontname="Helvetica Bold",
                fontsize="12",
                fontcolor="#222222",
            )

            if sub_nodes:
                # Render each sub_node as a node inside the cluster
                for sub in sub_nodes:
                    sname = sub.get("name", "")
                    sfunc = sub.get("function", "")
                    snippet = sfunc[:40] + ("…" if len(sfunc) > 40 else "")
                    sid = _node_id(name, sname)
                    c.node(
                        sid,
                        label=f"{sname}\n{snippet}",
                        shape="box",
                        style="filled,rounded",
                        fillcolor=fill,
                        fontcolor="white",
                        margin="0.15,0.08",
                    )
                    if name not in cluster_proxy:
                        cluster_proxy[name] = sid

                # internal_flow edges
                ports = mod.get("ports") or {}
                for flow in ports.get("internal_flow", []):
                    src_s = flow.get("source_node", "")
                    tgt_s = flow.get("target_node", "")
                    label = flow.get("edge_label", "")
                    if src_s and tgt_s:
                        c.edge(
                            _node_id(name, src_s),
                            _node_id(name, tgt_s),
                            label=label,
                            style="dashed",
                            color="#888888",
                        )
            else:
                # No sub_nodes: render module itself as a single node
                snippet = brief[:50] + ("…" if len(brief) > 50 else "")
                nid = _node_id(name)
                c.node(
                    nid,
                    label=f"{name}\n{snippet}",
                    shape="box",
                    style="filled,rounded",
                    fillcolor=fill,
                    fontcolor="white",
                    margin="0.2,0.1",
                )
                cluster_proxy[name] = nid

    # ── Cross-module edges (from outgoing ports) ──────────────────────────────
    seen_edges: set[tuple[str, str]] = set()

    for mod in modules:
        src_mod = mod.get("name", "")
        ports   = mod.get("ports") or {}

        for edge in ports.get("outgoing", []):
            tgt_mod   = edge.get("target_mod", "")
            edge_label = edge.get("edge_label", "")
            orig_sub  = edge.get("originates_from_internal_node")
            tgt_sub   = edge.get("target_node")

            if not tgt_mod or tgt_mod not in valid_names:
                continue

            key = (src_mod, tgt_mod)
            if key in seen_edges:
                continue
            seen_edges.add(key)

            # Determine actual tail/head nodes and lhead/ltail attrs
            tail_node = (_node_id(src_mod, orig_sub)
                         if orig_sub and orig_sub in {s.get("name") for s in (mod_by_name[src_mod].get("sub_nodes") or [])}
                         else cluster_proxy.get(src_mod, _node_id(src_mod)))

            tgt_subs  = {s.get("name") for s in (mod_by_name[tgt_mod].get("sub_nodes") or [])}
            head_node = (_node_id(tgt_mod, tgt_sub)
                         if tgt_sub and tgt_sub in tgt_subs
                         else cluster_proxy.get(tgt_mod, _node_id(tgt_mod)))

            dot.edge(
                tail_node,
                head_node,
                label=edge_label,
                lhead=f"cluster_{_node_id(tgt_mod)}",
                ltail=f"cluster_{_node_id(src_mod)}",
            )

    return dot.pipe(format="png")


def render_plan_b64(module_details: list | dict, title: str = "") -> str:
    """Return PNG as base64 data-URL string (compatible with /export endpoint)."""
    png = render_plan_png(module_details, title)
    return "data:image/png;base64," + base64.b64encode(png).decode()
