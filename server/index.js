// index.js
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import handleSSHSession from './controllers/sshController.js';
import apiRoutes from './routes/index.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// REST API routes
app.use('/api', apiRoutes);

// Socket.IO SSH handling
io.on('connection', (socket) => {
  console.log('🔌 WebSocket client connected');
  handleSSHSession(socket);
});

// Server startup
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});