// src/components/Projects.jsx
import useScrollAnimation from '../hooks/useScrollAnimation'
import '../App.css'
import './Projects.css'

const projects = [
  {
    period: '2024.10 — 2025.11',
    title: '基于LLM的人体工效学风险预筛助手',
    role: '项目负责人',
    desc: '针对工业场景工效学评估高度依赖人工分析的问题，以知识增强LLM辅助系统替代人工筛查，构建297条高频干预方案知识库，基准准确率提升8.7%，建议有效性提升16.1%，70.8%方案获领域专家偏好。',
    tags: ['LLM', 'RAG', 'GPT-4o', 'Prompt工程', '工效学'],
    link: 'https://github.com/yanjieZJU/ErgoKARE',
    linkLabel: '查看 GitHub →',
  },
  {
    period: '2023.06 — 2023.09',
    title: '基于LLM的说服式语音驾驶助手',
    role: '项目核心成员 · IEEE SMC 2025',
    desc: '面向L3自动驾驶场景的说服式语音驾驶助手，设计六类说话策略与LLM语言生成方案，在模拟驾驶实验中显著降低用户认知负荷，有用性提升11.7%，易用性提升30.4%，行为意愿提升5.4%。',
    tags: ['LLM', 'Prompt工程', 'HCI', 'IEEE SMC 2025', '自动驾驶'],
    link: 'https://github.com/yanjieZJU',
    linkLabel: 'GitHub →',
  },
  {
    period: '2024.10 — 2025.12',
    title: 'HCI领域大语言模型构建',
    role: '项目核心成员',
    desc: '面向HCI设计任务的垂类模型微调，将12,743篇HCI论文转化为双级指令微调数据集（Task-to-Requirement + Requirement-to-Concept），研究对比SFT、LoRA、DPO等方案，基于LLaMA-Factory完成完整微调链路。',
    tags: ['SFT', 'LoRA', 'DPO', 'LLaMA-Factory', 'Llama-3', 'Qwen2.5'],
    link: 'https://github.com/yanjieZJU',
    linkLabel: 'GitHub →',
  },
  {
    period: '2022.10 — 2023.01',
    title: '星世线小程序增长与体验优化',
    role: '项目负责人',
    desc: '针对国内首个3D打印鞋品牌小程序销量与转化问题，通过竞品分析（Adidas、匡威等）明确差异化方向，重构信息架构与关键页面（社区模块、商城分类、商品详情），推动用户体验与转化提升。',
    tags: ['用户调研', '交互设计', 'Figma', '数据分析', '竞品分析'],
    link: 'https://github.com/yanjieZJU',
    linkLabel: 'GitHub →',
  },
]

export default function Projects() {
  const titleRef = useScrollAnimation()

  return (
    <section id="projects" style={{ padding: '96px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 className="section-title fade-up" ref={titleRef}>项目经历</h2>
        <div className="projects-grid">
          {projects.map((project, i) => (
            <ProjectCard key={i} project={project} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ProjectCard({ project, delay }) {
  const ref = useScrollAnimation()

  return (
    <div
      className="project-card fade-up"
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="project-period">{project.period}</span>
      <h3 className="project-title">{project.title}</h3>
      <span className="project-role">{project.role}</span>
      <p className="project-desc">{project.desc}</p>
      <div className="project-tags">
        {project.tags.map((tag) => (
          <span key={tag} className="project-tag">{tag}</span>
        ))}
      </div>
      <a
        className="project-link"
        href={project.link}
        target="_blank"
        rel="noreferrer"
      >
        {project.linkLabel}
      </a>
    </div>
  )
}
