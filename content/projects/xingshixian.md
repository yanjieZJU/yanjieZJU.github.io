---
title_zh: "星世线小程序增长与体验优化"
title_en: "Xingshixian Mini-Program Growth & UX Optimization"
period: "2022.10 — 2023.01"
role_zh: "项目负责人"
role_en: "Project Lead"
tags: ["用户调研", "交互设计", "数据分析", "竞品分析"]
cover: "/xingshixian/banner.jpg"
github: ""
paper: ""
order: 3
---

针对3D打印鞋品牌小程序的增长与转化问题，本项目通过竞品分析与关键页面重构，推动用户体验和转化效率同步提升。

## Abstract / 摘要

针对国内首个3D打印鞋品牌小程序销量与转化问题，通过竞品分析（Adidas、匹克等）明确差异化方向，重构信息架构与关键页面（社区模块、商城分类、商品详情），推动用户体验与转化提升。

For China's first 3D-printed shoe brand mini-program, we identified conversion issues through competitive analysis (Adidas, Converse, etc.), then restructured the information architecture and redesigned key pages (community module, product catalog, product detail), driving improvements in UX and conversion.

## Overview / 概述

![Overview Video](/xingshixian/video.mp4)

Redesign scope: community module → product catalog → product detail page. Research methods: competitive analysis, user interviews, heuristic evaluation.


## Data Analysis / 数据分析

### 访问深度分布

用户访问深度严重偏头部——超 40% 的用户仅访问 1 次即离开，说明首页留存率极低，是优化的首要切入点。

<chart id="VisitDepthChart" />

### 用户旅程

从访问数据还原用户的核心路径：大多数用户从首页直接退出，进入商品详情的流量中仅约 19% 最终完成加入购物车，转化漏斗损耗严重。

<chart id="UserJourneySankey" />

```card
**关键数据发现**
- 首页用户占比最高，但跳出率相比行业标准（25%-45%）显著要高[1](https://www.youfinddigital.com/blog/bounce-rate-seo-insights.html)[2](https://www.clickpost.ai/blog/ecommerce-bounce-rate-by-industry)
- 用户访问深度较浅，多数停留在1–2页

**可能原因假设**
- 信息理解不足：用户在首页未能快速理解3D打印鞋的核心价值，以及与传统产品的差异
- 信任机制缺失：作为新品牌，小程序中缺少用户使用反馈和品牌背书，导致用户不敢买
- 产品展示问题：产品展示细节不足，未能突出产品的功能、创新点和材料亮点
```

## Competitor Analysis / 竞品对比

与 Adidas Ultra 4D、匡威等竞品在五个维度的横向对比。星世线在舒适度和功能性上具备差异化优势，但品牌认知度相对薄弱。

<chart id="CompetitorTable" />

## User Survey / 用户调研

我们首先基于目标市场对核心用户群体进行界定，并构建用户画像，以明确产品服务对象及其典型使用场景。用户画像聚焦于新一线城市中具有一定消费能力的“精致妈妈”群体，其在儿童鞋选购中更关注舒适性、安全性及多场景适用性。

在此基础上，我们进一步开展问卷调研，以定量方式收集用户在选购儿童鞋及使用购物平台过程中的决策因素与关注重点。本次调研共回收131份有效问卷，重点从以下两个维度进行分析：

- 产品决策因素：舒适度、外观、易清洁性、功能性、价格、品牌等
- 购物决策关注点：用户评价、商品优惠、图片展示、图文内容、品牌信息等

<chart id="AttentionChart" />

```card
**核心洞察**

- 家长在选购儿童鞋时，舒适性与外观是最核心的决策因素。
- 在电商环境中，用户评价与价格优惠对决策影响最大，而品牌与故事类信息影响相对较弱。
```

## Optimization Strategy / 优化策略

### 优化体验
合理的布局和流程设计，易于操作和使用

**信息框架**
![Information Architecture](/xingshixian/ia.png)

### 视觉升级
符合目标用户的视觉语言，体现品牌特色，树立品牌形象

**设计点**
```card
首页 :: 以绿色为主色调，设计自然、卡通的视觉风格，瞄准目标用户，传达自由生长的品牌理念和特色
商城 :: 对不同的产品系列以及礼盒和套装进行分类，同时增加了搜索框和热搜等设计，视觉上与首页保持统一
社区 :: 新增社区模块，用户可以在此分享生活和出游日常，以强化产品功能性，建立品牌社群
详情 :: 产品详情页面使用顶部导航栏实现灵活跳转，参考“黄金视觉区 1.5屏；商品功能区 3.5屏；视觉展示区 3屏；售后服务区 1屏”的设计原则全方位展示产品[1]左瑞瑞,叶文静.跨境电商B2B背景下产品详情页优化技巧——以阿里巴巴国际站平台为例[J].对外经贸实务,2020,(07):69-72.[2]左瑞瑞,叶文静.跨境电商B2B背景下产品详情页优化技巧——以阿里巴巴国际站平台为例[J].对外经贸实务,2020,(07):69-72.
```

- **Research:** Competitive analysis + user interviews (n=12)
- **Design tool:** Figma
- **Deliverables:** Redesigned IA, hi-fi prototypes for 3 key pages
- **Analytics:** Conversion funnel analysis with SPSS

## Prototype Demo / 原型展示

<chart id="PrototypeShowcase" />

