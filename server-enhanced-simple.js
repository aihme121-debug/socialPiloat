const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '7070', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let io = null;
let connectionCount = 0;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7070',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  console.log('Socket.io server initialized');

  io.on('connection', (socket) => {
    connectionCount++;
    console.log('User connected:', socket.id, 'Total connections:', connectionCount);

    socket.on('join-conversation', (conversationId) => {
      socket.join(conversationId);
      console.log(`User ${socket.id} joined conversation ${conversationId}`);
    });

    socket.on('leave-conversation', (conversationId) => {
      socket.leave(conversationId);
      console.log(`User ${socket.id} left conversation ${conversationId}`);
    });

    socket.on('typing', ({ conversationId, userId, isTyping }) => {
      socket.to(conversationId).emit('user-typing', { userId, isTyping });
    });

    socket.on('message-read', ({ conversationId, messageId, userId }) => {
      socket.to(conversationId).emit('message-read-status', { messageId, userId });
    });

    socket.on('disconnect', (reason) => {
      connectionCount--;
      console.log('User disconnected:', socket.id, 'Reason:', reason, 'Total connections:', connectionCount);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.io
  initializeSocket(server);

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> ✅ Ready on http://${hostname}:${port}`);
      console.log(`> 📡 Socket.io server integrated`);
      console.log(`> 🔧 Enhanced monitoring active`);
    });
}).catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});