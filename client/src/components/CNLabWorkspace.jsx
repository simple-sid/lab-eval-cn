import { useState, useCallback } from 'react';
import { Panel, PanelGroup } from 'react-resizable-panels';
import Header from './Header';
import EditorPane from './EditorPane';
import QuestionPane from './QuestionPane';
import TerminalPane from './TerminalPane';
import ResizeHandle from './shared/ResizeHandle';
import { useIsMobile } from './utils/useIsMobile';

const MobileTabs = ({ activeTab, setActiveTab, tabs }) => (
  <div className="flex bg-white border-b border-gray-200 shadow-sm">
    {tabs.map(tab => (
      <button
        key={tab.id}
        className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 ${
          activeTab === tab.id 
            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
        onClick={() => setActiveTab(tab.id)}
      >
        <span className="flex items-center justify-center">
          {tab.icon && <tab.icon className="w-4 h-4 mr-2" />}
          {tab.label}
        </span>
      </button>
    ))}
  </div>
);

// Helper functions
const getCurrentUser = () => 'simple-sid';
const getCurrentDateTime = () => {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace('T', ' ');
};

export default function CNLabWorkspace({ question }) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('question');
  const [language, setLanguage] = useState('python');
  const [showQuestion, setShowQuestion] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [files, setFiles] = useState([
  { 
    id: 'server', 
    name: 'server.py', 
    code: `import socket

HOST = 'localhost'
PORT = 8080

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.bind((HOST, PORT))
    s.listen()
    print(f"[Server] Server started on {HOST}:{PORT}")
    while True:
        conn, addr = s.accept()
        with conn:
            print(f"[Conn] Connection from {addr}")
            data = conn.recv(1024)
            if not data:
                break
            print(f"[Recv] Received from {addr}: {data.decode()}")
            response = f"Echo: {data.decode()}"
            conn.sendall(response.encode())
            print(f"[Send] Sent: {response}")
            print(f"[Disc] Client {addr} disconnected")
`,
    language: 'python' 
  },
  { 
    id: 'client', 
    name: 'client.py', 
    code: `import socket

HOST = 'localhost'
PORT = 8080

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.connect((HOST, PORT))
    print(f"[Conn] Connected to server at {HOST}:{PORT}")
    message = "Hello, Server!"
    print(f"[Send] Sending: {message}")
    s.sendall(message.encode())
    data = s.recv(1024)
    print(f"[Recv] Server response: {data.decode()}")
    print(f"[Disc] Disconnected from server")
`,
    language: 'python' 
  }
]);
  
  const [activeFileId, setActiveFileId] = useState('server');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle file operations
  const updateCode = useCallback((newCode) => {
    setFiles(prevFiles => 
      prevFiles.map(f => 
        f.id === activeFileId ? {...f, code: newCode} : f
      )
    );
  }, [activeFileId]);

  const addNewFile = useCallback(() => {
    const timestamp = Date.now();
    const newId = `file_${timestamp}`;
    const extension = language === 'python' ? 'py' : 
                      language === 'javascript' ? 'js' : 
                      language === 'java' ? 'java' : 'txt';
    
    const template = language === 'python' ? 
      `#!/usr/bin/env python3\n"""\nNew Python File\nAuthor: ${getCurrentUser()}\nCreated: ${getCurrentDateTime()} UTC\n"""\n\n# Your code here\n` :
      `// New ${language} file\n// Author: ${getCurrentUser()}\n// Created: ${getCurrentDateTime()} UTC\n\n`;
    
    setFiles(prevFiles => [
      ...prevFiles, 
      {
        id: newId,
        name: `new_file_${timestamp}.${extension}`,
        code: template,
        language
      }
    ]);
    setActiveFileId(newId);
  }, [language]);

  const handleCloseFile = (fileId) => {
    setFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
    // set a new active file if the closed one was active
    if (activeFileId === fileId && files.length > 1) {
      const idx = files.findIndex(f => f.id === fileId);
      const nextFile = files[idx + 1] || files[idx - 1];
      setActiveFileId(nextFile?.id || null);
    }
  };

  // Handle execution
  const handleRun = useCallback(() => {
    setIsRunning(true);
    setShowTerminal(true);
    
    const activeFile = files.find(f => f.id === activeFileId);
    
    setTimeout(() => {
      const simulatedOutput = [
        `[Server] Running ${activeFile?.name || 'code'}...`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
      ];

      if (activeFile?.name === 'server.py') {
        simulatedOutput.push(
          '[Server] Server started on localhost:8080',
          'Waiting for connections...',
          '[Conn] Connection from (\'127.0.0.1\', 54321)',
          '[Recv] Received from (\'127.0.0.1\', 54321): Hello, Server!',
          '[Send] Sent: Echo: Hello, Server!',
          '[Disc] Client (\'127.0.0.1\', 54321) disconnected'
        );
      } else if (activeFile?.name === 'client.py') {
        simulatedOutput.push(
          '[Conn] Connected to server at localhost:8080',
          '[Send] Sending: Hello, Server!',
          '[Recv] Server response: Echo: Hello, Server!',
          '[Disc] Disconnected from server'
        );
      }

      simulatedOutput.push(
        '',
        '[OK] Execution completed successfully',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      );

      setTerminalOutput(prev => [...prev, ...simulatedOutput]);
      setIsRunning(false);
    }, 2000);
  }, [activeFileId, files]);

  const handleSubmit = useCallback(() => {
    setIsSubmitting(true);
    setShowTerminal(true);
    
    setTimeout(() => {
      const submissionOutput = [
        '[Send] Submitting solution...',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        '[Test] Running test cases...',
        '',
        '[OK] Test 1: Basic Connection Test - PASSED (25 pts)',
        '[OK] Test 2: Multiple Messages Test - PASSED (25 pts)', 
        '[OK] Test 3: Disconnect Test - PASSED (25 pts)',
        '[OK] Test 4: Multiple Clients Test - PASSED (25 pts)',
        '',
        '[Success] All tests passed! Score: 100/100',
        '[OK] Solution submitted successfully',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      ];

      setTerminalOutput(prev => [...prev, ...submissionOutput]);
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 3000);
  }, []);

  const handleTimeUp = useCallback(() => {
    if (!isSubmitted) {
      alert("[Time] Time's up! Your code will be automatically submitted.");
      handleSubmit();
    }
  }, [handleSubmit, isSubmitted]);

  // Mobile layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <Header 
          title={question.title}
          timeLimit={question.timeLimit}
          onTimeUp={handleTimeUp}
        />
        
        <MobileTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={[
            { id: 'question', label: 'Problem', icon: null },
            { id: 'editor', label: 'Code', icon: null },
            { id: 'terminal', label: 'Output', icon: null }
          ]}
        />
        
        <div className="flex-1 overflow-hidden">
          {activeTab === 'question' && (
            <QuestionPane question={question} />
          )}
          {activeTab === 'editor' && (
            <EditorPane 
              language={language}
              setLanguage={setLanguage}
              files={files}
              activeFileId={activeFileId}
              setActiveFileId={setActiveFileId}
              updateCode={updateCode}
              addNewFile={addNewFile}
              onRun={handleRun}
              onSubmit={handleSubmit}
              isRunning={isRunning}
              isSubmitting={isSubmitting}
            />
          )}
          {activeTab === 'terminal' && (
            <TerminalPane 
              output={terminalOutput}
              onClear={() => setTerminalOutput([])}
            />
          )}
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex flex-col h-screen bg-white">
      <Header 
        title={question.title}
        timeLimit={question.timeLimit} 
        onTimeUp={handleTimeUp}
        showQuestion={showQuestion}
        onToggleQuestion={() => setShowQuestion(!showQuestion)}
      />
      
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="vertical" className="h-full" autoSaveId="cnlab-vertical-panels">
          <Panel defaultSize={showTerminal ? 70 : 100} minSize={30} id="main-panel" order={1}>
            <PanelGroup direction="horizontal" className="h-full" autoSaveId="cnlab-horizontal-panels">
              {showQuestion && (
                <>
                  <Panel defaultSize={35} minSize={25} maxSize={60} id="question-panel" order={1}>
                    <QuestionPane 
                      question={question}
                      onClose={() => setShowQuestion(false)}
                    />
                  </Panel>
                  <ResizeHandle />
                </>
              )}
              <Panel minSize={40} id="editor-panel" order={2}>
                <EditorPane 
                  language={language}
                  setLanguage={setLanguage}
                  files={files}
                  setFiles={setFiles}
                  activeFileId={activeFileId}
                  setActiveFileId={setActiveFileId}
                  updateCode={updateCode}
                  addNewFile={addNewFile}
                  onRun={handleRun}
                  onSubmit={handleSubmit}
                  isRunning={isRunning}
                  isSubmitting={isSubmitting}
                  showQuestion={showQuestion}
                  onToggleQuestion={() => setShowQuestion(true)}
                  showTerminal={showTerminal}
                  setShowTerminal={setShowTerminal}
                  onCloseFile={handleCloseFile}
                />
              </Panel>
            </PanelGroup>
          </Panel>
          {showTerminal && (
            <>
              <ResizeHandle orientation="horizontal" />
              <Panel defaultSize={30} minSize={20} maxSize={100} id="terminal-panel" order={3}>
                <TerminalPane 
                  output={terminalOutput}
                  onClose={() => setShowTerminal(false)}
                  onClear={() => setTerminalOutput([])}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}