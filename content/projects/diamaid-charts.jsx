import { useState, useRef, useEffect, useCallback } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
  Legend, Tooltip, ResponsiveContainer,
} from 'recharts'

const palette = {
  surface: '#f8fbff',
  border: '#d7e3f1',
  title: '#2f4b6b',
  text: '#3d4f63',
  inputBg: '#e7f2ff',
  inputBorder: '#8ab3df',
  llmBg: '#f4f8ec',
  llmBorder: '#9fb87b',
  toolBg: '#edf7f4',
  toolBorder: '#8ab9ac',
  checkBg: '#fbf2ef',
  checkBorder: '#d4a99a',
  outputBg: '#ecf1ff',
  outputBorder: '#95aeda',
}

const ACCENT = '#2c4a7c'

const generateFlow = [
  { type: 'input', text: '用户需求 / 添加节点' },
  { type: 'llm', text: 'Planner (LLM)\n计算文章簇相似性\n提出 3 个 perspective 及功能锚点' },
  { type: 'tool', text: 'Retriever\n根据用户及 Planner 节点检索\n(含 Node, Structural Path)' },
  { type: 'llm', text: 'Integrator (LLM)\n整理知识信息\n生成固定格式方案' },
  { type: 'check', text: 'ConflictDetector\n检查冲突 (孤立节点、重复连线等)' },
  { type: 'output', text: '输出最终方案' },
]

const editFlow = [
  { type: 'input', text: '用户修改指令 + 当前方案架构' },
  { type: 'llm', text: 'Editor (Agent)\n判断意图\n生成修改结果或方案修改' },
  { type: 'tool', text: 'Retriever (Tool)\n检索函数并返回补充信息' },
  { type: 'check', text: 'ConflictDetector\n检查方案漏洞' },
  { type: 'output', text: '输出修改结果' },
]

const typeStyle = {
  input: { background: palette.inputBg, borderColor: palette.inputBorder },
  llm: { background: palette.llmBg, borderColor: palette.llmBorder },
  tool: { background: palette.toolBg, borderColor: palette.toolBorder },
  check: { background: palette.checkBg, borderColor: palette.checkBorder },
  output: { background: palette.outputBg, borderColor: palette.outputBorder },
}

function FlowColumn({ title, items, includeKnowledge }) {
  return (
    <section style={{ flex: 1, minWidth: 260 }}>
      <h4 style={{ margin: '0 0 14px', color: palette.title, fontSize: 13, letterSpacing: 0.4 }}>{title}</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, index) => (
          <div key={`${title}-${index}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            <div
              style={{
                border: `1px solid ${typeStyle[item.type].borderColor}`,
                background: typeStyle[item.type].background,
                borderRadius: 8,
                padding: '10px 12px',
                color: palette.text,
                fontSize: 12,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
              }}
            >
              {item.text}
            </div>
            {includeKnowledge && index === 1 && (
              <div
                style={{
                  border: `1px dashed ${palette.toolBorder}`,
                  background: '#f2f8f6',
                  borderRadius: 999,
                  padding: '5px 10px',
                  color: '#4f6c63',
                  fontSize: 11,
                  width: 'fit-content',
                  alignSelf: 'center',
                }}
              >
                知识图谱输入
              </div>
            )}
            {index < items.length - 1 && (
              <div style={{ textAlign: 'center', color: '#92a4b9', fontSize: 13, lineHeight: 1 }}>↓</div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function AgentWorkflowDiagram() {
  return (
    <div className="chart-block" style={{ background: palette.surface, borderColor: palette.border }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <FlowColumn title="方案生成 Pipeline" items={generateFlow} includeKnowledge />
        <FlowColumn title="编辑修改 Pipeline" items={editFlow} />
      </div>
    </div>
  )
}


// ── 竞品分析 ──────────────────────────────────────────────────────────

const competitors = [
  {
    name: 'ArchCanvas',
    highlight: true,
    tags: ['知识图谱', '多方案', '对话编辑'],
    features: [
      { label: '定位', text: '面向 HCI 研究者的系统架构图智能助手' },
      { label: '核心能力', text: '1200+ 篇论文知识图谱驱动，生成 3 个多视角设计方案，支持跨方案引用与对话式编辑' },
      { label: '输出', text: '交互式架构图 + Word 设计文档' },
    ],
  },
  {
    name: 'NanaDraw',
    highlight: false,
    tags: ['学术插图', '素材库'],
    features: [
      { label: '定位', text: '学术论文方法描述 → 可编辑流程图' },
      { label: '核心能力', text: '草稿/生成/组装三模式，VLM 结构提取 + AI 重绘组件，素材工坊' },
      { label: '输出', text: 'draw.io XML 可编辑插图' },
    ],
  },
  {
    name: 'DiagramGPT',
    highlight: false,
    tags: ['通用图表', 'API'],
    features: [
      { label: '定位', text: '通用软件设计图表生成（Eraser.io）' },
      { label: '核心能力', text: '多格式支持（ER/序列/架构图等），MCP Server + API，基于 Claude' },
      { label: '输出', text: '专业工程图表，可嵌入文档' },
    ],
  },
  {
    name: 'Figma AI',
    highlight: false,
    tags: ['设计工具', '协作'],
    features: [
      { label: '定位', text: 'FigJam AI 辅助白板图表生成' },
      { label: '核心能力', text: '思维导图/时间线/流程图/甘特图，深度集成 Figma 设计生态' },
      { label: '输出', text: 'Figma 原生格式，团队协作' },
    ],
  },
]

const radarData = [
  { dim: '领域知识',   diamaid: 5, nanadraw: 2, diagramgpt: 1, figma: 1 },
  { dim: '交互灵活性', diamaid: 5, nanadraw: 3, diagramgpt: 2, figma: 3 },
  { dim: '输出专业度', diamaid: 3, nanadraw: 4, diagramgpt: 5, figma: 4 },
  { dim: '生态集成',   diamaid: 2, nanadraw: 3, diagramgpt: 5, figma: 5 },
  { dim: '视觉质量',   diamaid: 3, nanadraw: 5, diagramgpt: 4, figma: 5 },
]

const RADAR_COLORS = {
  diamaid:    '#183c7a',
  nanadraw:   '#e8915a',
  diagramgpt: '#4474b6',
  figma:      '#a8c3f1',
}

export function CompetitorAnalysis() {
  return (
    <div className="chart-block">
      <div className="chart-title">竞品对比</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* 左：竞品卡片 */}
        <div style={{ minWidth: 400, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--color-border)', border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
          {competitors.map((c) => (
            <div
              key={c.name}
              style={{
                background: c.highlight ? '#f4f7fd' : 'var(--color-bg)',
                padding: '16px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: c.highlight ? 'var(--color-accent)' : '#1a1a1a' }}>
                {c.name}
              </div>

              {c.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {c.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 2, background: c.highlight ? 'var(--color-tag-bg)' : '#f0f0f0', color: c.highlight ? 'var(--color-accent)' : '#555', fontFamily: 'var(--font-sans)' }}>{tag}</span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {c.features.map((f, i) => (
                  <div key={i}>
                    {f.label && (
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: '#333', marginBottom: 2 }}>{f.label}</div>
                    )}
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{f.text}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}


// ── SWOT 分析 ──────────────────────────────────────────────────────────

const swotData = [
  { key: 'S', title: 'Strengths', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', items: [
    '基于 1200+ 篇 HCI 论文构建的领域知识图谱，提供结构化的设计知识支撑',
    '多方案发散生成 + 跨方案引用机制，拓宽设计探索空间',
    'ConflictDetector 自我修正闭环，保障方案结构一致性',
    '对话式编辑与直接操作双通道交互',
  ]},
  { key: 'W', title: 'Weaknesses', color: '#991b1b', bg: '#fef2f2', border: '#fecaca', items: [
    '界面视觉成熟度待提升，缺少精细的动效与视觉层次',
    '输出格式限于架构图 + Word，缺少 draw.io / Mermaid 等工程格式',
    '生态集成能力弱，尚未提供 API / MCP 接口',
  ]},
  { key: 'O', title: 'Opportunities', color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', items: [
    '作为竞品的上游思考工具：先用 ArchCanvas 构思架构，再导出至专业图表工具',
    '实现 MCP 协议，让其他工具调用 ArchCanvas 的知识图谱检索能力',
    '知识图谱可扩展至更多领域（IoT、教育技术等）',
  ]},
  { key: 'T', title: 'Threats', color: '#92400e', bg: '#fffbeb', border: '#fde68a', items: [
    '通用大模型通过长上下文窗口模拟领域知识检索，削弱知识图谱的独特优势',
    'NanaDraw 等工具在视觉质量上持续提升，压缩差异化空间',
  ]},
]

export function SwotAnalysis() {
  return (
    <div className="chart-block">
      <div className="chart-title">SWOT 分析</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {swotData.map(s => (
          <div key={s.key} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: s.color, marginBottom: 10 }}>
              {s.key} — {s.title}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {s.items.map((item, i) => (
                <li key={i} style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 4 }}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}


// ── 用户实验：设计质量对比 ──────────────────────────────────────────

const qualityData = [
  { dim: 'Applicability', archcanvas: 5.10, baseline: 4.52, p: '0.016', d: '0.53' },
  { dim: 'Effectiveness', archcanvas: 4.92, baseline: 4.25, p: '0.006', d: '0.62' },
  { dim: 'Novelty', archcanvas: 3.67, baseline: 3.06, p: '0.002', d: '0.63' },
  { dim: 'Completeness', archcanvas: 4.44, baseline: 2.98, p: '<0.001', d: '1.23' },
]

function sigLabel(p) {
  if (p === '<0.001') return '***'
  const v = parseFloat(p)
  if (v < 0.001) return '***'
  if (v < 0.01) return '**'
  if (v < 0.05) return '*'
  return 'n.s.'
}

function GroupedBarChart({ data, title, yDomain, labelKey }) {
  return (
    <div>
      <div className="chart-title">{title}</div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 4 }} barGap={2} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9f2" />
          <XAxis dataKey="dim" tick={{ fontSize: 11, fill: '#444' }} axisLine={false} tickLine={false} />
          <YAxis domain={yDomain} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #dde3ee' }} />
          <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Bar name="ArchCanvas" dataKey="archcanvas" fill="#183c7a" radius={[3, 3, 0, 0]} label={({ x, y, width, index }) => (
            <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#183c7a" fontWeight="600">
              {sigLabel(data[index].p)}
            </text>
          )} />
          <Bar name="Baseline" dataKey="baseline" fill="#a8c3f1" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function QualityComparison() {
  return (
    <div className="chart-block">
      <GroupedBarChart data={qualityData} title="设计方案质量评分（7-point Likert, N=24）" yDomain={[0, 7]} />
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 }}>
        * p &lt; .05, ** p &lt; .01, *** p &lt; .001 (paired-samples t-test)
      </p>
    </div>
  )
}


// ── CSI + 自定义量表 ──────────────────────────────────────────────

const csiData = [
  { dim: 'Exploration', archcanvas: 16.67, baseline: 10.00, p: '<0.001', d: '1.64' },
  { dim: 'Expression', archcanvas: 15.54, baseline: 10.96, p: '<0.001', d: '0.92' },
  { dim: 'Immersion', archcanvas: 12.75, baseline: 11.21, p: '0.23', d: '0.25' },
  { dim: 'Enjoyment', archcanvas: 15.92, baseline: 11.71, p: '<0.001', d: '0.97' },
  { dim: 'Result Worth\nEffort', archcanvas: 15.83, baseline: 12.17, p: '0.002', d: '0.72' },
]

const customData = [
  { dim: 'Understand-\nability', archcanvas: 5.88, baseline: 3.88, p: '<0.001', d: '1.06' },
  { dim: 'Controllability', archcanvas: 5.67, baseline: 3.75, p: '<0.001', d: '0.98' },
  { dim: 'Anti-design\nFixation', archcanvas: 5.92, baseline: 4.75, p: '0.002', d: '0.73' },
]

export function CSIComparison() {
  return (
    <div className="chart-block">
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 55%', minWidth: 340 }}>
          <GroupedBarChart data={csiData} title="Creativity Support Index（20-point scale）" yDomain={[0, 20]} />
        </div>
        <div style={{ flex: '1 1 40%', minWidth: 280 }}>
          <GroupedBarChart data={customData} title="自定义量表（7-point Likert）" yDomain={[0, 7]} />
        </div>
      </div>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 }}>
        * p &lt; .05, ** p &lt; .01, *** p &lt; .001; n.s. = not significant
      </p>
    </div>
  )
}


// ── 行为数据对比 ──────────────────────────────────────────────

const intentBaselineData = [
  { intent: 'Drafting &\nFormatting', count: 28, pct: '57.1%' },
  { intent: 'Knowledge\nQueries', count: 13, pct: '26.5%' },
  { intent: 'Content\nElaboration', count: 5, pct: '10.2%' },
  { intent: 'Scenario\nSupplementation', count: 3, pct: '6.1%' },
]

const intentArchCanvasData = [
  { intent: 'Function\nAddition', count: 27, pct: '57.5%' },
  { intent: 'Function\nModification', count: 6, pct: '12.8%' },
  { intent: 'Scenario\nSupplementation', count: 5, pct: '10.6%' },
  { intent: 'Structural\nAdjustment', count: 4, pct: '8.5%' },
  { intent: 'Logic\nReview', count: 3, pct: '6.4%' },
]

function IntentBar({ data, title, color }) {
  return (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 50, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e9f2" />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="intent" tick={{ fontSize: 10, fill: '#444' }} axisLine={false} tickLine={false} width={72} />
          <Bar dataKey="count" fill={color} radius={[0, 3, 3, 0]}
            label={({ x, y, width, index }) => (
              <text x={x + width + 4} y={y + 10} fontSize={10} fill="#666" dominantBaseline="middle">{data[index].pct}</text>
            )}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BehaviorComparison() {
  return (
    <div className="chart-block">
      <div className="chart-title">交互意图分布对比</div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <IntentBar data={intentBaselineData} title="Baseline（LLM + 白板）" color="#a8c3f1" />
        <IntentBar data={intentArchCanvasData} title="ArchCanvas" color="#183c7a" />
      </div>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 10 }}>
        Baseline 下用户主要用 LLM 做文本格式整理（57%）；ArchCanvas 下用户转向功能层面的添加与修改（57%），66.7% 的功能添加来自跨方案引用。
      </p>
    </div>
  )
}


// ── 知识图谱交互展示 ──────────────────────────────────────────
// Schema: Article --DEFINES_MODULE--> Module --FLOW_TO--> Module --HAS_ROLE--> Role

const ROLE_COLOR = { Input: '#22c55e', Process: '#3b82f6', Output: '#f97316', Data: '#8b5cf6' }
const NODE_COLOR = { article: '#183c7a', module: '#5a7d95', role: '#e45e3b' }
const EDGE_STYLE = {
  def:  { stroke: '#a0b8d0', dash: '4 3', width: 0.7 },
  flow: { stroke: '#556b7a', dash: '',    width: 1.2 },
  role: { stroke: '#d4a0a0', dash: '2 2', width: 0.5 },
}
const COMMUNITY_LABEL = ['Elderly & Companion', 'Education & Assessment', 'Health & Wellbeing']
const COMMUNITY_BG = ['#dbeafe', '#dcfce7', '#fef3c7']

const KG_RAW_NODES = [
  { id: 'r_input',   type: 'role', label: 'Input',   desc: '用户输入与数据采集类模块' },
  { id: 'r_process', type: 'role', label: 'Process', desc: '核心处理与计算类模块' },
  { id: 'r_output',  type: 'role', label: 'Output',  desc: '结果呈现与反馈类模块' },
  { id: 'r_data',    type: 'role', label: 'Data',    desc: '数据存储与管理类模块' },
  { id: 'p1', type: 'article', label: 'MemoryCompanion', desc: '基于回忆拼贴的老年陪伴系统', community: 0 },
  { id: 'p2', type: 'article', label: 'EmotiChat', desc: '情感感知的对话交互系统', community: 0 },
  { id: 'm1', type: 'module', role: 'Input',   label: 'Speech Recognition', desc: '语音输入与转写模块', community: 0 },
  { id: 'm2', type: 'module', role: 'Process', label: 'Emotion Detection', desc: '多模态情感识别（语音+文本）', community: 0 },
  { id: 'm3', type: 'module', role: 'Process', label: 'Dialogue Manager', desc: '多轮对话状态追踪与策略选择', community: 0 },
  { id: 'm4', type: 'module', role: 'Process', label: 'Memory Collage', desc: '将事件整合为可分享的视觉记忆', community: 0 },
  { id: 'm5', type: 'module', role: 'Output',  label: 'Voice Synthesis', desc: '基于 TTS 的自然语音输出', community: 0 },
  { id: 'm6', type: 'module', role: 'Data',    label: 'User Profile', desc: '用户偏好与历史记录存储', community: 0 },
  { id: 'p3', type: 'article', label: 'QuizCraft', desc: '自适应测评内容生成系统', community: 1 },
  { id: 'p4', type: 'article', label: 'LearnPath', desc: '个性化学习路径规划工具', community: 1 },
  { id: 'm7', type: 'module', role: 'Input',   label: 'Student Input', desc: '学生答题与交互输入', community: 1 },
  { id: 'm8', type: 'module', role: 'Process', label: 'Quiz Generator', desc: '基于知识点的题目自动生成', community: 1 },
  { id: 'm9', type: 'module', role: 'Process', label: 'Adaptive Engine', desc: '根据答题表现动态调整难度', community: 1 },
  { id: 'm10', type: 'module', role: 'Data',   label: 'Progress Tracker', desc: '学习进度和掌握程度记录', community: 1 },
  { id: 'm11', type: 'module', role: 'Output', label: 'Feedback Display', desc: '可视化反馈与学习报告', community: 1 },
  { id: 'p5', type: 'article', label: 'HealthTracker', desc: '健康数据监测与预警系统', community: 2 },
  { id: 'm12', type: 'module', role: 'Input',   label: 'Sensor Input', desc: '可穿戴设备数据采集', community: 2 },
  { id: 'm13', type: 'module', role: 'Process', label: 'Data Analysis', desc: '时序健康数据趋势分析', community: 2 },
  { id: 'm14', type: 'module', role: 'Output',  label: 'Alert System', desc: '异常指标实时预警推送', community: 2 },
  { id: 'm15', type: 'module', role: 'Data',    label: 'Health Records', desc: '个人健康档案与历史数据', community: 2 },
]

const KG_RAW_LINKS = [
  ['p1','m1','def'],['p1','m2','def'],['p1','m3','def'],['p1','m4','def'],['p1','m5','def'],['p1','m6','def'],
  ['p2','m1','def'],['p2','m2','def'],['p2','m3','def'],['p2','m5','def'],
  ['p3','m7','def'],['p3','m8','def'],['p3','m11','def'],
  ['p4','m7','def'],['p4','m9','def'],['p4','m10','def'],['p4','m11','def'],
  ['p5','m12','def'],['p5','m13','def'],['p5','m14','def'],['p5','m15','def'],
  ['m1','m3','flow'],['m1','m2','flow'],['m2','m3','flow'],['m3','m4','flow'],
  ['m3','m5','flow'],['m6','m3','flow'],['m4','m5','flow'],
  ['m7','m9','flow'],['m9','m11','flow'],['m10','m9','flow'],['m7','m11','flow'],
  ['m12','m13','flow'],['m13','m14','flow'],['m15','m13','flow'],
  ['m1','r_input','role'],['m7','r_input','role'],['m12','r_input','role'],
  ['m2','r_process','role'],['m3','r_process','role'],['m4','r_process','role'],
  ['m8','r_process','role'],['m9','r_process','role'],['m13','r_process','role'],
  ['m5','r_output','role'],['m11','r_output','role'],['m14','r_output','role'],
  ['m6','r_data','role'],['m10','r_data','role'],['m15','r_data','role'],
]

function initSimulation() {
  const rolePos = {
    r_input: { x: -180, y: -200 }, r_process: { x: -60, y: -200 },
    r_output: { x: 60, y: -200 }, r_data: { x: 180, y: -200 },
  }
  const comCenters = [{ x: -130, y: 30 }, { x: 130, y: 30 }, { x: 0, y: 160 }]
  const nodes = KG_RAW_NODES.map((n) => {
    let x, y
    if (n.type === 'role') {
      const rp = rolePos[n.id]; x = rp.x; y = rp.y
    } else {
      const cc = n.community >= 0 ? comCenters[n.community] : { x: 0, y: 80 }
      x = cc.x + (Math.random() - 0.5) * 140
      y = cc.y + (Math.random() - 0.5) * 120
    }
    return { ...n, x, y, vx: 0, vy: 0, fixed: n.type === 'role' }
  })
  const idx = Object.fromEntries(nodes.map((n, i) => [n.id, i]))
  const links = KG_RAW_LINKS.map(([s, t, et]) => ({ si: idx[s], ti: idx[t], et }))
  return { nodes, links, alpha: 1.0 }
}

function stepSim(sim) {
  const { nodes, links } = sim
  const alpha = sim.alpha
  if (alpha < 0.002) return false
  const N = nodes.length
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (nodes[i].fixed && nodes[j].fixed) continue
      let dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y
      let d2 = dx * dx + dy * dy; if (d2 < 4) d2 = 4
      const d = Math.sqrt(d2)
      const f = -alpha * 1400 / d2
      const fx = f * dx / d, fy = f * dy / d
      if (!nodes[i].fixed) { nodes[i].vx += fx; nodes[i].vy += fy }
      if (!nodes[j].fixed) { nodes[j].vx -= fx; nodes[j].vy -= fy }
    }
  }
  for (const l of links) {
    const s = nodes[l.si], t = nodes[l.ti]
    const dx = t.x - s.x, dy = t.y - s.y
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    const rest = l.et === 'role' ? 120 : l.et === 'def' ? 50 : 60
    const k = l.et === 'role' ? 0.008 : 0.04
    const f = alpha * (d - rest) * k
    const fx = f * dx / d, fy = f * dy / d
    if (!s.fixed) { s.vx += fx; s.vy += fy }
    if (!t.fixed) { t.vx -= fx; t.vy -= fy }
  }
  const comCenters = [{ x: -130, y: 30 }, { x: 130, y: 30 }, { x: 0, y: 160 }]
  for (const n of nodes) {
    if (n.fixed) continue
    n.vx -= n.x * alpha * 0.004
    n.vy -= n.y * alpha * 0.004
    if (n.community >= 0) {
      const cc = comCenters[n.community]
      n.vx += (cc.x - n.x) * alpha * 0.005
      n.vy += (cc.y - n.y) * alpha * 0.005
    }
    n.vx *= 0.55; n.vy *= 0.55
    n.x += n.vx; n.y += n.vy
  }
  sim.alpha *= 0.994
  return true
}

function nodeRadius(n) {
  if (n.type === 'role') return 13
  if (n.type === 'article') return 10
  return 6
}
function nodeColor(n) {
  if (n.type === 'role') return ROLE_COLOR[n.label] || '#e45e3b'
  if (n.type === 'article') return NODE_COLOR.article
  return NODE_COLOR.module
}

export function KnowledgeGraphDemo() {
  const [, setTick] = useState(0)
  const simRef = useRef(null)
  const frameRef = useRef(null)
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const panRef = useRef(null)
  const [view, setView] = useState({ x: 320, y: 240, k: 0.9 })
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [showEdgeTypes, setShowEdgeTypes] = useState({ def: true, flow: true, role: true })

  if (!simRef.current) simRef.current = initSimulation()
  const sim = simRef.current

  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      if (stepSim(sim)) {
        setTick(t => t + 1)
        frameRef.current = requestAnimationFrame(loop)
      }
    }
    frameRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(frameRef.current) }
  }, [])

  const reheat = useCallback(() => {
    sim.alpha = Math.max(sim.alpha, 0.3)
    const loop = () => {
      if (stepSim(sim)) {
        setTick(t => t + 1)
        frameRef.current = requestAnimationFrame(loop)
      }
    }
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(loop)
  }, [])

  const onWheel = useCallback((e) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const rect = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    setView(v => {
      const nk = Math.min(3, Math.max(0.3, v.k * factor))
      return { x: mx - (mx - v.x) * (nk / v.k), y: my - (my - v.y) * (nk / v.k), k: nk }
    })
  }, [])

  const onNodeDown = useCallback((e, i) => {
    e.stopPropagation()
    const n = sim.nodes[i]
    if (n.type === 'role') return
    n.fixed = true
    dragRef.current = { idx: i, startX: e.clientX, startY: e.clientY, ox: n.x, oy: n.y }
  }, [])

  const onBgDown = useCallback((e) => {
    if (e.target === svgRef.current || e.target.tagName === 'rect') {
      panRef.current = { startX: e.clientX, startY: e.clientY, ox: view.x, oy: view.y }
      setSelected(null)
    }
  }, [view])

  const onMouseMove = useCallback((e) => {
    if (dragRef.current) {
      const { idx, startX, startY, ox, oy } = dragRef.current
      const n = sim.nodes[idx]
      n.x = ox + (e.clientX - startX) / view.k
      n.y = oy + (e.clientY - startY) / view.k
      n.vx = 0; n.vy = 0
      reheat()
    } else if (panRef.current) {
      const { startX, startY, ox, oy } = panRef.current
      setView(v => ({ ...v, x: ox + e.clientX - startX, y: oy + e.clientY - startY }))
    }
  }, [view.k, reheat])

  const onMouseUp = useCallback(() => {
    if (dragRef.current) {
      sim.nodes[dragRef.current.idx].fixed = false
      dragRef.current = null
      reheat()
    }
    panRef.current = null
  }, [reheat])

  const connectedTo = selected != null
    ? new Set(sim.links.flatMap(l => l.si === selected ? [l.ti] : l.ti === selected ? [l.si] : []))
    : new Set()
  const selNode = selected != null ? sim.nodes[selected] : null
  const edgeLabels = { def: 'DEFINES_MODULE', flow: 'FLOW_TO', role: 'HAS_ROLE' }

  return (
    <div className="chart-block" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
      <div style={{ padding: '12px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div className="chart-title" style={{ margin: 0 }}>知识图谱结构预览</div>
        <div style={{ display: 'flex', gap: 10, fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: NODE_COLOR.article, display: 'inline-block' }} /> Article
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: NODE_COLOR.module, display: 'inline-block' }} /> Module
          </span>
          {Object.entries(ROLE_COLOR).map(([k, c]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 9, height: 9, background: c, display: 'inline-block', transform: 'rotate(45deg)' }} />
              {k}
            </span>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 16px 4px', display: 'flex', gap: 12, fontSize: 10, fontFamily: 'var(--font-sans)' }}>
        {Object.entries(edgeLabels).map(([et, label]) => (
          <label key={et} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: showEdgeTypes[et] ? '#333' : '#bbb' }}>
            <input type="checkbox" checked={showEdgeTypes[et]}
              onChange={() => setShowEdgeTypes(s => ({ ...s, [et]: !s[et] }))}
              style={{ width: 12, height: 12 }} />
            <span style={{ borderBottom: `2px ${EDGE_STYLE[et].dash ? 'dashed' : 'solid'} ${EDGE_STYLE[et].stroke}`, paddingBottom: 1 }}>
              {label}
            </span>
          </label>
        ))}
      </div>
      <svg ref={svgRef} width="100%" height={460}
        style={{ cursor: panRef.current ? 'grabbing' : 'grab', display: 'block', background: '#fafbfe' }}
        onWheel={onWheel} onMouseDown={onBgDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        <defs>
          <marker id="arrowFlow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_STYLE.flow.stroke} />
          </marker>
        </defs>
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {[0, 1, 2].map(ci => {
            const cns = sim.nodes.filter(n => n.community === ci)
            if (!cns.length) return null
            const cx = cns.reduce((s, n) => s + n.x, 0) / cns.length
            const cy = cns.reduce((s, n) => s + n.y, 0) / cns.length
            const spread = Math.max(80, ...cns.map(n => Math.sqrt((n.x-cx)**2 + (n.y-cy)**2))) + 45
            return (
              <g key={`c${ci}`}>
                <ellipse cx={cx} cy={cy} rx={spread * 1.1} ry={spread * 0.85} fill={COMMUNITY_BG[ci]} opacity={0.4} />
                <text x={cx} y={cy - spread * 0.7} textAnchor="middle" fontSize={9} fill="#888" fontFamily="var(--font-sans)">
                  {COMMUNITY_LABEL[ci]}
                </text>
              </g>
            )
          })}
          {sim.links.map((l, i) => {
            if (!showEdgeTypes[l.et]) return null
            const s = sim.nodes[l.si], t = sim.nodes[l.ti]
            const isHL = selected != null && (l.si === selected || l.ti === selected)
            const st = EDGE_STYLE[l.et]
            const tr = nodeRadius(t)
            const dx = t.x - s.x, dy = t.y - s.y
            const d = Math.sqrt(dx*dx + dy*dy) || 1
            const tx = t.x - (tr + 2) * dx / d, ty = t.y - (tr + 2) * dy / d
            return (
              <line key={`l${i}`} x1={s.x} y1={s.y} x2={tx} y2={ty}
                stroke={isHL ? '#183c7a' : st.stroke}
                strokeWidth={isHL ? 2 : st.width}
                strokeDasharray={st.dash}
                strokeOpacity={selected != null && !isHL ? 0.1 : (l.et === 'role' ? 0.4 : 0.65)}
                markerEnd={l.et === 'flow' ? 'url(#arrowFlow)' : undefined} />
            )
          })}
          {sim.nodes.map((n, i) => {
            const r = nodeRadius(n)
            const c = nodeColor(n)
            const isSel = i === selected
            const isConn = connectedTo.has(i)
            const isHov = i === hovered
            const dim = selected != null && !isSel && !isConn
            const isDiamond = n.type === 'role'
            return (
              <g key={n.id} style={{ cursor: n.type === 'role' ? 'default' : 'pointer' }}
                onMouseDown={e => onNodeDown(e, i)}
                onClick={e => { e.stopPropagation(); setSelected(i === selected ? null : i) }}
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                {isDiamond ? (
                  <>
                    <rect x={n.x - r} y={n.y - r} width={r*2} height={r*2}
                      transform={`rotate(45,${n.x},${n.y})`}
                      fill="none" stroke={c} strokeWidth={isSel ? 2 : 1.5}
                      strokeOpacity={isSel || isHov ? 0.5 : 0} rx={2} />
                    <rect x={n.x - r + 2} y={n.y - r + 2} width={r*2 - 4} height={r*2 - 4}
                      transform={`rotate(45,${n.x},${n.y})`}
                      fill={c} stroke="#fff" strokeWidth={1.2}
                      opacity={dim ? 0.2 : 1} rx={2} />
                  </>
                ) : (
                  <>
                    <circle cx={n.x} cy={n.y} r={r + (isSel ? 4 : isHov ? 2 : 0)}
                      fill="none" stroke={c} strokeWidth={isSel ? 2 : 1.5}
                      strokeOpacity={isSel || isHov ? 0.5 : 0} />
                    <circle cx={n.x} cy={n.y} r={r}
                      fill={c} stroke="#fff" strokeWidth={1.2} opacity={dim ? 0.2 : 1} />
                  </>
                )}
                <text x={n.x} y={n.y + r + 11} textAnchor="middle"
                  fontSize={n.type === 'role' ? 9 : n.type === 'article' ? 8 : 7}
                  fontWeight={n.type !== 'module' ? 600 : 400}
                  fontFamily="var(--font-sans)" fill={dim ? '#ccc' : '#555'} pointerEvents="none">
                  {n.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
      {selNode && (
        <div style={{
          position: 'absolute', top: 52, right: 12,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
          border: '1px solid #d7e3f1', borderRadius: 8,
          padding: '12px 14px', width: 220, fontSize: 12,
          fontFamily: 'var(--font-sans)', color: '#333',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)', lineHeight: 1.6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 3,
              background: selNode.type === 'role' ? (ROLE_COLOR[selNode.label] || '#e45e3b') + '20'
                : selNode.type === 'article' ? '#e8edf6' : '#e8f0f4',
              color: selNode.type === 'role' ? (ROLE_COLOR[selNode.label] || '#e45e3b')
                : selNode.type === 'article' ? '#183c7a' : '#5a7d95',
              fontWeight: 600,
            }}>
              {selNode.type === 'role' ? 'Role' : selNode.type === 'article' ? 'Article' : 'Module'}
            </span>
            <span style={{ cursor: 'pointer', color: '#999', fontSize: 14, lineHeight: 1 }}
              onClick={() => setSelected(null)}>&times;</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{selNode.label}</div>
          {selNode.role && <div style={{ fontSize: 10, color: ROLE_COLOR[selNode.role], marginBottom: 4 }}>Role: {selNode.role}</div>}
          <div style={{ color: '#666', fontSize: 11 }}>{selNode.desc}</div>
          {connectedTo.size > 0 && (
            <div style={{ marginTop: 8, borderTop: '1px solid #eee', paddingTop: 6 }}>
              <div style={{ fontSize: 10, color: '#999', marginBottom: 3 }}>Connected ({connectedTo.size})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {[...connectedTo].slice(0, 10).map(ci => (
                  <span key={ci} style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 2,
                    background: '#f0f4fa', color: '#555', cursor: 'pointer',
                  }} onClick={() => setSelected(ci)}>
                    {sim.nodes[ci].label}
                  </span>
                ))}
                {connectedTo.size > 10 && <span style={{ fontSize: 9, color: '#999' }}>+{connectedTo.size - 10}</span>}
              </div>
            </div>
          )}
        </div>
      )}
      <div style={{ padding: '6px 16px 10px', fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
        拖拽节点 · 滚轮缩放 · 点击查看详情 · 勾选控制边类型显示 · 数据来源：1,215 篇 HCI 论文 → 514 功能簇 → 101 场景簇
      </div>
    </div>
  )
}
