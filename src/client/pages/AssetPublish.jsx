import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { authHeaders } from '../utils/auth'

const SAMPLE_CONTENT = {
  Agent: { doc: 'Agent 能力说明：接收输入文本，输出分类/识别结果。\n调用：HTTP API\n输入：{ text: string }\n输出：{ category: string }' },
  Skill: { skillMd: '# Skill 能力说明\n\n分析输入并输出结构化结论。', script: '#!/bin/bash\necho "analyzing..."\nnode ./analyze.js "$1"' },
  Command: { doc: 'Command：在 Agent 中通过 /xxx 触发，参数与正文由流水线发布回填。' },
  Extension: {}
}

const ORG_LIST = ['云核心网研发管理部', '客服中心', '运维部', '数据中台', '安全部']

function AssetPublish() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(location.state?.asset || null)
  const [tab, setTab] = useState('publish')
  const [org, setOrg] = useState('')
  const [desc, setDesc] = useState('')
  const [beta, setBeta] = useState('')
  const [releases, setReleases] = useState([])
  const [workflow, setWorkflow] = useState(null)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (asset) {
      setDesc(asset.description || '')
      loadReleases()
      if (asset.auto && asset.scenarioId) {
        axios.get(`/api/workflow?scenarioId=${asset.scenarioId}`, { headers: authHeaders() })
          .then(r => setWorkflow(r.data[0] || null)).catch(() => setWorkflow(null))
      }
    }
  }, [asset])

  const loadReleases = async () => {
    try {
      if (asset.assetType === 'Command') {
        // Command releaseNotes 在对象上
        setReleases(asset.releaseNotes || [])
      } else if (!asset.auto) {
        const res = await axios.get(`/api/asset/${asset._id}`, { headers: authHeaders() })
        setReleases(res.data.releaseNotes || [])
      } else if (asset.scenarioId) {
        const res = await axios.get(`/api/extension/${asset.scenarioId}/releases`, { headers: authHeaders() })
        setReleases(res.data)
      }
    } catch (err) { setReleases([]) }
  }

  const confirmPublish = async () => {
    if (!org) { alert('请选择目标组织'); return }
    setPublishing(true)
    try {
      const payload = { organization: org, notes: desc, betaProduct: beta }
      if (asset.auto && asset.scenarioId) {
        // Extension 发布
        const wf = workflow || {}
        const counts = `${(wf.commands || []).length} cmd · ${(wf.assets || []).filter(a => a.type === 'Agent').length} agent · ${(wf.assets || []).filter(a => a.type === 'Skill').length} skill`
        await axios.post('/api/extension/release', {
          scenarioId: asset.scenarioId, extName: asset.name, organization: org, betaProduct: beta, description: desc, counts
        }, { headers: authHeaders() })
      } else if (asset.assetType === 'Command') {
        await axios.post(`/api/command/${asset._id}/publish`, payload, { headers: authHeaders() })
      } else {
        await axios.post(`/api/asset/${asset._id}/publish`, payload, { headers: authHeaders() })
      }
      await loadReleases()
      setTab('history')
      alert('发布成功')
    } catch (err) {
      alert(err.response?.data?.error || '发布失败')
    } finally {
      setPublishing(false)
    }
  }

  const renderTree = () => {
    const at = asset.assetType
    const c = SAMPLE_CONTENT[at] || {}
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
            <div style={{ marginLeft: '24px' }}>{cmds.length ? cmds.map(x => <div key={x.id} style={{ color: 'var(--gray-600)' }}>📄 {x.name}.md <span className="badge badge-info" style={{ fontSize: '.65rem' }}>入口</span></div>) : <span style={{ color: 'var(--gray-400)' }}>（空）</span>}</div>
            <div style={{ fontWeight: 700 }}>📁 agents/</div>
            <div style={{ marginLeft: '24px' }}>{agents.length ? agents.map(x => <div key={x._id} style={{ color: 'var(--gray-600)' }}>📁 {x.assetId?.name}/</div>) : <span style={{ color: 'var(--gray-400)' }}>（空）</span>}</div>
            <div style={{ fontWeight: 700 }}>📁 skills/</div>
            <div style={{ marginLeft: '24px' }}>{skills.length ? skills.map(x => <div key={x._id} style={{ color: 'var(--gray-600)' }}>📁 {x.assetId?.name}/</div>) : <span style={{ color: 'var(--gray-400)' }}>（空）</span>}</div>
          </div>
        </div>
      )
    }
    if (at === 'Skill') {
      return (
        <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '13px', lineHeight: '1.9', background: 'var(--gray-50)', padding: '16px', borderRadius: '8px' }}>
          <div style={{ fontWeight: 700 }}>📁 {asset.name}/</div>
          <div style={{ marginLeft: '24px', borderLeft: '1px dashed var(--gray-300)', paddingLeft: '12px' }}>
            <div style={{ color: 'var(--gray-600)' }}>📄 SKILL.md</div>
            <pre style={{ margin: '4px 0 8px', padding: '8px 10px', background: '#1e293b', borderRadius: '6px', whiteSpace: 'pre-wrap', fontSize: '11px', color: '#cbd5e1' }}>{c.skillMd}</pre>
            <div style={{ color: 'var(--gray-600)' }}>📄 run.sh</div>
            <pre style={{ margin: '4px 0 8px', padding: '8px 10px', background: '#1e293b', borderRadius: '6px', whiteSpace: 'pre-wrap', fontSize: '11px', color: '#cbd5e1' }}>{c.script}</pre>
          </div>
        </div>
      )
    }
    return (
      <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '13px', lineHeight: '1.9', background: 'var(--gray-50)', padding: '16px', borderRadius: '8px' }}>
        <div style={{ color: 'var(--gray-600)' }}>📄 {asset.name}.md</div>
        <pre style={{ margin: '4px 0 8px', padding: '8px 10px', background: '#1e293b', borderRadius: '6px', whiteSpace: 'pre-wrap', fontSize: '11px', color: '#cbd5e1' }}>{c.doc || '内容由流水线发布后回填'}</pre>
      </div>
    )
  }

  if (!asset) {
    return <div className="empty-state"><div className="empty-title">资产不存在</div><button className="btn btn-secondary" onClick={() => navigate('/assets')}>返回</button></div>
  }

  const nextVersion = asset.auto
    ? `v1.0.${releases.length + 1}`
    : asset.version ? `v${asset.version}` : '无版本（未开发）'

  return (
    <div>
      <div className="header">
        <div>
          <button className="btn btn-secondary" style={{ marginBottom: '.5rem' }} onClick={() => navigate('/assets')}>← 返回</button>
          <h1>发布 · {asset.name}</h1>
        </div>
        <span className="badge badge-info">{asset.assetType}</span>
      </div>

      <div className="filter-bar" style={{ borderBottom: '1px solid var(--gray-200)', marginBottom: '1rem' }}>
        <button className={`filter-btn ${tab === 'publish' ? 'active' : ''}`} onClick={() => setTab('publish')}>发布</button>
        <button className={`filter-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>发布历史</button>
      </div>

      {tab === 'publish' ? (
        <div className="card">
          <div className="form-group">
            <label className="form-label">下一版本（自增）</label>
            <input className="form-input" style={{ width: 'auto' }} value={nextVersion} disabled />
          </div>
          <h3 style={{ margin: '1rem 0 .5rem', fontSize: '.9rem' }}>目录结构</h3>
          {renderTree()}
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">描述</label>
            <textarea className="form-input" rows="2" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">beta product</label>
            <input className="form-input" value={beta} onChange={e => setBeta(e.target.value)} placeholder="填写 beta product" />
          </div>
          <div className="form-group">
            <label className="form-label">目标组织</label>
            <select className="form-input" style={{ width: 'auto' }} value={org} onChange={e => setOrg(e.target.value)}>
              <option value="">选组织…</option>
              {ORG_LIST.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={confirmPublish} disabled={publishing}>
            {publishing ? '发布中...' : '确认发布'}
          </button>
        </div>
      ) : (
        <div className="card">
          <h3 style={{ marginBottom: '.5rem', fontSize: '.9rem' }}>发布历史</h3>
          {releases.length === 0 ? (
            <div className="empty-state"><div className="empty-title">暂无发布记录</div></div>
          ) : (
            releases.map((r, i) => (
              <div key={i} className="rel-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.4rem' }}>
                  <b>{r.extName || asset.name}</b>
                  <span style={{ fontSize: '.75rem', fontFamily: 'monospace', color: 'var(--gray-500)', background: 'var(--gray-100)', padding: '.1rem .4rem', borderRadius: '.25rem' }}>v{r.version}</span>
                  <span className="badge badge-success">{r.status || '已发布'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--gray-500)' }}>{r.date ? new Date(r.date).toLocaleString('zh-CN') : '-'}</span>
                </div>
                <div style={{ fontSize: '.75rem', color: 'var(--gray-500)' }}>发布人: {r.publisher || '—'} · 组织: {r.organization || '—'} · beta: {r.betaProduct || '—'}</div>
                {r.counts && <div style={{ fontSize: '.7rem', color: 'var(--gray-400)', marginTop: '.2rem' }}>{r.counts}</div>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default AssetPublish
