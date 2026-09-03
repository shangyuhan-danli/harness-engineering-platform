import { useState, useEffect } from 'react'
import axios from 'axios'
import { authHeaders } from '../utils/auth'

// 运营数据（写死示例，基于部门度量）
const DEPT_STATS = [
  { dept: '分组控制开发部', product: 'UDM', scenes: { total: 2, ready: 1, published: 1, unconfigured: 0 }, assets: { total: 5, published: 3, pending: 2 } },
  { dept: '分组移动接入开发部', product: 'USCDB', scenes: { total: 1, ready: 0, published: 0, unconfigured: 1 }, assets: { total: 2, published: 1, pending: 1 } },
  { dept: '分组融合数据开发部', product: 'UPCF', scenes: { total: 1, ready: 0, published: 0, unconfigured: 1 }, assets: { total: 1, published: 0, pending: 1 } },
]

function Operations() {
  const [tab, setTab] = useState('ops')
  const [stats, setStats] = useState(null)
  const [activities, setActivities] = useState([])

  useEffect(() => {
    if (tab === 'overview' && !stats) loadDashboard()
  }, [tab])

  const loadDashboard = async () => {
    try {
      const [s, a] = await Promise.all([
        axios.get('/api/dashboard/stats', { headers: authHeaders() }),
        axios.get('/api/dashboard/activities', { headers: authHeaders() })
      ])
      setStats(s.data)
      setActivities(a.data)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    }
  }

  // 运营统计
  const totals = DEPT_STATS.reduce((a, d) => ({
    scenes: { total: a.scenes.total + d.scenes.total, ready: a.scenes.ready + d.scenes.ready, published: a.scenes.published + d.scenes.published, unconfigured: a.scenes.unconfigured + d.scenes.unconfigured },
    assets: { total: a.assets.total + d.assets.total, published: a.assets.published + d.assets.published, pending: a.assets.pending + d.assets.pending },
  }), { scenes: { total: 0, ready: 0, published: 0, unconfigured: 0 }, assets: { total: 0, published: 0, pending: 0 } })

  const StatCard = ({ label, value, color }) => (
    <div className="stat-card">
      <h3>{label}</h3>
      <div className="stat-val" style={{ color: color || 'var(--gray-900)' }}>{value}</div>
    </div>
  )

  const svgChart = (s) => {
    if (!s) return null
    const tw = s.total?.workflows || 1, ta = s.total?.assets || 1, ts = s.total?.specs || 1
    const data = [0.25, 0.5, 0.75, 1].map((r, i) => ({ n: '第' + (i + 1) + '周', w: Math.round(tw * r), a: Math.round(ta * r), s: Math.round(ts * r) }))
    const W = 720, H = 260, p = 40
    const mx = Math.max(...data.flatMap(d => [d.w, d.a, d.s]), 1)
    const x = i => p + i * (W - p * 2) / (data.length - 1)
    const y = v => H - p - (v / mx) * (H - p * 2)
    let g = ''
    for (let i = 0; i <= 4; i++) { const yy = p + i * ((H - p * 2) / 4); g += `<line x1="${p}" y1="${yy}" x2="${W - p}" y2="${yy}" stroke="#e5e7eb" stroke-dasharray="3 3"/><text x="${p - 6}" y="${yy + 3}" text-anchor="end" font-size="10" fill="#9ca3af">${Math.round(mx - mx * i / 4)}</text>` }
    data.forEach((d, i) => { g += `<text x="${x(i)}" y="${H - p + 16}" text-anchor="middle" font-size="10" fill="#9ca3af">${d.n}</text>` })
    ;[['w', '#2563eb'], ['a', '#10b981'], ['s', '#f59e0b']].forEach(([k, c]) => {
      g += `<polyline points="${data.map((d, i) => x(i) + ',' + y(d[k])).join(' ')}" fill="none" stroke="${c}" stroke-width="2"/>`
      data.forEach((d, i) => { g += `<circle cx="${x(i)}" cy="${y(d[k])}" r="3" fill="${c}"/>` })
    })
    return <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} dangerouslySetInnerHTML={{ __html: g }} />
  }

  return (
    <div>
      <div className="header">
        <div>
          <h1>👁 运营</h1>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <button className={`filter-btn ${tab === 'ops' ? 'active' : ''}`} onClick={() => setTab('ops')}>建设全景</button>
        <button className={`filter-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>工程总览</button>
      </div>

      {tab === 'ops' ? (
        <>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ flex: 1, minWidth: 300, border: '1px solid var(--gray-200)', borderRadius: '.5rem', padding: '1rem', background: '#fff' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--gray-600)', marginBottom: '.5rem', borderBottom: '1px solid var(--gray-100)', paddingBottom: '.4rem' }}>场景建设 & 发布</div>
              <div style={{ display: 'flex', gap: '.75rem' }}>
                {[{ l: '累计场景', v: totals.scenes.total, c: '#111827' }, { l: '已就绪', v: totals.scenes.ready, c: '#16a34a' }, { l: '已发布', v: totals.scenes.published, c: '#6366f1' }, { l: '未配置', v: totals.scenes.unconfigured, c: '#94a3b8' }].map(s => (
                  <div key={s.l} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.c }}>{s.v}</div>
                    <div style={{ fontSize: '.65rem', color: 'var(--gray-400)' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 260, border: '1px solid var(--gray-200)', borderRadius: '.5rem', padding: '1rem', background: '#fff' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--gray-600)', marginBottom: '.5rem', borderBottom: '1px solid var(--gray-100)', paddingBottom: '.4rem' }}>资产建设</div>
              <div style={{ display: 'flex', gap: '.75rem' }}>
                {[{ l: '资产总数', v: totals.assets.total, c: '#111827' }, { l: '已发布', v: totals.assets.published, c: '#16a34a' }, { l: '待发布', v: totals.assets.pending, c: '#f59e0b' }].map(s => (
                  <div key={s.l} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.c }}>{s.v}</div>
                    <div style={{ fontSize: '.65rem', color: 'var(--gray-400)' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '.5rem', fontSize: '.9rem' }}>部门度量</h3>
            <table className="table">
              <thead>
                <tr><th>部门</th><th>产品</th><th>场景累计</th><th>已就绪</th><th>已发布</th><th>未配置</th><th>资产总数</th><th>已发布</th><th>待发布</th></tr>
              </thead>
              <tbody>
                {DEPT_STATS.map(d => (
                  <tr key={d.dept}>
                    <td>{d.dept}</td>
                    <td>{d.product}</td>
                    <td>{d.scenes.total}</td>
                    <td><span className="badge badge-success">{d.scenes.ready}</span></td>
                    <td><span className="badge badge-info">{d.scenes.published}</span></td>
                    <td><span className="badge badge-warning">{d.scenes.unconfigured}</span></td>
                    <td>{d.assets.total}</td>
                    <td><span className="badge badge-success">{d.assets.published}</span></td>
                    <td><span className="badge badge-warning">{d.assets.pending}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {stats ? (
            <>
              <div className="stats-grid">
                <StatCard label="业务场景" value={stats.total?.scenarios || 0} />
                <StatCard label="工作流" value={stats.total?.workflows || 0} />
                <StatCard label="AI 资产" value={stats.total?.assets || 0} />
                <StatCard label="SPEC" value={stats.total?.specs || 0} />
                <StatCard label="测试集" value={stats.total?.testCases || 0} />
              </div>
              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>资产/交付趋势</h3>
                {svgChart(stats)}
              </div>
              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>近期活动</h3>
                {activities.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                    {activities.map((a, i) => (
                      <div key={i} className="act-item">
                        <span className="act-type">{a.type === 'workflow' ? '工作流' : a.type === 'asset' ? '资产' : 'SPEC'}</span>
                        <span className="act-name">{a.name || a.title}</span>
                        <span className="act-time">{a.updatedAt ? new Date(a.updatedAt).toLocaleString('zh-CN') : '-'}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-state">暂无活动</div>}
              </div>
            </>
          ) : <div className="loading-state">加载中...</div>}
        </>
      )}
    </div>
  )
}

export default Operations
