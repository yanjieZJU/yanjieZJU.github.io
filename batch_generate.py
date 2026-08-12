"""
Batch generation script for the three-condition ablation experiment.

Input : tasks.json  — list of {id, description, anchors?, relations?}
Output: batch_results/{task_id}/{mode}/
          plans.json          — all raw plan dicts
          option_{n}.png      — X6 diagram screenshot (Playwright)
          option_{n}.docx     — Word export (text + X6 screenshot)

Prerequisites:
    pip install playwright && playwright install chromium
    Vite dev server must be running:  cd client && npm run dev

Usage:
    python batch_generate.py [--tasks tasks.json] [--modes kg flat rag]
                             [--out-dir batch_results]
                             [--base-url http://localhost:8000]
                             [--frontend-url http://localhost:5173]
                             [--warmup-timeout 120]
"""

import argparse
import base64
import json
import pathlib
import sys
import time
import uuid

import requests

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from x6_screenshot import screenshot_plan

DEFAULT_BASE_URL     = "http://localhost:8000"
DEFAULT_FRONTEND_URL = "http://localhost:5173"


# ── helpers ────────────────────────────────────────────────────────────────────

def warmup(base_url: str, mode: str, timeout: int) -> None:
    """Trigger warmup endpoint and poll /ready/{mode} until ready."""
    r = requests.post(f"{base_url}/warmup/{mode}", timeout=10)
    if r.status_code not in (200, 202):
        raise RuntimeError(f"Warmup POST /warmup/{mode} returned {r.status_code}: {r.text}")

    print(f"  [{mode}] warmup started, waiting...", flush=True)
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            status = requests.get(f"{base_url}/ready/{mode}", timeout=5).json()
            if status.get("ready"):
                print(f"  [{mode}] ready.", flush=True)
                return
        except Exception:
            pass
        time.sleep(3)
    raise TimeoutError(f"[{mode}] not ready after {timeout}s")


def generate(base_url: str, mode: str, task: dict, session_id: str) -> tuple[list[dict], list[dict]]:
    """POST /generate, consume NDJSON stream.

    Returns (plans, references):
      plans      — list of plan_data dicts
      references — list of per-plan reference sets (R_p) for faithfulness eval,
                   each {plan_id, option_id, perspective, query, references}
    """
    payload = {
        "session_id": session_id,
        "prompt": task["description"],
        "anchors": task.get("anchors", []),
        "relations": task.get("relations", []),
        "retrieval_mode": mode,
        "allowRandomNodes": False,
    }
    plans, errors = [], []
    references_by_option = {}   # option_id -> reference set

    with requests.post(
        f"{base_url}/generate", json=payload, stream=True, timeout=(10, 300)
    ) as resp:
        if resp.status_code != 200:
            raise RuntimeError(f"/generate {resp.status_code}: {resp.text[:300]}")
        for raw in resp.iter_lines():
            if not raw:
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            t = msg.get("type")
            if t == "plan":
                plans.append(msg["plan_data"])
            elif t == "plan_references":
                opt = msg["option_id"]
                references_by_option[opt] = {
                    "plan_id":     msg.get("plan_id", ""),
                    "option_id":   opt,
                    "perspective": msg.get("perspective", ""),
                    "query":       msg.get("query", ""),
                    "references":  msg.get("references", {}),
                }
            elif t == "progress":
                print(f"    {msg.get('percent','?')}%  {msg.get('message','')}", flush=True)
            elif t == "error":
                errors.append(msg.get("message", ""))

    if errors:
        print(f"  ⚠️  pipeline errors: {errors}", flush=True)
    references = [references_by_option[k] for k in sorted(references_by_option)]
    return plans, references


def export_docx(base_url: str, plan: dict, image_b64: str) -> bytes:
    """POST /export with server-rendered diagram, return .docx bytes."""
    payload = {
        "image": image_b64,
        "plan": plan.get("node_details", []),
        "overall_description": plan.get("description", ""),
        "plan_id": plan.get("plan_id", ""),
    }
    r = requests.post(f"{base_url}/export", json=payload, timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"/export {r.status_code}: {r.text[:300]}")
    return r.content


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tasks",          default="tasks.json")
    parser.add_argument("--modes",          nargs="+", default=["kg", "flat", "rag"])
    parser.add_argument("--out-dir",        default="batch_results")
    parser.add_argument("--base-url",       default=DEFAULT_BASE_URL)
    parser.add_argument("--frontend-url",   default=DEFAULT_FRONTEND_URL)
    parser.add_argument("--warmup-timeout", type=int, default=120)
    args = parser.parse_args()

    tasks_path = pathlib.Path(args.tasks)
    if not tasks_path.exists():
        print(f"ERROR: {tasks_path} not found.")
        sys.exit(1)

    tasks  = json.loads(tasks_path.read_text(encoding="utf-8"))
    out_dir = pathlib.Path(args.out_dir)
    out_dir.mkdir(exist_ok=True)

    print(f"Tasks: {len(tasks)}  |  Modes: {args.modes}  |  Output: {out_dir.resolve()}")

    for mode in args.modes:
        print(f"\n{'='*60}\n  Warming up mode: {mode}\n{'='*60}")
        try:
            warmup(args.base_url, mode, args.warmup_timeout)
        except Exception as e:
            print(f"  ERROR warming up [{mode}]: {e} — skipping.")
            continue

        for task in tasks:
            task_id = str(task["id"])
            print(f"\n  Task {task_id!r} [{mode}]: {task['description'][:70]}")

            task_dir = out_dir / task_id / mode
            task_dir.mkdir(parents=True, exist_ok=True)

            session_id = str(uuid.uuid4())
            try:
                plans, references = generate(args.base_url, mode, task, session_id)
            except Exception as e:
                print(f"  ERROR: {e}")
                (task_dir / "error.txt").write_text(str(e), encoding="utf-8")
                continue

            if not plans:
                print("  WARNING: no plans returned.")
                (task_dir / "error.txt").write_text("no plans returned", encoding="utf-8")
                continue

            # Save raw JSON
            (task_dir / "plans.json").write_text(
                json.dumps(plans, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(f"  ✅ {len(plans)} plans → plans.json")

            # Save per-plan references (R_p) for offline faithfulness evaluation
            if references:
                (task_dir / "references.json").write_text(
                    json.dumps(references, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                print(f"  ✅ {len(references)} reference sets → references.json")

            for plan in plans:
                opt          = plan.get("option_id", "?")
                node_details = plan.get("node_details", [])

                # 1. Screenshot via Playwright + X6FlowViewer
                png_path = task_dir / f"option_{opt}.png"
                img_b64  = ""
                try:
                    img_b64   = screenshot_plan(node_details, frontend_url=args.frontend_url)
                    png_bytes = base64.b64decode(img_b64.split(",", 1)[1])
                    png_path.write_bytes(png_bytes)
                    print(f"     option {opt} PNG → {png_path.name} ({len(png_bytes)//1024}KB)")
                except Exception as e:
                    print(f"     option {opt} PNG ERROR: {e}")

                # 2. Export DOCX (embed X6 screenshot as diagram)
                docx_path = task_dir / f"option_{opt}.docx"
                try:
                    docx_bytes = export_docx(args.base_url, plan, img_b64)
                    docx_path.write_bytes(docx_bytes)
                    print(f"     option {opt} DOCX → {docx_path.name} ({len(docx_bytes)//1024}KB)")
                except Exception as e:
                    print(f"     option {opt} DOCX ERROR: {e}")

    print(f"\n✅ Batch complete.  Results in: {out_dir.resolve()}")


if __name__ == "__main__":
    main()
