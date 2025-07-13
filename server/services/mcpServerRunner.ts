#!/usr/bin/env node

import { googleMCPServer } from './mcpGoogleServer.js';

// Start the MCP server
async function main() {
  try {
    // Configure with environment variables or command line args if needed
    const credentials = {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || '/api/auth/google/callback',
    };

    // Start the server
    await googleMCPServer.start();
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

main();