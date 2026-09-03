// Command 预览工具：把平台上设计的 Command（slash command 契约 + Workflow 阶段编排）
// 编译为 Claude Code 发布形态下的所见即所得预览。
// 触发形态：Claude Code TUI 中输入 /xxx 参数…，参数整体进入 $ARGUMENTS（方案 A：位置参数）。
import { stageTypeLabel } from './workflowProgress'

export const COMMAND_NAME_PATTERN = /^\/[a-z0-9][a-z0-9-]*$/

// 统一命令名：补 / 前缀、转小写
export function normalizeCommandName(name) {
  const trimmed = (name || '').trim().toLowerCase()
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

// parameters 契约 { "input": "string", "lang": "string" } → argument-hint "<input> <lang>"
export function argumentHint(parameters) {
  return Object.keys(parameters || {}).map(key => `<${key}>`).join(' ')
}

// TUI 中的调用形态，例如：/codec-generate <input> <lang>
export function cliInvocation(command) {
  const hint = argumentHint(command.parameters)
  return hint ? `${command.name} ${hint}` : command.name
}

// 编译 command md 正文：bodyOverride 优先，否则由阶段编排自动生成
export function compileCommandBody(workflow, command) {
  if (command.bodyOverride) {
    return command.bodyOverride
  }
  // 未开发的 Command（无版本号）：仅占位名字，参数与正文待流水线发布回填
  if (!command.version) {
    return '（该 Command 尚未由流水线发布，待责任人完成后由流水线自动回填参数与正文。）'
  }

  const stages = [...(workflow?.stages || [])].sort((a, b) => a.order - b.order)
  const lines = [
    command.description || `执行「${workflow?.name || '未命名流程'}」作业流程。`,
    '',
    '用户输入：$ARGUMENTS',
    '',
    '## 执行流程',
    ''
  ]

  if (stages.length === 0) {
    lines.push('（该 Workflow 尚未编排环节，请先在第 2 步完成编排。）')
  } else {
    lines.push(`按以下环节顺序执行，共 ${stages.length} 个环节：`, '')
    stages.forEach((stage, stageIndex) => {
      lines.push(`${stageIndex + 1}. **${stage.name}**（${stageTypeLabel(stage.type)}）`)
      if (stage.description) {
        lines.push(`   - 环节说明：${stage.description}`)
      }
      const nodes = [...(stage.steps || [])].sort((a, b) => a.order - b.order)
      nodes.forEach((node, nodeIndex) => {
        // 资产缺失时不写入正文（避免误导最终指令读者），缺口由 findUnboundNodes 暴露给设计者
        const assets = (node.assets || [])
          .map(item => item.assetId ? `${item.type} · ${item.assetId.name}` : null)
          .filter(Boolean)
        const suffix = assets.length > 0 ? ` —— ${assets.join('；')}` : ''
        lines.push(`   ${stageIndex + 1}.${nodeIndex + 1} ${node.name}${suffix}`)
        if (node.description) {
          lines.push(`      ${node.description}`)
        }
      })
    })
  }

  lines.push('', '## 输出要求', '', '汇总各环节结论与产物清单，并标注未完成的环节及原因。')
  return lines.join('\n')
}

// 设计缺口检查：返回尚未绑定 Agent / Skill 的节点，用于界面向设计者提示（不写进 Command 正文）
export function findUnboundNodes(workflow) {
  const gaps = []
  ;(workflow?.stages || []).forEach((stage, stageIndex) => {
    ;[...(stage.steps || [])]
      .sort((a, b) => a.order - b.order)
      .forEach((node, nodeIndex) => {
        if ((node.assets || []).length === 0) {
          gaps.push({
            stageName: stage.name,
            nodeName: node.name,
            label: `${stageIndex + 1}.${nodeIndex + 1} ${node.name}（${stage.name}）`
          })
        }
      })
  })
  return gaps
}

// 完整预览：frontmatter（发布为 .claude/commands/<name>.md 时的头部）+ 正文
export function buildCommandPreview(workflow, command) {
  const hint = argumentHint(command.parameters)
  const frontmatter = [
    '---',
    `description: ${command.description || command.name}`,
    ...(hint ? [`argument-hint: ${hint}`] : []),
    '---'
  ].join('\n')

  return {
    invocation: cliInvocation(command),
    argumentHint: hint,
    customized: Boolean(command.bodyOverride),
    body: compileCommandBody(workflow, command),
    markdown: `${frontmatter}\n\n${compileCommandBody(workflow, command)}`
  }
}
