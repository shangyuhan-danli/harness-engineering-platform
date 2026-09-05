// 四步设计主链路的统一定义：向导 stepper 与场景卡片上的进度 chip 共用，
// 避免两处各自维护步骤文案与完成度规则。
export const WIZARD_STEPS = [
  { key: 'scenario', label: '业务场景分析' },
  { key: 'workflow', label: 'Workflow 规划' },
  { key: 'command', label: 'Command 入口' },
  { key: 'assets', label: 'Skill / Agent 集成' }
]

// 推导单个 Workflow 在四步链路上的完成度。
// 返回 { steps: [{ key, label, state: 'done'|'partial'|'todo', reason }], nextStep, allDone }
export function getWorkflowProgress(scenario, workflow) {
  const stages = workflow?.stages || []
  const nodes = stages.flatMap(stage => stage.steps || [])
  const emptyStages = stages.filter(stage => !(stage.steps?.length > 0)).length
  const unboundNodes = nodes.filter(node => !(node.assets?.length > 0)).length
  const boundNodes = nodes.length - unboundNodes
  const poolSize = workflow?.assets?.length || 0
  const commandCount = workflow?.commands?.length || 0

  const steps = WIZARD_STEPS.map(step => ({ ...step, state: 'todo', reason: '' }))

  // 1 业务场景分析：需要名称 + 说明与目标
  if (scenario?.name && scenario?.description) {
    steps[0].state = 'done'
  } else {
    steps[0].reason = '补充场景说明与目标后完成'
  }

  // 2 Workflow 规划：至少一个环节，且每个环节都有节点
  if (stages.length > 0 && emptyStages === 0) {
    steps[1].state = 'done'
  } else if (stages.length > 0) {
    steps[1].state = 'partial'
    steps[1].reason = `${emptyStages} 个环节还没有节点`
  } else {
    steps[1].reason = '尚未编排环节与节点'
  }

  // 3 Command 入口
  if (commandCount > 0) {
    steps[2].state = 'done'
  } else {
    steps[2].reason = '尚未设计 Command 入口'
  }

  // 4 Skill / Agent 集成：资产池非空，且每个节点都绑定了资产
  if (poolSize > 0 && nodes.length > 0 && unboundNodes === 0) {
    steps[3].state = 'done'
  } else if (boundNodes > 0) {
    steps[3].state = 'partial'
    steps[3].reason = `${unboundNodes} 个节点未绑定资产`
  } else if (poolSize > 0) {
    steps[3].state = 'partial'
    steps[3].reason = '资产池已配置，但节点尚未绑定资产'
  } else {
    steps[3].reason = '尚未配置资产池'
  }

  const firstNotDone = steps.findIndex(step => step.state !== 'done')
  return {
    steps,
    nextStep: firstNotDone === -1 ? steps.length - 1 : firstNotDone,
    allDone: firstNotDone === -1
  }
}
