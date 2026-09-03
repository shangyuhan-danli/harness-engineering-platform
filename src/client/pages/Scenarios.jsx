import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { authHeaders } from '../utils/auth'
import { getWorkflowProgress, stageTypeLabel } from '../utils/workflowProgress'
import { cliInvocation } from '../utils/commandPreview'
import WorkflowWizard from '../components/WorkflowWizard'
import DeptTreeSelect from '../components/DeptTreeSelect'
import './Scenarios.css'

const initialScenarioForm = { name: '', code: '', description: '', parentId: '' }

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
      // 默认选中 UPCF 所在部门 → 加载产品 → 默认选 UPCF
      const targetDept = depts.find(d => d.name === '分组融合数据开发部')
      if (targetDept) {
        setSelectedDeptId(targetDept._id)
        const pres = await axios.get(`/api/product?departmentId=${targetDept._id}`, { headers: authHeaders() })
        setProducts(pres.data)
        const upcf = pres.data.find(p => p.name === 'UPCF')
        if (upcf) {
          setProductId(upcf._id)
          await loadWorkspace(upcf._id)
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

  const openWizard = (workflow, initialStep) => {
    setWizardState({ workflow, initialStep })
  }

  const closeWizard = async () => {
    setWizardState(null)
    await Promise.all([loadScenario(selectedId), loadWorkspace(productId)])
  }

  const renderTree = (nodes) => nodes.map(node => (
    <div key={node._id}>
      <button
        className={`scenario-node ${selectedId === node._id ? 'active' : ''}`}
        style={{ paddingLeft: `${0.75 + (node.level - 1) * 1.25}rem` }}
        onClick={() => setSelectedId(node._id)}
      >
        <span className="scenario-node-level">L{node.level}</span>
        <span className="scenario-node-name">{node.name}</span>
        <span
          className="scenario-node-count"
          title={`直接关联 ${node.workflowCount || 0} 个，含下级场景共 ${node.totalWorkflowCount} 个`}
        >
          {node.totalWorkflowCount}
        </span>
      </button>
      {node.children.length > 0 && renderTree(node.children)}
    </div>
  ))

  if (loading) {
    return <div className="loading-state">加载中...</div>
  }

  return (
    <div className="scenarios-container">
      <div className="scenario-page-header">
        <div>
          <p className="page-eyebrow">BUSINESS SCENARIO FIRST</p>
          <h1>业务场景设计台</h1>
          <p>沿“场景分析 → Workflow 规划 → Command 入口 → Skill / Agent 集成”四步完成场景设计。</p>
        </div>
        {productId && (
          <button className="btn btn-primary" onClick={() => openScenarioModal()}>
            + 新建一级场景
          </button>
        )}
      </div>

      <div className="dept-product-selector">
        <DeptTreeSelect departments={departments} selectedId={selectedDeptId} onSelect={selectDept} />
        {products.length > 0 && (
          <select className="form-input dept-select" value={productId} onChange={event => selectProduct(event.target.value)}>
            <option value="">选产品…</option>
            {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="scenario-workspace">
        <aside className="scenario-tree-panel">
          <div className="panel-title">
            <div>
              <span>场景地图</span>
              <small>{scenarios.length} 个场景节点</small>
            </div>
          </div>
          {!productId ? (
            <div className="scenario-tree-empty">
              请先在上方选择部门与产品。
            </div>
          ) : scenarioTree.length === 0 ? (
            <div className="scenario-tree-empty">
              该产品下暂无业务场景，请先创建一级场景。
            </div>
          ) : renderTree(scenarioTree)}
        </aside>

        <section className="scenario-design-panel">
          {!selectedScenario ? (
            <div className="empty-state scenario-empty">
              <div className="empty-icon">🧭</div>
              <div className="empty-title">选择或创建业务场景</div>
              <div className="empty-hint">例如：需求开发 → 编解码开发</div>
            </div>
          ) : detailLoading ? (
            <div className="loading-state">加载场景设计...</div>
          ) : (
            <>
              <div className="scenario-summary">
                <div>
                  <div className="scenario-breadcrumb">
                    L{selectedScenario.level} 场景
                  </div>
                  <h2>{selectedScenario.name}</h2>
                  <p>{selectedScenario.description || '请补充场景目标、边界与预期业务结果。'}</p>
                </div>
                <div className="scenario-summary-actions">
                  {selectedScenario.level === 1 && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => openScenarioModal(selectedScenario._id)}
                    >
                      + 新建下级场景
                    </button>
                  )}
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
                <div className="empty-state workflow-empty">
                  <div className="empty-icon">🗂️</div>
                  <div className="empty-title">一级场景为业务分组节点</div>
                  <div className="empty-hint">一级场景不支持直接定义 Workflow，请在左侧选择或新建下级场景进行流程设计（场景最多两级）。</div>
                </div>
              )}
              {selectedScenario.level >= 2 && (
                <>
              <div className="workflow-section-header">
                <div>
                  <h3>场景 Workflow</h3>
                  <p>每个场景对应一个 Harness Workflow（发布后为一个 Extension），流程内按「环节 → 节点」编排。</p>
                </div>
              </div>

              {selectedScenario.workflows?.length === 0 ? (
                <div className="empty-state workflow-empty">
                  <div className="empty-title">该场景尚未开始 Workflow 设计</div>
                  <div className="empty-hint">点击右上角“开始设计 Workflow”，按向导完成规划、Command 与资产集成。</div>
                </div>
              ) : (
                <div className="workflow-list">
                  {selectedScenario.workflows.map(workflow => {
                    const progress = getWorkflowProgress(selectedScenario, workflow)
                    return (
                      <article className="workflow-designer-card" key={workflow._id}>
                        <div className="workflow-card-header">
                          <div>
                            <span className={`badge ${workflow.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                              {workflow.status === 'active' ? '设计完成' : '草稿'}
                            </span>
                            <h3>{workflow.name}</h3>
                            <p>{workflow.description || '暂无流程说明'}</p>
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
                              {index + 1} {item.label} {item.state === 'done' ? '✓' : item.state === 'partial' ? '◐' : ''}
                            </button>
                          ))}
                        </div>

                        <div className="workflow-config-grid">
                          <div className="workflow-config-block">
                            <div className="config-block-title">
                              <span>Workflow 资产池</span>
                              <small>{workflow.assets?.length || 0} 个</small>
                            </div>
                            {workflow.assets?.length > 0 ? (
                              <div className="workflow-asset-list">
                                {workflow.assets.map(item => (
                                  <span className="workflow-asset-chip" key={item._id || item.assetId?._id}>
                                    <b>{item.type}</b>
                                    {item.assetId?.name || '未找到资产'}
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
                              <span>Command 入口</span>
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
                          <span>环节与节点</span>
                          <small>节点只能选用 Workflow 资产池中的 Agent / Skill</small>
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
                                  {stageIndex > 0 && <div className="stage-connector">→</div>}
                                  <div className="stage-card">
                                    <div className="stage-index">环节 {stageIndex + 1}</div>
                                    <h4>{stage.name}</h4>
                                    <p>{stageTypeLabel(stage.type)}</p>
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
              <div className="form-group">
                <label className="form-label">场景编码</label>
                <input
                  className="form-input"
                  value={scenarioForm.code}
                  onChange={event => setScenarioForm({ ...scenarioForm, code: event.target.value })}
                  placeholder="例如：REQ-DEV（英文，作为 Extension 的 name）"
                  required
                />
              </div>
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
