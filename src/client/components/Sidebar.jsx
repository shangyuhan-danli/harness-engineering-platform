import { Link, useLocation } from 'react-router-dom'
import './Sidebar.css'

function Sidebar({ user, onLogout }) {
  const location = useLocation()

  const menuItems = [
    { name: '业务场景设计', path: '/', icon: '🧭' },
    { name: 'Harness 工作流', path: '/workflows', icon: '⚙️' },
    { name: 'Agent / Skill 资产', path: '/assets', icon: '🧩' },
    { name: 'SPEC 工程', path: '/specs', icon: '📋' },
    { name: '评测/质量工程', path: '/testing', icon: '✅' },
    { name: '运营', path: '/operations', icon: '👁' },
    { name: '我的待办', path: '/todo', icon: '📌' },
    { name: '权限管理', path: '/permission', icon: '🔐' },
  ]

  return (
    <header className="sidebar">
      <div className="sidebar-header">
        <h1 className="logo">🚀 Harness 工程平台</h1>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            title={item.name}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-text">{item.name}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="user-info">
            <p className="user-name">{user.username}</p>
            <p className="user-role">{user.role}</p>
          </div>
        )}
        <button className="btn btn-secondary" onClick={onLogout}>
          退出登录
        </button>
      </div>
    </header>
  )
}

export default Sidebar
