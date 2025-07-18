# AI Agent Chatbot Framework

## Overview

This is a production-ready AI agent chatbot framework built with React frontend and Node.js backend, now powered by Azure OpenAI through LangChain. The system enables real-time, bidirectional streaming communication between users and AI agents through WebSocket connections. The framework provides full conversation history, context awareness, and graceful fallback handling.

**Latest Update (July 14, 2025 - 11:51 PM):** Removed Deprecated Code and Simplified Architecture:
- **Deprecated Files Removed**: Cleaned up 12 unused files including old MCP implementations and multi-agent systems
  - Removed: mcpGoogleCalendar.ts, mcpClient.ts, mcpGoogleServer.ts, mcpServer.ts, mcpServerNew.ts, mcpServerRunner.ts
  - Removed: directAzureTest.ts, intelligentAgent.ts, multiAgent.ts, multiAgentRefactored.ts, multiAgentOrchestrator.ts
- **Simplified Agent Service**: Streamlined to use only OpenAI Assistant with Azure OpenAI fallback
  - Removed complex fallback chains and deprecated service references
  - Cleaner code with better maintainability
- **Environment Variables**: Created .env configuration for all secrets and API keys
  - Added dotenv support with .env.example template
  - Enhanced security with proper .gitignore configuration

**Previous Update (July 14, 2025 - 11:33 PM):** Enhanced Schedule Formatting and Duplicate Prevention:
- **Consistent Schedule Template**: Created standardized formatting for all schedule summaries
  - Calendar events grouped by date with "Today", "Tomorrow" or full date headers
  - Tasks organized by priority levels (High/Medium/Low) with color-coded emoji indicators
  - Each item shows: Title | Time/Due Date | Location/List Name
  - Summary section shows total events and pending tasks
- **Improved Duplicate Detection**: Enhanced message deduplication using content-based hashing
  - Changed from timestamp-based to content hash-based duplicate detection
  - Added 5-second retention window to catch late duplicate messages
  - Uses first 20 chars of base64 content hash for efficient comparison
- **OpenAI Assistant Instructions**: Updated with precise formatting template
  - Strict formatting rules for consistent output structure
  - Clear date formatting guidelines (relative dates for today/tomorrow)
  - Pipe-separated fields with consistent emoji usage

**Previous Update (July 14, 2025 - 11:24 PM):** Fixed Duplicate Message Streaming Issue:
- **Problem Identified**: WebSocket messages were being processed twice, causing duplicated words in output
- **Root Cause**: Client sending duplicate messages with slightly different timestamps
- **Solution Implemented**: Added message deduplication mechanism using unique message keys
- **Technical Details**: 
  - Tracks active messages using sessionId + content + timestamp as unique key
  - Prevents duplicate processing by checking if message is already being handled
  - Cleans up tracking map after message processing completes
- **Result**: Output no longer shows duplicated words like "This This Week's Week's Events"

**Previous Update (July 14, 2025 - 11:20 PM):** Fixed Critical OpenAI SDK Parameter Issues:
- **Root Cause Identified**: OpenAI SDK methods require different parameter signatures than documented
- **Fixed runs.retrieve**: Changed from `retrieve(threadId, runId)` to `retrieve(runId, { thread_id: threadId })`
- **Fixed submitToolOutputs**: Changed from `submitToolOutputs(runId, threadId, params)` to `submitToolOutputs(runId, { thread_id: threadId, tool_outputs })`
- **Comprehensive Fix**: Corrected all 4 occurrences throughout openaiAssistant.ts
- **Result**: OpenAI Assistant now successfully executes all 17 granular MCP tools for Google Calendar and Tasks
- **Technical Insight**: SDK source code analysis revealed the actual method signatures differ from OpenAI documentation

**Previous Update (July 13, 2025):** Successfully implemented and tested complete Multi-Agent System:

**Bug Fix (July 13, 2025 - 9:16 PM):** Fixed schedule query handling issue:
- Fixed incorrect task creation when user asks "What do I need to do this week"
- Added proper detection for schedule-related queries (e.g., "what do I need to do", "what's on my", "my schedule")
- Updated formatter to handle both initial summaries and regular schedule requests
- System now correctly fetches calendar events and tasks when user asks about their schedule
- Renamed `formatInitialSummary` to `formatScheduleResponse` for broader usage

**Major Refactor (July 13, 2025 - 9:20 PM):** Removed hardcoded action routing:
- **Intelligent Tool Usage**: AI agent now always has access to all tools and decides when to use them
- **Removed Hardcoded Logic**: Eliminated all hardcoded action detection and manual tool call creation
- **Enhanced System Prompt**: Updated prompt to guide AI on intelligent tool selection based on user intent
- **Simplified Architecture**: Cleaned up over 200 lines of redundant hardcoded logic
- **Better User Experience**: AI can now handle complex requests requiring multiple tools automatically

**Dynamic Language Detection (July 13, 2025 - 9:31 PM):** Summary Agent Multi-Language Support:
- **Automatic Language Detection**: Summary Agent now detects language from user's input
- **Multi-Language Support**: Supports Korean, Japanese, Chinese, and English
- **Dynamic Formatting**: All headers, dates, and recommendations adapt to detected language
- **Smart Detection**: Uses character pattern matching to identify language
- **Fixed Tool Binding**: Corrected Azure OpenAI tool binding to use proper invoke parameters

**Major Refactor (July 13, 2025 - 10:16 PM):** Removed hardcoded action routing:
- **Intelligent Tool Usage**: AI agent now always has access to all tools and decides when to use them
- **Removed Hardcoded Logic**: Eliminated all hardcoded action detection and manual tool call creation
- **Enhanced System Prompt**: Updated prompt to guide AI on intelligent tool selection based on user intent
- **Simplified Architecture**: Cleaned up over 200 lines of redundant hardcoded logic
- **Better User Experience**: AI can now handle complex requests requiring multiple tools automatically

**Bug Fix (July 13, 2025 - 10:16 PM):** Fixed task organization by list vs priority:
- **Task List Organization**: Added detection for "by list" or "organized by list" in user requests
- **Summary Agent Enhancement**: Updated Summary Agent to accept original user request for context
- **Dynamic Organization**: System now organizes tasks by their actual Google Task lists when requested
- **Priority Fallback**: Maintains priority-based organization as default for "all tasks" requests
- **List Headers**: Shows proper task list names (Book, 주문목록, 한국, Grocery, 기백 To Do, etc.)
- **Fixed Tool Schema**: Removed default "@default" value from get_tasks tool that was forcing single list
- **Multi-List Support**: Now correctly fetches from all 6 task lists instead of just default
- **Context Passing**: All Summary Agent calls now pass original user request for better organization detection
- **Direct Azure OpenAI**: Regular chat messages now use direct Azure OpenAI without complex tool binding
- **Schedule Detection**: System detects schedule-related keywords and routes to Multi-Agent Orchestrator
- **Smart Routing**: Schedule/calendar/task requests use appropriate tools, other messages use simple chat
- **Fixed Import Error**: Added missing AIMessage import in agent.ts
- **Fixed Raw Data Output**: Aggregator now uses Summary Agent to format all calendar/task data
- **Dynamic Time Ranges**: Supports week, today, tomorrow, month based on user request
- **Localized Formatting**: All time ranges properly formatted in detected language
- **Task Priority Organization**: When user asks for "all tasks", system shows tasks organized by priority (High/Medium/Low)
- **Task-Only Requests**: Fixed issue where task-only requests were showing calendar headers
- **Priority Detection**: System detects "all" keyword with tasks to enable priority-based organization
- **Fixed Variable Reference**: Corrected calendarEvents undefined error by using calendarData parameter
- **All Tasks Retrieval**: Fixed issue where only default task list was being fetched
- **Multi-List Support**: System now fetches tasks from all task lists when no specific list is specified
- **Priority Inference**: Added intelligent priority detection based on task titles (moved inline to fix context issues)
- **Task List Information**: Tasks now include task list ID and title for better organization
- **Context Fix**: Resolved `this.inferPriorityFromTitle` undefined error by moving logic inline
- **Reduced Timeouts**: Set 15-second timeout for regular chat messages with single retry
- **Fallback Strategy**: Life Manager system remains as fallback for tool-required operations
- **Improved Performance**: Regular conversations no longer experience 60-second timeouts
- **Conversation History**: Maintains proper conversation context across messages
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
- **OpenAI Assistant API**: Primary AI system using OpenAI's Assistant API with function calling
- **17 Granular MCP Tools**: Comprehensive tool set for Google Calendar and Tasks:
  - Calendar: get_calendar_events, get_today_events, get_this_week_events, get_this_month_events, get_this_year_events, create_calendar_event, list_calendars
  - Tasks: get_task_lists, get_all_tasks, get_tasks_from_list, get_high_priority_tasks, get_overdue_tasks, get_tasks_due_today, get_tasks_due_this_week, create_task, complete_task, delete_task
- **Dynamic Tool Execution**: Assistant autonomously selects and executes appropriate tools based on user intent
- **Thread Management**: Persistent conversation threads with proper session isolation
- **Concurrent Request Handling**: Race condition protection for thread creation and active runs
- **Fallback System**: Azure OpenAI for simple chat when OpenAI Assistant is unavailable
- **Real Google Data**: When users authenticate with Google OAuth, system uses real Calendar/Tasks data
- **Conversation History**: Per-session conversation context maintained across interactions
- **Streaming Response**: Token-by-token response delivery for natural interaction

### MCP Tool Integration
- **Unified MCP Server**: Single server (mcpUnified.ts) handles both Calendar and Tasks APIs
- **MCPToolAdapter**: Converts MCP capabilities into LangChain-compatible DynamicStructuredTools
- **17 Granular Tools**: Specialized tools for every calendar and task operation
- **Automatic Tool Selection**: OpenAI Assistant autonomously chooses appropriate tools based on user requests
- **Structured Response Formatting**: ScheduleFormatter service ensures consistent markdown formatting
- **Real-time Data**: Direct integration with Google Calendar and Tasks APIs when user is authenticated
- **Mock Data Fallback**: Development mode with realistic test data when Google APIs unavailable

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

## Environment Variables Setup

### Required Environment Variables

The application uses environment variables for configuration. Copy `.env.example` to `.env` and fill in your actual values:

```bash
cp .env.example .env
```

#### Essential Variables:
- **DATABASE_URL**: PostgreSQL connection string (provided by Replit)
- **OPENAI_API_KEY**: Required for OpenAI Assistant functionality
- **GOOGLE_CLIENT_ID**: Required for Google OAuth login
- **GOOGLE_CLIENT_SECRET**: Required for Google OAuth login
- **SESSION_SECRET**: Secret key for session encryption (generate a random string)

#### Optional Variables:
- **AZURE_OPENAI_***: Azure OpenAI configuration (if using Azure fallback)
- **REPLIT_DOMAINS**: Automatically set by Replit
- **NODE_ENV**: Set to "development" or "production"
- **PORT**: Server port (defaults to 5000)

### Security Notes:
- Never commit your `.env` file to version control
- Use strong, random values for SESSION_SECRET
- Keep your API keys secure and rotate them regularly
- The `.env` file is already added to `.gitignore`

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