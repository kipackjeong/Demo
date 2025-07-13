import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:5000/chat-ws', {
  handshakeTimeout: 10000,
  maxPayload: 10 * 1024 * 1024 // 10MB
});

const sessionId = 'test_session_' + Date.now();
let fullResponse = '';

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  console.log('Session ID:', sessionId);
  
  // Send task creation request
  sendMessage("Tomorrow, I have to call doctor's office to book appointment");
});

ws.on('message', (data) => {
  try {
    const response = JSON.parse(data);
    
    if (response.type === 'connected') {
      console.log('✓ Connected to server');
    } else if (response.type === 'typing') {
      console.log('✓ Server is typing...');
    } else if (response.type === 'agent_response' && response.content) {
      fullResponse += response.content;
    } else if (response.type === 'done') {
      console.log('\n=== Task Creation Complete ===');
      console.log('Response:', fullResponse);
      console.log('\n✓ Task creation test completed successfully');
      
      setTimeout(() => {
        ws.close();
        process.exit(0);
      }, 1000);
    } else if (response.type === 'error') {
      console.error('❌ Error:', response.content);
      ws.close();
      process.exit(1);
    }
  } catch (error) {
    console.error('Error parsing message:', error.message);
  }
});

function sendMessage(content) {
  const message = {
    type: 'user_message',
    content: content,
    sessionId: sessionId,
    timestamp: new Date().toISOString(),
    userId: 1
  };
  
  console.log('Sending message:', content);
  ws.send(JSON.stringify(message));
}

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`\nWebSocket closed with code ${code}${reason ? ': ' + reason : ''}`);
  
  if (code !== 1000 && code !== 1005) {
    console.error('❌ Abnormal closure');
    process.exit(1);
  }
});

// Add timeout for the test
setTimeout(() => {
  console.error('❌ Test timed out after 70 seconds');
  ws.close();
  process.exit(1);
}, 70000);