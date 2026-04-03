---
title_zh: "DiaMaid：系统设计架构图智能助手"
title_en: "DiaMaid: AI-Driven System Architecture Diagram Assistant"
period: "2025.12 — 至今"
role_zh: "项目负责人"
role_en: "Project Lead"
tags: ["Multi-Agent", "LLM", "React", "FastAPI", "React Flow", "Mermaid.js"]
cover: ""
github: "https://github.com/yanjieZJU/DiaMaid"
paper: ""
order: 2
---

## Abstract / 摘要

面向研究者与开发者的AI驱动系统架构图生成工具，输入自然语言描述即可生成多视角专业架构方案。结合LLM与Multi-Agent协作，支持对话式编辑、可视化工作区与Word报告导出。

DiaMaid is an AI-driven tool for researchers and developers to generate professional system architecture diagrams from natural language descriptions. It leverages LLM + Multi-Agent collaboration, supporting conversational editing, a visual workspace, and Word report export.

## System Overview

<!-- Add architecture diagram here: ![Architecture](/images/diamaid-arch.png) -->

Multi-Agent pipeline: Planner agent decomposes the input → Diagram agent generates multi-view architecture → Editor agent handles conversational refinement → Export agent produces Word reports.

## Key Results / 核心成果

- 自然语言 → 多视角专业架构图 / Natural language → multi-view architecture diagrams
- 支持对话式编辑 / Conversational editing support
- Word 报告一键导出 / One-click Word report export

## Implementation Details

- **Frontend:** React + React Flow + Mermaid.js
- **Backend:** FastAPI
- **AI layer:** Multi-Agent orchestration with LLM backbone
- **Export:** Docx generation for Word reports
