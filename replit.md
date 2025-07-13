# AI Agent Chatbot Framework

## Overview

This is a production-ready AI agent chatbot framework built with React frontend and Node.js backend, now powered by Azure OpenAI through LangChain. The system enables real-time, bidirectional streaming communication between users and AI agents through WebSocket connections. The framework provides full conversation history, context awareness, and graceful fallback handling.

**Latest Update (July 13, 2025):** Successfully implemented and tested complete Multi-Agent System:
- **Completed Multi-Agent Architecture (multiAgentOrchestrator.ts)**
  - Orchestrator Agent: Routes requests based on intelligent analysis
  - Calendar Agent: Directly calls calendar tools for efficient data retrieval
  - Tasks Agent: Directly calls task tools without model binding overhead
  - Summary Agent: Creates formatted markdown summaries with proper date handling
  - Parallel execution using Promise.all for optimal performance
- **Enhanced Life Manager System (multiAgentRefactored.ts)**
  - Direct tool execution for task creation without Azure OpenAI bindTools
  - Intelligent request parsing to extract task details from natural language
  - Automatic priority detection (high/medium/low) from user messages
  - Proper response formatting for both conversational and action requests
  - **Fixed Graph Execution Timeouts**: Increased timeout from 30s to 60s to handle Azure OpenAI latency
  - **Optimized Agent Node Execution**: Added early exit when tools have been executed to prevent redundant AI calls
- **Key Technical Improvements:**
  - Fixed Azure OpenAI bindTools compatibility issue by using direct tool calls
  - Implemented proper mock data fallback when Google tokens unavailable
  - Enhanced date formatting to handle various date formats from APIs
  - Orchestrator automatically routes initial summaries to both data agents
  - Aggregator node ensures Summary Agent always runs for initial summaries
  - Fixed WebSocket message streaming for all response types
  - Reduced streaming delay from 100ms to 20ms for better UX
  - **Session-based AgentService Persistence**: Fixed conversation state management by maintaining AgentService instances per session
  - **Proactive Task Creation**: System now automatically creates tasks when user intent is clear (e.g., "I have to...", "I need to...")
- **System Features:**
  - Initial summaries show 3-day window with proper markdown formatting
  - Interactive action buttons for different time ranges (week/month/7 days)
  - Task creation with natural language parsing
  - Comprehensive logging at each orchestration step
  - Graceful fallback to mock data when APIs unavailable
  - Proper WebSocket streaming of formatted responses
  - Support for both initial summaries and regular conversations
  - **Conversation State Management**: Full conversation history maintained across multiple turns per session

## User Preferences

- Preferred communication style: Simple, everyday language.
- Initial AI greeting: Concise markdown-formatted 3-day summary with Calendar, Tasks, and Recommendations sections
- Time-ranged summaries: Initial view shows next 3 days, with interactive buttons for week/month views
- Regular conversations: Natural language without markdown formatting
- Authentication: Traditional email/password login with Google OAuth option for Calendar and Tasks API access

## System Architecture

### Frontend Architecture
- **React + TypeScript**: Modern component-based UI framework
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **shadcn/ui**: High-quality, accessible component library
- **TanStack Query**: Data fetching and caching library
- **Wouter**: Lightweight router for client-side navigation

### Backend Architecture
- **Express.js**: Web application framework for Node.js
- **WebSocket**: Real-time communication via `ws` library
- **TypeScript**: Type-safe JavaScript with modern features
- **ESM**: Modern ES modules for better tree-shaking and performance

### Database Layer
- **Drizzle ORM**: Type-safe SQL ORM with PostgreSQL support
- **Neon Database**: Serverless PostgreSQL database
- **Schema Design**: Users, chat sessions, and messages with proper relationships
- **Authentication Tables**: Session storage and user management for email/password and Google OAuth authentication
- **Data Isolation**: User-specific chat sessions and message history

## Key Components

### Real-Time Communication
- **WebSocket Server**: Handles persistent connections at `/ws` endpoint
- **Message Streaming**: Token-by-token response streaming for natural conversation flow
- **Connection Management**: Automatic reconnection and error handling
- **Session Management**: Persistent chat sessions with unique identifiers

### AI Agent Integration
- **LangChain Integration**: Full Azure OpenAI integration with LangChain framework
- **Azure OpenAI Service**: Production-ready AI responses using Azure OpenAI GPT models
- **Azure AD Authentication**: Uses DefaultAzureCredential for secure authentication
- **Multi-Agent System**: LangGraph-powered life management with specialized agents
- **Conversation History**: Per-session conversation context and memory management
- **Streaming Response**: Word-by-word response delivery for natural interaction
- **Fallback Handling**: Graceful degradation when AI service is unavailable

### Life Management Multi-Agent System
- **Dual Architecture Support**: System now supports both approaches:
  - **Original System (multiAgentRefactored.ts)**: Single agent with tool calling and state machine
  - **New Multi-Agent System (multiAgentOrchestrator.ts)**: True orchestrator pattern with specialized sub-agents
- **Multi-Agent Orchestration Pattern**:
  - **Orchestrator Agent**: Routes requests to appropriate specialized agents based on analysis
  - **Calendar Agent**: Dedicated to calendar operations with filtered calendar tools
  - **Tasks Agent**: Focused on task management with task-specific tools
  - **Summary Agent**: Specializes in creating formatted summaries from data
  - **Parallel Execution**: Independent agents run concurrently for better performance
- **MCP Tool Integration**: Both systems use MCPToolAdapter for tool conversion
- **Unified MCP Server**: Single server (mcpUnified.ts) handles both Calendar and Tasks APIs
- **MCPToolAdapter**: Converts MCP capabilities into LangChain-compatible DynamicStructuredTools
- **Automatic Tool Selection**: Agents autonomously choose appropriate tools based on user requests
- **Structured Response Formatting**: Enhanced markdown formatting for summaries
- **Fallback Handling**: Graceful degradation with direct tool calls when main system times out

### User Interface
- **Authentication Flow**: Traditional login/signup page with email/password and Google OAuth options
- **Protected Chat Interface**: Clean, modern chat UI with message bubbles
- **User Dashboard**: Personalized home page with quick actions and user profile
- **Login/Signup Page**: Comprehensive authentication page with both email/password and Google OAuth options
- **Typing Indicators**: Visual feedback during response generation
- **Theme Support**: Light/dark mode with persistent preferences
- **Responsive Design**: Mobile-first approach with desktop optimization
- **Accessibility**: ARIA labels and keyboard navigation support

### State Management
- **React State**: Component-level state for UI interactions
- **Custom Hooks**: Reusable hooks for WebSocket, theme, and mobile detection
- **Session Storage**: Browser storage for theme and session preferences

## Data Flow

1. **User Authentication**: User signs in via email/password or Google OAuth
2. **Session Creation**: Authenticated user session established
3. **User Input**: User types message in protected chat interface
4. **WebSocket Transmission**: Message sent to server via WebSocket
5. **Session Management**: Server creates/retrieves user-specific chat session
6. **Message Storage**: User message stored in database with user ID
7. **Agent Processing**: AI agent generates response based on input and user context
8. **Streaming Response**: Response streamed back token-by-token
9. **UI Update**: Frontend updates chat interface in real-time
10. **Message Persistence**: Complete response stored in database with user association

## External Dependencies

### Frontend Dependencies
- **UI Components**: Radix UI primitives for accessible components
- **Styling**: Tailwind CSS with custom design tokens
- **Icons**: Lucide React for consistent iconography
- **Routing**: Wouter for lightweight client-side routing
- **HTTP Client**: Fetch API with custom query client

### Backend Dependencies
- **WebSocket**: `ws` library for real-time communication
- **Database**: Drizzle ORM with Neon PostgreSQL
- **Development**: TSX for TypeScript execution
- **Build Tools**: ESBuild for production bundling
- **Google APIs**: googleapis and google-auth-library for Google Calendar and Tasks integration
- **MCP**: @modelcontextprotocol/sdk for Model Context Protocol implementation

### Development Tools
- **Vite**: Fast development server and build tool
- **TypeScript**: Type checking and modern JavaScript features
- **ESLint/Prettier**: Code formatting and linting (implied)
- **PostCSS**: CSS processing with Tailwind

## Deployment Strategy

### Development Setup
- **Local Development**: Vite dev server with hot module replacement
- **Environment Variables**: `DATABASE_URL` for database connection
- **TypeScript Compilation**: Real-time type checking during development
- **WebSocket Development**: Local WebSocket server for testing

### Production Build
- **Frontend Build**: Static assets built with Vite
- **Backend Build**: ESBuild compilation to single JavaScript file
- **Database Migration**: Drizzle migrations for schema updates
- **Asset Optimization**: Minification and tree-shaking

### Scalability Considerations
- **Database**: PostgreSQL with connection pooling
- **WebSocket**: Clustered WebSocket servers for horizontal scaling
- **Static Assets**: CDN-ready static file serving
- **Session Storage**: Database-backed session management

### Framework Extension Points
- **Agent Service**: Easily replaceable with LangGraph, AutoGen, or custom agents
- **Database**: Drizzle schema can be extended for additional data models
- **UI Components**: shadcn/ui components can be customized or replaced
- **Authentication**: Framework ready for user authentication integration
- **External APIs**: Structured for integration with various AI services
- **MCP Server**: Model Context Protocol architecture allows easy addition of new service integrations

## Google API Integration Setup

### Required Environment Variables
- `GOOGLE_CLIENT_ID`: OAuth 2.0 client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET`: OAuth 2.0 client secret from Google Cloud Console

### How It Works
1. Users login with Google OAuth at `/api/auth/google`
2. The system requests Calendar and Tasks permissions during login
3. Google tokens are stored per user in the database
4. When users send messages, their Google data is automatically accessed
5. MCP server dynamically configures with each user's tokens
6. System works with just access token if refresh token is unavailable

### API Architecture
```
User Request → WebSocket → Multi-Agent System → MCP Server → Google APIs
```

The system automatically falls back to mock data when Google APIs are unavailable, ensuring consistent functionality during development and testing.

## Authentication System

### Traditional Authentication with Google OAuth
- **Email/Password Login**: Standard authentication with secure password hashing
- **Google OAuth Integration**: Optional Google login for Calendar and Tasks API access
- **Session Management**: Secure session storage with PostgreSQL backend
- **User Profiles**: Automatic user profile creation with email, name, and avatar
- **Protected Routes**: Chat interface and user-specific features require authentication
- **Login/Signup Page**: Comprehensive authentication page with both login options

### Refresh Token Handling
- **Force Consent Flow**: Users can re-authorize by visiting `/api/auth/google?force=true`
- **Token Status Check**: `/api/auth/google-status` endpoint checks if re-authorization is needed
- **Warning Display**: Shows a yellow warning banner when Google refresh token is missing
- **Automatic Detection**: Chat interface detects missing tokens and prompts for re-authorization

### Google API Integration
- **OAuth Token Storage**: Google OAuth tokens stored securely in database
- **Calendar API Access**: Direct access to Google Calendar using user's OAuth tokens
- **Tasks API Access**: Direct access to Google Tasks using user's OAuth tokens
- **MCP Server Configuration**: Dynamically configures MCP server with user's Google tokens

### Security Features
- **Password Hashing**: bcrypt-based password hashing for email/password accounts
- **Session Expiration**: Automatic token refresh and session management for Google OAuth
- **Data Isolation**: User-specific chat sessions and message history
- **Secure Cookies**: HTTPOnly and secure cookie configuration
- **CSRF Protection**: Built-in CSRF protection via session middleware

### User Experience
- **Dual Authentication**: Users can choose between email/password or Google OAuth
- **Google Service Integration**: When users login with Google, their Calendar and Tasks are automatically accessible
- **Automatic Redirects**: Seamless redirect to intended page after login
- **Loading States**: Smooth loading indicators during authentication
- **Error Handling**: Clear error messages and fallback behaviors
- **Logout Flow**: Clean logout with proper session cleanup