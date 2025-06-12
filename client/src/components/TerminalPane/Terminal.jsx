import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { io } from "socket.io-client";

function TerminalComponent({
  isVisible,
  username,
  password,
  terminalId,
  onSessionEnd,
  output,
  setOutput
}) {
  const terminalRef = useRef(null);
  const socketRef = useRef(null);
  const xterm = useRef(null);
  const fitAddon = useRef(null);
  const sessionEnded = useRef(false);

  // 1. Setup socket connection
  useEffect(() => {
    const socket = io("http://localhost:5001", {
      query: { terminalId }
    });

    socketRef.current = socket;

    socket.emit("submit-credentials", {
      terminalId,
      username,
      password
    });

    socket.on(`ssh-data-${terminalId}`, (data) => {
      if (xterm.current && typeof data === "string") {
        xterm.current.write(data);
      }

      // Store all SSH output as one string (scrollback preserved)
      if (typeof setOutput === "function") {
        setOutput((prev) => (typeof prev === "string" ? (prev + data).slice(-50000) : data));
      }
    });

    socket.on("session-closed", () => {
      sessionEnded.current = true;
      if (xterm.current) {
        xterm.current.writeln("\r\n*** SSH session ended ***");
        xterm.current.blur();
      }
      onSessionEnd?.();
    });

    return () => {
      socket.disconnect();
    };
  }, [terminalId, username, password]);

  // 2. Setup terminal instance on visible
  useEffect(() => {
    if (!isVisible || !terminalRef.current) return;

    // Dispose old terminal
    if (xterm.current) {
      xterm.current.dispose();
    }

    const term = new Terminal({
      cursorBlink: true,
      scrollback: 1000,
      convertEol: true
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalRef.current);
    fit.fit();

    xterm.current = term;
    fitAddon.current = fit;
    
    // Replay entire output as one stream (NOT line-by-line)
    if (typeof output === "string") {
      term.write(output);
    }

    // Handle user input
    term.onData((data) => {
      if (!sessionEnded.current) {
        socketRef.current?.emit(`ssh-input-${terminalId}`, data);
      }
    });

    // Handle window resize
    const handleResize = () => {
      fit.fit();
      const { cols, rows } = term;
      socketRef.current?.emit("resize", { cols, rows });
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
      xterm.current = null;
    };
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