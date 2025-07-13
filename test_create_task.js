import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:5000/chat-ws');

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  
  const message = {
    type: 'user_message',
    content: 'create a task: Something is wrong here',
    sessionId: `test_session_${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: 1
  };
  
  console.log('Sending message:', message);
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  
  console.log('\n=== Received response ===');
  console.log('Type:', response.type);
  
  if (response.type === 'agent_response') {
    console.log('Content:', response.content);
  }
  
  if (response.type === 'done') {
    console.log('\n=== Full conversation complete ===');
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('WebSocket connection closed');
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\n=== Timeout reached ===');
  ws.close();
  process.exit(0);
}, 30000);