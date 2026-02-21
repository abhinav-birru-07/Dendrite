import React, { useState, useEffect, useRef } from 'react'
import { api } from './api'
import ConversationTree from './components/ConversationTree'
import ChatArea from './components/ChatArea'
import './App.css'

export default function App() {
  const [conversationId, setConversationId] = useState(null)
  const [nodes, setNodes] = useState({})
  const [rootNodeId, setRootNodeId] = useState(null)
  const [currentNodeId, setCurrentNodeId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [contextPath, setContextPath] = useState([])

  // Initialize conversation
  useEffect(() => {
    const initConversation = async () => {
      try {
        const { data } = await api.createConversation()
        setConversationId(data.conversationId)
        setRootNodeId(data.rootNodeId)
        setCurrentNodeId(data.rootNodeId)
      } catch (error) {
        console.error('Failed to create conversation:', error)
      }
    }

    initConversation()
  }, [])

  // Load conversation tree when conversationId changes
  useEffect(() => {
    if (!conversationId) return

    const loadConversation = async () => {
      try {
        const { data } = await api.getConversation(conversationId)
        setNodes(data.nodes)
      } catch (error) {
        console.error('Failed to load conversation:', error)
      }
    }

    loadConversation()
  }, [conversationId])

  // Update context path when current node changes
  useEffect(() => {
    if (!conversationId || !currentNodeId) return

    const loadContextPath = async () => {
      try {
        const { data } = await api.getContextPath(conversationId, currentNodeId)
        setContextPath(data.contextPath)
      } catch (error) {
        console.error('Failed to load context path:', error)
        alert(`Failed to load context: ${error.message}`)
      }
    }

    loadContextPath()
  }, [conversationId, currentNodeId])

  // Handle sending message
  const handleSendMessage = async (message, branchLabel = null) => {
    if (!conversationId || !currentNodeId) return

    setLoading(true)
    try {
      const { data } = await api.sendMessage(
        conversationId,
        message,
        currentNodeId,
        branchLabel
      )

      setNodes(data.tree)
      setCurrentNodeId(data.assistantNodeId)
    } catch (error) {
      console.error('Failed to send message:', error)
      alert(`Error: ${error.response?.data?.error || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Handle node click in tree
  const handleSelectNode = (nodeId) => {
    setCurrentNodeId(nodeId)
    // Force reload context path
    const reloadContext = async () => {
      try {
        const { data } = await api.getContextPath(conversationId, nodeId)
        setContextPath(data.contextPath)
      } catch (error) {
        console.error('Failed to load context path:', error)
      }
    }
    reloadContext()
  }

  return (
    <div className="app">
      {!conversationId ? (
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Initializing conversation...</p>
        </div>
      ) : (
        <div className="container">
          <div className="sidebar">
            <ConversationTree
              nodes={nodes}
              rootNodeId={rootNodeId}
              currentNodeId={currentNodeId}
              onSelectNode={handleSelectNode}
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
      )}
    </div>
  )
}
