import React, { useState, useEffect } from 'react'
import { api } from './api'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import './App.css'

export default function App() {
  const [conversations, setConversations] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [nodes, setNodes] = useState({})
  const [rootNodeId, setRootNodeId] = useState(null)
  const [currentNodeId, setCurrentNodeId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [contextPath, setContextPath] = useState([])
  const [initialized, setInitialized] = useState(false)

  const loadConversation = async (conversationId) => {
    const { data } = await api.getConversation(conversationId)
    setCurrentConversationId(conversationId)
    setNodes(data.nodes)
    setRootNodeId(data.rootNodeId)
    setCurrentNodeId(data.rootNodeId)
    setContextPath([])
  }

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await api.listConversations()
        if (data.conversations.length > 0) {
          setConversations(data.conversations)
          await loadConversation(data.conversations[0].id)
        } else {
          await handleNewChat(true)
        }
      } catch (e) {
        console.error('Init failed:', e)
      } finally {
        setInitialized(true)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!currentConversationId || !currentNodeId) return
    api.getContextPath(currentConversationId, currentNodeId)
      .then(({ data }) => setContextPath(data.contextPath))
      .catch(console.error)
  }, [currentConversationId, currentNodeId])

  const handleNewChat = async (skipStateUpdate = false) => {
    // React passes an event object by default if used in onClick.
    const shouldSkip = skipStateUpdate === true;
    try {
      const { data } = await api.createConversation()
      const newConv = { id: data.conversationId, rootNodeId: data.rootNodeId, name: null, createdAt: Date.now() }
      if (!shouldSkip) setConversations(prev => [newConv, ...prev])
      else setConversations([newConv])
      const { data: convData } = await api.getConversation(data.conversationId)
      setCurrentConversationId(data.conversationId)
      setNodes(convData.nodes)
      setRootNodeId(data.rootNodeId)
      setCurrentNodeId(data.rootNodeId)
      setContextPath([])
    } catch (e) {
      console.error('New chat failed:', e)
    }
  }

  const handleSelectConversation = async (conversationId) => {
    if (conversationId === currentConversationId) return
    try { await loadConversation(conversationId) }
    catch (e) { console.error('Switch conversation failed:', e) }
  }

  const handleSendMessage = async (message, branchLabel = null) => {
    if (!currentConversationId || !currentNodeId) return
    setLoading(true)
    try {
      const { data } = await api.sendMessage(currentConversationId, message, currentNodeId, branchLabel)
      setNodes(data.tree)
      setCurrentNodeId(data.assistantNodeId)
      if (data.generatedName) {
        setConversations(prev =>
          prev.map(c => c.id === currentConversationId ? { ...c, name: data.generatedName } : c)
        )
      }
    } catch (e) {
      alert(`Error: ${e.response?.data?.error || e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectNode = async (nodeId) => {
    setCurrentNodeId(nodeId)
    try {
      const { data } = await api.getContextPath(currentConversationId, nodeId)
      setContextPath(data.contextPath)
    } catch (e) { console.error(e) }
  }

  const handleRenameConversation = async (conversationId, name) => {
    try {
      await api.renameConversation(conversationId, name)
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, name } : c))
    } catch (e) { console.error(e) }
  }

  const handleRenameBranch = async (nodeId, branchLabel) => {
    try {
      await api.renameBranch(currentConversationId, nodeId, branchLabel)
      setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], branchLabel } }))
    } catch (e) { console.error(e) }
  }

  const handleDeleteConversation = async (conversationId) => {
    try {
      await api.deleteConversation(conversationId)
      const remaining = conversations.filter(c => c.id !== conversationId)
      setConversations(remaining)
      if (conversationId === currentConversationId) {
        if (remaining.length > 0) await loadConversation(remaining[0].id)
        else await handleNewChat(true)
      }
    } catch (e) { console.error(e) }
  }

  if (!initialized) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading Dendrite...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="container">
        <div className="sidebar">
          <Sidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            nodes={nodes}
            rootNodeId={rootNodeId}
            currentNodeId={currentNodeId}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onSelectNode={handleSelectNode}
            onRenameConversation={handleRenameConversation}
            onRenameBranch={handleRenameBranch}
            onDeleteConversation={handleDeleteConversation}
          />
        </div>
        <div className="main">
          <ChatArea
            nodes={nodes}
            currentNodeId={currentNodeId}
            contextPath={contextPath}
            onSendMessage={handleSendMessage}
            loading={loading}
          />
        </div>
      </div>
    </div>
  )
}
