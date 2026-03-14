import os
import json
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import uvicorn
from pipeline_runner import run_pipeline, run_edit_pipeline # Updated Import
import sys
import hashlib
from datetime import datetime
# Add parent directory to path for config import
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import *
from session_manager import SESSIONS_DIR, create_modified_plan, get_session_tree
from exporter import export_to_docx

app = FastAPI()

# --- CORS Setting ---
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- LLM Client Setting ---
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"), base_url=os.getenv("OPENAI_BASE_URL"))

from typing import Optional, Union # Add Optional and Union


# --- 3. 定义请求数据格式 ---
class AnchorDef(BaseModel):
    user_term: str
    description: str = ""

class RelationDef(BaseModel):
    source: str
    target: str
    type: str = "FLOWS_TO"

class GenRequest(BaseModel):
    session_id: Optional[str] = None # Added session_id
    prompt: str          # 用户的总体描述
    anchors: list[AnchorDef] = []
    relations: list[RelationDef] = []
    userNodes: list[str] = [] # 用户定义的纯文本节点列表 (作为后续预留或旧版本兼容)
    allowRandomNodes: bool = False # 是否允许生成随机节点

class EditRequest(BaseModel):
    session_id: Optional[str] = None # Added session_id
    plan_id: Optional[str] = None # Actually represents parent_node_id now
    current_plan: dict
    instruction: str
    original_query: str

class ExportRequest(BaseModel):
    image: str # Base64 encoded image string
    plan: Union[dict, list] # Module details json
    overall_description: Optional[str] = None

class SaveRequest(BaseModel):
    session_id: Optional[str] = None
    plan_id: Optional[str] = None
    current_plan: dict
    original_query: Optional[str] = None

# --- 4. 核心接口 ---
@app.post("/generate")
async def generate_mermaid(req: GenRequest):
    print(f"收到请求: 描述={req.prompt}, 允许随机节点={req.allowRandomNodes}")
    # 打印前几个节点看看格式
    if req.userNodes:
        print(f"节点示例: {req.userNodes[:3]}...")
    
    print(f"Calling streaming run_pipeline with:")
    print(f"    user query: {req.prompt}")
    print(f"    Anchors: {len(req.anchors)}")
    print(f"    Relations: {len(req.relations)}")
    
    anchors_list = [a.model_dump() for a in req.anchors]
    relations_list = [r.model_dump() for r in req.relations]
    
    # 使用 StreamingResponse, media_type设为 ndjson 方便前端按行解析
    def event_generator():
        try:
            # 修改 num_outputs 增加生成方案数量，以流式逐步返回
            for chunk in run_pipeline(
                user_query=req.prompt,
                base_anchors=anchors_list,
                user_relations=relations_list,
                num_outputs=1, 
                divergence=True,
                session_id=req.session_id # Pass session_id
            ):
                yield chunk
        except Exception as e:
            print(f"Pipeline error: {e}")
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

@app.post("/edit")
async def edit_architecture(req: EditRequest):
    print(f"收到修改请求: 指令={req.instruction}, PlanID={req.plan_id}")
    try:
        md = req.current_plan.get("module_details", {})
        md_str = json.dumps(md, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        sha = hashlib.sha256(md_str).hexdigest()
        count = len(md) if isinstance(md, dict) else (len(md) if isinstance(md, list) else 0)
        print(f"接收模块数={count}, SHA={sha}")
    except Exception as e:
        print(f"接收架构摘要失败: {e}")
        sha = None
    # 将“前端上传的当前架构”作为一次版本节点写入会话树，并把后续 Editor 结果挂在其下
    effective_parent_id = req.plan_id
    try:
        pre_desc = req.current_plan.get("overall_description", "前端上传的当前架构")
        new_pre_id = create_modified_plan(
            session_id=req.session_id or "anonymous_session",
            parent_node_id=req.plan_id,
            user_instruction="(用户上传) 前端当前架构",
            original_query=req.original_query or "",
            modified_description=pre_desc,
            modified_arch_json=req.current_plan,
            perspective_prefix="(手动快照)"
        )
        print(f"已在会话树中保存编辑前快照节点: {new_pre_id}")
        effective_parent_id = new_pre_id
    except Exception as e:
        print(f"保存编辑前快照到会话树失败: {e}")
    
    def event_generator():
        try:
            try:
                first_msg = {"type": "progress", "message": f"已接收架构: {sha[:8] if sha else 'unknown'}", "percent": 10}
                yield json.dumps(first_msg) + "\n"
            except Exception:
                pass
            # 使用 run_edit_pipeline 处理修改
            for chunk in run_edit_pipeline(
                plan_id=effective_parent_id,
                current_plan_json=req.current_plan,
                user_instruction=req.instruction,
                original_query=req.original_query,
                session_id=req.session_id # Pass session_id
            ):
                yield chunk
        except Exception as e:
            print(f"Edit Pipeline error: {e}")
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

@app.post("/sessions/save")
async def save_snapshot(req: SaveRequest):
    try:
        desc = req.current_plan.get("overall_description", "Manual Save")
        new_id = create_modified_plan(
            session_id=req.session_id or "anonymous_session",
            parent_node_id=req.plan_id,
            user_instruction="(手动保存) 用户保存当前架构",
            original_query=req.original_query or "",
            modified_description=desc,
            modified_arch_json=req.current_plan,
            perspective_prefix="(手动保存)"
        )
        return JSONResponse({"status": "ok", "new_plan_id": new_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/revert")
async def revert_to_parent(session_id: Optional[str] = Query(None), plan_id: Optional[str] = Query(None)):
    if not plan_id:
        raise HTTPException(status_code=400, detail="Missing session_id or plan_id")
    sid = session_id or "anonymous_session"
    tree = get_session_tree(sid)
    nodes = tree.get("nodes", {})
    if plan_id not in nodes:
        raise HTTPException(status_code=404, detail="Plan not found")
    current = nodes[plan_id]
    parent_id = current.get("parent_id")
    if not parent_id:
        raise HTTPException(status_code=404, detail="Already at root; no parent to revert")
    if parent_id not in nodes:
        raise HTTPException(status_code=404, detail="Parent plan not found")
    parent = nodes[parent_id]
    arch = parent.get("arch_json", {})
    return JSONResponse({
        "status": "ok",
        "plan": {
            "plan_id": parent_id,
            "arch_json": arch,
            "description": parent.get("description", arch.get("overall_description", "")),
            "perspective": parent.get("perspective", "")
        }
    })

@app.post("/export")
async def export_document(req: ExportRequest):
    print("Received request to export docx.")
    try:
        doc_stream = export_to_docx(image_b64=req.image, node_details=req.plan)
        headers = {
            'Content-Disposition': 'attachment; filename="architecture_plan.docx"'
        }
        return StreamingResponse(
            doc_stream, 
            headers=headers,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except Exception as e:
        print(f"Error exporting Docx: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # 启动服务，端口 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
