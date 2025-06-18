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
      conn        .on('ready', () => {
          // Request shell with explicit PTY for interactive programs
          conn.shell({
            term: 'xterm-256color',
            cols: 80,
            rows: 24,
            width: 640,
            height: 480
          }, (err, stream) => {
            if (err) {
              return ws.send(JSON.stringify({ type: 'error', message: 'SSH Shell Error' }));
            }

            sessions[terminalId] = { conn, stream, ws };
            stream.on('data', (data) => {
              if (ws.readyState === ws.OPEN) {
                // Ensure proper encoding and send raw data
                const output = data.toString('utf8');
                ws.send(JSON.stringify({ type: 'data', data: output }));
              }
            });

            stream.stderr?.on('data', (data) => {
              if (ws.readyState === ws.OPEN) {
                // Send stderr data as well for complete output
                const errorOutput = data.toString('utf8');
                ws.send(JSON.stringify({ type: 'data', data: errorOutput }));
              }
            });            ws.on('message', (message) => {
              try {
                const { type, data, cols, rows } = JSON.parse(message);

                if (type === 'input') {
                  // Handle Ctrl+C properly by sending SIGINT
                  if (data === '\u0003') { // Ctrl+C character
                    stream.write(data);
                    // Don't automatically kill other processes - let Ctrl+C handle it naturally
                  } else {
                    stream.write(data);
                  }
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

// Save file to user's container via SFTP
export async function saveFileToContainer({ userId, filename, code }) {
  const Session = (await import('../models/Session.js')).default;
  const sessionDoc = await Session.findOne({ userId }).sort({ createdAt: -1 });
  if (!sessionDoc) throw new Error('No active session for user');
  const { sshPort } = sessionDoc;
  console.log(`[SFTP] Attempting to connect to userId=${userId} on sshPort=${sshPort} for file ${filename}`);

  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      console.log('[SFTP] SSH connection ready');
      conn.sftp((err, sftp) => {
        if (err) {
          console.error('[SFTP] SFTP error:', err);
          conn.end();
          return reject(err);
        }
        const remotePath = `/home/labuser/${filename}`;
        console.log(`[SFTP] Writing to ${remotePath}`);
        const writeStream = sftp.createWriteStream(remotePath, { encoding: 'utf8' });
        writeStream.on('close', () => {
          console.log('[SFTP] File write complete');
          conn.end();
          resolve();
        });
        writeStream.on('error', (err) => {
          console.error('[SFTP] WriteStream error:', err);
          conn.end();
          reject(err);
        });
        writeStream.write(code);
        writeStream.end();
      });
    })
    .on('error', (err) => {
      console.error('[SFTP] SSH connection error:', err);
      reject(err);
    })
    .on('end', () => {
      console.log('[SFTP] SSH connection ended');
    })
    .on('close', (hadError) => {
      console.log(`[SFTP] SSH connection closed${hadError ? ' with error' : ''}`);
    })
    .connect({
      host: '127.0.0.1',
      port: sshPort,
      username: 'labuser',
      privateKey: fs.readFileSync('./labuser_key'),
      readyTimeout: 10000
    });
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

// export async function runAndEvaluate({ userId, filename, code, port, path, protocol, autostart }) {
//   // 1. sftp the file
//   await saveFileToContainer({ userId, filename, code });

//   // 2. find the container
//   const { containerName } = await ensureSessionContainer(userId);

//   // 3. exec inside the container
//   const container = docker.getContainer(containerName);
//   let runCmd;
//   if (language === 'c') {
//     const exe = filename.replace(/\.c$/, '');
//     runCmd = `gcc ${filename} -o ${exe} && ./${exe}`;
//   } else if (language === 'python') {
//     runCmd = `python3 -u ${filename}`;
//   } else {
//     throw new Error('Unsupported language: ' + language);
//   }
//   const cmd = [
//     'bash', '-lc',
//     `${runCmd} \
//       && bash /home/labuser/${filename%.*}/check_proto.sh ${port} ${filename} ${path} ${protocol} ${autostart}`
//   ]
// }