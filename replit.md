# AI Agent Chatbot Framework

## Overview

This is a modular, production-ready AI agent chatbot framework built with React frontend and Node.js backend. The system enables real-time, bidirectional streaming communication between users and AI agents through WebSocket connections. The framework is designed to be extensible and can be adapted for various AI agent implementations.

## User Preferences

Preferred communication style: Simple, everyday language.

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

## Key Components

### Real-Time Communication
- **WebSocket Server**: Handles persistent connections at `/ws` endpoint
- **Message Streaming**: Token-by-token response streaming for natural conversation flow
- **Connection Management**: Automatic reconnection and error handling
- **Session Management**: Persistent chat sessions with unique identifiers

### AI Agent Integration
- **Agent Service**: Modular service for AI response generation
- **Response Selection**: Keyword-based response matching (extensible to LLM integration)
- **Streaming Response**: Character-by-character response delivery
- **Context Awareness**: Session-based conversation context

### User Interface
- **Chat Interface**: Clean, modern chat UI with message bubbles
- **Typing Indicators**: Visual feedback during response generation
- **Theme Support**: Light/dark mode with persistent preferences
- **Responsive Design**: Mobile-first approach with desktop optimization
- **Accessibility**: ARIA labels and keyboard navigation support

### State Management
- **React State**: Component-level state for UI interactions
- **Custom Hooks**: Reusable hooks for WebSocket, theme, and mobile detection
- **Session Storage**: Browser storage for theme and session preferences

## Data Flow

1. **User Input**: User types message in chat interface
2. **WebSocket Transmission**: Message sent to server via WebSocket
3. **Session Management**: Server creates/retrieves chat session
4. **Message Storage**: User message stored in database
5. **Agent Processing**: AI agent generates response based on input
6. **Streaming Response**: Response streamed back token-by-token
7. **UI Update**: Frontend updates chat interface in real-time
8. **Message Persistence**: Complete response stored in database

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