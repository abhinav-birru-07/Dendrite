import axios from 'axios'

const API_BASE = 'http://localhost:5000/api'

export const api = {
  listConversations: () =>
    axios.get(`${API_BASE}/conversations`),

  createConversation: () =>
    axios.post(`${API_BASE}/conversations`),

  getConversation: (conversationId) =>
    axios.get(`${API_BASE}/conversations/${conversationId}`),

  sendMessage: (conversationId, message, parentNodeId, branchLabel) =>
    axios.post(`${API_BASE}/conversations/${conversationId}/messages`,
      { message, parentNodeId, branchLabel }),

  getContextPath: (conversationId, nodeId) =>
    axios.get(`${API_BASE}/conversations/${conversationId}/context/${nodeId}`),

  getNodeChildren: (conversationId, nodeId) =>
    axios.get(`${API_BASE}/conversations/${conversationId}/nodes/${nodeId}/children`),

  renameConversation: (conversationId, name) =>
    axios.patch(`${API_BASE}/conversations/${conversationId}/name`, { name }),

  renameBranch: (conversationId, nodeId, branchLabel) =>
    axios.patch(`${API_BASE}/conversations/${conversationId}/nodes/${nodeId}/branch-label`, { branchLabel }),

  deleteConversation: (conversationId) =>
    axios.delete(`${API_BASE}/conversations/${conversationId}`),
}
