import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { authHeaders } from '../utils/auth'

const SAMPLE_CONTENT = {
  Agent: { doc: 'Agent 能力说明：接收输入文本，输出分类/识别结果。\n调用：HTTP API\n输入：{ text: string }\n输出：{ category: string }' },
  Skill: { skillMd: '# Skill 能力说明\n\n分析输入并输出结构化结论。\n\n## 输入\n{ input: string }\n\n## 输出\n{ result: object }', script: '#!/bin/bash\n# 运行 Skill\necho "analyzing..."\nnode ./analyze.js "$1"' },
  Command: { doc: 'Command：在 Agent 中通过 /xxx 触发，参数与正文由流水线发布回填。\n\n## 参数\n{ input: string }\n\n## 正文\n由环节编排自动生成' },
  Extension: {}
}

const SKILL_REPORT = {
  overallScore: 92,
  testCoverage: 88,
  performanceScore: 90,
  securityScore: 95,
  maintenanceScore: 89,
  items: [
    { name: '单元测试覆盖率', value: '88%', pass: true },
    { name: '性能基准', value: '90 分', pass: true },
    { name: '安全扫描', value: '95 分', pass: true },
    { name: '可维护性', value: '89 分', pass: true },
  ],
  summary: '该 Skill 已通过质量门禁，整体评分 92 分，建议发布。'
}

function AssetDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(location.state?.asset || null)
  const [tab, setTab] = useState('content')
  const [version, setVersion] = useState('')
  const [workflow, setWorkflow] = useState(null)

  useEffect(() => {
    if (asset) {
      setVersion(asset.version || '')
      if (asset.auto && asset.scenarioId) {
        axios.get(`/api/workflow?scenarioId=${asset.scenarioId}`, { headers: authHeaders() })
          .then(r => setWorkflow(r.data[0] || null))
          .catch(() => setWorkflow(null))
      }
    }
  }, [asset])

  if (!asset) {
    return <div className="empty-state"><div className="empty-title">资产不存在</div><button className="btn btn-secondary" onClick={() => navigate('/assets')}>返回</button></div>
  }

  const at = asset.assetType
  const c = SAMPLE_CONTENT[at] || {}
  const folder = ({ Agent: 'agents', Skill: 'skills', Command: 'commands', Extension: 'extension' })[at] || 'assets'
  const FileBlock = ({ name, content }) => (
    <div>
      <div style={{ color: 'var(--gray-600)' }}>📄 {name}</div>
      <pre style={{ margin: '4px 0 8px', padding: '8px 10px', background: '#1e293b', borderRadius: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '11px', lineHeight: '1.5', color: '#cbd5e1' }}>{content}</pre>
    </div>
  )

  const renderTree = () => {
    if (at === 'Skill') {
      return (
        <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '13px', lineHeight: '1.9', background: 'var(--gray-50)', padding: '16px', borderRadius: '8px' }}>
          <div style={{ fontWeight: 700 }}>📁 {asset.name}/</div>
          <div style={{ marginLeft: '24px', borderLeft: '1px dashed var(--gray-300)', paddingLeft: '12px' }}>
            <FileBlock name="SKILL.md" content={c.skillMd} />
            <FileBlock name="run.sh" content={c.script} />
          </div>
        </div>
      )
    }
    if (at === 'Extension') {
      const wf = workflow || {}
      const cmds = wf.commands || []
      const agents = (wf.assets || []).filter(a => a.type === 'Agent')
      const skills = (wf.assets || []).filter(a => a.type === 'Skill')
      return (
        <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '13px', lineHeight: '1.9', background: 'var(--gray-50)', padding: '16px', borderRadius: '8px' }}>
          <div style={{ fontWeight: 700 }}>📁 {asset.name}/</div>
          <div style={{ marginLeft: '24px', borderLeft: '1px dashed var(--gray-300)', paddingLeft: '12px' }}>
            <div style={{ fontWeight: 700 }}>📁 commands/</div>
            <div style={{ marginLeft: '24px' }}>{cmds.length ? cmds.map(x => <FileBlock key={x.id} name={x.name + '.md'} content={SAMPLE_CONTENT.Command.doc} />) : <span style={{ color: 'var(--gray-400)' }}>（空）</span>}</div>
            <div style={{ fontWeight: 700 }}>📁 agents/</div>
            <div style={{ marginLeft: '24px' }}>{agents.length ? agents.map(x => <div key={x._id} style={{ color: 'var(--gray-600)' }}>📄 {x.assetId?.name}.md</div>) : <span style={{ color: 'var(--gray-400)' }}>（空）</span>}</div>
            <div style={{ fontWeight: 700 }}>📁 skills/</div>
            <div style={{ marginLeft: '24px' }}>{skills.length ? skills.map(x => <div key={x._id} style={{ color: 'var(--gray-600)' }}>📁 {x.assetId?.name}/</div>) : <span style={{ color: 'var(--gray-400)' }}>（空）</span>}</div>
          </div>
        </div>
      )
    }
    // Command / Agent 单文件
    return (
      <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '13px', lineHeight: '1.9', background: 'var(--gray-50)', padding: '16px', borderRadius: '8px' }}>
        <FileBlock name={asset.name + '.md'} content={c.doc || '内容由流水线发布后回填'} />
      </div>
    )
  }

  return (
    <div>
      <div className="header">
        <div>
          <button className="btn btn-secondary" style={{ marginBottom: '.5rem' }} onClick={() => navigate('/assets')}>← 返回</button>
          <h1>{asset.name}</h1>
        </div>
        <div>
          <span className="badge badge-info">{at}</span>
          {asset.auto && <span className="badge badge-info" style={{ marginLeft: '.5rem' }}>自动生成</span>}
        </div>
      </div>

      <div className="card">
        <div className="form-group">
          <label className="form-label">版本</label>
          <select className="form-input" style={{ width: 'auto' }} value={version} onChange={e => setVersion(e.target.value)}>
            <option value={asset.version}>v{asset.version}</option>
          </select>
        </div>

        <div className="filter-bar" style={{ borderBottom: '1px solid var(--gray-200)', marginBottom: '1rem' }}>
          <button className={`filter-btn ${tab === 'content' ? 'active' : ''}`} onClick={() => setTab('content')}>内容</button>
          {at === 'Skill' && <button className={`filter-btn ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>质量报告</button>}
        </div>

        {tab === 'content' ? renderTree() : (
          <>
            <div style={{ borderLeft: '4px solid var(--success-color)', padding: '1rem', background: 'var(--gray-50)', marginBottom: '1rem', borderRadius: '.5rem' }}>
              <div style={{ fontSize: '.85rem', color: 'var(--gray-500)' }}>整体评分</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>{SKILL_REPORT.overallScore}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--gray-500)' }}>{SKILL_REPORT.summary}</div>
            </div>
            <table className="table">
              <thead><tr><th>指标</th><th>结果</th><th>状态</th></tr></thead>
              <tbody>
                {SKILL_REPORT.items.map(it => (
                  <tr key={it.name}>
                    <td>{it.name}</td>
                    <td>{it.value}</td>
                    <td><span className={`badge ${it.pass ? 'badge-success' : 'badge-danger'}`}>{it.pass ? '通过' : '未通过'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}

export default AssetDetail
