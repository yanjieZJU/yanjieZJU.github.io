---
title_zh: "DiaMaid：系统设计架构图智能助手（进行中）"
title_en: "DiaMaid: AI-Driven System Architecture Diagram Assistant"
period: "2025.12 — 至今"
role_zh: "项目负责人"
role_en: "Project Lead"
tags: ["LLM", "Multi-Agent", "React", "System Architecture Diagram"]
cover: ""
github: "https://github.com/yanjieZJU/DiaMaid_public"
demo: "http://106.14.161.104/"
paper: ""
order: 5
---

面向研究者与开发者的系统架构图智能助手，可将自然语言需求转为多视角架构方案，并支持对话式编辑与报告导出。

## System Design / 系统设计

### LLM 工作流

<chart id="AgentWorkflowDiagram" />

- Planner（LLM）：接收用户需求，计算文章簇的相似性，提出3个不同的perspective以及对应的功能锚点（Anchor）
- Retriever：根据用户创建的节点和planner提供的节点进行检索（包括Node、Structural path）
- Integrator（LLM）：整理所有的知识信息，生成固定格式的方案，功能还包括接收审查到的冲突，在原始方案上进行修改
- ConflictDetector：检查方案中的冲突（孤立节点、重复连线等等）
- Editor（Agent）：接受用户的查询和修改指令，明确意图，调用检索工具进行回复（解答疑惑）或方案修改（添加节点、修改逻辑等）

### 知识图谱
1. 文章提取：收集1200+篇HCI领域文章，以系统架构图为核心，结合全文内容提取出功能模块与连接关系
2. 在Neo4j中构建知识图谱，节点分为三类，文章、功能模块和模块角色，边为连接关系（包含模块的连接、文章与模块的包含关系、模块与角色的属性关系）
3. 参考GraphRAG的思路，将文章节点和功能节点进行聚类，得到514个功能簇（Function Communities）和101个场景簇（Scene Clusters），每个功能簇拥有一段描述；在每个场景簇中统计了功能簇的出现频率和拓扑模式，得到在该场景下较为关键或常用的功能和数据流。
![Knowledge Graph Structure](diamaid/KG_2.png)