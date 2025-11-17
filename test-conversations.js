// Simple test to check Facebook conversations
async function testFacebookConversations() {
  try {
    const response = await fetch('/api/facebook/conversations');
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error('Failed to fetch conversations:', response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('Conversations data:', data);
    
    if (data.conversations && data.conversations.length > 0) {
      console.log(`Found ${data.conversations.length} conversations`);
      
      // Test fetching messages for the first conversation
      const firstConversation = data.conversations[0];
      console.log('Testing first conversation:', firstConversation.id);
      
      const messagesResponse = await fetch(`/api/facebook/conversations/${firstConversation.id}/messages`);
      console.log('Messages response status:', messagesResponse.status);
      
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        console.log('Messages data:', messagesData);
      } else {
        console.error('Failed to fetch messages:', messagesResponse.statusText);
      }
    } else {
      console.log('No conversations found');
    }
  } catch (error) {
    console.error('Error testing conversations:', error);
  }
}

// Run the test
testFacebookConversations();