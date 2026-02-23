import React, { useState, useEffect, useRef } from 'react'
import './ChatArea.css'

export default function ChatArea({ nodes, currentNodeId, contextPath, onSendMessage, loading }) {
  const [input, setInput] = useState('')
  const [showBranchInput, setShowBranchInput] = useState(false)
  const [branchLabel, setBranchLabel] = useState('')
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    // Force scroll to bottom
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }, 0)
  }, [contextPath])

  const handleSend = () => {
    if (!input.trim()) return
    const label = showBranchInput && branchLabel.trim() ? branchLabel : null
    onSendMessage(input, label)
    setInput('')
    setBranchLabel('')
    setShowBranchInput(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const currentNode = nodes[currentNodeId]

  // Build breadcrumb showing path from Main to current branch
  const getBranchPath = () => {
    const branchNodes = contextPath.filter(msg => msg.branchLabel)
    if (branchNodes.length === 0) {
      return 'Main'
    }
    const path = ['Main', ...branchNodes.map(node => `[${node.branchLabel}]`)]
    return path.join(' > ')
  }

  const breadcrumb = getBranchPath()

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="breadcrumb">
          🌳 {breadcrumb}
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {contextPath
          .filter(msg => msg.role !== 'system')
          .map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-content">
                {msg.branchLabel && (
                  <div className="branch-label">🌿 {msg.branchLabel}</div>
                )}
                <div className="message-text">{msg.content}</div>
                <div className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="input-area">
        {showBranchInput && (
          <input
            type="text"
            value={branchLabel}
            onChange={(e) => setBranchLabel(e.target.value)}
            placeholder="Branch label (e.g., 'Deep Dive: Equities')"
            className="branch-input"
          />
        )}
        <div className="input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about investment topics..."
            className="message-input"
            rows="3"
          />
          <div className="input-actions">
            <button
              onClick={() => setShowBranchInput(!showBranchInput)}
              className="action-btn branch-btn"
              title="Create new branch"
            >
              🌿 Branch
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="send-btn"
            >
              {loading ? '⏳' : '📤'} Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
