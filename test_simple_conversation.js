import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:5000/chat-ws', {
  handshakeTimeout: 10000,
  maxPayload: 10 * 1024 * 1024 // 10MB
});

const sessionId = 'test_session_' + Date.now();
let conversationStep = 0;
let responses = [];

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  console.log('Session ID:', sessionId);
  
  // Step 1: Ask a simple question
  sendMessage("What's the weather today?");
});

ws.on('message', (data) => {
  try {
    const response = JSON.parse(data);
    
    if (response.type === 'connected') {
      console.log('✓ Connected to server');
    } else if (response.type === 'typing') {
      console.log('✓ Server is typing...');
    } else if (response.type === 'agent_response' && response.content) {
      // Skip individual words, just accumulate
      if (!responses[conversationStep]) {
        responses[conversationStep] = '';
      }
      responses[conversationStep] += response.content;
    } else if (response.type === 'done') {
      console.log('\n=== Response ' + (conversationStep + 1) + ' complete ===');
      console.log('Response:', responses[conversationStep]);
      
      conversationStep++;
      
      if (conversationStep === 1) {
        // Step 2: Ask a follow-up that requires context
        console.log('\n\n--- Sending follow-up message ---');
        setTimeout(() => {
          sendMessage("Is it good for outdoor activities?");
        }, 1000);
      } else if (conversationStep === 2) {
        // Test complete
        console.log('\n\n=== TEST COMPLETE ===');
        console.log('\nConversation Summary:');
        console.log('User: "What\'s the weather today?"');
        console.log('AI:', responses[0]);
        console.log('\nUser: "Is it good for outdoor activities?"');
        console.log('AI:', responses[1]);
        console.log('\nIf the AI understood the context (weather) in the second response, conversation state is maintained.');
        console.log('If the AI asked "What activities?" or similar, conversation state is NOT maintained.');
        setTimeout(() => {
          ws.close();
          process.exit(0);
        }, 1000);
      }
    } else if (response.type === 'error') {
      console.error('❌ Error:', response.content);
      ws.close();
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
  process.exit(0);
});