import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:5000/chat-ws', {
  // Add some WebSocket options to prevent early closure
  handshakeTimeout: 10000,
  maxPayload: 10 * 1024 * 1024 // 10MB
});

let messageCount = 0;
let fullResponse = '';

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
  
  console.log('Sending initial summary request...');
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  try {
    messageCount++;
    const response = JSON.parse(data);
    
    if (response.type === 'connected') {
      console.log('✓ Connected to server');
    } else if (response.type === 'typing') {
      console.log('✓ Server is typing...');
    } else if (response.type === 'agent_response') {
      // Just accumulate the response, don't log each word
      if (response.content) {
        fullResponse += response.content;
      }
    } else if (response.type === 'done') {
      console.log('\n✓ Response complete!');
      console.log('\n=== FULL INITIAL SUMMARY ===\n');
      console.log(fullResponse);
      console.log('\n=== END OF SUMMARY ===');
      console.log(`\nTotal messages received: ${messageCount}`);
      console.log(`Total response length: ${fullResponse.length} characters`);
      
      // Wait a bit then close
      setTimeout(() => {
        ws.close();
      }, 1000);
    } else if (response.type === 'action_buttons') {
      console.log('\n✓ Action buttons received:');
      response.buttons.forEach(btn => {
        console.log(`  - ${btn.label}`);
      });
    } else if (response.type === 'error') {
      console.error('❌ Error:', response.content);
      ws.close();
    }
  } catch (error) {
    console.error('Error parsing message:', error.message);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`\nWebSocket closed with code ${code}${reason ? ': ' + reason : ''}`);
  process.exit(0);
});