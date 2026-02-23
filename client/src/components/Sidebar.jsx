import React, { useState, useRef, useEffect, useCallback } from 'react'
import './Sidebar.css'

export default function Sidebar({
    conversations, currentConversationId, nodes, rootNodeId,
    currentNodeId, onNewChat, onSelectConversation, onSelectNode,
    onRenameConversation, onRenameBranch, onDeleteConversation
}) {
    const [editingId, setEditingId] = useState(null)
    const [editingValue, setEditingValue] = useState('')
    const [editingType, setEditingType] = useState(null) // 'conv' | 'branch'
    const [ctxMenu, setCtxMenu] = useState(null)         // { x, y, id, label, type }
    const inputRef = useRef(null)
    const ctxRef = useRef(null)

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [editingId])

    // Dismiss context menu on any outside click
    const dismissCtx = useCallback(() => setCtxMenu(null), [])
    useEffect(() => {
        if (!ctxMenu) return
        const handle = (e) => {
            if (ctxRef.current && !ctxRef.current.contains(e.target)) dismissCtx()
        }
        // Delay so the right-click event itself doesn't dismiss it
        const t = setTimeout(() => window.addEventListener('mousedown', handle), 10)
        return () => { clearTimeout(t); window.removeEventListener('mousedown', handle) }
    }, [ctxMenu, dismissCtx])

    const openCtxMenu = (e, id, label, type) => {
        e.preventDefault()
        e.stopPropagation()
        // Keep menu inside window
        const x = Math.min(e.clientX, window.innerWidth - 160)
        const y = Math.min(e.clientY, window.innerHeight - 100)
        setCtxMenu({ x, y, id, label, type })
    }

    const handleCtxRename = () => {
        setEditingId(ctxMenu.id)
        setEditingValue(ctxMenu.label || '')
        setEditingType(ctxMenu.type)
        setCtxMenu(null)
    }

    const handleCtxDelete = () => {
        onDeleteConversation(ctxMenu.id)
        setCtxMenu(null)
    }

    const saveEdit = () => {
        const val = editingValue.trim()
        if (val) {
            if (editingType === 'conv') onRenameConversation(editingId, val)
            else onRenameBranch(editingId, val)
        }
        setEditingId(null)
    }

    const cancelEdit = () => setEditingId(null)

    const onKeyDown = (e) => {
        if (e.key === 'Enter') saveEdit()
        if (e.key === 'Escape') cancelEdit()
    }

    // ── Branch tree helpers ────────────────────────────────────────

    const getLastInChain = (nodeId) => {
        let cur = nodeId
        let next = Object.values(nodes).find(n => n.parentId === cur && !n.branchLabel)
        while (next) { cur = next.id; next = Object.values(nodes).find(n => n.parentId === cur && !n.branchLabel) }
        return cur
    }

    const getChainNodes = (startId) => {
        const chain = [startId]
        let cur = startId
        let next = Object.values(nodes).find(n => n.parentId === cur && !n.branchLabel)
        while (next) { chain.push(next.id); cur = next.id; next = Object.values(nodes).find(n => n.parentId === cur && !n.branchLabel) }
        return chain
    }

    const buildBranchMap = (convName) => {
        const map = {}
        if (rootNodeId) {
            map[rootNodeId] = { id: rootNodeId, label: convName || 'New Chat', isRoot: true, lastNodeId: getLastInChain(rootNodeId) }
        }
        Object.values(nodes).forEach(node => {
            if (node.branchLabel) {
                map[node.id] = { id: node.id, label: node.branchLabel, isRoot: false, parentId: node.parentId, lastNodeId: getLastInChain(node.id) }
            }
        })
        return map
    }

    const getChildBranches = (branchId, map) => {
        const parent = map[branchId]
        if (!parent) return []
        const chain = getChainNodes(parent.id)
        return Object.values(map).filter(b => !b.isRoot && b.id !== branchId && chain.includes(b.parentId))
    }

    const isBranchActive = (lastNodeId) => {
        let id = currentNodeId
        while (id) {
            if (id === lastNodeId) return true
            const n = nodes[id]; if (!n) break; id = n.parentId
        }
        return false
    }

    const renderBranch = (branchId, map, depth = 0) => {
        const branch = map[branchId]
        if (!branch) return null
        const children = getChildBranches(branchId, map)
        const active = isBranchActive(branch.lastNodeId)

        return (
            <div key={branchId} className="sb-branch-wrapper">
                <div
                    className={`sb-branch ${active ? 'sb-branch-active' : ''}`}
                    style={{ paddingLeft: `${14 + depth * 14}px` }}
                    onClick={() => onSelectNode(branch.lastNodeId)}
                    onContextMenu={e => openCtxMenu(e, branchId, branch.label, 'branch')}
                >
                    <span className="sb-branch-icon">{branch.isRoot ? '🏠' : '🌿'}</span>
                    {editingId === branchId && editingType === 'branch' ? (
                        <input
                            ref={inputRef}
                            className="sb-rename-input"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onKeyDown={onKeyDown}
                            onBlur={saveEdit}
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <span className="sb-branch-label">{branch.label}</span>
                    )}
                </div>
                {children.length > 0 && (
                    <div>
                        {children
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map(c => renderBranch(c.id, map, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    const currentConv = conversations.find(c => c.id === currentConversationId)
    const branchMap = (currentConv && Object.keys(nodes).length > 0)
        ? buildBranchMap(currentConv.name)
        : {}

    return (
        <div className="sb-root">
            <div className="sb-header">
                <span className="sb-title">🌿 Dendrite</span>
                <button className="sb-new-btn" onClick={onNewChat} title="New Chat">+ New</button>
            </div>

            <div className="sb-convs">
                {conversations.map(conv => {
                    const isCurrent = conv.id === currentConversationId
                    const displayName = conv.name || 'New Chat'
                    return (
                        <div key={conv.id} className={`sb-conv-group ${isCurrent ? 'sb-conv-active' : ''}`}>
                            <div
                                className="sb-conv-row"
                                onClick={() => onSelectConversation(conv.id)}
                                onContextMenu={e => openCtxMenu(e, conv.id, conv.name || '', 'conv')}
                            >
                                <span className="sb-conv-icon">💬</span>
                                {editingId === conv.id && editingType === 'conv' ? (
                                    <input
                                        ref={inputRef}
                                        className="sb-rename-input"
                                        value={editingValue}
                                        onChange={e => setEditingValue(e.target.value)}
                                        onKeyDown={onKeyDown}
                                        onBlur={saveEdit}
                                        onClick={e => e.stopPropagation()}
                                    />
                                ) : (
                                    <span className="sb-conv-name" title={displayName}>{displayName}</span>
                                )}
                            </div>

                            {isCurrent && rootNodeId && Object.keys(branchMap).length > 0 && (
                                <div className="sb-branches">
                                    {renderBranch(rootNodeId, branchMap, 0)}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Right-click context menu */}
            {ctxMenu && (
                <div
                    ref={ctxRef}
                    className="sb-ctx-menu"
                    style={{ top: ctxMenu.y, left: ctxMenu.x }}
                >
                    <button className="sb-ctx-item" onClick={handleCtxRename}>
                        <span className="sb-ctx-icon">✏️</span> Rename
                    </button>
                    {ctxMenu.type === 'conv' && (
                        <button className="sb-ctx-item sb-ctx-danger" onClick={handleCtxDelete}>
                            <span className="sb-ctx-icon">🗑️</span> Delete
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
