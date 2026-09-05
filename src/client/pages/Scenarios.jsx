import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { authHeaders } from '../utils/auth'
import { getWorkflowProgress } from '../utils/workflowProgress'
import { cliInvocation } from '../utils/commandPreview'
import WorkflowWizard from '../components/WorkflowWizard'
import DeptTreeSelect from '../components/DeptTreeSelect'
import './Scenarios.css'

const initialScenarioForm = { name: '', code: '', description: '', parentId: '', tags: '' }

// 环节卡片顶部强调色，按环节序号循环
const STAGE_ACCENTS = ['#2563eb', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899']

function Scenarios() {
  const [scenarios, setScenarios] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedScenario, setSelectedScenario] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [scenarioModal, setScenarioModal] = useState(false)
  const [scenarioForm, setScenarioForm] = useState(initialScenarioForm)
  const [wizardState, setWizardState] = useState(null)
  const [departments, setDepartments] = useState([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [collapsed, setCollapsed] = useState({})
  const [tagDraft, setTagDraft] = useState('')
  const [searchParams] = useSearchParams()

  useEffect(() => {
    loadDepartments()
  }, [])

  useEffect(() => {
    if (selectedId) {
      loadScenario(selectedId)
    } else {
      setSelectedScenario(null)
    }
  }, [selectedId])

  const loadDepartments = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/department', { headers: authHeaders() })
      const depts = response.data
      setDepartments(depts)
      // 默认选中 UDM 所在部门 → 加载产品 → 默认选 UDM
      const targetDept = depts.find(d => d.name === '分组控制开发部')
      if (targetDept) {
        setSelectedDeptId(targetDept._id)
        const pres = await axios.get(`/api/product?departmentId=${targetDept._id}`, { headers: authHeaders() })
        setProducts(pres.data)
        const udm = pres.data.find(p => p.name === 'UDM')
        if (udm) {
          setProductId(udm._id)
          await loadWorkspace(udm._id)
        }
      }
    } catch (err) {
      console.error('Failed to load departments:', err)
      setError('部门加载失败，请确认后端服务已启动')
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async (departmentId) => {
    try {
      const response = await axios.get(`/api/product?departmentId=${departmentId}`, { headers: authHeaders() })
      setProducts(response.data)
    } catch (err) {
      console.error('Failed to load products:', err)
      setProducts([])
    }
  }

  const selectDept = (dept) => {
    setSelectedDeptId(dept._id)
    setProducts([])
    setProductId('')
    setScenarios([])
    setSelectedId('')
    loadProducts(dept._id)
  }

  const selectProduct = (pid) => {
    setProductId(pid)
    setSelectedId('')
    if (pid) loadWorkspace(pid)
  }

  const loadWorkspace = async (pid) => {
    if (!pid) return
    setLoading(true)
    setError('')
    try {
      const response = await axios.get(`/api/scenario?productId=${pid}`, { headers: authHeaders() })
      const list = response.data
      setScenarios(list)
      const deepLinked = searchParams.get('scenario')
      const fallback = list[0]?._id || ''
      const target = list.some(item => item._id === deepLinked) ? deepLinked : fallback
      if (target) {
        setSelectedId(current => current || target)
      }
    } catch (err) {
      console.error('Failed to load scenario workspace:', err)
      setError('场景设计台加载失败，请确认后端服务与数据库已启动')
    } finally {
      setLoading(false)
    }
  }

  const loadScenario = async (scenarioId) => {
    setDetailLoading(true)
    try {
      const response = await axios.get(`/api/scenario/${scenarioId}`, {
        headers: authHeaders()
      })
      setSelectedScenario(response.data)
    } catch (err) {
      console.error('Failed to load scenario:', err)
      setError(err.response?.data?.error || '场景详情加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const scenarioTree = useMemo(() => {
    const childrenByParent = new Map()
    scenarios.forEach(scenario => {
      const parentKey = scenario.parentId || 'root'
      const children = childrenByParent.get(parentKey) || []
      children.push(scenario)
      childrenByParent.set(parentKey, children)
    })

    // 后序累加：totalWorkflowCount = 自身直接关联数 + 所有下级场景的合计
    const buildNodes = (parentId = 'root') => (
      (childrenByParent.get(parentId) || []).map(scenario => {
        const children = buildNodes(scenario._id)
        const descendantsCount = children.reduce((sum, child) => sum + child.totalWorkflowCount, 0)
        return {
          ...scenario,
          children,
          totalWorkflowCount: (scenario.workflowCount || 0) + descendantsCount
        }
      })
    )
    return buildNodes()
  }, [scenarios])

  const openScenarioModal = (parentId = '') => {
    setScenarioForm({ ...initialScenarioForm, parentId })
    setScenarioModal(true)
  }

  const createScenario = async (event) => {
    event.preventDefault()
    try {
      const response = await axios.post('/api/scenario', {
        ...scenarioForm,
        // 标签支持中英文逗号分隔，仅一级场景使用
        tags: scenarioForm.parentId ? [] : scenarioForm.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean),
        parentId: scenarioForm.parentId || null,
        productId: productId || null
      }, { headers: authHeaders() })
      setScenarioModal(false)
      await loadWorkspace(productId)
      setSelectedId(response.data._id)
    } catch (err) {
      console.error('Failed to create scenario:', err)
      alert(err.response?.data?.error || '创建场景失败')
    }
  }

  const deleteScenario = async (scenario) => {
    const hint = scenario.level === 1 && scenario.children?.length > 0
      ? `「${scenario.name}」下有 ${scenario.children.length} 个下级场景，需先删除下级场景。`
      : `确认删除场景「${scenario.name}」？`
    if (scenario.level === 1 && scenario.children?.length > 0) {
      alert(hint)
      return
    }
    if (!window.confirm(`确认删除场景「${scenario.name}」？该操作不可恢复。`)) return
    try {
      await axios.delete(`/api/scenario/${scenario._id}`, { headers: authHeaders() })
      if (selectedId === scenario._id) setSelectedId('')
      await loadWorkspace(productId)
    } catch (err) {
      console.error('Failed to delete scenario:', err)
      alert(err.response?.data?.error || '删除场景失败')
    }
  }

  // 一级场景标签：保存后立即刷新详情与左侧树
  const saveTags = async (tags) => {
    try {
      await axios.put(`/api/scenario/${selectedScenario._id}`, { tags }, { headers: authHeaders() })
      await Promise.all([loadScenario(selectedId), loadWorkspace(productId)])
    } catch (err) {
      console.error('Failed to save tags:', err)
      alert(err.response?.data?.error || '标签保存失败')
    }
  }

  const addTag = async () => {
    const value = tagDraft.trim()
    if (!value) return
    const current = selectedScenario?.tags || []
    setTagDraft('')
    if (current.includes(value)) return
    await saveTags([...current, value])
  }

  const removeTag = (tag) => {
    saveTags((selectedScenario?.tags || []).filter(item => item !== tag))
  }

  const openWizard = (workflow, initialStep) => {
    setWizardState({ workflow, initialStep })
  }

  const closeWizard = async () => {
    setWizardState(null)
    await Promise.all([loadScenario(selectedId), loadWorkspace(productId)])
  }

  const toggleCollapse = (id) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const renderTree = (nodes) => nodes.map(node => {
    const hasChildren = node.children.length > 0
    const isCollapsed = !!collapsed[node._id]
    return (
      <div key={node._id} className="scenario-tree-item">
        <div
          className={`scenario-node ${selectedId === node._id ? 'active' : ''}`}
          style={{ paddingLeft: `${0.75 + (node.level - 1) * 1.25}rem` }}
          onClick={() => setSelectedId(node._id)}
          role="button"
          tabIndex={0}
          onKeyDown={event => { if (event.key === 'Enter') setSelectedId(node._id) }}
        >
          {hasChildren ? (
            <span
              className={`scenario-node-toggle ${isCollapsed ? 'collapsed' : ''}`}
              onClick={event => { event.stopPropagation(); toggleCollapse(node._id) }}
              title={isCollapsed ? '展开' : '折叠'}
            >
              ▾
            </span>
          ) : (
            <span className="scenario-node-toggle placeholder" />
          )}
          <span className="scenario-node-name">{node.name}</span>
          <span className="scenario-node-actions">
            {node.level === 1 && (
              <span
                className="scenario-node-action add"
                title="新建下级场景"
                onClick={event => { event.stopPropagation(); openScenarioModal(node._id) }}
              >
                +
              </span>
            )}
            <span
              className="scenario-node-action delete"
              title="删除场景"
              onClick={event => { event.stopPropagation(); deleteScenario(node) }}
            >
              ×
            </span>
          </span>
          <span
            className="scenario-node-count"
            title={`直接关联 ${node.workflowCount || 0} 个，含下级场景共 ${node.totalWorkflowCount} 个`}
          >
            {node.totalWorkflowCount}
          </span>
        </div>
        <div className={`scenario-node-children ${isCollapsed ? 'collapsed' : ''}`}>
          {hasChildren && !isCollapsed && renderTree(node.children)}
        </div>
      </div>
    )
  })

  const totalWorkflows = scenarios.reduce((sum, item) => sum + (item.workflowCount || 0), 0)
  const currentProduct = products.find(p => p._id === productId)

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <span>加载中...</span>
      </div>
    )
  }

  return (
    <div className="scenarios-container">
      <div className="scenario-page-header">
        <div>
          <div className="page-eyebrow">SCENARIO DESIGN</div>
          <h1>业务场景设计台</h1>
          <p className="page-subtitle">按「产品 → 场景」逐层组织业务，并在二级场景中编排 E2E 工作流。</p>
          <div className="header-stats">
            <span className="header-stat"><b>{scenarios.length}</b> 场景节点</span>
            <span className="header-stat"><b>{totalWorkflows}</b> Workflow</span>
            {currentProduct && (
              <span className="header-stat product">当前产品 · <b>{currentProduct.name}</b></span>
            )}
          </div>
        </div>
      </div>

      <div className="dept-product-selector">
        <span className="selector-icon" title="选择部门与产品">🏢</span>
        <DeptTreeSelect departments={departments} selectedId={selectedDeptId} onSelect={selectDept} />
        {products.length > 0 && (
          <>
            <span className="selector-divider">→</span>
            <select className="form-input dept-select" value={productId} onChange={event => selectProduct(event.target.value)}>
              <option value="">选产品…</option>
              {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="scenario-workspace">
        <aside className="scenario-tree-panel">
          <div className="panel-title">
            <div>
              <span><span className="panel-title-icon">🗺️</span> 场景地图</span>
              <small>{scenarios.length} 个场景节点 · 点击节点查看设计</small>
            </div>
            <button
              className="tree-add-root"
              type="button"
              title={productId ? '新建一级场景' : '请先选择部门与产品'}
              disabled={!productId}
              onClick={() => openScenarioModal()}
            >
              +
            </button>
          </div>
          <div className="scenario-tree-body">
            {!productId ? (
              <div className="scenario-tree-empty">
                <div className="tree-empty-icon">👆</div>
                请先在上方选择部门与产品。
              </div>
            ) : scenarioTree.length === 0 ? (
              <div className="scenario-tree-empty">
                <div className="tree-empty-icon">🌱</div>
                该产品下暂无业务场景，请先创建一级场景。
              </div>
            ) : renderTree(scenarioTree)}
          </div>
        </aside>

        <section className="scenario-design-panel">
          {!selectedScenario ? (
            <div className="empty-state scenario-empty">
              <div className="empty-icon-wrap"><div className="empty-icon">🧭</div></div>
              <div className="empty-title">选择或创建业务场景</div>
              <div className="empty-hint">例如：需求开发 → 编解码开发</div>
            </div>
          ) : detailLoading ? (
            <div className="loading-state">
              <div className="spinner" />
              <span>加载场景设计...</span>
            </div>
          ) : (
            <>
              <div className="scenario-summary">
                <div>
                  <div className="scenario-meta">
                    <span className={`scenario-level-badge level-${selectedScenario.level}`}>
                      {selectedScenario.level === 1 ? '一级场景 · 业务分组' : '二级场景 · 流程设计'}
                    </span>
                    {currentProduct && <span className="scenario-meta-item">{currentProduct.name}</span>}
                    <span className="scenario-meta-item">{selectedScenario.workflows?.length || 0} 个 Workflow</span>
                  </div>
                  <h2>{selectedScenario.name}</h2>
                  {selectedScenario.description && <p>{selectedScenario.description}</p>}
                </div>
                <div className="scenario-summary-actions">
                  {selectedScenario.level >= 2 && (selectedScenario.workflows?.length || 0) === 0 && (
                    <button
                      className="btn btn-primary"
                      onClick={() => openWizard(null, 0)}
                    >
                      + 开始设计 Workflow
                    </button>
                  )}
                </div>
              </div>

              {selectedScenario.level === 1 && (
                <div className="scenario-tags-row">
                  <span className="scenario-tags-label">🏷️ 标签</span>
                  {(selectedScenario.tags || []).map(tag => (
                    <span className="scenario-tag-chip" key={tag}>
                      {tag}
                      <button type="button" title="移除标签" onClick={() => removeTag(tag)}>×</button>
                    </span>
                  ))}
                  <input
                    className="scenario-tag-input"
                    value={tagDraft}
                    onChange={event => setTagDraft(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }}
                    placeholder="+ 添加标签，回车确认"
                  />
                </div>
              )}

              {selectedScenario.level === 1 && (
                <div className="empty-state workflow-empty">
                  <div className="empty-icon-wrap"><div className="empty-icon">🗂️</div></div>
                  <div className="empty-title">一级场景为业务分组节点</div>
                  <div className="empty-hint">一级场景不支持直接定义 Workflow，请在左侧选择或新建下级场景进行流程设计（场景最多两级）。</div>
                </div>
              )}
              {selectedScenario.level >= 2 && (
                <>
              <div className="workflow-section-header">
                <div>
                  <h3><span className="section-title-icon">⚡</span> 场景 Workflow</h3>
                </div>
              </div>

              {selectedScenario.workflows?.length === 0 ? (
                <div className="empty-state workflow-empty">
                  <div className="empty-icon-wrap"><div className="empty-icon">🛠️</div></div>
                  <div className="empty-title">该场景尚未开始 Workflow 设计</div>
                  <div className="empty-hint">点击右上角“开始设计 Workflow”，按向导完成规划、Command 与资产集成。</div>
                </div>
              ) : (
                <div className="workflow-list">
                  {selectedScenario.workflows.map(workflow => {
                    const progress = getWorkflowProgress(selectedScenario, workflow)
                    const doneCount = progress.steps.filter(s => s.state === 'done').length
                    const percent = Math.round((doneCount / progress.steps.length) * 100)
                    return (
                      <article className="workflow-designer-card" key={workflow._id}>
                        <div className="workflow-card-header">
                          <div>
                            <h3>{workflow.name}</h3>
                            <span className={`workflow-status-badge ${progress.allDone ? 'complete' : 'ongoing'}`}>
                              {progress.allDone ? '✓ 设计完成' : `进行中 · ${doneCount}/${progress.steps.length}`}
                            </span>
                          </div>
                          <div className="workflow-card-actions">
                            <button
                              className="btn btn-primary"
                              onClick={() => openWizard(workflow, progress.nextStep)}
                            >
                              {progress.allDone ? '查看设计' : '继续设计'}
                            </button>
                          </div>
                        </div>

                        <div className="progress-overview">
                          <div className="progress-bar">
                            <i style={{ width: `${percent}%` }} className={progress.allDone ? 'complete' : ''} />
                          </div>
                          <span className="progress-percent">{percent}%</span>
                        </div>

                        <div className="progress-chips">
                          {progress.steps.map((item, index) => (
                            <button
                              type="button"
                              className={`progress-chip ${item.state}`}
                              key={item.key}
                              title={
                                item.state === 'done'
                                  ? `${item.label}（已完成，点击修改）`
                                  : `${item.label}（${item.reason}）`
                              }
                              onClick={() => openWizard(workflow, index)}
                            >
                              <span className="chip-index">{index + 1}</span>
                              {item.label}
                              {item.state === 'done' ? ' ✓' : item.state === 'partial' ? ' ◐' : ''}
                            </button>
                          ))}
                        </div>

                        <div className="workflow-config-grid">
                          <div className="workflow-config-block">
                            <div className="config-block-title">
                              <span><span className="config-title-icon">🧩</span> Workflow 资产池</span>
                              <small>
                                {workflow.assets?.length || 0} 个
                                {workflow.assets?.length > 0 && (
                                  workflow.assets.every(a => a.assetId?.version)
                                    ? ' · 全部已建设 ✓'
                                    : ` · ${workflow.assets.filter(a => !a.assetId?.version).length} 个未建设`
                                )}
                              </small>
                            </div>
                            {workflow.assets?.length > 0 ? (
                              <div className="workflow-asset-list">
                                {workflow.assets.map(item => (
                                  <span className="workflow-asset-chip" key={item._id || item.assetId?._id}>
                                    <b>{item.type}</b>
                                    {item.assetId?.name || '未找到资产'}
                                    {item.assetId?.version
                                      ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                                      : <span style={{ color: '#f59e0b', fontWeight: 700 }}>✗</span>}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <button
                                className="config-empty-button"
                                onClick={() => openWizard(workflow, 3)}
                              >
                                尚未配置 Agent / Skill 资产池
                              </button>
                            )}
                          </div>

                          <div className="workflow-config-block">
                            <div className="config-block-title">
                              <span><span className="config-title-icon">⌨️</span> Command 入口</span>
                              <small>{workflow.commands?.length || 0} 个</small>
                            </div>
                            {workflow.commands?.length > 0 ? (
                              <div className="command-list">
                                {workflow.commands.map(command => (
                                  <div className="command-chip" key={command.id || command._id}>
                                    <code>{command.name}</code>
                                    <span>{cliInvocation(command)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <button
                                className="config-empty-button"
                                onClick={() => openWizard(workflow, 2)}
                              >
                                尚未设计 Command 入口
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="stage-section-title">
                          <span><span className="config-title-icon">🔗</span> 环节与节点</span>
                          <small>{workflow.stages.length} 个环节</small>
                        </div>
                        {workflow.stages.length === 0 ? (
                          <button
                            className="config-empty-button stage-empty-button"
                            onClick={() => openWizard(workflow, 1)}
                          >
                            尚未编排环节与节点，点击开始
                          </button>
                        ) : (
                          <div className="stage-pipeline">
                            {[...workflow.stages]
                              .sort((a, b) => a.order - b.order)
                              .map((stage, stageIndex) => (
                                <div className="stage-wrapper" key={stage.id}>
                                  {stageIndex > 0 && <div className="stage-connector"><span>→</span></div>}
                                  <div className="stage-card" style={{ '--stage-accent': STAGE_ACCENTS[stageIndex % STAGE_ACCENTS.length] }}>
                                    <div className="stage-index">环节 {stageIndex + 1}</div>
                                    <h4>{stage.name}</h4>
                                    {stage.description && <p>{stage.description}</p>}
                                    <div className="stage-assets">
                                      {[...(stage.steps || [])].sort((a, b) => a.order - b.order).length === 0 ? (
                                        <span className="no-asset">尚未定义节点</span>
                                      ) : (
                                        [...(stage.steps || [])]
                                          .sort((a, b) => a.order - b.order)
                                          .map((node, nodeIndex) => (
                                            <div className="stage-node" key={node.id}>
                                              <span className="stage-node-name">
                                                {stageIndex + 1}.{nodeIndex + 1} {node.name}
                                              </span>
                                              {node.assets?.length > 0 ? (
                                                node.assets.map(item => (
                                                  <span className="asset-chip" key={item._id || item.assetId?._id}>
                                                    <b>{item.type}</b>
                                                    {item.assetId?.name || '未找到资产'}
                                                  </span>
                                                ))
                                              ) : (
                                                <span className="no-asset">未关联 Agent / Skill</span>
                                              )}
                                            </div>
                                          ))
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
                </>
              )}
            </>
          )}
        </section>
      </div>

      {scenarioModal && (
        <div className="modal" onClick={() => setScenarioModal(false)}>
          <div className="modal-content" onClick={event => event.stopPropagation()}>
            <h2>{scenarioForm.parentId ? '新建下级场景' : '新建一级场景'}</h2>
            <form onSubmit={createScenario}>
              <div className="form-group">
                <label className="form-label">场景名称</label>
                <input
                  className="form-input"
                  value={scenarioForm.name}
                  onChange={event => setScenarioForm({ ...scenarioForm, name: event.target.value })}
                  placeholder="例如：需求开发"
                  required
                />
              </div>
              {scenarioForm.parentId && (
                <div className="form-group">
                  <label className="form-label">场景编码 *</label>
                  <input
                    className="form-input"
                    value={scenarioForm.code}
                    onChange={event => setScenarioForm({ ...scenarioForm, code: event.target.value })}
                    placeholder="例如：CODEC-DEV（英文，作为 Extension 的 name）"
                    required
                  />
                </div>
              )}
              {!scenarioForm.parentId && (
                <div className="form-group">
                  <label className="form-label">场景标签</label>
                  <input
                    className="form-input"
                    value={scenarioForm.tags}
                    onChange={event => setScenarioForm({ ...scenarioForm, tags: event.target.value })}
                    placeholder="多个标签用逗号分隔，如：编解码, 相机"
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">场景说明</label>
                <textarea
                  className="form-input"
                  rows="4"
                  value={scenarioForm.description}
                  onChange={event => setScenarioForm({ ...scenarioForm, description: event.target.value })}
                  placeholder="描述场景目标、输入输出和业务边界"
                />
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" type="submit">创建</button>
                <button className="btn btn-secondary" type="button" onClick={() => setScenarioModal(false)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {wizardState && (
        <WorkflowWizard
          scenario={selectedScenario}
          workflow={wizardState.workflow}
          initialStep={wizardState.initialStep}
          onClose={closeWizard}
        />
      )}
    </div>
  )
}

export default Scenarios
