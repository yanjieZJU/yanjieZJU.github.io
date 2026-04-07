---
title_zh: "HCI领域大语言模型构建"
title_en: "Domain-Specific LLM Fine-tuning for HCI"
period: "2024.10 — 2025.12 | 在投"
role_zh: "学生二作"
role_en: "Student Second Author"
tags: ["LLM", "Fine-Tuning", "LoRA", "Crowd Sourcing"]
cover: ""
github: ""
paper: ""
order: 4
---

围绕HCI设计任务开展垂类大模型构建，将12,743篇论文转化为两个指令微调数据集，走通微调全链路。

## Abstract / 摘要

大语言模型（LLMs）能够生成具有技术可行性的智能系统设计方案，但这些方案往往并未基于具体的人类价值观。我们通过将12,743篇“人机交互”论文提炼成一个数据集来填补这一空白，该数据集展示了人类价值观是如何转化为设计概念的。该数据集包含两个相互关联的微调结构：任务到需求（11,765条记录），将情境映射到用户需求；需求到概念（4,779条记录），将需求映射到技术实现，这使得一个双模块流程得以实现，即大型语言模型（LLMs）按照以人为本的设计步骤生成设计概念。在一项大规模研究中，对六种条件（200名人类参与者、GPT-4o、原始和微调后的Llama-3.1-8B和Mistral-7B-v0.1）进行了比较，1,863名设计专家对2,400个概念进行了评估，评估指标包括有用性、新颖性和以人为中心性。微调后的大型语言模型在所有维度上都表现更优，特别是在阐述与人类价值观一致的设计理由方面。我们的研究结果表明，配备以人为本的数据能够使大型语言模型内化人类价值观向技术规范的动态转换。

## Dataset Construction / 数据集构建


### 文献调研（非成对数据集的构建方式）
#### ⭐ BioinspiredLLM: Conversational large language model for the mechanics of biological and bio-inspired materials ([Advanced Science](https://onlinelibrary.wiley.com/doi/full/10.1002/advs.202306724))

语料库：生物材料领域的1000+篇文章

两种开发训练集方法：
1. 按原样使用文本，默认生成token长度，发现文本中带有残留（例如交叉引用、上下文等），会在数据集中引入噪声
2. QA处理：使用原始llama-2-13B-chat模型进一步处理和清理文本，并从问答对中提取关键见解
    
    a. 将文本解析成块
    
    b. 询问可以通过给定文本块{txt}回答的问题（Eg. Give me a concise question to which the answer is "{txt}". Answer as a question, one sentence, short.）
    
    c. 重新措辞“答案” （Write a succinct summary of key concepts of how "{txt}" answers "{question}". The summary must stand on its own. Never include math, equations, variables and numbers in the response.）

#### ⭐ Large Language Models as biomedical hypothesis generators: a comprehensive evaluation ([COLM'24](https://github.com/TsinghuaC3I/LLM4BioHypoGen))

背景：生物医学数据和文献的指数级增长使得研究人员越来越难以跟上最新发现的步伐并提出新的假设。知识发现过程的核心是合理假设的制定。

数据集构建：来自生物医学文献的“背景-假设”对数据集，共2700组（2500训练集、200测试集）

1. 根据文献主题和内容组成论文集
2. 利用chatgpt和gpt-4对文献知识进行总结
3. 生成背景-假设对
4. 过滤低质量数据
5. 根据发布时间对数据集进行拆分


```card
在构建微调数据集时，通常需要将非成对数据整理成问答格式，常见的格式有alpaca和sharegpt格式，在本文中，我们使用alpaca格式整理数据集，包含instruction、input和output三个字段，instruction字段为任务描述，包括角色设定和任务指令，input字段为输入数据（场景、需求等），output字段为输出数据（设置、技术方法等）。
```

### 两级指令微调数据集

#### Task-to-Requirement 数据集
该数据集的目的是训练模型提出在特定情境下能够解决或优化需求的方法，并提供相应的理论依据。这一步骤将用户输入的需求转化为基于文章证据的具体变量或技术，为后续的设计迭代提供可操作的指导。

因此，我们专注于从研究文章的实验部分中提取因变量与自变量之间的关系，其中特定的设计变量被调整以观察其对人类表现和状态指标的影响。这一过程的核心是使用 gpt-4o-mini模型识别自变量和因变量之间具有统计学意义的正相关关系。这一过程由结构化的提示引导。

模型提取的信息被组织成“自变量 - 设置 - 结论”的关系三元组。每个关系都被转换为“设置：优化 {自变量} 为 {设置}。理由：{结论}”的格式，作为输出字段。影响同一因变量的自变量均列在同一输出项中。输入字段的设计包含了背景信息（结合应用场景和目标用户）以及以优化目标形式表述的要求。

模板：
```json
{
    "Instruction": "You are a design expert in Human-Computer Interaction and Ergonomics/human factors. You'll be presented with requirements and related context, including application scenarios and targeted users. Here are your tasks: (1) Provide some settings for achieving the requirements that are suitable for the context. These settings must provide clear and actionable guidance for design by optimizing a particular system, interaction technique, design, etc. The description should avoid vague or non-specific terms and ensure that each setting is not repeated. (2) Give the reason why the settings can solve the requirements. All settings must be tightly aligned with the core requirement, ensuring their direct relevance.",

    "Input": "Here's the context: {application scenario and target user}. Here is the requirement: {requirements}.",

    "Output": "Setting 1: Optimize {independent varialb} to {setting}. Reason:{conclusion}. ..."
}
```


#### Requirement-to-Concept 数据集

该数据集的目的是根据使用场景和需求提出具体的解决方案。每篇HCI文章都被转换为一个单独的实例，该实例由输入和相应的输出组成。输入字段填充了从原始文章中确定的应用场景、目标用户和需求等内容。输出字段被设计为一个四步骤流程，由原始文章中所呈现的原型设计和实现细节综合而成。该转换按照以下步骤进行：
1. 第一步（构思阶段）：将文章最初的设计理念进行了重新表述，以描述“实现这些要求的思路”。
2. 第二步（功能）：所提出设计方案的总体描述。
3. 第三步（详情）：详细列出了具体的技术要素和设计细节，例如系统输入和输出、设计材料等。
4. 第四步（实施）：详细记录了具体的实施或部署方法，例如具体的软件参数设置或硬件配置。
   
这种结构化的输出旨在描绘从概念构思到实际实施的整个工作流程，为模型提供清晰且全面的学习依据。

案例：
```json

{
    "Instruction": "You are an excellent designer at using advanced technologies to solve design requirements. You'll be presented with requirements and related context, including application scenarios and targeted users. Please provide an innovative solution that solves the requirements according to the context. Firstly, provide your thoughts on how and why the proposed function can solve the problem. Secondly, provide the detailed functions of your solution. Thirdly, provide advanced technical methods. Fourthly, provide implementation details to achieve the function and technical methods. You should abide by the following rules: (1) You should give innovative and feasible solutions, and don't make up non-existent technologies. (2) Ensure that every requirement is explicitly addressed and accounted for in the solution. (3) Implementation details could include key parameters (e.g., model versions, hardware specifications). If you are uncertain about these details, omit them. Do not provide speculative or inaccurate data.",

    "Input": "Here's the context:{application scenario and target user}. In order to achieve the requirements {requirements}, what solutions can be proposed?",

    "Output": "Step 1: My thoughts about achieving the requirements are {reason}. Step 2: In this case, I introduce this function: {function}. Step 3: Details: {details}. Step 4: Implementation: {implementation}."
}
```

## Fine-Tuning Pipeline / 微调链路

### 文献调研

<table>
  <thead>
    <tr>
      <th>标题</th>
      <th>主要内容</th>
      <th>模型选型</th>
      <th>数据集</th>
      <th>微调方法</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <a href="https://github.com/MAGIC-AI4Med/MMedLM?tab=readme-ov-file">Towards building multilingual language model for medicine</a><br><br>
        NC 2024
      </td>
      <td>
        1. 构建了一个多语言医学语料库（25.5B token，6种语言）；<br>
        2. 提出一种包含推理的多语言医学多项选择问答基准 MMedBench；<br>
        3. 在该基准上评估了多个开源 LLM，选择出最终模型 MMed-Llama3，仅有 8B 参数
      </td>
      <td>
        <strong>闭源 LLMs：</strong>GPT-3.5；GPT-4；Gemini-1.0 Pro；Flan-Palm（无法进一步训练）<br><br>
        <strong>流行开源 LLMs：</strong>InternLM2；Mistral；Llama2；Llama3-7B等<br><br>
        <strong>医学专用开源 LLMs：</strong>MedAlpaca；ChatDoctor-7B等<br><br>
        <strong>基于 MMedC 进一步训练的 LLMs：</strong>MMedLM（基于 InternLM）；MMedLM2（基于 Intern2）；MMed-Llama3（基于 Llama3）<br><br>
      </td>
      <td>
        <strong>MMedBench 训练集 &amp; 测试集：</strong><br>
        53566 个问答对（45048 个训练对和 8518 个测试对，约 4:1）<br>
        一个包含 1136 个问答对的子集，每个问答对都附有经过人工验证的推理句，作为推理评估的更专业基准
      </td>
      <td>
        在零样本、参数高效微调（PEFT）和全量微调设置下进行测试<br><br>
      </td>
    </tr>
        </tr>
        <tr>
        <td>
        <a href="https://www.nature.com/articles/s41562-024-02046-9">Large Language Models surpass human experts in predicting neuroscience results</a><br><br>
        Nature human behavior 2024
      </td>
      <td>
        在大量科学研究文献上训练的LLMs有可能整合杂乱但互相关联的发现，以比人类专家更好的方式预测新结果；<br>
        创建了BrainBench，一个用于预测神经科学结果的基准；发现LLMs在预测实验结果方面超越了专家；在神经科学文献上微调的BrainGPT表现更好
      </td>
      <td>
        通用模型测试：<br>
        Galactica-6.7B/30B/120B；Falcon-40B/180B-base/instruct；Llama2-7/13/70B-base/chat；Mistral-7B-base/instruct<br><br>
      </td>
      <td>
        BrainBench：[前瞻性基准]人类专家制作的200个测试用例，GPT-4生成的100个测试用例[对一篇已发表的摘要进行修改，改变基本结果，需要选择出正确的一版]
      </td>
      <td>
        LoRA 微调<br><br>
      </td>
    </tr>
    <tr>
        <td>
        <a href="https://arxiv.org/pdf/2402.06852">ChemLLM: A Chemical Large Language Model</a><br><br>
      </td>
      <td>
        提出首个专注化学的LLM（取得了与GPT-4相当的结果）；ChemData：专门设计的数据集用于指令微调
      </td>
      <td>
        <strong>基础模型：</strong>InternLM2-Base-7B <br>
        第一阶段：使用Multi-Corpus（1.7M通用问答数据集from Huggingface）训练，增强泛化能力（InternLM2-Chat-7B）<br>
        第二阶段：使用ChemData和Multi-Corpus的混合数据进行微调<br>
        <strong>与ChemLLM进行对比的通用模型：</strong>Llama2-7B、Mistral-7B、ChatGLM3-6B、InternLM-chat-7B、Owen-7B、GPT3.5、GPT-4
      </td>
      <td>
        7 Million指令调优问答对 &amp; ChemBench 包含4100+单选题
      </td>
      <td>
        分布式训练（SLURM集群管理系统）；ZeRO++（零冗余优化技术，减少内存溢出）；LoRA<br><br>
      </td>
  </tbody>
</table>


```card
**核心洞察**
1. 强大的基础模型能够提升最终结果
2. 较小模型和较大模型表现相当
3. 基础版本优于指令/聊天版本——将LLM调整为进行自然语言对话会阻碍其科学推理能力（推测）
```

### 本项目数据特征

1. 开放式问题

针对某个特殊场景下目标人群的特定需求提出的解决方案并没有标准答案。测试集的结果尽管有词嵌入相似度BERTScore作为参考，也不能单独以此为依据量化某个模型的性能。模型性能的评判取决于人工评估过程。

2. 数据涉及领域广
   
传统微调模型限定的任务场景小，例如癌症医疗、健身教练、化学领域名词对象关系提取、数学问题推理等，而设计任务可能同时涉及多个领域如驾驶训练、网球教练、AI赋能农业、安全保障设计等。这些领域内部的专业知识模型难以学习到，但模型可以做到针对特定领域任务提出相应的最新技术构建可行的解决方案。

### 模型选型

考虑维度：模态；输入和输出数据的大小；任务复杂度；预算；安全性

- 通用开源LLMs（用于微调/基线对比）：Llama3-8B；Mistral-7B；InternLM3-8B；InternLM2-7B/8B
- 闭源SOTA模型（用于基线对比）：GPT-4 omni/4.5/o3；Claude4-sonnet/opus；Gemini-2.5-pro

```card
**模型变体选择**

- 选择Base的情况：
  - 任务与通用NLP差异大（高度专业化，如医学实体识别、法律文本分析）。
  - 需要完全控制模型行为（避免Instruct/Chat的预设偏差，如拒绝回答某些问题）。
- 选择Instruct的情况：
  - 任务符合常见指令（如摘要生成、翻译、封闭域问答）。
  - 数据量少，希望减少微调成本。
- 选择Chat的情况：
  - 任务需多轮交互或拟人化回复（如心理咨询机器人）。
  - 通常无需微调，或仅微调对话风格

```

### 微调方法选择
**全量微调 VS 参数高效微调**

全量微调：通常能达到更高的性能上限，尤其是当目标任务与预训练任务差异较大时；当训练数据较少时容易出现过拟合

参数高效微调：仅更新少量参数，显存占用显著降低，但性能可能略低于全量微调

**最终方案**

<table>
  <thead>
    <tr>
      <th>方法</th>
      <th>开源模型</th>
      <th>闭源模型</th>
      <th>评估指标</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>/</td>
      <td>/</td>
      <td>
        Gemini-2.5-Pro<br>
        Claude-Sonnet-4<br>
        Openai-o3
      </td>
      <td rowspan="3">
        BERTScore<br><br>
        ROUGE-L（最长公共子序列匹配）<br><br>
        人工评估【比原始模型好】
      </td>
    </tr>
    <tr>
      <td>
        LoRA<br>
        快速训练测试
      </td>
      <td>
        Qwen2.5-7B-base/instruct<br>
        Llama3.1-8B-base/Instruct<br>
        <hr style="border:none;border-top:1px solid #ddd;margin:8px 0">
        Falcon3-7B-Base<br>
        Mistral-7B-v0.1<br>
        InternLM2-7B/8B
      </td>
      <td>/</td>
    </tr>
    <tr>
      <td>
        Full SFT<br>
        寻找性能上限
      </td>
      <td>针对上述表现最佳的模型</td>
      <td>/</td>
      <td></td>
    </tr>
  </tbody>
</table>

### 微调实现

使用[LLaMA-Factory](https://github.com/hiyouga/LlamaFactory)框架进行微调（[LLaMA-Factory学习记录](https://my.feishu.cn/wiki/QJB6wrdblicsdVktnB6cW7BOnEd?from=from_copylink)）

**训练过程**

1. 我们首先在Requirement-to-Concept（RC）数据集上按8:2划分训练集和测试集，以LoRA矩阵秩为16进行微调实验，初步得到了各模型在该任务上的性能排序。
2. 随后，我们将LoRA矩阵秩增加至32，并系统探索了不同学习率、Alpha参数及梯度裁剪范数等超参数的组合。最终基于Rouge-L和BERTScore指标，筛选出综合表现最佳的一组超参数配置。
3. 接下来，我们引入Task-to-Requirement（TR）数据集。在混合训练后，模型在RC测试集上的表现较仅使用该数据集训练时有所下降，且模型输出中误出现了调研方案而非设计实现。因此，我们决定改为对每个模型分别针对RC和TR数据集进行独立训练。

