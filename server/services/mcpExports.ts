// Export the unified MCP server with backwards compatibility names
// This file provides a central place for all MCP-related exports

export { mcpUnifiedServer } from './mcpUnified.js';
export { mcpUnifiedServer as mcpServer } from './mcpUnified.js';
export { mcpUnifiedServer as mcpServerNew } from './mcpUnified.js';
export { MCPUnifiedServer } from './mcpUnified.js';

// Re-export types
export type { CalendarEvent, Task } from './mockDataStore.js';