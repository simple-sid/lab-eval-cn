import { Client } from 'ssh2';
import dotenv from 'dotenv';
dotenv.config();

const sessions = {}; // key: terminalId, value: { conn, stream }

export default function handleSSHSession(socket) {
  socket.on('submit-credentials', ({ terminalId, username, password }) => {
    if (!username || !password || !terminalId) {
      socket.emit('ssh-error', 'Missing credentials or terminal ID');
      return;
    }

    console.log(`[SSH] Attempting SSH connect for ${username}@${process.env.SSH_HOST}`);

    const conn = new Client();

    conn
      .on('ready', () => {
        console.log(`[SSH] Connected for terminal ${terminalId}`);

        conn.shell((err, stream) => {
          if (err) {
            socket.emit(`ssh-error-${terminalId}`, 'Shell error');
            return;
          }

          sessions[terminalId] = { conn, stream };

          stream.on('data', (data) => {
            socket.emit(`ssh-data-${terminalId}`, data.toString());
          });

          stream.stderr?.on('data', (data) => {
            socket.emit(`ssh-data-${terminalId}`, data.toString());
          });

          // Handle input to this terminal
          socket.on(`ssh-input-${terminalId}`, (data) => {
            stream.write(data);
          });

          // Resize handling
          socket.on(`resize-${terminalId}`, ({ cols, rows }) => {
            stream.setWindow(rows, cols, 600, 800);
          });

          // Clean up on terminal close
          socket.on(`close-terminal-${terminalId}`, () => {
            stream.end();
            conn.end();
            delete sessions[terminalId];
            socket.emit(`session-closed-${terminalId}`);
          });

          stream.on('close', () => {
            socket.emit(`session-closed-${terminalId}`);
          });
        });
      })
      .on('error', (err) => {
        console.error(`[SSH] Error for terminal ${terminalId}:`, err.message);
        socket.emit(`ssh-error-${socket.handshake.query.terminalId}`, `SSH Connection error: ${err.message}`);
      })
      .connect({
        host: process.env.SSH_HOST,
        port: parseInt(process.env.SSH_PORT),
        username,
        password,
      });
  });

  socket.on('disconnect', () => {
    for (const [terminalId, { conn }] of Object.entries(sessions)) {
      conn.end();
      delete sessions[terminalId];
    }
  });
}