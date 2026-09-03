import { useState } from 'react'

// 权限管理：部门级数据访问授权（写死示例数据）
const INITIAL_USERS = [
  { name: '李明', empNo: 'E001', dept: '分组控制开发部', role: 'owner' },
  { name: 'moli', empNo: 'E002', dept: '分组控制开发部', role: 'admin' },
  { name: '王芳', empNo: 'E003', dept: '分组移动接入开发部', role: 'owner' },
  { name: '张工', empNo: 'E004', dept: '分组控制开发部', role: 'admin' },
  { name: '赵工', empNo: 'E005', dept: '分组融合数据开发部', role: 'owner' },
]

function Permission() {
  const [users, setUsers] = useState(INITIAL_USERS)
  const [empNo, setEmpNo] = useState('')
  const [dept, setDept] = useState('')

  const ownerCount = users.filter(u => u.role === 'owner').length
  const adminCount = users.filter(u => u.role === 'admin').length
  const depts = [...new Set(users.map(u => u.dept))]

  const add = () => {
    if (!empNo || !dept) { alert('请填写工号/姓名并选择部门'); return }
    setUsers([...users, { name: empNo, empNo, dept, role: 'admin' }])
    setEmpNo('')
    setDept('')
  }
  const remove = (i) => setUsers(users.filter((_, x) => x !== i))

  return (
    <div>
      <div className="header">
        <div>
          <h1>🔐 权限管理</h1>
          <p className="page-description">部门 Owner 可管理本部门管理员</p>
        </div>
        <span className="badge badge-info">{users.length} 人</span>
      </div>

      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1, border: '1px solid var(--gray-200)', borderRadius: '.5rem', padding: '1rem', textAlign: 'center', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--danger-color)' }}>{ownerCount}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--gray-500)' }}>Owner</div>
        </div>
        <div style={{ flex: 1, border: '1px solid var(--gray-200)', borderRadius: '.5rem', padding: '1rem', textAlign: 'center', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary-color)' }}>{adminCount}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--gray-500)' }}>管理员</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
          <h3 style={{ fontSize: '1rem' }}>添加管理员</h3>
          <span className="badge badge-info">仅 Owner 可操作</span>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '160px' }}>
            <label className="form-label">工号/姓名</label>
            <input className="form-input" value={empNo} onChange={e => setEmpNo(e.target.value)} placeholder="输入工号或姓名" />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
            <label className="form-label">授权部门</label>
            <select className="form-input" value={dept} onChange={e => setDept(e.target.value)}>
              <option value="">选部门…</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={add}>＋ 添加管理员</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '.5rem', fontSize: '1rem' }}>授权列表</h3>
        <table className="table">
          <thead>
            <tr><th>姓名</th><th>工号</th><th>授权部门</th><th>角色</th><th>操作</th></tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i}>
                <td><b>{u.name}</b></td>
                <td><code style={{ fontFamily: 'ui-monospace,monospace', fontSize: '.75rem' }}>{u.empNo}</code></td>
                <td>{u.dept}</td>
                <td><span className={`badge ${u.role === 'owner' ? 'badge-danger' : 'badge-info'}`}>{u.role === 'owner' ? 'Owner' : '管理员'}</span></td>
                <td>{u.role === 'owner' ? <span style={{ color: 'var(--gray-300)' }}>—</span> : <button className="btn btn-secondary" style={{ color: 'var(--danger-color)' }} onClick={() => remove(i)}>移除</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '.75rem', padding: '.6rem .8rem', border: '1px solid var(--gray-200)', borderRadius: '.4rem', background: 'var(--gray-50)', fontSize: '.75rem', color: 'var(--gray-500)', lineHeight: 1.7 }}>
        <b style={{ color: 'var(--gray-600)' }}>权限说明：</b>
        <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>Owner</span> 部门负责人，后台配置不可删除，可管理本部门管理员 ·
        <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>管理员</span> 由 Owner 添加/移除，可编辑本部门场景和清单
      </div>
    </div>
  )
}

export default Permission
