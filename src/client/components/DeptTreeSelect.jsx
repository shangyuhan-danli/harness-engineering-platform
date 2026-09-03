import { useState } from 'react'

// 部门树下拉选择器：单个下拉框内呈树形（可展开/折叠），trigger 显示完整路径
function DeptTreeSelect({ departments, selectedId, onSelect }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState({})
  const childrenOf = pid => departments.filter(d => d.parentId === pid)
  const roots = departments.filter(d => !d.parentId)
  const getPath = (id) => {
    const path = []
    let cur = departments.find(d => d._id === id)
    while (cur) {
      path.unshift(cur.name)
      cur = cur.parentId ? departments.find(d => d._id === cur.parentId) : null
    }
    return path.join(' / ')
  }
  const triggerLabel = selectedId ? getPath(selectedId) : '选部门…'
  const renderNode = (node, level) => {
    const children = childrenOf(node._id)
    const isExpanded = expanded[node._id]
    return (
      <div key={node._id}>
        <div className="tree-node" style={{ paddingLeft: `${8 + level * 16}px` }}>
          {children.length > 0 ? (
            <span className="tree-toggle" onClick={e => { e.stopPropagation(); setExpanded({ ...expanded, [node._id]: !isExpanded }) }}>{isExpanded ? '▾' : '▸'}</span>
          ) : <span className="tree-toggle-placeholder" />}
          <span className={`tree-label ${selectedId === node._id ? 'selected' : ''}`} onClick={() => { onSelect(node); setOpen(false) }}>{node.name}</span>
        </div>
        {isExpanded && children.map(c => renderNode(c, level + 1))}
      </div>
    )
  }
  return (
    <div className="tree-select">
      <button type="button" className="tree-select-trigger" title={triggerLabel} onClick={() => setOpen(!open)}>
        <span className="tree-select-label-text">{triggerLabel}</span>
        <span className="tree-select-arrow">▾</span>
      </button>
      {open && (
        <>
          <div className="tree-select-backdrop" onClick={() => setOpen(false)} />
          <div className="tree-select-dropdown">
            {roots.map(r => renderNode(r, 0))}
          </div>
        </>
      )}
    </div>
  )
}

export default DeptTreeSelect
