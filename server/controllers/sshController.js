import { WebSocketServer } from 'ws';
import { Client } from 'ssh2';
import fs from 'fs';
import url from 'url';
import dotenv from 'dotenv';
import Session from '../models/Session.js';
import { createContainerForUser } from '../docker/dockerManager.js';

dotenv.config();

const sessions = {}; // terminalId => { conn, stream, ws }

export function initSSHWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname, query } = url.parse(request.url, true);
    if (pathname === '/ws/ssh') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.query = query;
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (ws) => {
    const { terminalId = 'main' } = ws.query;

    // FOR TESTING PURPOSES: Hardcoded user ID (simulate JWT extraction)
    const userId = 'testuser123';

    try {
      const { containerName, sshPort, sessionId } = await ensureSessionContainer(userId);

      const conn = new Client();
      conn
        .on('ready', () => {
          conn.shell((err, stream) => {
            if (err) {
              return ws.send(JSON.stringify({ type: 'error', message: 'SSH Shell Error' }));
            }

            sessions[terminalId] = { conn, stream, ws };

            stream.on('data', (data) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'data', data: data.toString() }));
              }
            });

            stream.stderr?.on('data', (data) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'data', data: data.toString() }));
              }
            });

            ws.on('message', (message) => {
              try {
                const { type, data, cols, rows } = JSON.parse(message);

                if (type === 'input') {
                  stream.write(data);
                } else if (type === 'resize') {
                  stream.setWindow(rows, cols, 600, 800);
                }
              } catch (err) {
                console.error('[WS] Invalid message format:', err);
              }
            });

            const cleanup = async () => {
              stream.end();
              conn.end();
              delete sessions[terminalId];

              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'end' }));
              }

              await Session.updateOne(
                { userId, sessionId },
                { $pull: { activeSockets: terminalId } }
              );
            };

            ws.on('close', cleanup);
          });
        })
        .on('error', (err) => {
          console.error('[SSH Error]', err.message);
          ws.send(JSON.stringify({ type: 'error', message: `SSH error: ${err.message}` }));
        })
        .connect({
          host: '127.0.0.1',
          port: sshPort,
          username: 'labuser',
          privateKey: fs.readFileSync('./labuser_key')
        });

    } catch (err) {
      console.error('[SSH WS] Failed to init session:', err.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to start lab session' }));
    }
  });
}

async function ensureSessionContainer(userId) {
  const { containerName, sshPort, sessionId } = await createContainerForUser(userId);

  let sessionDoc = await Session.findOne({ userId, sessionId });
  if (!sessionDoc) {
    await Session.create({
      userId,
      sessionId,
      containerName,
      sshPort,
      createdAt: new Date(),
      activeSockets: [],
    });
    console.log(`[Session DB] Created new session for ${userId} @ ${sessionId}`);
  } else if (sessionDoc.containerName !== containerName) {
    sessionDoc.containerName = containerName;
    sessionDoc.sshPort = sshPort;
    await sessionDoc.save();
    console.log(`[Session DB] Updated existing session for ${userId}`);
  }

  return { containerName, sshPort, sessionId };
}