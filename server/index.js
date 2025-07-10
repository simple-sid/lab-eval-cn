// index.js
import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import apiRoutes from './routes/index.js';
import { initSSHWebSocket } from './controllers/sshController.js';
import { connectDB, disconnectDB } from './utils/db.js'; 

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
// Make sure path is absolute to avoid any path resolution issues
app.use(express.static(path.join(process.cwd(), 'public')));
// Explicitly serve uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// REST API routes
app.use('/api', apiRoutes);

// Initialize SSH WebSocket handler (handles /ws/ssh upgrades)
initSSHWebSocket(server);

// Graceful shutdown handler for DB
process.on('SIGINT', async () => {
  console.log('\nCaught SIGINT, shutting down...');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nCaught SIGTERM, shutting down...');
  await disconnectDB();
  process.exit(0);
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});