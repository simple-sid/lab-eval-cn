import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { io } from "socket.io-client";
import "xterm/css/xterm.css";

function DummyLoginTerminal({terminalId, onLoginSuccess }) {
  const termRef = useRef(null);
  const term = useRef(null);
  const socket = useRef(null);

  const input = useRef("");
  const step = useRef(0); // 0 = username, 1 = password
  const promptCol = useRef(0);

  const usernameRef = useRef("");
  const passwordRef = useRef("");

  useEffect(() => {
    term.current = new Terminal({ cursorBlink: true });
    term.current.open(termRef.current);
    term.current.focus();

    const writePrompt = (label) => {
      term.current.write(`${label}: `);
      promptCol.current = label.length + 2;
    };

    term.current.writeln('\x1B[1;32m┌─────────────────────────────────────┐\x1B[0m');
    term.current.writeln('\x1B[1;32m│        CN Lab Terminal v1.0         │\x1B[0m');
    term.current.writeln('\x1B[1;32m└─────────────────────────────────────┘\x1B[0m');
    term.current.writeln('');
    term.current.writeln('\x1B[36mWelcome to the Computer Networks Lab!\x1B[0m');
    term.current.writeln('');
    term.current.write("Login to the system\r\n");
    writePrompt("Username");

    const handleInput = (data) => {
      const char = data;

      // Block cursor movement before prompt
      const pos = term.current._core.buffer.x;

      // Left arrow
      if (char === "\u001b[D" && pos <= promptCol.current) {
        return;
      }

      // Backspace
      if (char === "\u007F") {
        if (input.current.length > 0 && pos > promptCol.current) {
          input.current = input.current.slice(0, -1);
          term.current.write("\b \b");
        }
        return;
      }

      // Enter
      if (char === "\r") {
        term.current.write("\r\n");

        if (step.current === 0) {
          usernameRef.current = input.current.trim();
          input.current = "";
          step.current = 1;
          writePrompt("Password");
        } else {
          passwordRef.current = input.current;
          input.current = "";

          term.current.write("Logging in...\r\n");

          socket.current = io('http://localhost:5001');

          socket.current.emit("submit-credentials", {
            terminalId: terminalId,
            username: usernameRef.current,
            password: passwordRef.current
          });

          socket.current.on(`ssh-error-${terminalId}`, (msg) => {
            term.current.write(`Login failed: ${msg}\r\n`);
            step.current = 0;
            input.current = "";
            writePrompt("Username");
            socket.current.disconnect();
          });

          socket.current.on(`ssh-data-${terminalId}`, () => {
            socket.current.disconnect();
            onLoginSuccess(usernameRef.current, passwordRef.current);
          });
        }
        return;
      }

      // Ignore other escape sequences (optional)
      if (/^\u001b\[\w$/.test(char)) return;

      input.current += char;
      if (step.current === 0) {
        term.current.write(char);
      } else {
        term.current.write("*");
      }
    };

    term.current.onData(handleInput);

    window.addEventListener("click", () => term.current.focus());

    return () => {
      term.current.dispose();
      socket.current?.disconnect();
    };
  }, [terminalId, onLoginSuccess]);

  return (
    <div
      ref={termRef}
      style={{ width: "100vw", height: "100vh", backgroundColor: "black", overflow: "auto" }}
    />
  );
}

export default DummyLoginTerminal;