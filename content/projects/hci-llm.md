---
title_zh: "HCI领域大语言模型构建"
title_en: "Domain-Specific LLM Fine-tuning for HCI"
period: "2024.10 — 2025.12"
role_zh: "项目核心成员"
role_en: "Core Member"
tags: ["SFT", "LoRA", "DPO", "LLaMA-Factory", "Llama-3", "Qwen2.5"]
cover: ""
github: "https://github.com/yanjieZJU"
paper: ""
order: 4
---

## Abstract / 摘要

面向HCI设计任务的垂类模型微调，将12,743篇HCI论文转化为双级指令微调数据集（Task-to-Requirement + Requirement-to-Concept），研究对比SFT、LoRA、DPO等方案，基于LLaMA-Factory完成完整微调链路。

Domain-specific LLM fine-tuning for HCI design tasks. We converted 12,743 HCI papers into a two-level instruction-tuning dataset (Task-to-Requirement + Requirement-to-Concept), compared SFT, LoRA, and DPO approaches, and completed a full fine-tuning pipeline using LLaMA-Factory.

## System Overview

<!-- Add pipeline diagram here -->

Two-level dataset construction pipeline: paper parsing → task extraction → requirement decomposition → concept mapping. Fine-tuning pipeline: data preprocessing → SFT/LoRA/DPO training → evaluation.

## Key Results / 核心成果

- 12,743 篇 HCI 论文转化为指令微调数据集
- 双级数据集：Task-to-Requirement + Requirement-to-Concept
- 完整对比 SFT、LoRA、DPO 三类方案

## Implementation Details

- **Base models:** Llama-3, Qwen2.5
- **Fine-tuning framework:** LLaMA-Factory
- **Methods compared:** SFT, LoRA, DPO
- **Dataset:** 12,743 HCI papers → dual-level instruction pairs
