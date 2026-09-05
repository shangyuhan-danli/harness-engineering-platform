import { useEffect, useState } from 'react'
import axios from 'axios'
import { authHeaders } from '../utils/auth'
import { WIZARD_STEPS, getWorkflowProgress } from '../utils/workflowProgress'
import {
  COMMAND_NAME_PATTERN,
  normalizeCommandName,
  cliInvocation,
  compileCommandBody,
  buildCommandPreview,
  findUnboundNodes
} from '../utils/commandPreview'
import './WorkflowWizard.css'

const PARAM_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/

const emptyStageDraft = { id: null, name: '', description: '' }
const emptyStepDraft = { stageId: null, id: null, name: '', description: '' }
const emptyCommandDraft = {
  id: null,
  name: '',
  description: '',
  parameters: '{\n  "input": "string"\n}',
  bodyOverride: '',
  customizeBody: false
}
// 预置 Command 模板库：设计 Command 入口时可从中选择现成模板，
// 选中后自动填充表单，仍可在表单中修改后保存，不强制现场逐项创建。
const COMMAND_TEMPLATES = [
  { name: '/generate', description: '根据输入生成代码或产物', parameters: { input: 'string' } },
  { name: '/review', description: '对指定对象进行评审并输出建议', parameters: { target: 'string' } },
  { name: '/validate', description: '校验输入是否符合规则或契约', parameters: { input: 'string' } },
  { name: '/analyze', description: '分析输入并输出结构化结论', parameters: { input: 'string' } },
  { name: '/transform', description: '按指定格式转换输入', parameters: { input: 'string', format: 'string' } },
  { name: '/summarize', description: '对输入生成摘要', parameters: { input: 'string' } }
]
const emptyQuickAsset = { name: '', assetType: 'Agent', owner: '', dueDate: '' }

function WorkflowWizard({ scenario, workflow, initialStep = 0, onClose }) {
  const [step, setStep] = useState(initialStep)
  const [maxReached, setMaxReached] = useState(initialStep)
  const [workflowId, setWorkflowId] = useState(workflow?._id || null)
  const [wf, setWf] = useState(workflow || null)
  const [assets, setAssets] = useState([])
  const [scenarioForm, setScenarioForm] = useState({
    name: scenario?.name || '',
    code: scenario?.code || '',
    description: scenario?.description || ''
  })
  const [workflowForm, setWorkflowForm] = useState({
    name: workflow?.name || '',
    description: workflow?.description || ''
  })
  const [stageDraft, setStageDraft] = useState(null)
  const [stepDraft, setStepDraft] = useState(null)
  const [commandDraft, setCommandDraft] = useState(null)
  // Command 清单（从 /api/command 加载，下拉选择用）
  const [commandRegistry, setCommandRegistry] = useState([])
  // 新定义 Command 表单（仅 name + 责任人 + 完成时间，不写参数/正文）
  const [newCommandForm, setNewCommandForm] = useState(null)
  const [poolIds, setPoolIds] = useState(
    (workflow?.assets || []).map(item => item.assetId?._id || item.assetId).filter(Boolean)
  )
  // 节点资产分配：{ [nodeId]: [assetId, ...] }
  const [nodeAssetsMap, setNodeAssetsMap] = useState(() => {
    const map = {}
    ;(workflow?.stages || []).forEach(stage => {
      (stage.steps || []).forEach(node => {
        map[node.id] = (node.assets || [])
          .map(item => item.assetId?._id || item.assetId)
          .filter(Boolean)
      })
    })
    return map
  })
  const [quickAsset, setQuickAsset] = useState(null)
  const [poolSearch, setPoolSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAssets()
    loadCommandRegistry()
  }, [])

  const loadAssets = async () => {
    try {
      const response = await axios.get('/api/asset', { headers: authHeaders() })
      setAssets(response.data.filter(asset => ['Agent', 'Skill'].includes(asset.assetType)))
    } catch (err) {
      console.error('Failed to load assets:', err)
      setError('资产列表加载失败，请确认后端服务已启动')
    }
  }

  const loadCommandRegistry = async () => {
    try {
      const response = await axios.get('/api/command', { headers: authHeaders() })
      setCommandRegistry(response.data)
    } catch (err) {
      console.error('Failed to load command registry:', err)
    }
  }

  const refreshWorkflow = async (id = workflowId) => {
    if (!id) return
    const response = await axios.get(`/api/workflow/${id}`, { headers: authHeaders() })
    const fresh = response.data
    setWf(fresh)
    setPoolIds(fresh.assets.map(item => item.assetId?._id || item.assetId).filter(Boolean))
    const map = {}
    fresh.stages.forEach(stage => {
      (stage.steps || []).forEach(node => {
        map[node.id] = (node.assets || [])
          .map(item => item.assetId?._id || item.assetId)
          .filter(Boolean)
      })
    })
    setNodeAssetsMap(map)
  }

  // 环节/节点/命令/资产操作都要求 workflow 已落库；未创建时先创建
  const ensureWorkflow = async () => {
    if (workflowId) return workflowId
    if (!workflowForm.name.trim()) {
      throw new Error('请先填写 Workflow 名称')
    }
    const response = await axios.post('/api/workflow', {
      name: workflowForm.name,
      description: workflowForm.description,
      scenarioId: scenario._id,
      businessScenario: scenario.name,
      stages: []
    }, { headers: authHeaders() })
    setWorkflowId(response.data._id)
    await refreshWorkflow(response.data._id)
    return response.data._id
  }

  const runStep = async (action) => {
    setSaving(true)
    setError('')
    try {
      await action()
      return true
    } catch (err) {
      console.error('Wizard step failed:', err)
      setError(err.response?.data?.error || err.message || '操作失败，请重试')
      return false
    } finally {
      setSaving(false)
    }
  }

  const goToStep = (target) => {
    if (target === step) return
    if (target >= 2 && !workflowId) return
    if (target > maxReached) return
    setStageDraft(null)
    setStepDraft(null)
    setCommandDraft(null)
    setError('')
    setStep(target)
  }

  const handleNext = async () => {
    if (step === 0) {
      if (!scenarioForm.name.trim()) {
        setError('请填写场景名称')
        return
      }
      if (!scenarioForm.description.trim()) {
        setError('请填写场景说明与目标（此步骤的必填项）')
        return
      }
      const ok = await runStep(() => axios.put(`/api/scenario/${scenario._id}`, {
        name: scenarioForm.name,
        code: scenarioForm.code,
        description: scenarioForm.description
      }, { headers: authHeaders() }))
      if (!ok) return
    }

    if (step === 1) {
      if (!workflowForm.name.trim()) {
        setError('请填写 Workflow 名称')
        return
      }
      const isCreating = !workflowId
      const ok = await runStep(async () => {
        const id = await ensureWorkflow()
        await axios.put(`/api/workflow/${id}`, {
          name: workflowForm.name,
          description: workflowForm.description
        }, { headers: authHeaders() })
        await refreshWorkflow(id)
      })
      if (!ok) return
      if (isCreating) {
        // 刚创建完流程时停留在本步，让用户直接开始编排环节与节点
        setError('')
        return
      }
      // 进入下一步前校验编排完整性：至少一个环节，且每个环节都有节点
      const stages = wf?.stages || []
      if (stages.length === 0) {
        setError('请至少添加一个环节，并在环节内添加节点')
        return
      }
      const emptyStage = stages.find(stage => !(stage.steps?.length > 0))
      if (emptyStage) {
        setError(`环节「${emptyStage.name}」下还没有节点，请添加节点或删除该环节`)
        return
      }
    }

    if (step === 2) {
      if ((wf?.commands || []).length === 0) {
        setError('请至少设计一个 Command 入口')
        return
      }
    }

    if (step === 3) {
      let finalProgress = null
      const ok = await runStep(async () => {
        // 先保存资产池（后端会级联解绑被移出池的节点资产），再逐节点重写资产分配
        await axios.put(`/api/workflow/${workflowId}/assets`, {
          assetIds: poolIds
        }, { headers: authHeaders() })
        const pool = new Set(poolIds)
        for (const stage of wf?.stages || []) {
          for (const node of stage.steps || []) {
            const selected = (nodeAssetsMap[node.id] || []).filter(id => pool.has(id))
            const nodeAssets = selected.map(assetId => {
              const asset = assets.find(item => item._id === assetId)
              return { assetId, type: asset.assetType, role: `${node.name}执行资产` }
            })
            await axios.put(`/api/workflow/${workflowId}/stages/${stage.id}/steps/${node.id}`, {
              assets: nodeAssets
            }, { headers: authHeaders() })
          }
        }
        // 按四步完成度更新 Workflow 状态：全部完成 → 设计完成(active)，否则保持草稿
        const fresh = await axios.get(`/api/workflow/${workflowId}`, { headers: authHeaders() })
        finalProgress = getWorkflowProgress(
          { ...scenario, name: scenarioForm.name, description: scenarioForm.description },
          fresh.data
        )
        await axios.put(`/api/workflow/${workflowId}`, {
          status: finalProgress.allDone ? 'active' : 'draft'
        }, { headers: authHeaders() })
      })
      if (!ok) return
      // 保存成功但有步骤未完成：留在本步并明确告知缺什么，而不是关闭后让用户自己反查
      if (!finalProgress.allDone) {
        await refreshWorkflow()
        const missing = finalProgress.steps
          .filter(item => item.state !== 'done')
          .map(item => `${item.label}（${item.reason}）`)
          .join('；')
        setError(`已保存当前配置，但以下步骤尚未完成：${missing}`)
        return
      }
      onClose()
      return
    }

    setError('')
    setStep(step + 1)
    setMaxReached(Math.max(maxReached, step + 1))
  }

  // ---- 步 2：环节与节点编排 ----

  const saveStage = async (event) => {
    event.preventDefault()
    await runStep(async () => {
      const id = await ensureWorkflow()
      const payload = {
        name: stageDraft.name,
        description: stageDraft.description
      }
      if (stageDraft.id) {
        await axios.put(`/api/workflow/${id}/stages/${stageDraft.id}`, payload, { headers: authHeaders() })
      } else {
        await axios.post(`/api/workflow/${id}/stages`, payload, { headers: authHeaders() })
      }
      await refreshWorkflow(id)
    })
    setStageDraft(null)
  }

  const deleteStage = async (stage) => {
    const nodeCount = stage.steps?.length || 0
    if (nodeCount > 0 && !window.confirm(`环节「${stage.name}」下有 ${nodeCount} 个节点，删除环节会一并删除这些节点。确认删除？`)) {
      return
    }
    await runStep(async () => {
      await axios.delete(`/api/workflow/${workflowId}/stages/${stage.id}`, { headers: authHeaders() })
      await refreshWorkflow()
    })
  }

  const moveStage = async (stageId, direction) => {
    const ordered = [...(wf?.stages || [])].sort((a, b) => a.order - b.order)
    const index = ordered.findIndex(stage => stage.id === stageId)
    const swapWith = ordered[index + direction]
    if (!swapWith) return
    await runStep(async () => {
      await axios.put(`/api/workflow/${workflowId}/stages/${stageId}`, {
        order: swapWith.order
      }, { headers: authHeaders() })
      await axios.put(`/api/workflow/${workflowId}/stages/${swapWith.id}`, {
        order: ordered[index].order
      }, { headers: authHeaders() })
      await refreshWorkflow()
    })
  }

  const saveNode = async (event) => {
    event.preventDefault()
    await runStep(async () => {
      const payload = { name: stepDraft.name, description: stepDraft.description }
      const base = `/api/workflow/${workflowId}/stages/${stepDraft.stageId}/steps`
      if (stepDraft.id) {
        await axios.put(`${base}/${stepDraft.id}`, payload, { headers: authHeaders() })
      } else {
        await axios.post(base, payload, { headers: authHeaders() })
      }
      await refreshWorkflow()
    })
    setStepDraft(null)
  }

  const deleteNode = async (stageId, nodeId) => {
    await runStep(async () => {
      await axios.delete(`/api/workflow/${workflowId}/stages/${stageId}/steps/${nodeId}`, { headers: authHeaders() })
      await refreshWorkflow()
    })
  }

  const moveNode = async (stage, nodeId, direction) => {
    const ordered = [...(stage.steps || [])].sort((a, b) => a.order - b.order)
    const index = ordered.findIndex(node => node.id === nodeId)
    const swapWith = ordered[index + direction]
    if (!swapWith) return
    await runStep(async () => {
      await axios.put(`/api/workflow/${workflowId}/stages/${stage.id}/steps/${nodeId}`, {
        order: swapWith.order
      }, { headers: authHeaders() })
      await axios.put(`/api/workflow/${workflowId}/stages/${stage.id}/steps/${swapWith.id}`, {
        order: ordered[index].order
      }, { headers: authHeaders() })
      await refreshWorkflow()
    })
  }

  // ---- 步 3：Command 入口 ----

  const parseCommandParameters = (raw) => {
    const parameters = raw.trim() ? JSON.parse(raw) : {}
    if (
      typeof parameters !== 'object' || Array.isArray(parameters) ||
      Object.entries(parameters).some(([key, value]) =>
        !PARAM_KEY_PATTERN.test(key) || typeof value !== 'string'
      )
    ) {
      throw new Error('参数定义必须是扁平 JSON 对象，key 为参数名、value 为类型说明字符串')
    }
    return parameters
  }

  // 从 Command 清单选择一个加入本 Workflow（引用，不在系统直接写参数/正文）
  const addCommand = async (commandId) => {
    if (!commandId) return
    const ok = await runStep(async () => {
      await axios.post(`/api/workflow/${workflowId}/commands`, { commandId }, { headers: authHeaders() })
      await refreshWorkflow()
    })
    if (ok) setNewCommandForm(null)
  }

  // 新定义一个 Command：仅 name + 责任人 + 完成时间，加入清单（未开发占位）并引用到本 Workflow
  const createNewCommand = async (event) => {
    event.preventDefault()
    if (!newCommandForm?.name?.trim()) {
      setError('请填写 Command 名称')
      return
    }
    const ok = await runStep(async () => {
      const response = await axios.post('/api/command', {
        name: newCommandForm.name,
        owner: newCommandForm.owner,
        dueDate: newCommandForm.dueDate || null
      }, { headers: authHeaders() })
      await loadCommandRegistry()
      await axios.post(`/api/workflow/${workflowId}/commands`, { commandId: response.data._id }, { headers: authHeaders() })
      await refreshWorkflow()
    })
    if (ok) setNewCommandForm(null)
  }

  const deleteCommand = async (commandId) => {
    await runStep(async () => {
      await axios.delete(`/api/workflow/${workflowId}/commands/${commandId}`, { headers: authHeaders() })
      await refreshWorkflow()
    })
  }

  // ---- 步 4：Skill / Agent 集成 ----

  const togglePoolAsset = (assetId) => {
    const removing = poolIds.includes(assetId)
    setPoolIds(removing ? poolIds.filter(id => id !== assetId) : [...poolIds, assetId])
    if (removing) {
      // 移出资产池时同步清掉各节点里的引用，避免提交时被后端拒绝
      setNodeAssetsMap(map => Object.fromEntries(
        Object.entries(map).map(([nodeId, ids]) => [nodeId, ids.filter(id => id !== assetId)])
      ))
    }
  }

  const toggleNodeAsset = (nodeId, assetId) => {
    setNodeAssetsMap(current => {
      const ids = current[nodeId] || []
      return {
        ...current,
        [nodeId]: ids.includes(assetId) ? ids.filter(id => id !== assetId) : [...ids, assetId]
      }
    })
  }

  const createQuickAsset = async (event) => {
    event.preventDefault()
    const ok = await runStep(async () => {
      const response = await axios.post('/api/asset', { ...quickAsset, productId: scenario?.productId || null }, { headers: authHeaders() })
      await loadAssets()
      setPoolIds(current => [...current, response.data._id])
    })
    if (ok) setQuickAsset(null)
  }

  const poolAssets = assets.filter(asset => poolIds.includes(asset._id))
  // 资产库搜索：按名称 / 说明 / 类型 / 标签过滤
  const filteredAssets = (() => {
    const query = poolSearch.trim().toLowerCase()
    if (!query) return assets
    return assets.filter(asset =>
      [asset.name, asset.description, asset.assetType, ...(asset.tags || [])]
        .filter(Boolean)
        .some(text => String(text).toLowerCase().includes(query))
    )
  })()
  const orderedStages = [...(wf?.stages || [])].sort((a, b) => a.order - b.order)
  const totalNodes = orderedStages.reduce((sum, stage) => sum + (stage.steps?.length || 0), 0)
  const unboundNodes = findUnboundNodes(wf)
  const unboundSummary = unboundNodes.length <= 3
    ? unboundNodes.map(gap => gap.label).join('、')
    : `${unboundNodes.slice(0, 3).map(gap => gap.label).join('、')} 等 ${unboundNodes.length} 个`

  // Command 草稿的实时预览：参数 JSON 解析失败时退化为空参数，保证输入过程中不中断
  const draftCommandPreview = (() => {
    if (!commandDraft) return null
    let parameters = {}
    try {
      parameters = parseCommandParameters(commandDraft.parameters)
    } catch {
      parameters = {}
    }
    const draft = {
      name: normalizeCommandName(commandDraft.name || 'command'),
      description: commandDraft.description,
      parameters,
      bodyOverride: commandDraft.customizeBody ? commandDraft.bodyOverride : ''
    }
    return {
      invocation: cliInvocation(draft),
      body: compileCommandBody(wf, draft)
    }
  })()

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content wizard-content" onClick={event => event.stopPropagation()}>
        <header className="wizard-header">
          <div>
            <p className="page-eyebrow">{scenario?.name} · 场景设计</p>
            <h2>{workflow ? `继续设计：${wf?.name || workflow.name}` : '新建 Harness Workflow'}</h2>
          </div>
          <button className="wizard-close" type="button" onClick={onClose}>×</button>
        </header>

        <nav className="wizard-stepper">
          {WIZARD_STEPS.map((item, index) => (
            <div className="wizard-step-item" key={item.key}>
              {index > 0 && <div className={`wizard-step-line ${index <= maxReached ? 'reached' : ''}`} />}
              <button
                type="button"
                className={`wizard-step ${index === step ? 'current' : ''} ${index < step ? 'done' : ''}`}
                onClick={() => goToStep(index)}
                disabled={(index >= 2 && !workflowId) || index > maxReached}
              >
                <strong>{index + 1}</strong>
                <span>{item.label}</span>
              </button>
            </div>
          ))}
        </nav>

        <section className="wizard-body">
          {step === 0 && (
            <div className="wizard-step-panel">
              <p className="wizard-step-hint">
                先对齐业务场景：明确场景目标、输入输出与业务边界，后续 Workflow 与资产都围绕它展开。带 * 为必填项。
              </p>
              <div className="form-group">
                <label className="form-label">场景名称</label>
                <input
                  className="form-input"
                  value={scenarioForm.name}
                  onChange={event => setScenarioForm({ ...scenarioForm, name: event.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">场景编码 *</label>
                <input
                  className="form-input"
                  value={scenarioForm.code}
                  onChange={event => setScenarioForm({ ...scenarioForm, code: event.target.value })}
                  placeholder="例如：REQ-DEV（英文，作为 Extension 的 name）"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">场景说明与目标 *</label>
                <textarea
                  className="form-input"
                  rows="5"
                  value={scenarioForm.description}
                  onChange={event => setScenarioForm({ ...scenarioForm, description: event.target.value })}
                  placeholder="描述场景目标、输入输出和业务边界"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="wizard-step-panel">
              <p className="wizard-step-hint">
                规划 Workflow 基本信息，并编排「环节 → 节点」：环节是逻辑分组（方便理解），节点是绑定 Agent / Skill 的原子执行单元。
              </p>
              <div className="wizard-form-grid">
                <div className="form-group">
                  <label className="form-label">流程名称</label>
                  <input
                    className="form-input"
                    value={workflowForm.name}
                    onChange={event => setWorkflowForm({ ...workflowForm, name: event.target.value })}
                    placeholder="例如：编解码开发作业流程"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">流程说明</label>
                  <input
                    className="form-input"
                    value={workflowForm.description}
                    onChange={event => setWorkflowForm({ ...workflowForm, description: event.target.value })}
                  />
                </div>
              </div>

              <div className="wizard-block-title">
                <span>环节与节点</span>
                <small>{orderedStages.length} 个环节 · {totalNodes} 个节点，按顺序执行</small>
              </div>

              {!workflowId ? (
                <div className="wizard-empty-hint">填写流程名称后点击“下一步”，即可编排环节与节点。</div>
              ) : (
                <>
                  {orderedStages.length === 0 && !stageDraft && (
                    <div className="wizard-empty-hint">尚未定义环节，点击下方“添加环节”开始编排。</div>
                  )}
                  {orderedStages.map((stage, stageIndex) => {
                    const orderedNodes = [...(stage.steps || [])].sort((a, b) => a.order - b.order)
                    return (
                      <div className="wizard-stage-block" key={stage.id}>
                        <div className="wizard-stage-row">
                          <span className="wizard-stage-order">{stageIndex + 1}</span>
                          <div className="wizard-stage-info">
                            <b>{stage.name}</b>
                            {stage.description && <small>{stage.description}</small>}
                          </div>
                          <div className="wizard-row-actions">
                            <button type="button" onClick={() => moveStage(stage.id, -1)} disabled={stageIndex === 0 || saving}>↑</button>
                            <button type="button" onClick={() => moveStage(stage.id, 1)} disabled={stageIndex === orderedStages.length - 1 || saving}>↓</button>
                            <button type="button" onClick={() => {
                              setStepDraft(null)
                              setStageDraft({ id: stage.id, name: stage.name, description: stage.description || '' })
                            }}>编辑</button>
                            <button type="button" onClick={() => deleteStage(stage)} disabled={saving}>删除</button>
                          </div>
                        </div>

                        <div className="wizard-node-list">
                          {orderedNodes.map((node, nodeIndex) => (
                            <div className="wizard-node-row" key={node.id}>
                              <span className="wizard-node-index">{stageIndex + 1}.{nodeIndex + 1}</span>
                              <div className="wizard-stage-info">
                                <b>{node.name}</b>
                                {node.description && <small>{node.description}</small>}
                              </div>
                              <div className="wizard-row-actions">
                                <button type="button" onClick={() => moveNode(stage, node.id, -1)} disabled={nodeIndex === 0 || saving}>↑</button>
                                <button type="button" onClick={() => moveNode(stage, node.id, 1)} disabled={nodeIndex === orderedNodes.length - 1 || saving}>↓</button>
                                <button type="button" onClick={() => {
                                  setStageDraft(null)
                                  setStepDraft({ stageId: stage.id, id: node.id, name: node.name, description: node.description || '' })
                                }}>编辑</button>
                                <button type="button" onClick={() => deleteNode(stage.id, node.id)} disabled={saving}>删除</button>
                              </div>
                            </div>
                          ))}

                          {stepDraft?.stageId === stage.id ? (
                            <form className="wizard-inline-form" onSubmit={saveNode}>
                              <input
                                className="form-input"
                                value={stepDraft.name}
                                onChange={event => setStepDraft({ ...stepDraft, name: event.target.value })}
                                placeholder="节点名称，例如：解析协议字段"
                                required
                              />
                              <input
                                className="form-input"
                                value={stepDraft.description}
                                onChange={event => setStepDraft({ ...stepDraft, description: event.target.value })}
                                placeholder="节点说明（可选）"
                              />
                              <div className="wizard-inline-actions">
                                <button className="btn btn-primary" type="submit" disabled={saving}>
                                  {stepDraft.id ? '保存节点' : '添加节点'}
                                </button>
                                <button className="btn btn-secondary" type="button" onClick={() => setStepDraft(null)}>取消</button>
                              </div>
                            </form>
                          ) : (
                            <button
                              className="wizard-add-button compact"
                              type="button"
                              onClick={() => {
                                setStageDraft(null)
                                setStepDraft({ ...emptyStepDraft, stageId: stage.id })
                              }}
                            >
                              + 添加节点
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {stageDraft ? (
                    <form className="wizard-inline-form" onSubmit={saveStage}>
                      <div className="wizard-form-grid">
                        <input
                          className="form-input"
                          value={stageDraft.name}
                          onChange={event => setStageDraft({ ...stageDraft, name: event.target.value })}
                          placeholder="环节名称，例如：方案设计"
                          required
                        />
                      </div>
                      <input
                        className="form-input"
                        value={stageDraft.description}
                        onChange={event => setStageDraft({ ...stageDraft, description: event.target.value })}
                        placeholder="环节说明（可选）"
                      />
                      <div className="wizard-inline-actions">
                        <button className="btn btn-primary" type="submit" disabled={saving}>
                          {stageDraft.id ? '保存环节' : '添加环节'}
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => setStageDraft(null)}>取消</button>
                      </div>
                    </form>
                  ) : (
                    <button className="wizard-add-button" type="button" onClick={() => {
                      setStepDraft(null)
                      setStageDraft({ ...emptyStageDraft })
                    }}>
                      + 添加环节
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="wizard-step-panel">
              <p className="wizard-step-hint">
                Command 在 Agent 中通过 / 触发，不指明工具类型；从清单选择或新定义，参数与正文由流水线发布后回填。
              </p>
              {unboundNodes.length > 0 && (
                <div className="wizard-gap-warning">
                  ⚠️ {unboundNodes.length} 个节点尚未绑定 Agent / Skill（{unboundSummary}）。
                  未绑定的节点不会带资产信息进入 Command 正文，可在第 4 步完成绑定。
                </div>
              )}
              {(wf?.commands || []).length === 0 && !newCommandForm && (
                <div className="wizard-empty-hint">尚未选择 Command 入口。</div>
              )}
              {(wf?.commands || []).map(command => (
                <div className="wizard-command-row" key={command.id}>
                  <code>{command.name}</code>
                  {command.version
                    ? <span className="wizard-command-version">v{command.version}</span>
                    : <span className="wizard-command-pending">未开发</span>}
                  <span className="wizard-command-desc">{command.description || '无说明'}</span>
                  <div className="wizard-row-actions">
                    <button type="button" onClick={() => deleteCommand(command.id)} disabled={saving}>删除</button>
                  </div>
                </div>
              ))}
              {newCommandForm ? (
                <form className="wizard-inline-form" onSubmit={createNewCommand}>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">Command 名称 *</label>
                    <input
                      className="form-input"
                      value={newCommandForm.name}
                      onChange={event => setNewCommandForm({ ...newCommandForm, name: event.target.value })}
                      placeholder="/deploy（小写字母、数字、连字符）"
                      required
                    />
                  </div>
                  <div className="wizard-form-grid">
                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label className="form-label">责任人</label>
                      <input
                        className="form-input"
                        value={newCommandForm.owner}
                        onChange={event => setNewCommandForm({ ...newCommandForm, owner: event.target.value })}
                        placeholder="如：张工"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label className="form-label">完成时间</label>
                      <input
                        className="form-input"
                        type="date"
                        value={newCommandForm.dueDate}
                        onChange={event => setNewCommandForm({ ...newCommandForm, dueDate: event.target.value })}
                      />
                    </div>
                  </div>
                  <p className="wizard-step-hint" style={{ marginBottom: '0.75rem' }}>
                    新定义的 Command 仅记录 name + 责任人 + 完成时间，参数与正文由流水线发布后回填，不可在此直接编写。
                  </p>
                  <div className="wizard-inline-actions">
                    <button className="btn btn-primary" type="submit" disabled={saving}>创建并加入清单</button>
                    <button className="btn btn-secondary" type="button" onClick={() => setNewCommandForm(null)}>取消</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="wizard-block-title" style={{ margin: '0.5rem 0 0.75rem' }}>
                    <span>从清单选择 Command</span>
                    <small>仅可选择已注册命令，内容由流水线发布</small>
                  </div>
                  <select
                    className="form-input"
                    value=""
                    onChange={event => { if (event.target.value) addCommand(event.target.value) }}
                  >
                    <option value="">+ 选择一个 Command 加入…</option>
                    {commandRegistry
                      .filter(reg => !(wf?.commands || []).some(c => c.commandId && c.commandId.toString() === reg._id))
                      .map(reg => (
                        <option key={reg._id} value={reg._id}>
                          {reg.name}{reg.developed ? '' : '（未开发）'} — {reg.description || '无说明'}
                        </option>
                      ))}
                  </select>
                  <button
                    className="wizard-add-button"
                    type="button"
                    onClick={() => setNewCommandForm({ name: '', owner: '', dueDate: '' })}
                  >
                    + 新定义 Command（仅 name + 责任人 + 完成时间）
                  </button>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="wizard-step-panel">
              <p className="wizard-step-hint">
                先圈定该 Workflow 可用的 Agent / Skill 资产池，再逐节点从池中分配执行资产（环节视图由节点自动汇总）。
              </p>

              <div className="wizard-block-title">
                <span>Workflow 资产池</span>
                <small>{poolIds.length} 个已选 · 移出资产池会同时解除相关节点的绑定</small>
              </div>
              {poolAssets.length > 0 && (
                <div className="wizard-pool-chips">
                  {poolAssets.map(asset => (
                    <span className="wizard-pool-chip" key={asset._id}>
                      <b>{asset.assetType}</b> {asset.name}
                      <button
                        type="button"
                        title="移出资产池"
                        onClick={() => togglePoolAsset(asset._id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                className="form-input wizard-pool-search"
                value={poolSearch}
                onChange={event => setPoolSearch(event.target.value)}
                placeholder="搜索资产库：名称 / 说明 / 类型 / 标签"
              />
              <div className="wizard-asset-results">
                {filteredAssets.length === 0 ? (
                  <div className="wizard-empty-hint">
                    {assets.length === 0 ? '资产库为空，可点击下方快速创建。' : '没有匹配的资产，换个关键词试试。'}
                  </div>
                ) : (
                  filteredAssets.map(asset => (
                    <div className="wizard-asset-result" key={asset._id}>
                      <div className="wizard-stage-info">
                        <b>{asset.name}</b>
                        <small>
                          {asset.assetType} · v{asset.version} · {asset.status}
                          {asset.description ? ` · ${asset.description}` : ''}
                        </small>
                      </div>
                      {poolIds.includes(asset._id) ? (
                        <span className="badge badge-success">已在池中</span>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => togglePoolAsset(asset._id)}
                        >
                          + 添加
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              {quickAsset ? (
                <form className="wizard-inline-form" onSubmit={createQuickAsset}>
                  <div className="wizard-form-grid">
                    <input
                      className="form-input"
                      value={quickAsset.name}
                      onChange={event => setQuickAsset({ ...quickAsset, name: event.target.value })}
                      placeholder="资产名称，例如：Codec Generator"
                      required
                    />
                    <select
                      className="form-input"
                      value={quickAsset.assetType}
                      onChange={event => setQuickAsset({ ...quickAsset, assetType: event.target.value })}
                    >
                      <option value="Agent">Agent</option>
                      <option value="Skill">Skill</option>
                    </select>
                  </div>
                  <div className="wizard-form-grid">
                    <input
                      className="form-input"
                      value={quickAsset.owner}
                      onChange={event => setQuickAsset({ ...quickAsset, owner: event.target.value })}
                      placeholder="责任人，例如：张工"
                    />
                    <input
                      className="form-input"
                      type="date"
                      value={quickAsset.dueDate}
                      onChange={event => setQuickAsset({ ...quickAsset, dueDate: event.target.value })}
                    />
                  </div>
                  <p className="wizard-step-hint" style={{ marginBottom: '0.75rem' }}>
                    实时新建仅记录 name + 责任人 + 完成时间，资产内容由流水线发布后回填，不可在此直接编写。
                  </p>
                  <div className="wizard-inline-actions">
                    <button className="btn btn-primary" type="submit" disabled={saving}>创建并加入资产池</button>
                    <button className="btn btn-secondary" type="button" onClick={() => setQuickAsset(null)}>取消</button>
                  </div>
                </form>
              ) : (
                <button className="wizard-add-button" type="button" onClick={() => setQuickAsset({ ...emptyQuickAsset })}>
                  + 快速创建 Agent / Skill
                </button>
              )}

              <div className="wizard-block-title">
                <span>节点资产分配</span>
                <small>候选来自上方资产池的勾选结果</small>
              </div>
              {orderedStages.length === 0 || totalNodes === 0 ? (
                <div className="wizard-empty-hint">该 Workflow 尚未定义节点，可返回第 2 步在环节内添加。</div>
              ) : (
                <>
                  {poolAssets.length === 0 && (
                    <div className="wizard-empty-hint">
                      请先在资产池中勾选至少一个 Agent / Skill，然后回到这里逐节点分配。
                    </div>
                  )}
                  {orderedStages.map((stage, stageIndex) => (
                    <div className="wizard-stage-assign" key={stage.id}>
                      <div className="wizard-stage-info">
                        <b>环节 {stageIndex + 1}：{stage.name}</b>
                      </div>
                      {[...(stage.steps || [])].sort((a, b) => a.order - b.order).map((node, nodeIndex) => {
                        const assignedIds = nodeAssetsMap[node.id] || []
                        const assignedAssets = poolAssets.filter(asset => assignedIds.includes(asset._id))
                        const addableAssets = poolAssets.filter(asset => !assignedIds.includes(asset._id))
                        return (
                          <div className="wizard-node-assign" key={node.id}>
                            <div className="wizard-node-assign-title">
                              {stageIndex + 1}.{nodeIndex + 1} {node.name}
                              {node.description && <small className="wizard-node-assign-desc">{node.description}</small>}
                            </div>
                            <div className="wizard-node-assets">
                              {assignedAssets.map(asset => (
                                <span className="wizard-pool-chip" key={asset._id}>
                                  <b>{asset.assetType}</b> {asset.name}
                                  <button
                                    type="button"
                                    title="从该节点移除"
                                    onClick={() => toggleNodeAsset(node.id, asset._id)}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              {poolAssets.length > 0 && addableAssets.length > 0 && (
                                <select
                                  className="form-input wizard-node-select"
                                  value=""
                                  onChange={event => {
                                    if (event.target.value) toggleNodeAsset(node.id, event.target.value)
                                  }}
                                >
                                  <option value="">+ 从资产池添加…</option>
                                  {addableAssets.map(asset => (
                                    <option value={asset._id} key={asset._id}>
                                      {asset.name}（{asset.assetType}）
                                    </option>
                                  ))}
                                </select>
                              )}
                              {assignedAssets.length === 0 && addableAssets.length === 0 && (
                                <span className="wizard-node-empty">未分配资产</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        <footer className="wizard-footer">
          <div className="wizard-error">{error}</div>
          <div className="wizard-footer-actions">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => goToStep(step - 1)}
              disabled={step === 0 || saving}
            >
              上一步
            </button>
            <button className="btn btn-primary" type="button" onClick={handleNext} disabled={saving}>
              {saving ? '保存中...' : step === WIZARD_STEPS.length - 1 ? '完成设计' : '下一步'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default WorkflowWizard
