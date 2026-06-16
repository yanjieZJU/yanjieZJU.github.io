---
title_zh: "ArchCanvas：系统设计架构图智能助手"
title_en: "ArchCanvas: AI-Driven System Architecture Diagram Assistant"
period: "2024.12 — 至今（在投）"
role_zh: "项目负责人"
role_en: "Project Lead"
tags: ["LLM", "AI Agent", "Knowledge Graph", "React", "Architecture Diagram"]
cover: ""
github: "https://github.com/yanjieZJU/DiaMaid_public"
demo: ""
paper: ""
order: 2
---

面向 HCI 研究者的系统架构图智能助手。基于 1200+ 篇论文构建的领域知识图谱，将自然语言需求转化为多视角架构方案，支持跨方案引用、对话式编辑与设计文档导出。
```card
**Highlights**
- 图表作为设计师思考和细化概念的媒介。
- 一个包含1,215篇人机交互产品论文的知识图谱，用于捕捉功能模块和拓扑模式。
- 在人工智能辅助设计中，结构完整性与设计师自主性之间存在权衡关系。

```

## Overview / 项目背景

HCI 研究者在设计 LLM 驱动的交互系统时，需要构建系统架构图来组织功能模块与数据流。这个过程面临两个核心困难：一是研究者对相关技术方案的了解往往局限于自身阅读范围，难以系统性地获取领域内已有的设计模式；二是从零开始构建架构图需要反复迭代模块划分、连接逻辑和技术选型，耗时且容易遗漏关键组件。

现有工具要么聚焦于视觉层面的图表生成（NanaDraw、Figma AI），要么提供通用的软件图表格式转换（DiagramGPT），均未深入解决"设计知识获取"这一上游问题。ArchCanvas 的核心思路是将 HCI 领域的设计知识结构化为可检索的知识图谱，在架构设计过程中主动提供多视角的方案参考，让研究者在探索阶段就能获得更广泛的设计灵感和技术选项。

现有的大语言模型辅助概念设计工具通常以文本形式组织创意，难以有效传达复杂的结构和顺序关系。对于需要展现不同功能模块如何连接与交互的设计概念而言，基于文本的描述会阻碍设计师在脑海中构建并探索这些架构的能力。因此需要更结构化、图示化的表达方式来支撑创意过程。


## Competitor Analysis / 竞品分析

<chart id="CompetitorAnalysis" />

ArchCanvas 与现有工具的关键差异在于"领域知识深度"和"交互灵活性"两个维度。NanaDraw 擅长将文字描述转化为高质量的学术插图，DiagramGPT 在工程图表的格式覆盖和生态集成上更成熟，Figma AI 依托设计工具生态提供协作能力。ArchCanvas 的独特价值是知识图谱驱动的多方案发散生成——它不只是画图工具，而是设计思考的辅助。

<chart id="SwotAnalysis" />


## Design Goals / 设计目标

```card
**目标用户**
HCI 领域研究者和交互设计师，正在设计围绕一个系统需求进行概念设计，需要构建系统架构图来组织和表达设计方案。
```

基于竞品分析和用户痛点，ArchCanvas 聚焦以下设计目标：

**DG1 — 知识驱动的方案生成**：从领域文献中提取结构化的功能模块和连接模式，在用户输入需求后自动检索相关设计知识，生成多个不同视角的架构方案，而非仅依赖 LLM 的通用生成能力。

**DG2 — 多方案对比与融合**：同时呈现多个设计方案，支持用户在方案间对比、从备选方案中引用模块到当前方案，降低设计探索的认知负担。

**DG3 — 双通道编辑**：对于复杂的结构性修改（添加模块、调整数据流），提供自然语言对话编辑；对于精细调整（重命名、拖动布局），保留直接操作。两种方式互补，适配不同粒度的编辑需求。

**DG4 — 结构一致性保障**：通过 ConflictDetector 在每次生成和编辑后自动检查方案中的结构问题（孤立节点、重复连线、缺失接口），确保输出方案的逻辑完整性。


## System Design / 系统设计

### LLM 工作流
![pipeline](diamaid/pipeline.png)

- Planner（LLM）：接收用户需求，计算文章簇的相似性，提出3个不同的perspective以及对应的功能锚点（Anchor）
- Retriever：根据用户创建的节点和planner提供的节点进行检索（包括Node、Structural path）
- Integrator（LLM）：整理所有的知识信息，生成固定格式的方案，功能还包括接收审查到的冲突，在原始方案上进行修改
- ConflictDetector：检查方案中的冲突（孤立节点、重复连线等等）
- Editor（Agent）：接受用户的查询和修改指令，明确意图，调用检索工具进行回复（解答疑惑）或方案修改（添加节点、修改逻辑等）

### 记忆机制
ArchCanvas 的 EditorAgent 记忆系统采用三层架构：

**Tier 1**

Working Snapshot（工作快照）：根据用户当前意图，提取目标模块，加上端口图的 one-hop 邻居，构成焦点集合。画布超过8个模块时，焦点外模块只保留名称和端口（拓扑完整但省去描述），焦点内保留完成描述。这让 prompt 长度可控，同时不丢失结构信息。


**Tier 2**

Episodic Memory（情境记忆）：滑动窗口保留最近 3 轮的原始操作记录，包括用户指令、主意图、修改意图、修改日志。

**Tier 3**

Semantic Long-term Memory（长时记忆）：running_summary 每5轮压缩一次全局摘要；entity_journal 按模块名记录变更轨迹；open_questions 收集未处理的探索意图。

**持久化策略**

每个 session-tree 节点携带完整记忆快照。分支创建时继承 fork 点的记忆，之后独立演化。load_memory() 沿 父节点上溯查找最近的快照，支持树状版本管理。

### 知识图谱

<chart id="KnowledgeGraphDemo" />

1. 文章提取：收集1200+篇HCI领域文章，以系统架构图为核心，结合全文内容提取出功能模块与连接关系
2. 在Neo4j中构建知识图谱，节点分为三类，文章、功能模块和模块角色，边为连接关系（包含模块的连接、文章与模块的包含关系、模块与角色的属性关系）
3. 参考GraphRAG的思路，将文章节点和功能节点进行聚类，得到514个功能簇（Function Communities）和101个场景簇（Scene Clusters），每个功能簇拥有一段描述；在每个场景簇中统计了功能簇的出现频率和拓扑模式，得到在该场景下较为关键或常用的功能和数据流。
<!-- ![Knowledge Graph Structure](diamaid/KG_2.png) -->

### 界面设计
**初始界面**

![startpage](diamaid/startpage.png)

初始界面支持通过文本（a）和图形输入（b）来初步表达想法。提交后，ArchCanvas 会从其场景库中检索语义相关的设计案例，并生成3个初始设计方案，每个方案都基于从不同场景簇中提取的独特设计视角。


**编辑工作区**
![workspace](diamaid/workspace.png)


中央画布（d）：以有向节点链接图的形式渲染所选方案的完整系统架构。布局从左至右，反映了系统的数据流。模块被组织成4个粗粒度的功能类别——input/process/output/data，并用不同的颜色编码以提高结构的可读性。

画布支持直接操作：双击节点以重命名、拖动端口来绘制新的连接、选择并删除边、拖动模块来重新组织布局；通过工具栏中的“+ 模块”和“+ 子节点”按钮添加全新的模块。这些操作提供了精细的、结构感知的编辑。

描述面板（e）：显示该模块的详细信息，包括功能作用和技术方法，以及相关文献的参考。该面板默认隐藏，遵循渐进式显示策略，在用户主动请求详细模块信息之前，保持工作区简洁。

对比视图（f）：供用户查看另外两个备选方案，支持切换和“引用”操作。系统自动将引用模块连接到当前数据流中。


对话面板（g）：发出自然语言修改指令或提出提问，保留设计意图、修改记录、画布状态上下文。

导出（h）：将当前设计方案导出为一份结构化的word文档。导出文档自动整合了三类内容：方案总体描述、架构图及模块详细说明。

<!-- [Have a try ➡](http://106.14.161.104/) -->


## Evaluation / 用户实验

我们通过一项被试内实验（N=24）评估 ArchCanvas 的有效性。参与者在 ArchCanvas 和 baseline（对话式 LLM + 白板工具）两种条件下分别完成一个开放式设计任务（25 分钟），任务顺序和条件顺序进行了完全平衡。

### 设计方案质量

两位设计专家独立评分（ICC 0.724–0.855），ArchCanvas 在全部四个维度上显著优于 baseline。完整性（Completeness）改进最大（Cohen's d = 1.23），反映知识图谱驱动的方案生成为设计方案提供了更完整的结构基础。

<chart id="QualityComparison" />

### 创造力支持与用户体验

CSI 量表显示 ArchCanvas 在探索性（Exploration, d=1.64）、表达性（Expression）、愉悦感（Enjoyment）和成果价值（Result Worth Effort）四个维度上显著提升，沉浸感（Immersion）无显著差异。自定义量表中，可理解性（d=1.06）和可控性（d=0.98）提升最为突出。

<chart id="CSIComparison" />

### 交互行为转变

交互日志分析揭示了两种条件下截然不同的设计行为模式。Baseline 下用户主要将 LLM 作为文本格式化工具；ArchCanvas 下用户转向功能层面的结构性操作，其中 66.7% 的功能添加来自跨方案引用——这验证了多方案对比机制的设计价值。

<chart id="BehaviorComparison" />


## Update Record / 更新记录

- 2026.06.16：BUG修复
  - 在意图模块中显式添加“删除”类意图
  - 修改 tool 描述
  - 替换 embedding 模型，选择了阿里云的text-embedding-v4模型（1024 dimension）
  - 使用 deepseek 官方直连，降低延时

- 2026.06.15：系统性模型选型
  - 选型指标：
    1. 生成方案质量：Applicability；Effectiveness；Novelty；Completeness
    2. Latency：TTFT-planner；E2E-planner；E2E-integrator
    3. Reliability：JSON 格式遵循；Schema齐全；LLM自修复率（不需要走自动化resolve）
    4. Cost：单次调用成本；单次完整query成本
  - 步骤：
    1. 撰写 Rubrics（[参考方法](https://github.com/teqkilla/RubricHub)）；与其他量化指标进行权重设计
    2. 设置若干个测试案例-形成评测集（复杂度：软件、软硬结合；领域：HCI、工业）
    3. 在候选模型上跑评测集（每个案例3次取平均），计算最终结果
   
- 2026.06.10：LangSmith集成
    - 解决看不到Editor中间的处理步骤，无法洞察延时和其他问题（如工具调用、模型幻觉）出现位置，无法针对性排查的问题
    - 使用LangSmith来监控Agent调用记录



## Resources / 资源

[产品需求文档 ➡](/diamaid/ArchCanvas_PRD.docx)
