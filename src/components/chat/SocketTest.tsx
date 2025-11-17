'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function SocketTest() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setMessages(prev => [...prev, 'Connected to server']);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      setMessages(prev => [...prev, 'Disconnected from server']);
    });

    socketInstance.on('test-message', (data) => {
      setMessages(prev => [...prev, `Received: ${data.message}`]);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const sendTestMessage = () => {
    if (socket) {
      socket.emit('test-message', { message: 'Hello from client!' });
      setMessages(prev => [...prev, 'Sent: Hello from client!']);
    }
  };

  const joinTestConversation = () => {
    if (socket) {
      socket.emit('join-conversation', 'test-conversation');
      setMessages(prev => [...prev, 'Joined test conversation']);
    }
  };

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="font-semibold mb-2">Socket.io Test</h3>
      <div className="mb-2">
        Status: <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={sendTestMessage}
          disabled={!isConnected}
          className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Send Test Message
        </button>
        
        <button
          onClick={joinTestConversation}
          disabled={!isConnected}
          className="px-3 py-1 bg-green-500 text-white rounded disabled:opacity-50"
        >
          Join Test Conversation
        </button>
      </div>
      
      <div className="bg-white p-2 rounded border max-h-40 overflow-y-auto">
        <h4 className="font-medium mb-1">Messages:</h4>
        {messages.map((msg, index) => (
          <div key={index} className="text-sm text-gray-600 mb-1">
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}