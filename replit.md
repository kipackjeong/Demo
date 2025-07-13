# AI Agent Chatbot Framework

## Overview

This is a production-ready AI agent chatbot framework built with React frontend and Node.js backend, now powered by Azure OpenAI through LangChain. The system enables real-time, bidirectional streaming communication between users and AI agents through WebSocket connections. The framework provides full conversation history, context awareness, and graceful fallback handling.

**Latest Update (July 13, 2025):** Now features Model Context Protocol (MCP) integration with Google Calendar and Google Tasks APIs, allowing the AI to interact with real Google services instead of mock data. Added seamless Replit OAuth authentication with protected chat interface and user-specific data isolation.

## User Preferences

- Preferred communication style: Simple, everyday language.
- Initial AI greeting: Concise markdown-formatted weekly summary with Calendar, Tasks, and Recommendations sections
- Regular conversations: Natural language without markdown formatting
- Authentication: Seamless Replit OAuth integration with protected chat interface

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
- **Authentication Tables**: Session storage and user management for Replit OAuth
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
- **Authentication Flow**: Seamless Replit OAuth with landing and home pages
- **Protected Chat Interface**: Clean, modern chat UI with message bubbles
- **User Dashboard**: Personalized home page with quick actions and user profile
- **Landing Page**: Marketing page with feature highlights for unauthenticated users
- **Typing Indicators**: Visual feedback during response generation
- **Theme Support**: Light/dark mode with persistent preferences
- **Responsive Design**: Mobile-first approach with desktop optimization
- **Accessibility**: ARIA labels and keyboard navigation support

### State Management
- **React State**: Component-level state for UI interactions
- **Custom Hooks**: Reusable hooks for WebSocket, theme, and mobile detection
- **Session Storage**: Browser storage for theme and session preferences

## Data Flow

1. **User Authentication**: User signs in via Replit OAuth
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
- `GOOGLE_CALENDAR_REFRESH_TOKEN`: Refresh token for Google Calendar API access
- `GOOGLE_TASKS_REFRESH_TOKEN`: Refresh token for Google Tasks API access

### Setup Instructions
1. Visit `/google-setup` page in the application for step-by-step setup
2. Follow the automated OAuth flow to obtain refresh tokens
3. Add tokens to your environment variables
4. Test the connection using the built-in test endpoint

### API Architecture
```
User Request → WebSocket → Multi-Agent System → MCP Server → Google APIs
```

The system automatically falls back to mock data when Google APIs are unavailable, ensuring consistent functionality during development and testing.

## Authentication System

### Replit OAuth Integration
- **Seamless Login**: One-click authentication with Replit accounts
- **Session Management**: Secure session storage with PostgreSQL backend
- **User Profiles**: Automatic user profile creation with email, name, and avatar
- **Protected Routes**: Chat interface and user-specific features require authentication
- **Landing Page**: Marketing page for unauthenticated users with feature highlights
- **User Dashboard**: Personalized home page with quick actions and user profile

### Security Features
- **Session Expiration**: Automatic token refresh and session management
- **Data Isolation**: User-specific chat sessions and message history
- **Secure Cookies**: HTTPOnly and secure cookie configuration
- **CSRF Protection**: Built-in CSRF protection via session middleware

### User Experience
- **Automatic Redirects**: Seamless redirect to intended page after login
- **Loading States**: Smooth loading indicators during authentication
- **Error Handling**: Clear error messages and fallback behaviors
- **Logout Flow**: Clean logout with proper session cleanup