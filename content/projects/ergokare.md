---
title_zh: "基于LLM的人体工效学风险预筛助手"
title_en: "ErgoKARE: LLM-Powered Ergonomic Risk Screening Assistant"
period: "2024.10 — 2025.11"
role_zh: "项目负责人"
role_en: "Project Lead"
tags: ["LLM", "RAG", "GPT-4o", "Prompt Engineering", "工效学"]
cover: ""
github: "https://github.com/yanjieZJU/ErgoKARE"
paper: ""
order: 1
---

## Abstract / 摘要

针对工业场景工效学评估高度依赖人工分析的问题，以知识增强LLM辅助系统替代人工筛查，构建297条高频干预方案知识库，基准准确率提升8.7%，建议有效性提升16.1%，70.8%方案获领域专家偏好。

Industrial ergonomic assessment relies heavily on manual expert analysis. We propose ErgoKARE, a knowledge-augmented LLM system that automates ergonomic risk screening. We built a 297-entry high-frequency intervention knowledge base, achieving +8.7% baseline accuracy, +16.1% recommendation effectiveness, with 70.8% of suggestions preferred by domain experts.

## System Overview

<!-- Add architecture diagram here: ![Architecture](/images/ergokare-arch.png) -->

The system follows a RAG pipeline: user inputs a workplace scenario description → retrieval from the intervention knowledge base → GPT-4o generates risk assessment and intervention suggestions → expert validation loop.

## Key Results / 核心成果

- 构建 297 条高频干预方案知识库 / 297-entry intervention knowledge base
- 基准准确率提升 8.7% / +8.7% baseline accuracy
- 建议有效性提升 16.1% / +16.1% recommendation effectiveness  
- 70.8% 方案获领域专家偏好 / 70.8% suggestions preferred by domain experts

## Implementation Details

- **LLM backbone:** GPT-4o with structured prompt engineering
- **Knowledge base:** 297 curated ergonomic intervention strategies
- **RAG pipeline:** Semantic retrieval + contextual generation
- **Evaluation:** Expert study (n=24) with comparative analysis against baseline
