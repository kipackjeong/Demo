
⸻

Project Requirements Documentation

Project Title:

Personal AI Manager Chatbot

Objective:

To develop a web-based chatbot application that acts as a personal AI manager by integrating with Google services (Calendar, Tasks, Gmail) and enabling dynamic interactions via intelligent agent orchestration using LangChain and LangGraph.

Functional Requirements:
	1.	User Authentication
	•	Google OAuth 2.0 login
	2.	Chat Interface
	•	Responsive and dynamic React-based UI
	•	Real-time interaction with AI
	3.	Google Services Integration
	•	Google Calendar Agent: View, create, update, delete events
	•	Google Tasks Agent: Create and manage to-do lists
	•	Gmail Agent: Fetch and summarize recent emails
	4.	Agent Architecture
	•	Use LangChain & LangGraph to orchestrate agents
	•	Integrate agents with ModelContextProtocol (MCP) Server
	5.	Intelligent Prompt Handling
	•	Non-deterministic orchestration allowing flexible user prompts like:
	•	“Get my recent inbox and make todo list”
	•	“Schedule a meeting based on this email”
	6.	MCP Server Integration
	•	Serve tools to agents dynamically based on context

Non-Functional Requirements:
	•	Secure API communication (HTTPS, OAuth)
	•	High responsiveness (low latency chat UI)
	•	Modular and scalable backend
	•	Error handling and retry logic for API failures

⸻

Backend Design Documentation

Stack:
	•	Node.js, Express.js (TypeScript)
	•	LangChain + LangGraph
	•	modelcontextprotocol (MCP)

Architecture Overview:

Client <---> Express API <---> LangGraph (Agent Orchestration)
                                       |---> Google Calendar Agent
                                       |---> Google Tasks Agent
                                       |---> Gmail Agent
                                       |---> MCP Server (tools access)

Modules:

1. Auth Module:
	•	Google OAuth 2.0 login via Passport.js or Firebase Auth

2. Agent Framework Module:
	•	Define and register agents using LangChain’s AgentExecutor
	•	Implement LangGraph for non-deterministic orchestration paths

3. MCP Server Module:
	•	Host using modelcontextprotocol-typescript
	•	Expose tools via REST endpoints or internal API

4. Google API Integration:
	•	OAuth token management
	•	Service-specific handlers for Google Calendar, Tasks, and Gmail

⸻

AI Framework Design Documentation

Technologies:
	•	LangChain
	•	LangGraph
	•	Anthropic’s modelcontextprotocol-typescript

Agent Types:
	1.	Google Calendar Agent
	2.	Google Task Agent
	3.	Gmail Agent

Orchestration Logic:
	•	LangGraph state machine dynamically determines the agent path
	•	Agents can call the MCP server for tools like:
	•	Task extraction
	•	Email summarization
	•	Intent recognition

Example Flow:

User Prompt: “Get my recent inbox and make todo list”
	•	Gmail Agent fetches latest emails
	•	MCP tool summarizes email content
	•	Task Agent creates todo items based on summary

MCP Tooling Support:
	•	Tools registered as context functions
	•	Callable from any agent
	•	Stateless, support JSON I/O

⸻

Frontend Documentation

Stack:
	•	React (TypeScript)
	•	Tailwind CSS / Shadcn UI for components

Pages & Components:

1. Login Page:
	•	Google Sign-In button
	•	OAuth redirect handling

2. Chat Interface:
	•	Message input box
	•	Message history (user & assistant)
	•	Streaming responses from backend

3. Settings Page:
	•	Connect/Disconnect Google services
	•	Manage permissions

Key Hooks:
	•	useAuth for session handling
	•	useChat for message lifecycle and streaming

API Communication:
	•	REST + WebSocket (optional)
	•	Secure token usage for each request

UX Goals:
	•	Clear distinction between AI/system/user messages
	•	Intuitive transitions and animations
	•	Error toasts & loading states

⸻
