import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

function TerminalComponent({
  isVisible,
  terminalId,
  onSessionEnd,
  output,
  setOutput
}) {
  const terminalRef = useRef(null);
  const wsRef = useRef(null);
  const xterm = useRef(null);
  const fitAddon = useRef(null);
  const sessionEnded = useRef(false);

  const hardcodedJWT = 'FAKE_TEST_TOKEN'; // Replace with real JWT in production
  const wsURL = `ws://localhost:5001/ws/ssh?token=${encodeURIComponent(hardcodedJWT)}&terminalId=${terminalId}`;

  useEffect(() => {
    let isClosedManually = false;
    let retryCount = 0;
    const maxRetries = 5;

    const connectWebSocket = () => {
      const ws = new WebSocket(wsURL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[WS] Connected to terminal ${terminalId}`);
        retryCount = 0; // reset on success
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (err) {
          console.error("[WS] Failed to parse message:", event.data, err);
          return;
        }

        if (!xterm.current) return;

        try {
          if (msg.type === 'data') {
            const data = msg.data;
            xterm.current.write(data);
            if (typeof setOutput === "function") {
              setOutput(prev =>
                typeof prev === "string" ? (prev + data).slice(-50000) : data
              );
            }
          } else if (msg.type === 'end') {
            sessionEnded.current = true;
            xterm.current.writeln("\r\n*** SSH session ended ***");
            xterm.current.blur();
            onSessionEnd?.();
          } else if (msg.type === 'error') {
            xterm.current.writeln(`\r\n*** Error: ${msg.message} ***`);
          }
        } catch (err) {
          console.error("[WS] Terminal message handling failed:", err);
          xterm.current.writeln("\r\n*** Terminal error occurred ***");
        }
      };

      ws.onerror = (err) => {
        console.error(`[WS] Error on terminal ${terminalId}:`, err.message);
      };

      ws.onclose = () => {
        if (!isClosedManually && retryCount < maxRetries && !sessionEnded.current) {
          const delay = Math.min(1000 * 2 ** retryCount, 10000); // exponential backoff
          console.warn(`[WS] Disconnected from ${terminalId}, retrying in ${delay}ms`);
          xterm.current?.writeln(`\r\n*** Reconnecting in ${delay / 1000}s... ***`);
          setTimeout(connectWebSocket, delay);
          retryCount++;
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
  }, [terminalId]);

  useEffect(() => {
    if (!isVisible || !terminalRef.current) return;

    if (xterm.current) xterm.current.dispose();

    try {
      const term = new Terminal({
        cursorBlink: true,
        scrollback: 1000,
        convertEol: true
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(terminalRef.current);
      fit.fit();
      term.scrollToBottom();

      xterm.current = term;
      fitAddon.current = fit;

      if (typeof output === "string") {
        term.write(output);
      }

      term.onData((data) => {
        if (!sessionEnded.current) {
          try {
            wsRef.current?.send(
              JSON.stringify({
                type: 'input',
                data,
                terminalId
              })
            );
          } catch (err) {
            console.error("[WS] Failed to send input:", err);
          }
        }
      });

      const resizeObserver = new ResizeObserver(() => {
        try {
          fit.fit();
          term.scrollToBottom();
          const { cols, rows } = term;
          wsRef.current?.send(
            JSON.stringify({
              type: 'resize',
              terminalId,
              cols,
              rows
            })
          );
        } catch (err) {
          console.error("[ResizeObserver] Resize failed:", err);
        }
      });

      resizeObserver.observe(terminalRef.current);

      return () => {
        resizeObserver.disconnect();
        term.dispose();
        xterm.current = null;
      };
    } catch (err) {
      console.error("[Terminal] Failed to initialize terminal UI:", err);
    }
  }, [isVisible]);

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
}

export default TerminalComponent;