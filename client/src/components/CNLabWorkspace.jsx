import { useState, useEffect } from 'react';
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
  // const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [files, setFiles] = useState([]);
  useEffect(() => {
    fetch('/codeFiles.json')
      .then(res => res.json())
      .then(data => setFiles(data))
      .catch(err => console.error("Error loading files:", err));
  }, []);
  
  const [activeFileId, setActiveFileId] = useState('server');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle file operations
  const updateCode = (newCode) => {
    setFiles(prevFiles => 
      prevFiles.map(f => 
        f.id === activeFileId ? {...f, code: newCode} : f
      )
    );
  };

  const addNewFile = () => {
    const timestamp = Date.now();
    const newId = `file_${timestamp}`;
    const extension = language === 'python' ? 'py' : 
                      language === 'c' ? 'c' : 'txt';
    
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
  };

  const handleCloseFile = (fileId) => {
    setFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
    // set a new active file if the closed one was active
    if (activeFileId === fileId && files.length > 1) {
      const idx = files.findIndex(f => f.id === fileId);
      const nextFile = files[idx + 1] || files[idx - 1];
      setActiveFileId(nextFile?.id || null);
    }
  };  // Handle execution
  const handleRun = () => {
    setIsRunning(true);
    setShowTerminal(true);
    const activeFile = files.find(f => f.id === activeFileId);
    if (!activeFile) {
      window.dispatchEvent(new CustomEvent('terminal-error', { detail: "No file selected" }));
      setIsRunning(false);
      return;
    }
    // Delay event dispatch to ensure TerminalPane is mounted and listeners registered
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('run-file-in-terminal', {
        detail: {
          code: activeFile.code,
          filename: activeFile.name,
          language: activeFile.language || language
        }
      }));
      setIsRunning(false);
    }, 100);
  };

  // Handle stopping all processes
  const handleStopAll = () => {
    setShowTerminal(true);
    window.dispatchEvent(new CustomEvent('stop-all-processes'));
  };
  const handleSubmit = () => {
    // setIsSubmitting(true);
    setShowTerminal(true);

    handleRun();
  };
  const handleTimeUp = () => {
    if (!isSubmitted) {
      alert("[Time] Time's up! Your code will be automatically submitted.");
      handleSubmit();
    }
  };

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
          )}          {activeTab === 'editor' && (
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
              onStopAll={handleStopAll}
              isRunning={isRunning}
              isSubmitting={isSubmitting}
            />
          )}
          {activeTab === 'terminal' && (
            <TerminalPane
              onClose={() => setActiveTab('editor')}
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
                  onStopAll={handleStopAll}
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
          {/* Always render TerminalPane, but hide with CSS if not visible */}
          <ResizeHandle orientation="horizontal" style={{ display: showTerminal ? undefined : 'none' }} />
          <Panel defaultSize={30} minSize={20} maxSize={100} id="terminal-panel" order={3} style={{ display: showTerminal ? undefined : 'none' }}>
            <TerminalPane 
              onClose={() => setShowTerminal(false)}
            />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}