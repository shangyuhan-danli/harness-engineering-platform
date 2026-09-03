import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import './Workflows.css'
import { authHeaders } from '../utils/auth'
import { buildCommandPreview, findUnboundNodes } from '../utils/commandPreview'
import DeptTreeSelect from '../components/DeptTreeSelect'

function Workflows() {
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [products, setProducts] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [productId, setProductId] = useState('')

  useEffect(() => {
    loadDepartments()
    loadAllProducts()
  }, [])

  const loadDepartments = async () => {
    try {
      const res = await axios.get('/api/department', { headers: authHeaders() })
      setDepartments(res.data)
      // 默认选 UDM 所在部门 → 产品 → 筛选 UDM 工作流
      const dept = res.data.find(d => d.name === '分组控制开发部')
      if (dept) {
        setSelectedDeptId(dept._id)
        const pres = await axios.get(`/api/product?departmentId=${dept._id}`, { headers: authHeaders() })
        setProducts(pres.data)
        const udm = pres.data.find(p => p.name === 'UDM')
        if (udm) {
          setProductId(udm._id)
          fetchWorkflows({ productId: udm._id })
        }
      }
    } catch (err) {
      console.error('Failed to load departments:', err)
    }
  }

  const loadAllProducts = async () => {
    try {
      const res = await axios.get('/api/product', { headers: authHeaders() })
      setAllProducts(res.data)
    } catch (err) {
      console.error('Failed to load products:', err)
    }
  }

  const loadProducts = async (departmentId) => {
    try {
      const res = await axios.get(`/api/product?departmentId=${departmentId}`, { headers: authHeaders() })
      setProducts(res.data)
    } catch (err) {
      console.error('Failed to load products:', err)
      setProducts([])
    }
  }

  const selectDept = (dept) => {
    setSelectedDeptId(dept._id)
    setProducts([])
    setProductId('')
    loadProducts(dept._id)
    fetchWorkflows({ deptId: dept._id })
  }

  const selectProduct = (pid) => {
    setProductId(pid)
    fetchWorkflows({ pid })
  }

  const fetchWorkflows = async ({ deptId, pid } = {}) => {
    setLoading(true)
    setError('')
    try {
      let url = '/api/workflow'
      if (pid) url += `?productId=${pid}`
      else if (deptId) url += `?departmentId=${deptId}`
      const res = await axios.get(url, { headers: authHeaders() })
      setWorkflows(res.data)
    } catch (err) {
      console.error('Failed to fetch workflows:', err)
      setError('工作流列表加载失败，请确认后端服务与数据库已启动')
    } finally {
      setLoading(false)
    }
  }

  const productOf = (wf) => {
    const pid = wf.scenarioId?.productId
    return pid ? allProducts.find(p => p._id === pid.toString() || p._id === pid) : null
  }
  const productName = (wf) => productOf(wf)?.name || '-'
  const scenarioPath = (wf) => {
    const sc = wf.scenarioId
    if (!sc) return wf.businessScenario || '未关联场景'
    if (sc.parentId?.name) return `${sc.parentId.name} / ${sc.name}`
    return sc.name
  }
  const deptName = (wf) => {
    const p = productOf(wf)
    if (!p?.departmentId) return '-'
    const d = departments.find(x => x._id === p.departmentId.toString() || x._id === p.departmentId)
    return d ? d.name : '-'
  }

  const handlePreview = async (workflowId) => {
    setPreviewLoading(true)
    try {
      const response = await axios.get(`/api/workflow/${workflowId}`, { headers: authHeaders() })
      setPreview(response.data)
    } catch (err) {
      console.error('Failed to load workflow preview:', err)
      alert(err.response?.data?.error || '加载预览失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  if (loading) {
    return <div className="loading-state">加载中...</div>
  }

  return (
    <div className="workflows-container">
      <div className="header">
        <div>
          <h1>Harness 工作流</h1>
          <p className="page-description">集中查看各业务场景的 Workflow；流程设计请从业务场景进入。</p>
        </div>
        <Link className="btn btn-primary workflow-entry-link" to="/">
          前往场景设计
        </Link>
      </div>

      <div className="dept-product-selector">
        <DeptTreeSelect departments={departments} selectedId={selectedDeptId} onSelect={selectDept} />
        {products.length > 0 && (
          <select className="form-input dept-select" value={productId} onChange={e => selectProduct(e.target.value)}>
            <option value="">全部产品</option>
            {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {workflows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⚙️</div>
            <div className="empty-title">暂无工作流</div>
            <div className="empty-hint">点击右上角"前往场景设计"，在场景设计台中按向导完成 Workflow 规划 → Command 入口 → Skill / Agent 集成</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>产品</th>
                <th>部门</th>
                <th>状态</th>
                <th>所属业务场景</th>
                <th>Command 入口</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map(workflow => (
                <tr key={workflow._id}>
                  <td>{workflow.name}</td>
                  <td>{productName(workflow)}</td>
                  <td>{deptName(workflow)}</td>
                  <td><span className="badge badge-info">{workflow.status}</span></td>
                  <td>{scenarioPath(workflow)}</td>
                  <td>{workflow.commands?.length || 0} 个</td>
                  <td className="workflow-row-actions">
                    <Link
                      className="btn btn-secondary"
                      to={workflow.scenarioId?._id ? `/?scenario=${workflow.scenarioId._id}` : '/'}
                    >
                      设计
                    </Link>
                    <button
                      className="btn btn-primary"
                      onClick={() => handlePreview(workflow._id)}
                      disabled={previewLoading}
                    >
                      预览调用入口
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {preview && (
        <div className="modal" onClick={() => setPreview(null)}>
          <div className="modal-content cli-preview-modal" onClick={event => event.stopPropagation()}>
            <h2>CLI 调用预览：{preview.name}</h2>
            <p className="cli-preview-hint">
              该 Workflow 发布为 Extension 后，以下 Command 可在 Claude Code TUI 中直接输入触发。
            </p>
            {findUnboundNodes(preview).length > 0 && (
              <div className="cli-preview-warning">
                ⚠️ {findUnboundNodes(preview).length} 个节点尚未绑定 Agent / Skill（{findUnboundNodes(preview).map(gap => gap.label).join('、')}），正文未包含其资产信息。
              </div>
            )}
            {preview.commands?.length === 0 ? (
              <div className="empty-hint">该 Workflow 尚未设计 Command 入口，请先在场景设计台第 3 步添加。</div>
            ) : (
              preview.commands.map(command => {
                const item = buildCommandPreview(preview, command)
                return (
                  <div className="cli-preview-command" key={command.id}>
                    <code className="cli-preview-invocation">{item.invocation}</code>
                    {item.customized && <span className="badge badge-warning">正文已自定义</span>}
                    <pre className="cli-preview-body">{item.markdown}</pre>
                  </div>
                )
              })
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setPreview(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Workflows
