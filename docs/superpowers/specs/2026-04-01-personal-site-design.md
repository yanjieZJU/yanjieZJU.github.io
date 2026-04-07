# Personal Website Design Spec
Date: 2026-04-01

## Overview
颜婕的个人主页，基于现有 index.html 重构为 React 单页应用，部署于 GitHub Pages。

## Tech Stack
- **框架**: React + Vite（静态构建，零运行时依赖）
- **样式**: 原生 CSS + CSS 变量（无 UI 库）
- **动画**: IntersectionObserver（无动画库）
- **部署**: GitHub Pages（`gh-pages` 分支或 `docs/` 目录）

## Visual Style
- **主题**: 渐变轻彩——白底 + 紫蓝渐变点缀（`#667eea` → `#a78bfa`）
- **字体**: `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`
- **背景色**: `#ffffff` / `#f5f5f7`（交替区块）
- **强调色**: 渐变 `linear-gradient(135deg, #667eea, #a78bfa)`
- **风格参考**: 苹果官网——大量留白、简约排版、细腻阴影

## Layout
单栏滚动，从上到下：Navbar → Hero → Education → Projects → Skills → Footer

## Component Spec

### Navbar
- 固定顶部（`position: fixed`）
- 默认透明背景；滚动 > 50px 后切换为白色毛玻璃（`backdrop-filter: blur(20px)`）+ 底部细线阴影
- 左侧：姓名"颜婕"（渐变色）
- 右侧：锚点链接「教育经历 / 项目经历 / 个人技能」
- 点击平滑滚动（`scroll-behavior: smooth`）

### Hero
- 左右两列：左文右像
- 左侧：姓名大字（渐变）、副标题"人与AI交互设计研究者"、院校信息、邮箱 + GitHub 图标链接
- 右侧：圆角矩形头像（从简历 PDF 提取的头像图片，后续替换为生活照）
- 背景：极淡渐变 `linear-gradient(135deg, #f0f4ff, #fff, #f5f0ff)`
- 进入时：fade-up 动画（0.6s）

### Education
- 竖向时间线，左侧时间轴线，右侧卡片
- **硕士**（2024.09–至今）：浙江大学 计算机科学与技术学院 · 设计学 硕士（保研）；研究方向：人与AI交互；荣誉：优秀研究生、五好研究生
- **本科**（2020.09–2024.06）：浙江大学 计算机科学与技术学院 · 工业设计 本科（GPA 4.48/5.00，top 15%）；荣誉：浙江省政府奖学金×2、校级二等奖学金、校级优秀毕业生、浙江省第十三届挑战杯金奖
- 滚动进入：fade-up 动画，两条记录延迟错开

### Projects
4 张卡片，2×2 网格（移动端单列）：

1. **基于LLM的人体工效学风险预筛助手**（2024.10–2025.11）
   - 标签：LLM · RAG · GPT-4o · 工效学
   - 描述：知识增强 LLM 辅助系统，用于工业场景工效学风险筛查与建议生成，提升 8.7% 准确率，16.1% 建议有效性
   - GitHub：`https://github.com/yanjieZJU/ErgoKARE`

2. **基于LLM的说服式语音驾驶助手**（2023.06–2023.09）
   - 标签：LLM · Prompt 工程 · HCI · IEEE SMC 2025
   - 描述：L3 自动驾驶场景说服式语音助手，降低认知负荷，有用性提升 11.7%，易用性提升 30.4%
   - GitHub：无（可链接到用户 GitHub 主页）

3. **HCI 领域大语言模型构建**（2024.10–2025.12）
   - 标签：SFT · LoRA · DPO · LLaMA-Factory
   - 描述：面向 HCI 设计任务的垂类模型微调，构建 12,743 篇 HCI 论文转化的双级指令微调数据集
   - GitHub：无

4. **星世线小程序增长与体验优化**（2022.10–2023.01）
   - 标签：用户调研 · 交互设计 · Figma · 数据分析
   - 描述：3D 打印鞋品牌小程序，竞品分析 + 交互重构，推动用户体验与转化提升
   - GitHub：无

卡片 hover：translateY(-6px) + 阴影加深

### Skills
按类别 pill 标签展示：
- **语言能力**：英语 CET-6（615）
- **产品技能**：用户调研、需求分析、交互原型设计（Figma）、数据分析（SPSS）
- **AI 产品能力**：Prompt 设计、RAG、指令微调、AI Agent 编排（Coze）、AIGC 工具（ComfyUI）
- **开发协作**：AI 编程工具（Antigravity、TRAE）

### Footer
- 居中，`© 2026 Yanjie. All rights reserved.`
- GitHub 链接

## Animation
- 所有内容区块使用 `IntersectionObserver` 触发 `.visible` class
- 默认状态：`opacity: 0; transform: translateY(24px)`
- 进入后：`opacity: 1; transform: translateY(0); transition: 0.6s ease`
- 卡片/时间线条目：`transition-delay` 错开 0.1s

## File Structure
```
yanjieZJU.github.io/
  src/
    components/
      Navbar.jsx
      Hero.jsx
      Education.jsx
      Projects.jsx
      Skills.jsx
      Footer.jsx
    assets/
      avatar.jpg        # 从简历提取的头像
    App.jsx
    App.css
    main.jsx
    index.css
  public/
  index.html            # Vite 入口（替换原文件）
  package.json
  vite.config.js
```

## Deployment
- `vite build` 产出 `dist/`
- GitHub Pages 配置为读取 `dist/` 或通过 gh-pages 分支部署
