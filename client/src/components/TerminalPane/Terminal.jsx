import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import axios from 'axios';

const TerminalComponent = ({
  isVisible,
  isTermVisible,
  terminalId,
  onSessionEnd,
  initialBuffer = [], 
  onData,
  token,
  setCurrentWorkingDir
}) => {
  const terminalRef = useRef(null);
  const wsRef = useRef(null);
  const xterm = useRef(null);
  const fitAddon = useRef(null);
  const inputReadyRef = useRef(false);
  const cwdListenerRef = useRef(null);
  const timeoutRef = useRef(null);
  const lastSentDataRef = useRef('');
  const sessionEnded = useRef(false);

  const hardcodedJWT = token || 'FAKE_TEST_TOKEN';
  const wsURL = `ws://localhost:5001/ws/ssh?token=${encodeURIComponent(hardcodedJWT)}&terminalId=${terminalId}`;

  //Track current Working directory
  const requestCurrentWorkingDir = () => {
    if (!xterm.current) return;

    const buffer = xterm.current.buffer.active;
    const lastLine = buffer.getLine(buffer.length - 1);

    if (!lastLine) return;
    const lineText = lastLine.translateToString(true).trim();

    const colonIndex = lineText.indexOf(':');
    const dollarIndex = lineText.lastIndexOf('$');
    let cwd;

    if (colonIndex !== -1 && dollarIndex !== -1 && dollarIndex > colonIndex) {
      cwd = lineText.slice(colonIndex + 1, dollarIndex).trim();
    }

    if (cwd) {
      const resolvedCWD = cwd.replace('~','/home/labuser');
      setCurrentWorkingDir?.(terminalId, resolvedCWD);
    } else {
      console.log("[CWD] No prompt-like pattern found in last line");
    }
  };

  // WebSocket connection effect - independent of visibility
  useEffect(() => {
    let isClosedManually = false;
    let retryCount = 0;
    const maxRetries = 5;

    const connectWebSocket = () => {
      const ws = new WebSocket(wsURL);
      
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[WS] Connected to terminal ${terminalId}`);
        retryCount = 0;
        setTimeout(requestCurrentWorkingDir, 500);
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (err) {
          console.error("[WS] Failed to parse message:", event.data, err);
          return;
        }

        // Even if terminal is not visible, process message if xterm exists
        if (!xterm.current) return;

        try {
          if (msg.type === 'data') {
            const data = msg.data;

            xterm.current?.write(data);
            onData?.(data);
          } else if (msg.type === 'end') {
            sessionEnded.current = true;
            xterm.current.writeln("\r\n*** SSH session ended ***");
            xterm.current.blur();
            onSessionEnd?.();
          } else if (msg.type === 'error') {
            const message = msg.message || '';

            xterm.current?.writeln(`\r\n*** Error: ${message} ***`);

            // ✅ Detect SSH auth failure
            if (message.includes('All configured authentication methods failed')) {
              xterm.current?.writeln(`\r\n*** Retrying connection in 3 seconds... ***`);
              onData();
              setTimeout(() => {
                if (xterm.current) xterm.current.clear();
                  retryCount = 0;
                  connectWebSocket();
                }, 3000);
              }
            }
        } catch (err) {
          console.error("[WS] Terminal message handling failed:", err);
          if (xterm.current) {
            xterm.current.writeln("\r\n*** Terminal error occurred ***");
          }
        }
      };

      ws.onerror = (err) => {
        console.error("[WS] Error on terminal", terminalId, ":", err.message || "Unknown error");
      };

      ws.onclose = () => {
        if (!isClosedManually && retryCount < maxRetries && !sessionEnded.current) {
          const delay = Math.min(1000 * 2 ** retryCount, 10000);
          console.warn(`[WS] Disconnected from ${terminalId}, retrying in ${delay}ms`);
          if (xterm.current) {
            xterm.current.writeln(`\r\n*** Reconnecting in ${delay / 1000}s... ***`);
          }
          retryCount++;
          setTimeout(connectWebSocket, delay);
        } else if (!sessionEnded.current) {
          if (xterm.current) {
            xterm.current.writeln("\r\n*** Still waiting for server, retrying anyway... ***");
          }
          setTimeout(connectWebSocket, 3000); // ← Force reconnect even after maxRetries
        } else {
          console.log(`[WS] Gave up retrying for ${terminalId}`);
        }
      };
    };

    connectWebSocket();

    return () => {
      isClosedManually = true;
      wsRef.current?.close();
    };
  }, [terminalId, wsURL, onSessionEnd]);

  // Terminal UI effect - handles visibility changes
  useEffect(() => {
    if (!terminalRef.current) return;
    
    // If terminal exists but is invisible, just hide it - don't dispose it
    if (!isVisible) {
      if (terminalRef.current) {
        terminalRef.current.style.display = 'none';
      }
      return;
    }

    if (terminalRef.current) {
      terminalRef.current.style.display = 'block';
    }
    
    // Only create a new terminal if it doesn't exist
    if (!xterm.current) {
      try {
        const term = new Terminal({
          cursorBlink: true,
          scrollback: 1000,
          convertEol: true
        });

        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(terminalRef.current);
        // Replay any stored output for this terminal
        initialBuffer.forEach(chunk => term.write(chunk));
        fit.fit();
        term.scrollToBottom();
        term.focus();

        xterm.current = term;
        fitAddon.current = fit;

        // Attach input handler only for visible/active terminal
        const onDataHandler = (data) => {
          if (!inputReadyRef.current) return;

          if (!sessionEnded.current && wsRef.current?.readyState === WebSocket.OPEN) {
            try {
              wsRef.current.send(
                JSON.stringify({
                  type: 'input',
                  data,
                  terminalId
                })
              );

              // Detect end of command on Enter key
              if (data === '\r' || data === '\n') {
                const buffer = xterm.current.buffer.active;
                const cursorY = buffer.cursorY;
                const line = buffer.getLine(cursorY);
                const currentLineText = line?.translateToString(true).trim() || '';
                
                // Strip prompt prefix (everything up to and including the first "$ ")
                const commandOnly = currentLineText.replace(/^.*?\$\s*/, '').trim();

                if (/^cd\b/.test(commandOnly)) {
                  setTimeout(() => {
                    requestCurrentWorkingDir();
                  }, 300);
                }
              }
            } catch (err) {
              console.error("[WS] Failed to send input:", err);
            }
          }
        };
        term.onData(onDataHandler);

        // Observe container resize to auto-fit and keep cursor visible
        if (terminalRef.current) {
          const resizeObserver = new window.ResizeObserver(() => {
            fit.fit();
            term.scrollToBottom();
          });
          resizeObserver.observe(terminalRef.current);
          terminalRef.current._resizeObserver = resizeObserver;
        }
      } catch (err) {
        console.error("[Terminal] Failed to initialize terminal UI:", err);
      }
    } else if (isVisible) {
      // Terminal became visible: refit, clear old wrapping, replay buffer, and scroll
      xterm.current.focus();
      fitAddon.current?.fit();
      // Clear existing display and replay full buffer for correct wrapping
      xterm.current.clear();
      if (initialBuffer.length > 0) {
        const lastChunk = initialBuffer[initialBuffer.length - 1];
        if (lastChunk.endsWith('\r')) {
          initialBuffer[initialBuffer.length - 1] = lastChunk.slice(0, -1);
        }
      }
      initialBuffer.forEach(chunk => xterm.current.write(chunk));
      xterm.current.scrollToBottom();
      requestCurrentWorkingDir(); // Track working dir
    } 
  }, [isVisible, terminalId]);

  // cleanup effect that runs on unmount only
  useEffect(() => {
    return () => {
      if (xterm.current) {
        xterm.current.dispose();
        xterm.current = null;
      }

      if (terminalRef.current?._resizeObserver) {
        terminalRef.current._resizeObserver.disconnect();
        delete terminalRef.current._resizeObserver;
      }

      if (cwdListenerRef.current && wsRef.current) {
        wsRef.current.removeEventListener('message', cwdListenerRef.current);
        cwdListenerRef.current = null;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onRunFile = async (e) => {
      // Only the visible terminal executes the run command
      if (!isVisible) return;
      const { code, filename, language, filePath } = e.detail;
      
      // Save file before running
      try {
        const savePayload = {
          filename,
          filePath: filePath || filename,
          code
        };
        
        const response = await axios.post('http://localhost:5001/api/save-file', savePayload);
      } catch (err) {
        console.error('[Terminal] Save error:', err);
        xterm.current?.writeln(`\r\n*** Error saving file: ${err?.response?.data?.error || err.message} ***`);
        return;
      };
      // Ensure WS is ready
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        xterm.current?.writeln("\r\n*** Waiting for terminal connection... ***");
        return;
      }
      const isServerFile = /bind\(|listen\(|accept\(/.test(code);
      if (isServerFile) {
        setTimeout(runFile, 200);
      } else {
        runFile();
      }
      
      function runFile() {
        setTimeout(() => {
          let runCmd = '';
          const justFilename = filename;
          
          if (language === 'python') {
            runCmd = `python3 -u ${justFilename}`;
          } else if (language === 'c') {
            const exe = justFilename.replace(/\.c$/, '');
            runCmd = `gcc ${justFilename} -o ${exe} && ./${exe}`;
          }
          wsRef.current.send(JSON.stringify({ type: 'input', data: `${runCmd}\n`, terminalId }));
        }, 200);
      }
   };
   window.addEventListener('run-file-in-terminal', onRunFile);

   const onStopAll = () => {
     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
     const stopCmd = `killall -9 server client 2>/dev/null || true\n`;
     wsRef.current.send(JSON.stringify({ type: 'input', data: stopCmd, terminalId }));
   };  
   window.addEventListener('stop-all-processes', onStopAll);

    return () => {
      window.removeEventListener('run-file-in-terminal', onRunFile);
      window.removeEventListener('stop-all-processes', onStopAll);
    };
  }, [isVisible]);

  // Autofocus and refit when terminal becomes visible (e.g. from hidden state)
  useEffect(() => {
    if ((isTermVisible && isVisible) && xterm.current) {
      setTimeout(() => {
        fitAddon.current?.fit();
        xterm.current.refresh(0, xterm.current.buffer.active.length - 1);
        xterm.current.focus();
      }, 100); // slight delay ensures DOM is painted
    }
  }, [isTermVisible]);

  useEffect(() => {
    if ((isTermVisible && isVisible) && wsRef.current?.readyState === WebSocket.OPEN) {
      setTimeout(() => {
        requestCurrentWorkingDir();
      }, 50); // small delay to ensure shell readiness
    }

    // Delay user input by 100ms
    inputReadyRef.current = false;
    setTimeout(() => {
      inputReadyRef.current = true;
    }, 1000);
  }, [isTermVisible, isVisible]);

  return (
    <div
      ref={terminalRef}
      style={{
        display: isVisible ? "block" : "none",
        width: "100%",
        height: "100%",
        backgroundColor: "black",
        overflow: "hidden"
      }}
    />
  );
};

export default TerminalComponent;