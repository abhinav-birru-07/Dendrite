import React, { useState } from 'react'
import './ConversationTree.css'

export default function ConversationTree({ nodes, rootNodeId, currentNodeId, onSelectNode }) {
  const [expanded, setExpanded] = useState({})

  // Get last node in a linear chain (stop before branch labels)
  const getLastNodeInChain = (nodeId) => {
    let currentId = nodeId
    let nextNode = Object.values(nodes).find(n => n.parentId === currentId && !n.branchLabel)
    
    while (nextNode) {
      currentId = nextNode.id
      nextNode = Object.values(nodes).find(n => n.parentId === currentId && !n.branchLabel)
    }
    
    return currentId
  }

  // Get all branches (nodes with branchLabel)
  const getAllBranches = () => {
    const branches = {}
    
    // Add Main/Root
    if (rootNodeId) {
      branches[rootNodeId] = {
        id: rootNodeId,
        branchLabel: 'Main',
        isMain: true,
        lastNodeId: getLastNodeInChain(rootNodeId)
      }
    }
    
    // Add all labeled branches
    Object.values(nodes).forEach(node => {
      if (node.branchLabel) {
        branches[node.id] = {
          id: node.id,
          branchLabel: node.branchLabel,
          isMain: false,
          parentId: node.parentId,
          lastNodeId: getLastNodeInChain(node.id)
        }
      }
    })
    
    return branches
  }

  // Get all nodes in a branch's chain from start to end
  const getNodesInBranchChain = (startNodeId) => {
    const chain = [startNodeId]
    let currentId = startNodeId
    let nextNode = Object.values(nodes).find(n => n.parentId === currentId && !n.branchLabel)
    
    while (nextNode) {
      chain.push(nextNode.id)
      currentId = nextNode.id
      nextNode = Object.values(nodes).find(n => n.parentId === currentId && !n.branchLabel)
    }
    
    return chain
  }

  // Get direct child branches - branches whose parent node is in this branch's chain
  const getChildBranches = (branchId, allBranches) => {
    const parentBranch = allBranches[branchId]
    if (!parentBranch) return []
    
    const parentChain = getNodesInBranchChain(parentBranch.id)
    
    return Object.values(allBranches).filter(b => 
      !b.isMain && 
      b.id !== branchId && 
      parentChain.includes(b.parentId)
    )
  }

  // Check if current node is in this branch's chain
  const isBranchActive = (branchLastNodeId) => {
    let nodeId = currentNodeId
    while (nodeId) {
      if (nodeId === branchLastNodeId) {
        return true
      }
      const node = nodes[nodeId]
      if (!node) break
      nodeId = node.parentId
    }
    return false
  }

  // Toggle expand/collapse
  const toggleExpand = (branchId) => {
    setExpanded(prev => ({
      ...prev,
      [branchId]: !prev[branchId]
    }))
  }

  const allBranches = getAllBranches()

  // Render a branch and its child branches recursively
  const renderBranch = (branchId, depth = 0) => {
    const branch = allBranches[branchId]
    if (!branch) return null

    const childBranches = getChildBranches(branchId, allBranches)
    const isExpanded = expanded[branchId] !== false || depth === 0 // Expand main by default
    const isActive = isBranchActive(branch.lastNodeId)
    const hasChildren = childBranches.length > 0

    return (
      <div key={branchId} className="tree-node-wrapper">
        <div className="tree-node-container" style={{ marginLeft: `${depth * 20}px` }}>
          <button
            className={`tree-toggle ${hasChildren ? '' : 'no-children'}`}
            onClick={() => toggleExpand(branchId)}
            title={hasChildren ? (isExpanded ? 'Collapse' : 'Expand') : 'No sub-branches'}
          >
            {hasChildren && (isExpanded ? '▼' : '▶')}
          </button>

          <button
            className={`tree-node ${isActive ? 'active' : ''}`}
            onClick={() => onSelectNode(branch.lastNodeId)}
            title={branch.branchLabel}
          >
            <span className="node-icon">{branch.isMain ? '🏠' : '🌿'}</span>
            <span className="node-content">{branch.branchLabel}</span>
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div className="tree-children">
            {childBranches
              .sort((a, b) => (a.branchLabel || '').localeCompare(b.branchLabel || ''))
              .map(child => renderBranch(child.id, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="tree-container">
      <h3>🌳 Branches</h3>
      {!rootNodeId ? (
        <div className="no-branches">
          <p>No branches yet</p>
          <p className="hint">Send a message to start</p>
        </div>
      ) : (
        <div className="tree-root">
          {renderBranch(rootNodeId)}
        </div>
      )}
    </div>
  )
}
