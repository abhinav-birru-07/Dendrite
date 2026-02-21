# Tree GPT - Branching Conversations UI

A web application for interacting with LLMs with a unique branching conversation feature. Instead of scrolling back to previous messages, create branches to explore different topics while maintaining full context from parent conversations.

## Features

✨ **Branch Conversations** - Create sub-conversations from any point in the main chat
📋 **Context Inheritance** - All branches inherit context from their parent conversation  
🌳 **Visual Tree Navigation** - See entire conversation structure in sidebar
📱 **Responsive Design** - Clean, modern dark theme UI
⚡ **Fast Switching** - Instantly jump between branches without losing context

## Architecture

```
tree-gpt/
├── server/           # Node.js Express backend + SQLite DB
│   ├── index.js      # Main server & API routes
│   ├── db.js         # Database & conversation tree logic
│   └── package.json
│
└── client/           # React + Vite frontend
    ├── src/
    │   ├── App.jsx         # Main app component
    │   ├── api.js          # API client
    │   └── components/
    │       ├── ChatArea.jsx       # Chat display & input
    │       └── ConversationTree.jsx # Tree sidebar
    ├── vite.config.js
    └── package.json
```

## Data Model

**Conversation Tree Node:**
```json
{
  "id": "uuid",
  "parentId": "uuid | null",
  "conversationId": "uuid",
  "message": "user input",
  "response": "llm response",
  "role": "user | assistant | system",
  "timestamp": 1234567890,
  "branchLabel": "Deep Dive: Equities"
}
```

All context for a node is computed by traversing from root → current node, eliminating redundancy.

## Setup & Run

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Google Gemini API key (or other LLM API key)

### 0. Environment Setup

Create a `.env` file in the `server/` directory with your API key:

```bash
cd server
touch .env
```

Add the following (get your key from [Google AI Studio](https://aistudio.google.com/)):

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

**Example:**
```env
GEMINI_API_KEY=AIzaSyD_rXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **Never commit `.env` file** - it's already in `.gitignore`

### 1. Backend Setup

```bash
cd server
npm install
npm start
```

Server starts at `http://localhost:5000`

### 2. Frontend Setup (in new terminal)

```bash
cd client
npm install
npm run dev
```

App opens at `http://localhost:3000`

### 3. Start Using!

1. Open http://localhost:3000 in browser
2. Type your first question (e.g., "Tell me about investment assets")
3. Click **🌿 Branch** to create a labeled sub-conversation
4. Ask follow-up questions in the branch
5. Click any node in the tree (left sidebar) to switch branches
6. Original context carries forward automatically

## How It Works

### Sending a Message
1. User types message and optionally adds a branch label
2. Frontend sends message + current node ID to backend
3. Backend traverses context path (root → parent node) 
4. Context sent to LLM along with user message
5. LLM response stored as new node
6. Frontend updates tree and switches to response node

### Branch Creation
- "🌿 Branch" button appears in input area
- Enables optional branch label field
- New branch inherits all context from parent
- Separate message thread for focused discussion

### Context Management
- Single context file built server-side
- Only includes path from root to current node
- Efficient: no duplication across branches
- Future: compression for very deep trees

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/conversations` | POST | Create new conversation |
| `/api/conversations/:id` | GET | Get conversation tree |
| `/api/conversations/:id/messages` | POST | Send message & get response |
| `/api/conversations/:id/context/:nodeId` | GET | Get context path for node |
| `/api/conversations/:id/nodes/:nodeId/children` | GET | Get child nodes |

## Mock LLM Responses

The backend includes mock investment-related responses. To integrate real LLM (OpenAI, Anthropic, etc):

Edit `server/index.js`, replace `getMockResponse()`:

```javascript
async function getLLMResponse(userMessage, contextPath) {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are an investment advisor." },
      ...contextPath.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: "user", content: userMessage }
    ]
  });
  return response.choices[0].message.content;
}
```

## Future Enhancements

- [ ] User authentication & persistence
- [ ] Share conversations / export branches
- [ ] Search across branches
- [ ] Context compression for deep trees
- [ ] Merge branches back to main
- [ ] Real LLM API integration
- [ ] Conversation templates
- [ ] Custom system prompts per branch

## Tech Stack

- **Frontend**: React 18, Vite, Axios
- **Backend**: Node.js, Express, SQLite3
- **Architecture**: Hybrid (frontend for UI, backend for persistence)

## Example Workflow

```
Start: "Tell me about investment assets"
  ↓ Response: Lists bonds, equities, derivatives

Create Branch "Equities Deep Dive"
  ↓ "Explain how compound interest works with equities?"
  ↓ "What's the tax impact?"

Back to Root
  ↓ Create Branch "Derivatives Discussion"
  ↓ "What are options vs futures?"

Switch between branches via sidebar
All maintain inherited context from root
```

## License

MIT

---

**Questions?** Check the architecture design in the root directory or explore the codebase. The context engine is the core — understand that first!
