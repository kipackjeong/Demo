import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:5000/chat-ws');

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  
  // Send a message with detailed task information
  const message = {
    type: 'user_message',
    content: 'Create a task called "Fix login button issue" in the "Work Projects" list with high priority',
    sessionId: 'test_session_' + Date.now(),
    timestamp: new Date().toISOString(),
    userId: 1
  };
  
  console.log('Sending message:', JSON.stringify(message, null, 2));
  ws.send(JSON.stringify(message));
});

let fullResponse = '';

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('\n=== Received response ===');
  console.log('Type:', response.type);
  
  if (response.type === 'agent_response' && response.content) {
    console.log('Content:', response.content);
    fullResponse += response.content;
  }
  
  if (response.type === 'done') {
    console.log('\n=== Full Response ===');
    console.log(fullResponse);
    console.log('\n=== Full conversation complete ===');
    ws.close();
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Disconnected from WebSocket server');
  process.exit(0);
});