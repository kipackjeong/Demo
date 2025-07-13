const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:5000/chat-ws');
let messageReceived = false;

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  
  // Send test message
  const message = {
    type: 'user_message',
    content: '[INITIAL_SUMMARY] Please provide me with a concise weekly summary in markdown format showing my calendar events and tasks.',
    sessionId: 'test_session_' + Date.now(),
    timestamp: new Date().toISOString(),
    userId: 1
  };
  
  console.log('Sending initial summary request...');
  ws.send(JSON.stringify(message));
  
  // Set a timeout to close connection after 20 seconds
  setTimeout(() => {
    if (!messageReceived) {
      console.log('\nTimeout: No complete response received after 20 seconds');
    }
    ws.close();
    process.exit(0);
  }, 20000);
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.type === 'connected') {
    console.log('Received connection confirmation');
  } else if (message.type === 'agent_response') {
    process.stdout.write(message.content);
  } else if (message.type === 'done') {
    messageReceived = true;
    console.log('\n\nResponse completed successfully.');
    ws.close();
    process.exit(0);
  } else if (message.type === 'typing') {
    console.log('Agent is typing...');
  } else if (message.type === 'error') {
    console.error('\nError:', message.error);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\nWebSocket connection closed');
});