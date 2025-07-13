import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:5000/chat-ws');

ws.on('open', function open() {
  console.log('Connected to WebSocket server');
  
  // Send initial summary request
  const message = {
    type: 'user_message',
    content: '[INITIAL_SUMMARY] Please provide me with a concise weekly summary in markdown format showing my calendar events and tasks.',
    sessionId: 'test_session_' + Date.now(),
    timestamp: new Date().toISOString(),
    userId: 1
  };
  
  console.log('Sending message:', message);
  ws.send(JSON.stringify(message));
});

ws.on('message', function message(data) {
  try {
    const response = JSON.parse(data);
    console.log('\n=== Received response ===');
    console.log('Type:', response.type);
    if (response.content) {
      console.log('Content:', response.content);
    }
    if (response.type === 'response_complete') {
      console.log('\n=== Full message received ===');
      ws.close();
    }
  } catch (e) {
    console.log('Raw message:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('Disconnected from WebSocket server');
  process.exit(0);
});

// Keep the connection alive
setTimeout(() => {
  console.log('Timeout reached, closing connection');
  ws.close();
  process.exit(0);
}, 30000);