import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Workflows from './pages/Workflows'
import Assets from './pages/Assets'
import Specs from './pages/Specs'
import Scenarios from './pages/Scenarios'
import Todo from './pages/Todo'
import Permission from './pages/Permission'
import Operations from './pages/Operations'
import AssetDetail from './pages/AssetDetail'
import AssetPublish from './pages/AssetPublish'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      setIsAuthenticated(true)
      const userData = localStorage.getItem('user')
      if (userData) {
        setUser(JSON.parse(userData))
      }
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsAuthenticated(false)
    setUser(null)
  }

  if (!isAuthenticated) {
    return <Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} />
  }

  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar user={user} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Scenarios />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/specs" element={<Specs />} />
            <Route path="/todo" element={<Todo />} />
            <Route path="/permission" element={<Permission />} />
            <Route path="/operations" element={<Operations />} />
            <Route path="/assets/:id/detail" element={<AssetDetail />} />
            <Route path="/assets/:id/publish" element={<AssetPublish />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App