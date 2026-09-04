import { useState } from 'react'

// 个人待办：当前用户名下的开发任务（写死示例数据）
const TASKS = [
  { id: 't1', name: '/codec-generate', type: 'command', product: 'UDM', owner: 'moli', devOwner: 'moli', due: '2026-09-15', status: '已完成', level: '产品级', version: '1.0.0', desc: '根据协议定义生成编解码实现' },
  { id: 't2', name: '测试Agent-未发布', type: 'agent', product: 'UDM', owner: 'moli', devOwner: 'moli', due: '2026-09-20', status: '进行中', level: '产品级', version: '—', desc: '测试发布流程的 Agent' },
  { id: 't3', name: '/test-unpublished', type: 'command', product: 'UDM', owner: 'moli', devOwner: 'moli', due: '2026-09-18', status: '进行中', level: '产品级', version: '—', desc: '测试用未发布 Command' },
  { id: 't4', name: '编解码代码生成', type: 'skill', product: 'UDM', owner: 'moli', devOwner: '张工', due: '2026-09-10', status: '已完成', level: '产品级', version: '1.0.0', desc: '生成编解码实现代码' },
  { id: 't5', name: '/summarize', type: 'command', product: 'UDM', owner: 'moli', devOwner: '钱工', due: '2026-09-25', status: '进行中', level: '产品级', version: '—', desc: '对输入文本生成结构化摘要' },
  { id: 't6', name: '协议解析Skill', type: 'skill', product: 'UDM', owner: 'moli', devOwner: 'moli', due: '2026-09-12', status: '已完成', level: '产品级', version: '1.0.0', desc: '解析协议字段与约束' },
]

const TYPE_LABEL = { command: 'Command', agent: 'Agent', skill: 'Skill', mcp: 'MCP' }

function Todo() {
  const [q, setQ] = useState('')
  const list = TASKS.filter(t => !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.desc.includes(q))
  const done = list.filter(t => t.status === '已完成').length
  const prog = list.filter(t => t.status === '进行中').length

  return (
    <div>
      <div className="header">
        <div>
          <h1>我的待办</h1>
          <p className="page-description">分派给当前用户的开发任务</p>
        </div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span className="badge badge-info">{list.length}</span>
          <input className="form-input" style={{ width: '220px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="搜索任务名称…" />
          <div style={{ flex: 1 }}></div>
          <span style={{ color: 'var(--success-color)', fontWeight: 600, fontSize: '.8rem' }}>已完成 {done}</span>
          <span style={{ color: 'var(--warning-color)', fontWeight: 600, fontSize: '.8rem' }}>进行中 {prog}</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>能力名称</th><th>类型</th><th>产品</th><th>责任人</th><th>开发责任人</th><th>层级</th><th>版本</th><th>计划完成</th><th>状态</th>
            </tr>
          </thead>
          <tbody>
            {list.length ? list.map(t => (
              <tr key={t.id}>
                <td>
                  <code style={{ fontFamily: 'ui-monospace,monospace', fontSize: '.75rem' }}>{t.name}</code>
                  <div style={{ fontSize: '.7rem', color: 'var(--gray-400)' }}>{t.desc}</div>
                </td>
                <td><span className="badge badge-info">{TYPE_LABEL[t.type]}</span></td>
                <td>{t.product}</td>
                <td>{t.owner}</td>
                <td>{t.devOwner}</td>
                <td>{t.level}</td>
                <td>{t.version !== '—' ? 'v' + t.version : '—'}</td>
                <td>{t.due}</td>
                <td><span className={`badge ${t.status === '已完成' ? 'badge-success' : 'badge-warning'}`}>{t.status}</span></td>
              </tr>
            )) : (
              <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--gray-400)' }}>暂无任务</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Todo
