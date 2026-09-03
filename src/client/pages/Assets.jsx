import { useState, useEffect } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import './Assets.css'
import { authHeaders } from '../utils/auth'
import DeptTreeSelect from '../components/DeptTreeSelect'

const TYPE_LABELS = {
  all: '全部',
  Agent: 'Agent',
  Skill: 'Skill',
  Command: 'Command',
  Extension: 'Extension'
}

// 详情内容示例（实际内容由流水线发布后回填，此处用于演示）
const SAMPLE_CONTENT = {
  Agent: { doc: 'Agent 能力说明：接收输入文本，输出分类/识别结果。\n调用：HTTP API\n输入：{ text: string }\n输出：{ category: string }' },
  Skill: { skillMd: '# Skill 能力说明\n\n分析输入并输出结构化结论。\n\n## 输入\n{ input: string }\n\n## 输出\n{ result: object }', script: '#!/bin/bash\n# 运行 Skill\necho "analyzing..."\nnode ./analyze.js "$1"' },
  Command: { doc: 'Command：在 Agent 中通过 /xxx 触发，参数与正文由流水线发布回填。\n\n## 参数\n{ input: string }\n\n## 正文\n由环节编排自动生成' },
  Extension: {}
}

// Skill 质量报告（每版本一份，此处为固定示例数据）
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
    { name: '可维护性', value: '89 分', pass: true }
  ],
  summary: '该 Skill 已通过质量门禁，整体评分 92 分，建议发布。'
}

// 发布目标组织（示例）
const ORG_LIST = ['云核心网研发管理部', '客服中心', '运维部', '数据中台', '安全部']

const emptyForm = { name: '', assetType: 'Agent', description: '', departmentId: '', productId: '', owner: '', dueDate: '' }

function Assets() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [publishingId, setPublishingId] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [justCreated, setJustCreated] = useState(false)
  const [detailAsset, setDetailAsset] = useState(null)
  const [detailVersion, setDetailVersion] = useState('')
  const [detailTab, setDetailTab] = useState('content')
  const [detailWorkflow, setDetailWorkflow] = useState(null)
  const [publishAsset, setPublishAsset] = useState(null)
  const [publishOrg, setPublishOrg] = useState('')
  const [publishTab, setPublishTab] = useState('publish')
  const [extPublishAsset, setExtPublishAsset] = useState(null)
  const [extWorkflow, setExtWorkflow] = useState(null)
  const [extReleases, setExtReleases] = useState([])
  const [extTab, setExtTab] = useState('publish')
  const [extForm, setExtForm] = useState({ extName: '', description: '', betaProduct: '', organization: '' })
  const [departments, setDepartments] = useState([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [products, setProducts] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [formProducts, setFormProducts] = useState([])
  const [productId, setProductId] = useState('')

  // 批量导入
  const [showBatch, setShowBatch] = useState(false)
  const [batchOwnerType, setBatchOwnerType] = useState('product')
  const [batchDeptId, setBatchDeptId] = useState('')
  const [batchProductId, setBatchProductId] = useState('')

  useEffect(() => {
    loadDepartments()
    loadAllProducts()
  }, [])

  useEffect(() => {
    fetchAssets()
  }, [filter])

  const loadDepartments = async () => {
    try {
      const res = await axios.get('/api/department', { headers: authHeaders() })
      setDepartments(res.data)
      // 默认选 UDM 所在部门 → 产品 → 筛选 UDM 资产
      const dept = res.data.find(d => d.name === '分组控制开发部')
      if (dept) {
        setSelectedDeptId(dept._id)
        const pres = await axios.get(`/api/product?departmentId=${dept._id}`, { headers: authHeaders() })
        setProducts(pres.data)
        const udm = pres.data.find(p => p.name === 'UDM')
        if (udm) {
          setProductId(udm._id)
          fetchAssets({ productId: udm._id })
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
    setProductId('')
    setProducts([])
    loadProducts(dept._id)
    fetchAssets({ departmentId: dept._id })
  }

  const selectProduct = (pid) => {
    setProductId(pid)
    fetchAssets({ productId: pid })
  }

  const fetchAssets = async (opts = {}) => {
    setLoading(true)
    setError('')
    try {
      const mapCmd = c => ({ ...c, assetType: 'Command', status: c.version ? 'published' : 'draft', auto: false })
      if (filter === 'Command') {
        const res = await axios.get('/api/command', { headers: authHeaders() })
        setAssets(res.data.map(mapCmd))
        return
      }
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('assetType', filter)
      const dept = opts.departmentId !== undefined ? opts.departmentId : selectedDeptId
      const prod = opts.productId !== undefined ? opts.productId : productId
      if (prod) params.set('productId', prod)
      else if (dept) params.set('departmentId', dept)
      const qs = params.toString()
      const response = await axios.get(`/api/asset${qs ? '?' + qs : ''}`, { headers: authHeaders() })
      let list = response.data
      if (filter === 'all') {
        const cmds = await axios.get('/api/command', { headers: authHeaders() })
        list = list.concat(cmds.data.map(mapCmd))
      }
      setAssets(list)
    } catch (err) {
      console.error('Failed to fetch assets:', err)
      setError('资产列表加载失败，请确认后端服务与数据库已启动')
    } finally {
      setLoading(false)
    }
  }

  // 新建弹窗：选部门后加载该部门产品（级联）
  const selectFormDept = (dept) => {
    setFormData(f => ({ ...f, departmentId: dept._id, productId: '' }))
    axios.get(`/api/product?departmentId=${dept._id}`, { headers: authHeaders() })
      .then(r => setFormProducts(r.data))
      .catch(() => setFormProducts([]))
  }

  // 单条新建：保留归属，提交后不关闭，可继续添加下一条
  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/asset', formData, { headers: authHeaders() })
      setFormData({ ...emptyForm, departmentId: formData.departmentId, productId: formData.productId })
      setJustCreated(true)
      setTimeout(() => setJustCreated(false), 2000)
      fetchAssets()
    } catch (err) {
      console.error('Failed to create asset:', err)
      alert(err.response?.data?.error || '创建资产失败')
    }
  }

  const confirmPublish = async () => {
    if (!publishAsset) return
    if (!publishOrg) { alert('请选择目标组织'); return }
    setPublishingId(publishAsset._id)
    try {
      const url = publishAsset.assetType === 'Command'
        ? `/api/command/${publishAsset._id}/publish`
        : `/api/asset/${publishAsset._id}/publish`
      await axios.post(url, { organization: publishOrg }, { headers: authHeaders() })
      setPublishAsset(null)
      fetchAssets()
    } catch (err) {
      alert(err.response?.data?.error || '发布失败')
    } finally {
      setPublishingId(null)
    }
  }

  // Extension 发布：加载场景 workflow（目录树）+ 发布历史
  const openExtPublish = async (asset) => {
    setExtPublishAsset(asset)
    setExtTab('publish')
    setExtForm({ extName: asset.name, description: asset.description || '', betaProduct: '', organization: '' })
    try {
      const wfRes = await axios.get(`/api/workflow?scenarioId=${asset.scenarioId}`, { headers: authHeaders() })
      setExtWorkflow(wfRes.data[0] || null)
    } catch (err) { setExtWorkflow(null) }
    try {
      const relRes = await axios.get(`/api/extension/${asset.scenarioId}/releases`, { headers: authHeaders() })
      setExtReleases(relRes.data)
    } catch (err) { setExtReleases([]) }
  }

  const confirmExtPublish = async () => {
    if (!extPublishAsset) return
    if (!extForm.organization) { alert('请选择目标组织'); return }
    const wf = extWorkflow || {}
    const counts = `${(wf.commands || []).length} cmd · ${(wf.assets || []).filter(a => a.type === 'Agent').length} agent · ${(wf.assets || []).filter(a => a.type === 'Skill').length} skill`
    try {
      await axios.post('/api/extension/release', {
        scenarioId: extPublishAsset.scenarioId,
        extName: extForm.extName,
        organization: extForm.organization,
        betaProduct: extForm.betaProduct,
        description: extForm.description,
        counts
      }, { headers: authHeaders() })
      const relRes = await axios.get(`/api/extension/${extPublishAsset.scenarioId}/releases`, { headers: authHeaders() })
      setExtReleases(relRes.data)
      setExtTab('history')
      fetchAssets()
      alert('发布成功')
    } catch (err) {
      alert(err.response?.data?.error || '发布失败')
    }
  }

  // 批量导入：下载 Excel 模板
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['name', 'assetType', 'owner', 'dueDate', 'description'],
      ['UDM分类Agent', 'Agent', '张工', '2026-12-31', '工单分类'],
      ['协议解析Skill', 'Skill', '李工', '2026-11-30', '解析协议']
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Assets')
    XLSX.writeFile(wb, 'assets-template.xlsx')
  }

  // 批量导入：上传 Excel 解析并导入，完成后关闭弹窗、刷新列表
  const handleBatchFile = async (file) => {
    if (!file) return
    if (batchOwnerType === 'product' && !batchProductId) { alert('请先选择产品'); return }
    if (batchOwnerType === 'department' && !batchDeptId) { alert('请先选择部门'); return }
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    const items = rows.filter(r => r.name).map(r => ({
      name: String(r.name).trim(),
      assetType: r.assetType || 'Agent',
      owner: r.owner ? String(r.owner).trim() : '',
      dueDate: r.dueDate ? String(r.dueDate).trim() : '',
      description: r.description ? String(r.description).trim() : ''
    }))
    if (!items.length) { alert('Excel 中无有效数据行'); return }
    const payload = {
      items,
      productId: batchOwnerType === 'product' ? batchProductId : null,
      departmentId: batchOwnerType === 'department' ? batchDeptId : null
    }
    try {
      const res = await axios.post('/api/asset/batch', payload, { headers: authHeaders() })
      setShowBatch(false)
      setBatchDeptId('')
      setBatchProductId('')
      fetchAssets()
      alert(`成功导入 ${res.data.length} 条资产`)
    } catch (err) {
      alert(err.response?.data?.error || '批量导入失败')
    }
  }

  if (loading) {
    return <div className="loading-state">加载中...</div>
  }

  return (
    <div className="assets-container">
      <div className="header">
        <div>
          <h1>Agent / Skill 资产</h1>
          <p className="page-description">设计可复用的执行单元，并在业务场景的 Workflow 阶段中进行编排。Extension 基于场景自动生成。</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowBatch(true)}>批量导入</button>
          <button className="btn btn-primary" onClick={() => { setFormData(emptyForm); setShowModal(true) }}>+ 新建资产</button>
        </div>
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
        <div className="filter-bar">
          {['all', 'Agent', 'Skill', 'Command', 'Extension'].map(type => (
            <button
              key={type}
              className={`filter-btn ${filter === type ? 'active' : ''}`}
              onClick={() => setFilter(type)}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {assets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-title">暂无资产</div>
            <div className="empty-hint">点击"新建资产"添加 Agent / Skill / MCP；Extension 基于场景自动生成。</div>
          </div>
        ) : (
          <div className="assets-grid">
            {assets.map(asset => (
              <div key={asset._id} className="asset-card" onClick={async () => { setDetailAsset(asset); setDetailVersion(asset.version); setDetailTab('content'); setDetailWorkflow(null); if (asset.auto && asset.scenarioId) { try { const r = await axios.get(`/api/workflow?scenarioId=${asset.scenarioId}`, { headers: authHeaders() }); setDetailWorkflow(r.data[0] || null) } catch (e) { setDetailWorkflow(null) } } }} style={{ cursor: 'pointer' }}>
                <div className="asset-header">
                  <h3>{asset.name}</h3>
                  <span className="badge badge-info">{asset.assetType}</span>
                </div>
                <p className="asset-description">{asset.description || '暂无描述'}</p>
                <div className="asset-meta">
                  <span>⭐ {(asset.marketplace?.rating || 0).toFixed(1)}</span>
                  <span>📥 {asset.marketplace?.downloads || 0}</span>
                  <span>📞 {asset.marketplace?.calls || 0}</span>
                  <span>{asset.version ? 'v' + asset.version : '无版本'}</span>
                  {(() => {
                    if (!asset.version) return <span className="badge badge-info">未开发</span>
                    const pub = (asset.releaseNotes || []).some(r => (r.version || '') === (asset.version || ''))
                    return pub ? <span className="badge badge-success">已发布</span> : <span className="badge badge-warning">待发布</span>
                  })()}
                </div>
                <div className="asset-actions">
                  {asset.auto ? (
                    <button className="btn btn-primary" onClick={() => openExtPublish(asset)}>发布</button>
                  ) : asset.status === 'draft' ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => { setPublishAsset(asset); setPublishOrg(''); setPublishTab('publish') }}
                      disabled={publishingId === asset._id}
                    >
                      {publishingId === asset._id ? '发布中...' : '发布'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <h2>新建资产</h2>
            {justCreated && <div className="error-banner" style={{ background: '#d1fae5', color: '#065f46' }}>已创建，归属保留，可继续添加下一条</div>}
            <form onSubmit={handleCreate}>
              <div className="wizard-form-grid">
                <div className="form-group">
                  <label className="form-label">部门</label>
                  <DeptTreeSelect departments={departments} selectedId={formData.departmentId} onSelect={selectFormDept} />
                </div>
                <div className="form-group">
                  <label className="form-label">产品</label>
                  <select className="form-input" value={formData.productId} onChange={(e) => setFormData({ ...formData, productId: e.target.value })}>
                    <option value="">不选（按部门归属）</option>
                    {formProducts.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">类型</label>
                  <select className="form-input" value={formData.assetType} onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}>
                    <option value="Agent">Agent</option>
                    <option value="Skill">Skill</option>
                  </select>
              </div>
              <div className="form-group">
                <label className="form-label">名称</label>
                <input type="text" className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">责任人</label>
                <input className="form-input" value={formData.owner} onChange={(e) => setFormData({ ...formData, owner: e.target.value })} placeholder="如：张工" />
              </div>
              <div className="form-group">
                <label className="form-label">完成时间</label>
                <input className="form-input" type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">描述</label>
                <textarea className="form-input" rows="3" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <p className="wizard-step-hint" style={{ marginBottom: '1rem' }}>选部门后产品下拉自动加载该部门产品；选了产品归属产品，否则归属部门。创建保留归属，可连续添加。</p>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">创建并继续</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>完成</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBatch && (
        <div className="modal" onClick={() => setShowBatch(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <h2>批量导入资产</h2>
            <p className="wizard-step-hint" style={{ marginBottom: '1rem' }}>
              选一次归属（产品或部门，二选一），上传 CSV 后直接导入，完成后在列表查看。
            </p>
            <div className="wizard-form-grid">
              <div className="form-group">
                <label className="form-label">归属类型</label>
                <select className="form-input" value={batchOwnerType} onChange={(e) => { setBatchOwnerType(e.target.value); setBatchDeptId(''); setBatchProductId('') }}>
                  <option value="product">按产品</option>
                  <option value="department">按部门</option>
                </select>
              </div>
              <div className="form-group">
                {batchOwnerType === 'product' ? (
                  <>
                    <label className="form-label">产品</label>
                    <select className="form-input" value={batchProductId} onChange={(e) => setBatchProductId(e.target.value)}>
                      <option value="">选产品…</option>
                      {allProducts.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <label className="form-label">部门</label>
                    <DeptTreeSelect departments={departments} selectedId={batchDeptId} onSelect={(d) => setBatchDeptId(d._id)} />
                  </>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={downloadTemplate}>下载 Excel 模板</button>
              <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                上传 Excel 导入
                <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && handleBatchFile(e.target.files[0])} />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowBatch(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
      {detailAsset && (
        <div className="modal" onClick={() => setDetailAsset(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <h2>{detailAsset.name}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <span className="badge badge-info">{detailAsset.assetType}</span>
              {detailAsset.auto && <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>自动生成</span>}
            </div>
            <div className="form-group">
              <label className="form-label">版本</label>
              <select className="form-input" value={detailVersion} onChange={(e) => setDetailVersion(e.target.value)}>
                <option value={detailAsset.version}>v{detailAsset.version}</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--gray-200)', marginBottom: '1rem' }}>
              <button type="button" className={`filter-btn ${detailTab === 'content' ? 'active' : ''}`} onClick={() => setDetailTab('content')}>内容</button>
              {detailAsset.assetType === 'Skill' && (
                <button type="button" className={`filter-btn ${detailTab === 'report' ? 'active' : ''}`} onClick={() => setDetailTab('report')}>报告</button>
              )}
            </div>
            {detailTab === 'content' ? (
              (() => {
                const at = detailAsset.assetType
                const c = SAMPLE_CONTENT[at] || {}
                const file = (name, content) => (
                  <div key={name}>
                    <div style={{ color: 'var(--gray-600)' }}>📄 {name}</div>
                    <pre style={{ margin: '4px 0 8px', padding: '8px 10px', background: '#1e293b', borderRadius: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '10.5px', lineHeight: '1.5', color: '#cbd5e1' }}>{content}</pre>
                  </div>
                )
                const wrap = (children) => (
                  <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '12px', lineHeight: '1.9', background: 'var(--gray-50)', padding: '12px', borderRadius: '8px' }}>{children}</div>
                )
                const sub = (children) => <div style={{ marginLeft: '22px', borderLeft: '1px dashed var(--gray-300)', paddingLeft: '10px' }}>{children}</div>
                const empty = <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>（空）</span>

                if (at === 'Skill') {
                  return wrap(<><div style={{ fontWeight: 700 }}>📁 {detailAsset.name}/</div>{sub(<>{file('SKILL.md', c.skillMd)}{file('run.sh', c.script)}</>)}</>)
                }
                if (at === 'Extension') {
                  const wf = detailWorkflow || {}
                  const cmds = wf.commands || []
                  const agents = (wf.assets || []).filter(a => a.type === 'Agent')
                  const skills = (wf.assets || []).filter(a => a.type === 'Skill')
                  return wrap(
                    <>
                      <div style={{ fontWeight: 700 }}>📁 {detailAsset.name}/</div>
                      {sub(
                        <>
                          <div style={{ fontWeight: 700 }}>📁 commands/</div>
                          <div style={{ marginLeft: '22px' }}>{cmds.length ? cmds.map(x => <div key={x.id}>{file(x.name + '.md', SAMPLE_CONTENT.Command.doc)}</div>) : empty}</div>
                          <div style={{ fontWeight: 700 }}>📁 agents/</div>
                          <div style={{ marginLeft: '22px' }}>{agents.length ? agents.map(x => <div key={x._id} style={{ color: 'var(--gray-600)' }}>📄 {x.assetId?.name}.md</div>) : empty}</div>
                          <div style={{ fontWeight: 700 }}>📁 skills/</div>
                          <div style={{ marginLeft: '22px' }}>{skills.length ? skills.map(x => <div key={x._id} style={{ color: 'var(--gray-600)' }}>📁 {x.assetId?.name}/</div>) : empty}</div>
                        </>
                      )}
                    </>
                  )
                }
                // Command / Agent / 其他：单文件
                return wrap(file(detailAsset.name + '.md', c.doc || '内容由流水线发布后回填'))
              })()
            ) : (
              <>
                <div style={{ borderLeft: '4px solid var(--success-color)', padding: '1rem', background: 'var(--gray-50)', marginBottom: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>整体评分</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700 }}>{SKILL_REPORT.overallScore}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{SKILL_REPORT.summary}</div>
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
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDetailAsset(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
      {publishAsset && (
        <div className="modal" onClick={() => setPublishAsset(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <h2>发布 {publishAsset.name}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <span className="badge badge-info">{publishAsset.assetType}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--gray-200)', marginBottom: '1rem' }}>
              <button type="button" className={`filter-btn ${publishTab === 'publish' ? 'active' : ''}`} onClick={() => setPublishTab('publish')}>发布</button>
              <button type="button" className={`filter-btn ${publishTab === 'history' ? 'active' : ''}`} onClick={() => setPublishTab('history')}>发布历史</button>
            </div>
            {publishTab === 'publish' ? (
              <>
                <div className="form-group">
                  <label className="form-label">最新未发布版本号</label>
                  <input className="form-input" value={`v${publishAsset.version}`} disabled />
                </div>
                <h3 style={{ margin: '0.5rem 0' }}>内容预览</h3>
                <pre className="wizard-preview-body" style={{ whiteSpace: 'pre-wrap' }}>{(SAMPLE_CONTENT[publishAsset.assetType] || {}).documentation || '内容由流水线发布后回填'}</pre>
                <div className="form-group">
                  <label className="form-label">发布目标组织</label>
                  <select className="form-input" value={publishOrg} onChange={(e) => setPublishOrg(e.target.value)}>
                    <option value="">选择组织…</option>
                    {ORG_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-primary" onClick={confirmPublish} disabled={publishingId === publishAsset._id}>
                    {publishingId === publishAsset._id ? '发布中...' : '确认发布'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setPublishAsset(null)}>取消</button>
                </div>
              </>
            ) : (
              <>
                {(publishAsset.releaseNotes || []).length === 0 ? (
                  <div className="empty-state"><div className="empty-title">暂无发布历史</div></div>
                ) : (
                  <table className="table">
                    <thead><tr><th>版本</th><th>目标组织</th><th>时间</th><th>说明</th></tr></thead>
                    <tbody>
                      {(publishAsset.releaseNotes || []).map((r, i) => (
                        <tr key={i}>
                          <td>v{r.version}</td>
                          <td>{r.organization || '-'}</td>
                          <td>{r.date ? new Date(r.date).toLocaleString('zh-CN') : '-'}</td>
                          <td>{r.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setPublishAsset(null)}>关闭</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {extPublishAsset && (
        <div className="modal" onClick={() => setExtPublishAsset(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <h2>发布 Extension · {extPublishAsset.name}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--gray-200)', marginBottom: '1rem' }}>
              <button type="button" className={`filter-btn ${extTab === 'publish' ? 'active' : ''}`} onClick={() => setExtTab('publish')}>发布</button>
              <button type="button" className={`filter-btn ${extTab === 'history' ? 'active' : ''}`} onClick={() => setExtTab('history')}>发布历史</button>
            </div>
            {extTab === 'publish' ? (
              <>
                <div className="wizard-form-grid">
                  <div className="form-group"><label className="form-label">Extension 名称</label><input className="form-input" value={extForm.extName} disabled /></div>
                  <div className="form-group"><label className="form-label">目标组织</label><select className="form-input" value={extForm.organization} onChange={(e) => setExtForm({ ...extForm, organization: e.target.value })}><option value="">选组织…</option>{ORG_LIST.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                </div>
                <div className="wizard-form-grid">
                  <div className="form-group"><label className="form-label">beta product</label><input className="form-input" value={extForm.betaProduct} onChange={(e) => setExtForm({ ...extForm, betaProduct: e.target.value })} placeholder="填写 beta product" /></div>
                  <div className="form-group"><label className="form-label">下一版本（自增）</label><input className="form-input" value={`v1.0.${extReleases.length + 1}`} disabled /></div>
                </div>
                <div className="form-group"><label className="form-label">描述</label><textarea className="form-input" rows="2" value={extForm.description} onChange={(e) => setExtForm({ ...extForm, description: e.target.value })} /></div>
                <h3 style={{ margin: '0.5rem 0' }}>目录结构（agent / skill / command）</h3>
                {(() => {
                  const wf = extWorkflow || {}
                  const cmds = wf.commands || []
                  const agents = (wf.assets || []).filter(a => a.type === 'Agent')
                  const skills = (wf.assets || []).filter(a => a.type === 'Skill')
                  return (
                    <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '12px', lineHeight: '1.9', background: 'var(--gray-50)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontWeight: 700 }}>{extForm.extName || extPublishAsset.name}/</div>
                      <div style={{ marginLeft: '22px', borderLeft: '1px dashed var(--gray-300)', paddingLeft: '10px' }}>
                        <div style={{ fontWeight: 700 }}>📁 commands/</div>
                        <div style={{ marginLeft: '22px' }}>{cmds.length ? cmds.map(c => <div key={c.id} style={{ color: 'var(--gray-600)' }}>📄 {c.name}.md <span style={{ fontSize: '9px', background: '#dbeafe', color: '#0c2d6b', padding: '0 5px', borderRadius: '3px' }}>入口</span></div>) : <div style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>（空）</div>}</div>
                        <div style={{ fontWeight: 700 }}>📁 agents/</div>
                        <div style={{ marginLeft: '22px' }}>{agents.length ? agents.map((a, i) => <div key={i} style={{ color: 'var(--gray-600)' }}>📁 {a.assetId?.name || '未命名'}/</div>) : <div style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>（空）</div>}</div>
                        <div style={{ fontWeight: 700 }}>📁 skills/</div>
                        <div style={{ marginLeft: '22px' }}>{skills.length ? skills.map((a, i) => <div key={i} style={{ color: 'var(--gray-600)' }}>📁 {a.assetId?.name || '未命名'}/ <span style={{ color: 'var(--gray-400)' }}>SKILL.md</span></div>) : <div style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>（空）</div>}</div>
                        <div style={{ color: 'var(--gray-600)' }}>📄 codeagent-extension.json <span style={{ fontSize: '9px', background: '#dbeafe', color: '#0c2d6b', padding: '0 5px', borderRadius: '3px' }}>自动生成</span></div>
                      </div>
                    </div>
                  )
                })()}
                <div className="modal-actions">
                  <button type="button" className="btn btn-primary" onClick={confirmExtPublish}>确认发布</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setExtPublishAsset(null)}>取消</button>
                </div>
              </>
            ) : (
              <>
                {extReleases.length === 0 ? (
                  <div className="empty-state"><div className="empty-title">暂无发布记录</div></div>
                ) : (
                  <div>{extReleases.map((r, i) => (
                    <div key={i} style={{ border: '1px solid var(--gray-200)', borderRadius: '9px', padding: '11px 14px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <b>{r.extName}</b>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--gray-500)', background: 'var(--gray-100)', padding: '1px 6px', borderRadius: '4px' }}>v{r.version}</span>
                        <span className="badge badge-success">{r.status}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--gray-500)' }}>{r.date ? new Date(r.date).toLocaleString('zh-CN') : '-'}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>发布人: {r.publisher} · 组织: {r.organization || '—'} · beta: {r.betaProduct || '—'}</div>
                      {r.counts && <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '4px' }}>{r.counts}</div>}
                    </div>
                  ))}</div>
                )}
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setExtPublishAsset(null)}>关闭</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Assets
