import { WebSocketServer } from 'ws';
import { Client } from 'ssh2';
import fs from 'fs';
import url from 'url';
import dotenv from 'dotenv';
import Session from '../models/Session.js';
import { createContainerForUser, docker } from '../docker/dockerManager.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
            });            
            
            ws.on('message', (message) => {
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

    }catch(err){
      if (
        err.message &&
        err.message.includes('Conflict') &&
        err.message.includes('is already in use by container')
      ) {
        console.warn('[SSH WS] Container name conflict — continuing as it is likely already running.');
        // Skip sending error to frontend; allow frontend to retry
        return;
      }

      console.error('[SSH WS] Failed to init session:', err.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to start lab session' }));
    }
  });
}

// Save file to user's container via SFTP
export async function saveFileToContainer({ userId, filename, filePath, code }) {
  const Session = (await import('../models/Session.js')).default;
  const sessionDoc = await Session.findOne({ userId }).sort({ createdAt: -1 });
  if (!sessionDoc) throw new Error('No active session for user');
  const { sshPort } = sessionDoc;
  const relPath = filePath || filename;
  console.log(`[SFTP] [DEBUG] Received: filename=${filename}, filePath=${filePath}, relPath=${relPath}`);

  const maxRetries = 5;
  const retryDelay = 1000;

  const attemptConnection = (retryCount = 0) => {
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

          let remotePath = relPath.startsWith('/') ? relPath : `/home/labuser/${relPath}`;
          console.log(`[SFTP] [DEBUG] Writing to ${remotePath}`);

          // Ensure parent directories exist
          const pathParts = remotePath.split('/').slice(0, -1);
          let currentPath = '';
          const mkdirRecursive = (idx) => {
            if (idx >= pathParts.length) return Promise.resolve();
            currentPath += (currentPath.endsWith('/') ? '' : '/') + pathParts[idx];
            return new Promise((res) => {
              sftp.mkdir(currentPath, { mode: 0o755 }, () => res());
            }).then(() => mkdirRecursive(idx + 1));
          };

          mkdirRecursive(1).then(() => {
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
        });
      });

      conn.on('error', (err) => {
        conn.end();
        if (err.code === 'ECONNREFUSED' && retryCount < maxRetries) {
          console.warn(`[SFTP] SSH ECONNREFUSED on port ${sshPort}. Retrying (${retryCount + 1}/${maxRetries})...`);
          return setTimeout(() => {
            attemptConnection(retryCount + 1).then(resolve).catch(reject);
          }, retryDelay);
        }
        console.error('[SFTP] SSH connection error:', err);
        reject(err);
      });

      conn.on('end', () => {
        console.log('[SFTP] SSH connection ended');
      });

      conn.on('close', (hadError) => {
        console.log(`[SFTP] SSH connection closed${hadError ? ' with error' : ''}`);
      });

      conn.connect({
        host: '127.0.0.1',
        port: sshPort,
        username: 'labuser',
        privateKey: fs.readFileSync('./labuser_key'),
        readyTimeout: 10000
      });
    });
  };

  return attemptConnection();
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
  } else if ((sessionDoc.containerName !== containerName) || (sessionDoc.sshPort !== sshPort)) {
    sessionDoc.containerName = containerName;
    sessionDoc.sshPort = sshPort;
    await sessionDoc.save();
    console.log(`[Session DB] Updated existing session for ${userId}`);
  }

  return { containerName, sshPort, sessionId };
}

/**
 * Runs code and evaluation script inside user's container.
 * Returns combined stdout, stderr and exit code.
 */
export async function runAndEvaluate({ userId, filename, code, evaluationScript, testCases }) {
  // Determine relative directory and workingDir in container
  const relDir = filename.includes('/') ? filename.split('/').slice(0, -1).join('/') : '';
  const workingDir = relDir ? `/home/labuser/${relDir}` : '/home/labuser';

  await saveFileToContainer({ userId, filename, filePath: filename, code });

  const scriptName = evaluationScript || 'evaluate_server1.sh';
  const scriptPath = path.resolve(__dirname, `../evaluation_scripts/${scriptName}`);
  let scriptContent = fs.readFileSync(scriptPath, 'utf8');
  // Hidden directory in container
  const hiddenEvalDir = '/tmp/.eval_scripts';
  const destScriptPath = `${hiddenEvalDir}/${scriptName}`;

  // Ensure hidden directory exists in container
  const { containerName } = await ensureSessionContainer(userId);
  const container = docker.getContainer(containerName);
  await container.exec({ Cmd: ['bash','-lc', `mkdir -p ${hiddenEvalDir}`], AttachStdout: true, AttachStderr: true, WorkingDir: '/tmp' });

  await saveFileToContainer({ userId, filename: scriptName, filePath: destScriptPath, code: scriptContent });

  // ensure testCases is always an array
  const safeTestCases = Array.isArray(testCases) ? testCases : [];

  // Determine the correct script arguments
  let scriptSourceFile = filename;
  if (evaluationScript === 'evaluate_server2.sh') {
    scriptSourceFile = 'server.c';
  }

  // Only run the first test case (or one iteration)
  const results = [];
  const i = 0;
  const testCase = safeTestCases[0] || {};
  // Pass test case index as argument
  let execCmd;
  if (evaluationScript === 'evaluate_server2.sh') {
    execCmd = `cd ${workingDir} && chmod +x ${destScriptPath} && ${destScriptPath} ${scriptSourceFile} ${i}`;
  } else {
    execCmd = `cd ${workingDir} && chmod +x ${destScriptPath} && ${destScriptPath} ${scriptSourceFile}`;
  }
  console.log('[EVAL] Exec command:', execCmd);

  const execInstance = await container.exec({ Cmd: ['bash','-lc', execCmd], AttachStdout: true, AttachStderr: true, WorkingDir: workingDir });
  const stream = await execInstance.start();

  let stdout = '', stderr = '';
  stream.on('data', chunk => stdout += chunk.toString('utf8'));
  stream.on('error', chunk => stderr += chunk.toString('utf8'));
  await new Promise((resolve, reject) => {
    stream.on('data', chunk => {
      stdout += chunk.toString('utf8');
      
      console.log(`[EVAL][TestCase ${i}] Bash output chunk:`, chunk.toString('utf8'));
    });
    stream.on('error', chunk => {
      stderr += chunk.toString('utf8');
      console.log(`[EVAL][TestCase ${i}] Bash error chunk:`, chunk.toString('utf8'));
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  const result = await execInstance.inspect();
  const exitCode = result.ExitCode;

  // Filter out non-essential bash debug lines
  function filterOutput(output) {
    if (!output) return '';
    return output
      .split('\n')
      .filter(line => !/^\+ /.test(line) && !/^set -x/.test(line) && !/^\s*$/.test(line))
      .join('\n')
      .trim();
  }

  // Only show the first RESULT: line from output, or fallback to filtered output if not found
  function extractResultLine(output) {
    if (!output) return '';
    const match = output.match(/^RESULT:.*$/m);
    if (match && match[0]) return match[0];

    return filterOutput(output);
  }

  results.push({
    stdout: extractResultLine(stdout),
    stderr: extractResultLine(stderr),
    exitCode
  });

  // Cleanup: remove script and compiled binary
  await container.exec({ Cmd: ['bash','-lc', `rm -f ${destScriptPath} ${workingDir}/server_exec ${workingDir}/${path.basename(filename)} ${workingDir}/server.log`], AttachStdout: true, AttachStderr: true, WorkingDir: '/tmp' });
  await container.exec({ Cmd: ['bash','-lc', `rm -f ${destScriptPath}`], AttachStdout: true, AttachStderr: true, WorkingDir: '/tmp' });

  return { results };
}