function Operations() {
  const DEPT_STATS = [
    { dept: '分组控制开发部', product: 'UDM', scenes: { total: 2, ready: 1, published: 1, unconfigured: 0 }, assets: { total: 5, published: 3, pending: 2 } },
    { dept: '分组移动接入开发部', product: 'USCDB', scenes: { total: 1, ready: 0, published: 0, unconfigured: 1 }, assets: { total: 2, published: 1, pending: 1 } },
    { dept: '分组融合数据开发部', product: 'UPCF', scenes: { total: 1, ready: 0, published: 0, unconfigured: 1 }, assets: { total: 1, published: 0, pending: 1 } },
  ]

  const totals = DEPT_STATS.reduce((a, d) => ({
    scenes: { total: a.scenes.total + d.scenes.total, ready: a.scenes.ready + d.scenes.ready, published: a.scenes.published + d.scenes.published, unconfigured: a.scenes.unconfigured + d.scenes.unconfigured },
    assets: { total: a.assets.total + d.assets.total, published: a.assets.published + d.assets.published, pending: a.assets.pending + d.assets.pending },
  }), { scenes: { total: 0, ready: 0, published: 0, unconfigured: 0 }, assets: { total: 0, published: 0, pending: 0 } })

  return (
    <div>
      <div className="header"><div><h1>工程总览</h1><p className="page-description">建设全景 · 基于部门度量</p></div></div>

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
    </div>
  )
}

export default Operations
