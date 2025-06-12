import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
//import { io } from "socket.io-client";

export default function XTerminal({ terminalId, output = [] }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  //const socketRef = useRef(null);
  const processedOutputLengthRef = useRef(0);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const initTimeoutRef = useRef(null);

  // PROBLEM: FitAddon.fit() fails when called before DOM dimensions are available
  // SOLUTION: Check both offsetWidth/Height AND getBoundingClientRect for reliable dimensions
  const canSafelyFit = () => {
    if (!terminalRef.current || !xtermRef.current || !fitAddonRef.current) {
      return false;
    }

    const container = terminalRef.current;
    const rect = container.getBoundingClientRect();
    
    return (
      container.offsetWidth > 0 && 
      container.offsetHeight > 0 &&
      rect.width > 0 && 
      rect.height > 0 &&
      container.offsetParent !== null &&
      xtermRef.current.element && 
      xtermRef.current.element.offsetParent !== null
    );
  };

  const performSafeFit = () => {
    if (!canSafelyFit()) {
      return false;
    }

    try {
      if (fitAddonRef.current && typeof fitAddonRef.current.fit === 'function') {
        fitAddonRef.current.fit();
        return true;
      }
    } catch (error) {
      console.warn('FitAddon error caught:', error.message);
      return false;
    }
    return false;
  };

  const initializeTerminal = () => {
    if (!terminalRef.current) return;

    if (xtermRef.current) {
      try {
        xtermRef.current.dispose();
      } catch (e) {
        console.warn('Error disposing previous terminal:', e);
      }
      xtermRef.current = null;
    }

    if (fitAddonRef.current) {
      fitAddonRef.current = null;
    }

    terminalRef.current.innerHTML = '';
    setIsTerminalReady(false);

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff',
        cursor: '#00ff00',
        selection: '#ffffff40',
        black: '#000000',
        red: '#ff6b6b',
        green: '#51cf66',
        yellow: '#ffd43b',
        blue: '#74c0fc',
        magenta: '#f06292',
        cyan: '#4dd0e1',
        white: '#ffffff',
        brightBlack: '#495057',
        brightRed: '#ff8a80',
        brightGreen: '#69f0ae',
        brightYellow: '#ffff8d',
        brightBlue: '#82b1ff',
        brightMagenta: '#ff80ab',
        brightCyan: '#84ffff',
        brightWhite: '#ffffff'
      },
      rows: 20,
      cols: 80,
      convertEol: true,
      scrollback: 1000
    });

    try {
      xtermRef.current = term;

      const webLinksAddon = new WebLinksAddon();
      term.loadAddon(webLinksAddon);

      // CRITICAL: Open terminal BEFORE loading FitAddon
      // This ensures DOM elements exist before FitAddon tries to access dimensions
      term.open(terminalRef.current);

      const setupFitAddon = () => {
        if (!xtermRef.current || !terminalRef.current) return;

        try {
          const fitAddon = new FitAddon();
          fitAddonRef.current = fitAddon;
          
          xtermRef.current.loadAddon(fitAddon);
          
          // SOLUTION: Wait for DOM to stabilize before first fit attempt
          setTimeout(() => {
            if (performSafeFit()) {
              setIsTerminalReady(true);
              initializeTerminalContent();
            } else {
              setIsTerminalReady(true);
              initializeTerminalContent();
            }
          }, 150);
        } catch (error) {
          console.warn('FitAddon initialization failed:', error);
          setIsTerminalReady(true);
          initializeTerminalContent();
        }
      };

      const initializeTerminalContent = () => {
        if (!xtermRef.current) return;

        const term = xtermRef.current;
        
        term.writeln('\x1B[1;32m┌─────────────────────────────────────┐\x1B[0m');
        term.writeln('\x1B[1;32m│        CN Lab Terminal v1.0         │\x1B[0m');
        term.writeln('\x1B[1;32m└─────────────────────────────────────┘\x1B[0m');
        term.writeln('');
        term.writeln('\x1B[36mWelcome to the Computer Networks Lab!\x1B[0m');
        term.writeln('\x1B[90mType commands to interact with your code.\x1B[0m');
        term.writeln('');

        if (output && output.length > 0) {
          output.forEach(line => {
            term.writeln(line);
          });
          processedOutputLengthRef.current = output.length;
        }

        term.write('\x1B[1;32m$ \x1B[0m');
      };

      // Handle user input from the terminal (keyboard events)
      term.onData(data => {
        // user input is received from the terminal UI
        if (data === '\r') {
          term.writeln('');
          term.write('\x1B[1;32m$ \x1B[0m');
        } else if (data === '\u007F') {
          term.write('\b \b');
        } else {
          term.write(data);
        }
        // send 'data' to the server for processing
      });

      // SOLUTION: Use requestAnimationFrame + timeout for proper DOM timing
      requestAnimationFrame(() => {
        setTimeout(setupFitAddon, 100);
      });

    } catch (error) {
      console.error('Terminal initialization error:', error);
    }
  };

  useEffect(() => {
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
    }

    initTimeoutRef.current = setTimeout(() => {
      initializeTerminal();
    }, 50);

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [terminalId]);

  useEffect(() => {
    if (!isTerminalReady || !xtermRef.current || !output) return;

    const term = xtermRef.current;
    if (output.length > processedOutputLengthRef.current) {
      const newLines = output.slice(processedOutputLengthRef.current);
      if (newLines.length > 0) {
        newLines.forEach(line => {
          term.writeln(line);
        });
        term.write('\x1B[1;32m$ \x1B[0m');
        processedOutputLengthRef.current = output.length;
      }
    }
  }, [output, isTerminalReady]);

  useEffect(() => {
    if (!isTerminalReady) return;

    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        performSafeFit();
      }, 200);
    };

    window.addEventListener('resize', handleResize);

    let resizeObserver;
    if (window.ResizeObserver && terminalRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [isTerminalReady]);

  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (xtermRef.current) {
        try {
          xtermRef.current.dispose();
        } catch (e) {
          console.warn('Error disposing terminal on cleanup:', e);
        }
        xtermRef.current = null;
      }
      fitAddonRef.current = null;
      processedOutputLengthRef.current = 0;
    };
  }, []);

  return (
    <div className="h-full w-full bg-gray-900 relative overflow-hidden">
      <div 
        ref={terminalRef} 
        className="h-full w-full p-2"
        style={{ 
          minHeight: '200px',
          minWidth: '400px'
        }}
      />
      {!isTerminalReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-400 mx-auto mb-2"></div>
            <div className="text-sm text-gray-400">Loading terminal...</div>
          </div>
        </div>
      )}
    </div>
  );
}