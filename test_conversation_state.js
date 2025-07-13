import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:5000/chat-ws', {
  handshakeTimeout: 10000,
  maxPayload: 10 * 1024 * 1024 // 10MB
});

const sessionId = 'test_session_' + Date.now();
let messageCount = 0;
let conversationStep = 0;

ws.on('open', () => {
  console.log('Connected to WebSocket server');
  console.log('Session ID:', sessionId);
  
  // Step 1: User asks about doctor appointment
  sendMessage("I need to call to make a doctor appointment tomorrow morning.");
});

ws.on('message', (data) => {
  try {
    messageCount++;
    const response = JSON.parse(data);
    
    if (response.type === 'connected') {
      console.log('✓ Connected to server');
    } else if (response.type === 'typing') {
      console.log('✓ Server is typing...');
    } else if (response.type === 'agent_response' && response.content) {
      // Skip individual words, just wait for done
    } else if (response.type === 'done') {
      console.log('\n=== Response ' + (conversationStep + 1) + ' complete ===');
      console.log('Full response:', response.fullResponse);
      
      conversationStep++;
      
      if (conversationStep === 1) {
        // Step 2: User says "Yes please" in response to agent's question
        console.log('\n\n--- Sending follow-up message ---');
        setTimeout(() => {
          sendMessage("Yes please");
        }, 1000);
      } else if (conversationStep === 2) {
        // Test complete
        console.log('\n\n=== TEST COMPLETE ===');
        console.log('The agent should have remembered the context about the doctor appointment.');
        console.log('If the agent asked "Could you clarify your request?", then conversation state is NOT maintained.');
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