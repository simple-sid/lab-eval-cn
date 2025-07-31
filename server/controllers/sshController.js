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

async function createSSHConnection(userId, sshPortOverride = null) {
  const session = await Session.findOne({ userId }).sort({ createdAt: -1 });
  if (!session && !sshPortOverride) throw new Error('No active session for user');
  const sshPort = sshPortOverride || session.sshPort;

  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      resolve(conn);
    })
    .on('error', (err) => {
      console.error('[SSH] Connection error:', err);
      reject(err);
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
      const { sshPort, sessionId } = await ensureSessionContainer(userId);

      let conn;
      
      try {
        conn = await createSSHConnection(userId, sshPort);

        // Request shell with explicit PTY for interactive programs
        conn.shell({
          term: 'xterm-256color',
          cols: 240,
          rows: 20,
          width: 640,
          height: 480
        }, (err, stream) => {
          if (err) {
            return ws.send(JSON.stringify({ type: 'error', message: 'SSH Shell Error' }));
          }
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
                  // // Handle Ctrl+C properly by sending SIGINT
                  // if (data === '\u0003') { // Ctrl+C character
                  //   stream.write(data);
                  //   // Don't automatically kill other processes - let Ctrl+C handle it naturally
                  // } else {
                  //   stream.write(data);
                  // }
                  stream.write(data);
                } else if (type === 'resize') {
                  stream.setWindow(rows, cols, 600, 800);
                }
              } catch (err) {
                console.error('[WS] Invalid message format:', err);
              }
            });
          sessions[terminalId] = { conn, stream, ws };

          // Handle incoming data from SSH
          stream.on('data', (data) => {
            if (ws.readyState === ws.OPEN) {
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
      } catch (err) {
        if (conn) conn.end();
        throw err;
      }
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
  } else if ((sessionDoc.containerName !== containerName) || (sessionDoc.sshPort !== sshPort)) {
    sessionDoc.containerName = containerName;
    sessionDoc.sshPort = sshPort;
    await sessionDoc.save();
    console.log(`[Session DB] Updated existing session for ${userId}`);
  }

  return { containerName, sshPort, sessionId };
}

async function ensureDirectoryExists(sftp, remotePath) {
  const pathParts = remotePath.split('/').slice(0, -1);
  let currentPath = '';
  
  for (let i = 1; i < pathParts.length; i++) {
    currentPath += (currentPath.endsWith('/') ? '' : '/') + pathParts[i];
    await new Promise((resolve) => {
      sftp.mkdir(currentPath, { mode: 0o755 }, () => resolve());
    });
  }
}

/**
 * upload string to file in container
 */
async function uploadFileContent(userId, content, remotePath) {
  let conn;
  try {
    conn = await createSSHConnection(userId);
    
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        
        ensureDirectoryExists(sftp, remotePath).then(() => {
          const writeStream = sftp.createWriteStream(remotePath);
          writeStream.on('close', () => {
            console.log(`[SFTP] File content written to ${remotePath}`);
            conn.end();
            resolve();
          });
          writeStream.on('error', (err) => {
            console.error('[SFTP] WriteStream error:', err);
            conn.end();
            reject(err);
          });
          writeStream.write(content);
          writeStream.end();
        }).catch(err => {
          conn.end();
          reject(err);
        });
      });
    });
  } catch (err) {
    if (conn) conn.end();
    throw err;
  }
}

/**
 * Save file to user's container via SFTP
 */
export async function saveFileToContainer({ userId, filePath, code }) {
  // Normalize path
  const remotePath = filePath;
  return uploadFileContent(userId, code, remotePath);
}

/**
 * Upload a local file to the container
 */
async function uploadLocalFile(userId, localPath, remotePath) {
  let conn;
  try {
    conn = await createSSHConnection(userId);
    
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        
        ensureDirectoryExists(sftp, remotePath).then(() => {
          sftp.fastPut(localPath, remotePath, (err) => {
            conn.end();
            if (err) {
              console.error('[SFTP] Upload error:', err);
              reject(err);
            } else {
              console.log(`[SFTP] File uploaded: ${localPath} → ${remotePath}`);
              resolve();
            }
          });
        }).catch(err => {
          conn.end();
          reject(err);
        });
      });
    });
  } catch (err) {
    if (conn) conn.end();
    throw err;
  }
}

/**
 * Execute a command in the user's container via SSH
 */
// async function execCmd(command, userId) {
//   const session = await Session.findOne({ userId }).sort({ createdAt: -1 });
//   if (!session) throw new Error('No active session for user');
//   const { sshPort } = session;

//   return execSSH(userId, command, sshPort);
// }

/**
 * Execute command via SSH and return stdout, stderr, and exit code
 */
async function execSSH(userId, command, sshPortOverride = null) {
  let conn;
  try {
    conn = await createSSHConnection(userId, sshPortOverride);
    
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        
        stream.on('data', (data) => {
          stdout += data.toString('utf8');
        });
        
        stream.stderr.on('data', (data) => {
          stderr += data.toString('utf8');
        });
        
        stream.on('close', (code) => {
          conn.end();
          resolve({ stdout, stderr, exitCode: code });
        });
      });
    });
  } catch (err) {
    if (conn) conn.end();
    throw err;
  }
}

/**
 * Runs code and evaluation script inside user's container.
 * Returns combined stdout, stderr and exit code.
 */
export async function runAndEvaluate({ 
  userId, 
  filename, 
  code, 
  language, 
  evaluationScript, 
  testCases = [],
  clientCount = 1,
  clientDelay = 0.5,
  codeType = 'server' // Default to server evaluation
}) {
  // Determine relative directory and workingDir in container
  // The path inside the container always starts at /home/labuser
  // Avoid adding /home/labuser again if the path already starts with it
  const relDir = filename.includes('/') ? filename.split('/').slice(0, -1).join('/') : '';
  const workingDir = relDir.startsWith('/home/labuser') ? relDir : 
                     relDir ? `/home/labuser/${relDir}` : '/home/labuser';

  try {
    // Save the user's code to the container
    await saveFileToContainer({ userId, filename, code });
      // Create a temporary test file with all the test case data
    // Extract the correct test cases based on the file type
    const isClient = filename.toLowerCase().includes('client');
    const actualCodeType = isClient ? 'client' : 'server'; 
    
    // Override codeType based on filename detection
    codeType = actualCodeType;
      // Extract the appropriate test cases for the file type
    // Handle both array format and object format with server/client keys
    const actualTestCases = Array.isArray(testCases) 
      ? testCases 
      : (testCases[codeType] || []);
    
    const testDataObj = {
      testCases: actualTestCases,  // Pass only the relevant test cases (server or client)
      clientCount,
      clientDelay,
      codeType
    };
    const testFilePath = `/tmp/.test_data_${userId}.json`;
    const jsonContent = JSON.stringify(testDataObj, null, 2);
    
    // Create necessary directories
    await execSSH(userId, 'mkdir -p /tmp/.eval_scripts /tmp/.eval_scripts/server_scripts').catch(err => {
      console.error('[EVAL] Failed to create directories:', err);
      throw new Error('Failed to prepare evaluation environment');
    });

    // Write test data to container
    await uploadFileContent(userId, jsonContent, testFilePath);

    // Determine which evaluation script to use based on codeType
    const mainEvalScript = codeType === 'client' ? 'client_evaluator.py' : 'server_evaluator.py';
      // Copy the main evaluation script to the container
    const srcMainScriptPath = `${process.cwd()}/evaluation_scripts/${mainEvalScript}`;
    const destMainScriptPath = `/tmp/.eval_scripts/${mainEvalScript}`;
    await uploadLocalFile(userId, srcMainScriptPath, destMainScriptPath);
    
    // Copy supporting modules based on the code type (server or client)
    if (codeType === 'server') {
      // Create the server_scripts directory
      await execSSH(userId, `mkdir -p /tmp/.eval_scripts/server_scripts`).catch(err => {
        console.warn('[EVAL] Failed to create server_scripts directory:', err);
      });
      
      const serverModules = [
        'evaluate_server.py',
        'utils.py',
        'validators.py',
        'client_actions.py'
      ];
      
      // Copy each supporting module
      for (const module of serverModules) {
        const srcModulePath = `${process.cwd()}/evaluation_scripts/server_scripts/${module}`;
        const destModulePath = `/tmp/.eval_scripts/server_scripts/${module}`;
        
        try {
          await uploadLocalFile(userId, srcModulePath, destModulePath);
          console.log(`[EVAL] Successfully copied ${module}`);
        } catch (err) {
          console.warn(`[EVAL] Failed to copy module ${module}:`, err);
          // Continue with other modules
        }
      }
      
      // Create __init__.py to make imports work
      await uploadFileContent(userId, '', '/tmp/.eval_scripts/server_scripts/__init__.py');
    } else if (codeType === 'client') {
      // Create the client_scripts directory
      await execSSH(userId, `mkdir -p /tmp/.eval_scripts/client_scripts`).catch(err => {
        console.warn('[EVAL] Failed to create client_scripts directory:', err);
      });
      
      const clientModules = [
        'evaluate_client.py',
        'utils.py',
        'validators.py',
        'test_servers.py'
      ];
      
      // Copy each supporting module
      for (const module of clientModules) {
        const srcModulePath = `${process.cwd()}/evaluation_scripts/client_scripts/${module}`;
        const destModulePath = `/tmp/.eval_scripts/client_scripts/${module}`;
        
        try {
          await uploadLocalFile(userId, srcModulePath, destModulePath);
          console.log(`[EVAL] Successfully copied ${module}`);
        } catch (err) {
          console.warn(`[EVAL] Failed to copy module ${module}:`, err);
          // Continue with other modules
        }
      }
      
      // Create __init__.py to make imports work
      await uploadFileContent(userId, '', '/tmp/.eval_scripts/client_scripts/__init__.py');
    }
    
    // Make all scripts executable
    await execSSH(userId, `chmod +x /tmp/.eval_scripts/*.py /tmp/.eval_scripts/*_scripts/*.py`);    // Run the evaluation for each test case
    const safeTestCases = Array.isArray(actualTestCases) ? actualTestCases : [];
    console.log(`[EVAL] Number of test cases: ${safeTestCases.length}, Code type: ${codeType}`);
    
    const results = [];
    
    for (let i = 0; i < safeTestCases.length; i++) {
      // Make sure we're using an absolute path to the file
      // If filename is already absolute, use it; otherwise prepend workingDir
      const fullFilePath = filename.startsWith('/') ? filename : 
                          `${workingDir}/${filename.split('/').pop()}`;
      
      const execCmd = `cd ${workingDir} && python3 ${destMainScriptPath} ${fullFilePath} ${testFilePath} ${i}`;
      
      console.log(`[EVAL] Exec command: ${execCmd}`);
      
      try {
        // Execute the command and get the output
        const { stdout, stderr, exitCode } = await execSSH(userId, execCmd);
        
        console.log(`[EVAL][TestCase ${i}] Result code: ${exitCode}`);
        
        // Extract just the RESULT line for clean output to frontend
        const resultLine = (stdout.match(/RESULT:[^:\n]+:[^\n]+/m) || [''])[0];
        
        // Parse the result line
        let status = 'FAIL';
        let message = 'Execution failed';
        
        if (resultLine) {
          const parts = resultLine.split(':');
          if (parts.length >= 3) {
            status = parts[1];
            message = parts.slice(2).join(':');
          }
        }
        
        // For HTTP evaluation tests, the actual output might have "Server output:" prefix
        // which needs to be removed when comparing against expected output
        let cleanedMessage = message;
        if (message.includes('Server output:')) {
          cleanedMessage = message.replace('Server output:', '').trim();
        }
        
        // Check if expected output is in the cleaned message
        const expectedOutput = safeTestCases[i]?.expectedOutput;
        if (expectedOutput && cleanedMessage.includes(expectedOutput)) {
          status = 'PASS';
        }
        
        results.push({
          stdout: resultLine || stdout,
          stderr: stderr,
          exitCode: exitCode,
          status: status,
          message: message,
          // Add these fields so they persist in the frontend 
          description: safeTestCases[i].description,
          points: safeTestCases[i].points,
          actualOutput: message
        });
      } catch (error) {
        console.error(`[EVAL] Error running test case ${i}:`, error);
        results.push({
          stdout: '',
          stderr: String(error),
          exitCode: 1,
          status: 'FAIL',
          message: `Error: ${error.message || 'Unknown error'}`,
          description: safeTestCases[i].description,
          points: safeTestCases[i].points,
          actualOutput: `Error during evaluation: ${error.message || 'Unknown error'}`
        });
      }
    }
    
    // Clean up - don't fail if cleanup fails
    execSSH(userId, `rm -rf ${testFilePath} /tmp/.eval_scripts`).catch(err => {
      console.warn('[EVAL] Cleanup failed:', err);
    });
    
    return { results };

  } catch (error) {
    console.error('[EVAL] Error:', error);
    throw error;
  }
}