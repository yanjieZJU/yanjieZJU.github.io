"""
Intra-condition diversity evaluator for the three-condition ablation.

For each task and each retrieval condition (kg / flat / rag) the pipeline
produces 3 plans (divergent options).  This script measures how *different*
those 3 plans are from one another — the hypothesis being that a richer
retrieval source lets the divergent planner explore a wider design space.

diversity = 1 - (s12 + s13 + s23) / 3

where s_ij is the cosine similarity between the plain-text renderings of
plan i and plan j.  Range: 0 (three identical plans) → 1 (fully orthogonal).

IMPORTANT — deterministic plain-text rendering:
  We never embed the raw JSON.  JSON punctuation, key names, port wiring and
  ids are structural noise that would inflate similarity uniformly across
  conditions.  Instead render_plan() walks the modules in file order and emits
  ONLY the human-authored content (module name / description / technical
  methods, plus the same for each sub-node).  Same JSON always → same text.

Embedding robustness:
  Primary result uses a Chinese-capable model (DashScope text-embedding-v4).
  Pass --backend openai for a robustness check with text-embedding-3-large.
  Report the primary in the main table and the second as a robustness row.

Input : batch_results/{task_id}/{mode}/plans.json   (3 plans each)
Run   : python eval_diversity.py [--backend dashscope|openai]
        python eval_diversity.py --modes kg flat rag --results-dir batch_results
Output: batch_results/diversity_results.csv  +  terminal summary table
"""

import argparse
import csv
import json
import os
import pathlib
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "server"))
import config  # noqa: F401  sets OPENAI_API_KEY / OPENAI_BASE_URL / DASHSCOPE_API_KEY

import httpx
from openai import OpenAI


# ── deterministic plain-text rendering ─────────────────────────────────────────

def _clean(s) -> str:
    """Normalise a field to a stripped string; treat 'None'/None as empty."""
    if s is None:
        return ""
    s = str(s).strip()
    return "" if s.lower() == "none" else s


def render_plan(plan: dict) -> str:
    """
    Deterministically turn one plan dict into a plain-text document.

    Walks modules in file order; for each module emits name / description /
    technical_methods, then the same for every sub_node in order.  Only
    human-authored semantic content is included — no JSON syntax, no ports,
    no ids.  The overall_description leads the document.
    """
    parts: list[str] = []

    desc = _clean(plan.get("description"))
    if desc:
        parts.append(desc)

    modules = plan.get("node_details", [])
    if isinstance(modules, dict):
        modules = list(modules.values())

    for mod in modules:
        name = _clean(mod.get("name"))
        brief = _clean(mod.get("brief_description")) or _clean(mod.get("function"))
        methods = _clean(mod.get("technical_methods"))
        seg = [x for x in (name, brief, methods) if x]
        if seg:
            parts.append("。".join(seg))

        for sub in mod.get("sub_nodes", []) or []:
            s_name = _clean(sub.get("name"))
            s_func = _clean(sub.get("function"))
            s_meth = _clean(sub.get("technical_methods"))
            seg = [x for x in (s_name, s_func, s_meth) if x]
            if seg:
                parts.append("。".join(seg))

    return "\n".join(parts)


# ── embedding backends ─────────────────────────────────────────────────────────

class Embedder:
    """Two interchangeable providers so we can run a robustness check."""

    def __init__(self, backend: str):
        self.backend = backend
        if backend == "dashscope":
            # DashScope exposes an OpenAI-compatible endpoint.
            self.client = OpenAI(
                api_key=os.environ["DASHSCOPE_API_KEY"],
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                http_client=httpx.Client(proxy=None, trust_env=False),
            )
            self.model = "text-embedding-v4"
        elif backend == "openai":
            self.client = OpenAI(http_client=httpx.Client(proxy=None, trust_env=False))
            self.model = "text-embedding-3-large"
        else:
            raise ValueError(f"unknown backend: {backend}")

    def embed(self, texts: list[str]) -> np.ndarray:
        """Return an (N, D) L2-normalised float32 array."""
        if not texts:
            return np.zeros((0, 0), dtype=np.float32)
        vecs = []
        for i in range(0, len(texts), 10):        # both providers cap batch size
            batch = [t[:8000] for t in texts[i:i + 10]]
            resp = self.client.embeddings.create(model=self.model, input=batch)
            vecs.extend(r.embedding for r in sorted(resp.data, key=lambda x: x.index))
        mat = np.array(vecs, dtype=np.float32)
        norms = np.linalg.norm(mat, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return mat / norms


# ── diversity computation ──────────────────────────────────────────────────────

def pairwise_diversity(vecs: np.ndarray) -> tuple[float, list[float]]:
    """
    vecs: (k, D) normalised embeddings of the plans in one condition.
    Returns (diversity, pairwise_sims).  diversity = 1 - mean(sims).
    """
    k = len(vecs)
    sims = [float(vecs[i] @ vecs[j]) for i in range(k) for j in range(i + 1, k)]
    if not sims:
        return float("nan"), []
    return float(1.0 - np.mean(sims)), sims


def load_condition_plans(results_dir: pathlib.Path, task_id: str, mode: str) -> list[dict]:
    path = results_dir / task_id / mode / "plans.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


# ── main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--modes",       nargs="+", default=["kg", "flat", "rag"])
    parser.add_argument("--results-dir", default="batch_results")
    parser.add_argument("--backend",     default="dashscope",
                        choices=["dashscope", "openai"],
                        help="dashscope=primary (Chinese), openai=robustness check")
    args = parser.parse_args()

    results_dir = pathlib.Path(args.results_dir)
    embedder = Embedder(args.backend)

    # Discover task ids: any subdir that holds at least one mode/plans.json
    task_ids = sorted(
        p.name for p in results_dir.iterdir()
        if p.is_dir() and any((p / m / "plans.json").exists() for m in args.modes)
    )
    if not task_ids:
        print(f"No task dirs with plans.json under {results_dir}/.")
        sys.exit(1)

    print(f"Backend: {args.backend} ({embedder.model})")
    print(f"Tasks:   {task_ids}\n")

    rows: list[dict] = []
    for task_id in task_ids:
        for mode in args.modes:
            plans = load_condition_plans(results_dir, task_id, mode)
            if len(plans) < 2:
                print(f"[SKIP] {task_id}/{mode}: only {len(plans)} plan(s)")
                continue

            texts = [render_plan(p) for p in plans]
            vecs = embedder.embed(texts)
            div, sims = pairwise_diversity(vecs)

            rows.append({
                "task_id":     task_id,
                "mode":        mode,
                "n_plans":     len(plans),
                "diversity":   div,
                "mean_sim":    float(np.mean(sims)) if sims else float("nan"),
                "pairwise_sims": ";".join(f"{s:.4f}" for s in sims),
                "backend":     args.backend,
            })
            print(f"[{task_id}/{mode:<4}] diversity={div:.4f}  "
                  f"(sims: {', '.join(f'{s:.3f}' for s in sims)})")

    if not rows:
        print("\nNo diversity computed.")
        sys.exit(1)

    # Write CSV
    out_path = results_dir / f"diversity_results_{args.backend}.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"\n✅ Wrote {len(rows)} rows → {out_path}")

    # Summary table: mean diversity per condition across tasks
    print("\n" + "=" * 52)
    print(f"{'Mode':<8} {'N_tasks':>8} {'diversity µ':>14} {'diversity σ':>14}")
    print("-" * 52)
    for mode in args.modes:
        divs = [r["diversity"] for r in rows
                if r["mode"] == mode and r["diversity"] == r["diversity"]]  # drop nan
        if not divs:
            continue
        print(f"{mode:<8} {len(divs):>8} {np.mean(divs):>14.4f} {np.std(divs):>14.4f}")
    print("=" * 52)
    print("\nEach task contributes one paired observation per condition;")
    print("compare conditions with Wilcoxon signed-rank across tasks.")


if __name__ == "__main__":
    main()
