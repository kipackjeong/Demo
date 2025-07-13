import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:5000/chat-ws');

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  
  // Send initial message that should trigger summary
  const message = {
    type: 'user_message',
    content: '[INITIAL_SUMMARY] Please provide me with a concise weekly summary in markdown format showing my calendar events and tasks.',
    sessionId: 'test_session_' + Date.now(),
    timestamp: new Date().toISOString(),
    userId: 1
  };
  
  console.log('Sending message:', JSON.stringify(message, null, 2));
  ws.send(JSON.stringify(message));
});

let fullResponse = '';

ws.on('message', (data) => {
  try {
    const response = JSON.parse(data);
    
    // Log all message types for debugging
    if (response.type !== 'agent_response') {
      console.log('\n=== Received message type:', response.type, '===');
    }
    
    if (response.type === 'agent_response' && response.content) {
      // Don't log each word, just accumulate
      fullResponse += response.content;
    }
    
    if (response.type === 'action_buttons') {
      console.log('\n=== Action Buttons ===');
      console.log(JSON.stringify(response.buttons, null, 2));
    }
    
    if (response.type === 'done') {
      console.log('\n=== Full Initial Summary ===');
      console.log(fullResponse);
      console.log('\n=== Summary complete ===');
      // Don't close immediately, wait for action buttons
      setTimeout(() => {
        ws.close();
        process.exit(0);
      }, 2000);
    }
  } catch (error) {
    console.error('Error parsing message:', error);
    console.error('Raw data:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Disconnected from WebSocket server');
  process.exit(0);
});