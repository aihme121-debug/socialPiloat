const io = require('socket.io-client');

console.log('Testing Socket.io connection and real-time messaging...');

// Test socket connection
const socket = io('http://localhost:3002', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('✅ Successfully connected to socket server:', socket.id);
  
  // Test joining a conversation
  const conversationId = 'mock_conversation_1';
  socket.emit('join-conversation', conversationId);
  console.log('📨 Joined conversation:', conversationId);
  
  // Test sending a message
  const testMessage = {
    id: 'test-' + Date.now(),
    conversationId: conversationId,
    senderId: 'test-user',
    senderName: 'Test User',
    content: 'Hello from test script!',
    timestamp: new Date().toISOString(),
    status: 'sent',
    isRead: false
  };
  
  console.log('📤 Sending test message:', testMessage.content);
  socket.emit('send-message', testMessage);
  
  // Test receiving messages
  socket.on('receive-message', (data) => {
    console.log('📥 Received message:', data.content, 'from', data.senderName);
  });
  
  socket.on('new-message', (data) => {
    console.log('📨 New message event:', data.content, 'from', data.senderName);
  });
  
  // Simulate incoming message after 3 seconds
  setTimeout(() => {
    const incomingMessage = {
      id: 'incoming-' + Date.now(),
      conversationId: conversationId,
      senderId: 'customer_1',
      senderName: 'John Doe',
      content: 'This is a simulated incoming message from John!',
      timestamp: new Date().toISOString(),
      status: 'delivered',
      isRead: false
    };
    
    console.log('🔄 Simulating incoming message from John Doe...');
    socket.emit('send-message', incomingMessage);
  }, 3000);
  
  // Test typing indicator
  setTimeout(() => {
    console.log('⌨️  Simulating typing indicator...');
    socket.emit('typing', {
      conversationId: conversationId,
      userId: 'customer_1',
      isTyping: true
    });
    
    setTimeout(() => {
      socket.emit('typing', {
        conversationId: conversationId,
        userId: 'customer_1',
        isTyping: false
      });
    }, 2000);
  }, 5000);
  
  // Test message status updates
  setTimeout(() => {
    console.log('✉️  Testing message status updates...');
    socket.emit('message-read', {
      conversationId: conversationId,
      messageId: 'test-message-1',
      userId: 'customer_1'
    });
  }, 7000);
  
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from socket server');
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket connection error:', error.message);
  console.log('💡 Make sure the Socket.io server is running on port 3002');
  process.exit(1);
});

socket.on('user-typing', (data) => {
  console.log('⌨️  User typing:', data.userId, data.isTyping ? 'is typing' : 'stopped typing');
});

socket.on('message-sent', (data) => {
  console.log('✅ Message sent confirmation:', data.messageId, 'status:', data.status);
});

socket.on('message-delivered-status', (data) => {
  console.log('📨 Message delivered:', data.messageId);
});

socket.on('message-read-status', (data) => {
  console.log('👁️  Message read:', data.messageId, 'by user:', data.userId);
});

// Keep the script running for 10 seconds to see all events
setTimeout(() => {
  console.log('🏁 Test completed. Disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 10000);