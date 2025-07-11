import fetch from 'node-fetch';

export async function testDirectAzureOpenAI() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-01";

  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deploymentName.trim()}/chat/completions?api-version=${apiVersion}`;
  
  console.log("Testing direct Azure OpenAI connection...");
  console.log("URL:", url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey || '',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, this is a test message.' }
        ],
        max_tokens: 100,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log("✓ Direct Azure OpenAI test successful!");
      console.log("Response:", data.choices[0].message.content);
      return data.choices[0].message.content;
    } else {
      console.error("✗ Direct Azure OpenAI test failed:", data);
      return null;
    }
  } catch (error) {
    console.error("✗ Direct Azure OpenAI test error:", error);
    return null;
  }
}