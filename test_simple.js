import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:5000/chat-ws');
let allContent = '';

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
  
  console.log('Sending initial summary request...');
  ws.send(JSON.stringify(message));
});

ws.on('message', function message(data) {
  try {
    const response = JSON.parse(data);
    
    if (response.type === 'agent_response' && response.content) {
      allContent += response.content;
    }
    
    if (response.type === 'done') {
      console.log('\n=== FULL RESPONSE ===\n');
      console.log(allContent);
      console.log('\n=== END OF RESPONSE ===\n');
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
  console.log('\nWebSocket connection closed');
  process.exit(0);
});

// Keep the connection alive for 60 seconds
setTimeout(() => {
  console.log('\nTimeout reached, closing connection');
  ws.close();
  process.exit(0);
}, 60000);