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
