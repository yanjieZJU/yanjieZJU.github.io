---
title_zh: "Managed Agents 学习笔记"
period: "2026.04"
tags: ["Anthropic", "Agent", "学习笔记"]
cover: ""
order: 0
---



## Goal / 目标：应对进化的AI

传统的 AI 代理系统通常会针对当时模型的弱点设定很多限制或辅助手段。但随着 Claude 的不断进化（比如从 Sonnet 4.5 升级到 Opus 4.5），之前的很多设计反而成了累赘。

目标： 建立一套接口稳定的系统，即使底层的 AI 模型变得越来越聪明，这套框架依然好用，无需推倒重来。

## Core Concepts / 核心概念

### 什么是“Managed”
1. 托管执行：Agent在服务提供商的基础设施上运行
2. 内置的协调机制：由服务提供商来处理多步骤的推理过程
3. 工具/集成管理：与外部服务的连接只需配置一次即可重复使用
4. 状态保持：对话或任务的上下文会在多次调用中得以保留
5. 扩展性与可靠性：服务提供商负责确保系统的可用性

```card
unmanaged agent：用户自行构建和掌控整个系统架构，包括流程编排、工具执行、状态管理、重试机制、扩展性以及监控功能等（LangChain、AutoGen）
```

### 核心概念

| 概念 | 描述 |
| --- | -------- |
| Agent | 模型、系统提示、工具、MCP 服务器和技能 |
| Environment | 已配置的容器模板（软件包、网络访问）|
| Session | 环境中的运行代理实例，执行特定任务并生成输出 |
| Events | 应用程序与代理之间交换的消息（用户轮次、工具结果、状态更新）|

### 思路：“大脑”与“双手”分离

- **大脑**：Agents，包括模型版本、System Prompt、工具定义、MCP连接器等
- **双手**：执行操作的沙箱和工具
- **会话**：会话事件日志

它们各自成为一个接口，任何一个部分都可以独立发生故障或被替换。

1. Agents和Environment 一次创建（返回一个唯一的ID），后续所有 session 均可复用
2. Harness 像调用其他工具一样调用“容器”，如果容器崩溃，Claude可以根据需要按照标准配方创建一个新的容器
3. 会话日志位于 harness 外部，当 harness 发生故障时，可以使用wake(sessionID)重启一个新的 harness，使用getSession(id)获取事件日志，并从上次事件中恢复运行。

### 优势
1. 卓越的系统稳定性：任何组件（包括沙箱容器或控制框架）崩溃时都可以随时重启并从会话日志中恢复，而不会导致整个任务失败或数据丢失。
2. 更强的安全性： 实现了安全边界隔离。敏感的 API 令牌和凭据存储在沙箱之外，AI 生成的不受信任代码无法接触到这些凭据，有效防止了提示注入攻击。
3. 智能的上下文管理： 会话日志独立于 Claude 的上下文窗口。Claude 可以通过 getEvents() 接口有选择地回溯或读取历史记录，避免了因为上下文过长而必须“丢弃记忆”的不可逆决策。

### 使用方法
1. 环境准备
```
pip install anthropic
export ANTHROPIC_API_KEY = "sk-ant-xxx"
```

2. 创建 Agent
```
from anthropic import Anthropic

client = Anthropic()

agent = client.beta.agents.create(
    name="Coding Assistant",
    model="claude-sonnet-4-6",
    system="You are a helpful coding assistant. Write clean, well-documented code.",
    tools=[
        {"type": "agent_toolset_20260401"},  # 全量内置工具
    ],
)
print(f"Agent ID: {agent.id}")
```

Managed Agent 内置的工具（agent_toolset_20260401）：
| 工具名 | 描述 | 需要权限 |
| --- | ----- | ---|
| bash | 在容器内的shell会话中执行命令 | 需要 |
| read | 读取本地文件系统中的文件 | 不需要 |
| write | 将文件写入本地文件系统 | 需要 |
| edit | 对文件执行精准字符串替换 | 需要 |
| glob | 使用glob模式快速匹配文件名 | 不需要 |
| grep | 使用正则表达式搜索文件内容 | 不需要 |
| web_fetch | 抓取指定URL的页面内容 | 需要 |
| web_search | 在互联网上搜索信息 | 需要 |

3. 创建 Environment
```
environment = client.beta.environments.create(
    name="quickstart-env",
    config={
        "type": "cloud",
        "networking": {"type": "unrestricted"},
    },
)
```
4. 启动 Session
```
session = client.beta.sessions.create(
    agent=agent.id,
    environment_id=environment.id,
    title="Quickstart session",
)
print(f"Session ID: {session.id}")
```

5. 发送消息
```
with client.beta.sessions.events.stream(session.id) as stream:
    client.beta.sessions.events.send(
        session.id,
        events=[{
            "type": "user.message",
            "content": [{"type": "text", "text": "搜索最新的 Claude 新闻并总结"}],
        }],
    )

    for event in stream:
        match event.type:
            case "agent.message":
                for block in event.content:
                    print(block.text, end="")
            case "agent.tool_use":
                print(f"\n[🔧 Using tool: {event.name}]")
            case "session.status_idle":
                print("\n\n✅ Agent finished.")
                break
```

## Comparison / Anthropic与Google的对比

**Google Managed Agent** 核心概念：一次API调用 = 一个独立的Agent运行环境

核心代码：
```
from google import genai
client = genai.Client()

agent = client.agents.create(
    id="data-analyst",
    base_agent="antigravity-preview-05-2026",
    base_environment={
        "type": "remote",
        "source": [
            {"type": "inline", "target": ".agents/AGENTS.md", "content": "You are a data analyst agent..."},
            {"type": "inline", "target": ".agents/slide-maker/SKILL.md", "content": "---name: slide-maker ...--- # Slide Maker ..."}
        ]
    }
)

result = client.interactions.create(
    agent = "data-analyst",
    input = "Analyze the Q1 revenue data and create a slide"
)

print(result.output_text)
```

| 维度 | Anthropic | Google |
| ---- | ------- | ------- |
| 核心思想 | 把 Managed Agents 类比为操作系统（Unix设计哲学：为尚未想到的程序而设计）；把 agent 的组件做虚拟化，session、harness、sandbox 各自独立，可以单独替换 | 把指令、技能、工具打包成一个 POST 请求发过去，Google 在一次 API 调用中启动一个 Gemini 3.5 Flash agent，带隔离的 Linux 沙箱、代码执行、搜索和 URL 抓取 |
| “脑”和“手”的关系 | 把“脑”（Claude + harness）和“手”（sandbox、工具）物理分离 | “黑箱” -- 用户只看到终端输出，不关心harness如何调度、沙箱怎么隔离 |
| 多Agent扩展 | 在接口层让你自己编排多 brain 多 hand 的拓扑 | 在平台层提供 A2A + Agent Executor + ADK 的全套多 agent 基础设施；A2A 定义了 agent card 来描述能力，用 HTTP/JSON 做任务委托和结果回传。 |
| 使用方式 | 理解 session、harness、sandbox 三个抽象，自己决定怎么组装 | 写一个 AGENTS.md 和 SKILL.md 替代编排代码，一个 POST 就能跑起一个 agent |