# AI Agent Chatbot Framework

## Overview

This is a production-ready AI agent chatbot framework built with React frontend and Node.js backend, now powered by Azure OpenAI through LangChain. The system enables real-time, bidirectional streaming communication between users and AI agents through WebSocket connections. The framework provides full conversation history, context awareness, and graceful fallback handling.

**Latest Update (July 13, 2025):** Now features Model Context Protocol (MCP) integration with Google Calendar and Google Tasks APIs, allowing the AI to interact with real Google services instead of mock data. Implemented traditional email/password authentication with Google OAuth login option. Google OAuth now requests Calendar and Tasks permissions directly during login, storing tokens per user for secure multi-user access. Fixed fundamental authentication issue - system now works with just Google access token when refresh token is unavailable.

## User Preferences

- Preferred communication style: Simple, everyday language.
- Initial AI greeting: Concise markdown-formatted weekly summary with Calendar, Tasks, and Recommendations sections
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
- **Orchestration Agent**: Boss agent that analyzes user requests and routes to appropriate sub-agents
- **Google Calendar Agent**: Specialized agent for calendar management, scheduling, and appointments
- **Google Tasks Agent**: Specialized agent for task management, todos, and reminders
- **Intelligent Routing**: Smart decision-making to determine which agents are needed for each request
- **Coordinated Workflow**: Agents work together to provide comprehensive life management assistance
- **MCP Integration**: Model Context Protocol server connects agents to real Google Calendar and Tasks APIs
- **Fallback Handling**: Graceful fallback to mock data when Google APIs are unavailable

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