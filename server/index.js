// index.js
import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/index.js';
import { initSSHWebSocket } from './controllers/sshController.js';
import { connectDB, disconnectDB } from './utils/db.js'; // ✅ Import the DB connection

dotenv.config();

// Connect to MongoDB
connectDB(); // ✅ Establish the connection before starting the server

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(express.json());

// REST API routes
app.use('/api', apiRoutes);

// Initialize SSH WebSocket handler (handles /ws/ssh upgrades)
initSSHWebSocket(server);

// Graceful shutdown handler for DB
process.on('SIGINT', async () => {
  console.log('\n🛑 Caught SIGINT, shutting down...');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Caught SIGTERM, shutting down...');
  await disconnectDB();
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});