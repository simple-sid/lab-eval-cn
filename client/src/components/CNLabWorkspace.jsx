import { useState, useEffect, useRef } from 'react';
import { Panel, PanelGroup } from 'react-resizable-panels';
import Header from './Header';
import EditorPane from './EditorPane';
import QuestionPane from './QuestionPane';
import TerminalPane from './TerminalPane';
import ResizeHandle from './shared/ResizeHandle';
import { useIsMobile } from './utils/useIsMobile';
import axios from 'axios';

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

export default function CNLabWorkspace() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('question');
  const [language, setLanguage] = useState('c');
  const [showQuestion, setShowQuestion] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [currentWorkingDir, setCurrentWorkingDir] = useState(''); // Track current directory
  const [saveStatus, setSaveStatus] = useState('idle'); //track autosave status
  const panelRef = useRef(null);
  // const [isSubmitted, setIsSubmitted] = useState(false);

  // Load questions from public/questionPool.json
  const [questions, setQuestions] = useState([]);
  useEffect(() => {
    fetch('/questionPool.json')
      .then(res => res.json())
      .then(data => setQuestions(data))
      .catch(err => console.error('Error loading questions:', err));
  }, []);

  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  
  const [files, setFiles] = useState([]);
  useEffect(() => {
    fetch('/codeFiles.json')
      .then(res => res.json())
      .then(data => {
        // Ensure each file has a .path property (default to name if not present)
        setFiles(data.map(f => ({
          ...f,
          path: f.path || f.name // always set path
        })));
      })
      .catch(err => console.error("Error loading files:", err));
  }, []);
  
  const [activeFileId, setActiveFileId] = useState('server');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testCaseResults, setTestCaseResults] = useState({});

  // setting test case results
  useEffect(() => {
    const onEval = (e) => {
      const { results } = e.detail || {};
      const currentQuestion = questions[activeQuestionIdx];
      const questionId = currentQuestion?.id;

      if (!questionId || !results) return;

      const currentTestCases = currentQuestion?.testCases || [];
      
      // merge each result into corresponding test case
      const processedResults = currentTestCases.map((tc, idx) => {
        const result = results && results[idx] ? results[idx] : {};
        return {
          ...tc,
          actualOutput: (result.stdout || '') + (result.stderr ? `\n${result.stderr}` : ''),
          status: result.exitCode === 0 ? 'PASS' : 'FAIL',
          exitCode: result.exitCode
        };
      });

      // store results by question id
      setTestCaseResults(prev => ({
        ...prev,
        [questionId]: processedResults
      }));
    };
    
    window.addEventListener('evaluation-complete', onEval);
    return () => window.removeEventListener('evaluation-complete', onEval);
  }, [questions, activeQuestionIdx]);
  
  // When questions or activeQuestionIdx changes, set files from solution
  useEffect(() => {
    if (questions && questions.length > 0 && questions[activeQuestionIdx] && questions[activeQuestionIdx].solution) {
      const solution = questions[activeQuestionIdx].solution;
      // Convert solution object to files array
      const filesFromSolution = Object.entries(solution).map(([filename, code]) => {
        let lang = 'plaintext';
        if (filename.endsWith('.py')) lang = 'python';
        else if (filename.endsWith('.c')) lang = 'c';
        return {
          id: filename.replace(/\.[^/.]+$/, ''),
          name: filename.split('/').pop(), // just the filename
          path: filename, // full relative path
          language: lang,
          code: code
        };
      });
      setFiles(filesFromSolution);
      if (filesFromSolution.length > 0) {
        setActiveFileId(filesFromSolution[0].id);
      }
    }
  }, [questions, activeQuestionIdx]);

  // Handle file operations
  const updateCode = (newCode) => {
    setFiles(prevFiles => 
      prevFiles.map(f => 
        f.id === activeFileId ? {...f, code: newCode} : f
      )
    );
  };

  //track changes and auto-save
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const activeFile = files.find(f => f.id === activeFileId);
      if (activeFile && activeFile.code?.trim()) {
        saveFile(activeFile);
      }
    }, 1000); // Debounce: wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [files, activeFileId]);

  const addNewFile = () => {
    const timestamp = Date.now();
    const newId = `file_${timestamp}`;
    const extension = language === 'c' ? 'c' :
                      language === 'python' ? 'py' : 'txt';
    const template = language === 'c' ? 
      `"""\nNew C File\nAuthor: ${getCurrentUser()}\nCreated: ${getCurrentDateTime()} UTC\n"""\n\n# Your code here\n` :
      `// New ${language} file\n// Author: ${getCurrentUser()}\n// Created: ${getCurrentDateTime()} UTC\n\n`;
    setFiles(prevFiles => [
      ...prevFiles, 
      {
        id: newId,
        name: `new_file_1.${extension}`,
        path: `new_file_1.${extension}`,
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
    // If we're in a subdirectory, update the file's path to include the current directory
    const fullPath = currentWorkingDir 
      ? `${currentWorkingDir}/${activeFile.name}` 
      : activeFile.path;
    
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('run-file-in-terminal', {
        detail: {
          code: activeFile.code,
          filename: fullPath, // use full path including current directory
          filePath: fullPath, // use full path including current directory
          language: activeFile.language || language
        }
      }));
      setIsRunning(false);
    }, 100);
  };

  const saveFile = async (file) => {
    if (!file) return;
    try {
      setSaveStatus('saving');
      const payload = {
        //userId: 'jwt-later',
        filename: file.name,
        filePath: file.path,
        code: file.code
      };

      await fetch('http://localhost:5001/api/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000); // Reset to idle after 2 seconds
    } catch (err) {
      console.error(`[AutoSave] Failed to save ${file.path}:`, err);
      setSaveStatus('idle');
    }
  };

  //handle rename and code language change
  const renameFile = (fileId, newName) => {
    const extension = newName.split('.').pop().toLowerCase();

    let detectedLanguage = 'plaintext';
    if (extension === 'py') detectedLanguage = 'python';
    else if (extension === 'c') detectedLanguage = 'c';

    setFiles(prevFiles =>
      prevFiles.map(f =>
        f.id === fileId
          ? {
              ...f,
              name: newName,
              path: f.path
                ? f.path.split('/').slice(0, -1).concat(newName).join('/')
                : newName,
              language: detectedLanguage //update language too
            }
          : f
      )
    );

    setLanguage(detectedLanguage);
  };

  const updateFileLanguage = (fileId, newLang) => {
    const newExt = newLang === 'c' ? 'c' : newLang === 'python' ? 'py' : '';
    setFiles(prevFiles =>
      prevFiles.map(f => {
        if (f.id === fileId) {
          const baseName = f.name.replace(/\.[^/.]+$/, ''); // remove old extension
          const newName = `${baseName}.${newExt}`;
          return {
            ...f,
            language: newLang,
            name: newName,
            path: f.path
              ? f.path.split('/').slice(0, -1).concat(newName).join('/')
              : newName
          };
        }
        return f;
      })
    );
  };

  const activeFile = files.find(f => f.id === activeFileId) || files[0];  
  const handleEvaluate = async () => {
    try {
      if (!questions.length || !activeFile) return;      const currentQuestion = questions[activeQuestionIdx] || {};
      
      // Determine code type (server or client) based on filename
      const isClient = activeFile.name.toLowerCase().includes('client');
      const codeType = isClient ? 'client' : 'server';
      
      // Choose the appropriate evaluation script and test cases
      const evaluationScript = isClient ? 'client_evaluator.py' : (currentQuestion.evaluationScript || 'server_evaluator.py');
      
      const testCases = currentQuestion.testCases?.[codeType] || [];
      
      const clientCount = currentQuestion.clientCount || 1;
      const clientDelay = currentQuestion.clientDelay || 0.5;
      const evalType = currentQuestion.evalType || 'default';

      console.log(`EVALUATE: Sending ${codeType} evaluation request:`, { 
        evaluationScript, testCases, clientCount, clientDelay, evalType, codeType 
      });

      const response = await axios.post('http://localhost:5001/api/run-evaluate', {
        filename: activeFile.path || activeFile.name,
        code: activeFile.code,
        language: activeFile.language,
        evaluationScript,
        testCases,
        clientCount,
        clientDelay,
        evalType,
        codeType
      });
      
      // Process test results
      const updatedTestCases = [];
      if (response.data && response.data.results) {
        // Map each test result to include all relevant information
        response.data.results.forEach((result, idx) => {
          const originalTest = testCases[idx] || {};
          const resultParts = (result.stdout || '').split(':');
          const status = resultParts.length > 1 ? resultParts[1] : 'FAIL';
          const message = resultParts.length > 2 ? resultParts.slice(2).join(':') : result.stderr || 'Evaluation failed';
          
          updatedTestCases.push({
            ...originalTest,  // Keep original test case properties
            id: idx,          // Add an id for tracking
            description: originalTest.description || `Test ${idx + 1}`,
            points: originalTest.points || 0,
            status: status,
            actualOutput: message,
            stderr: result.stderr || ''
          });
        });
        
        // Update test case results in the relevant question
        const updatedQuestions = [...questions];
        updatedQuestions[activeQuestionIdx] = {
          ...currentQuestion,
          [`testCaseResults_${codeType}`]: updatedTestCases
        };
        setQuestions(updatedQuestions);
      }
      
      window.dispatchEvent(new CustomEvent('evaluation-complete', { 
        detail: {
          ...response.data,
          testCaseResults: updatedTestCases
        }
      }));
    } catch (err) {
      console.error('Evaluate error', err);
    }
  }

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
    alert("[Time] Time's up! Your code will be automatically submitted.");
    handleSubmit();
  };

  const question = questions && questions.length > 0 ? questions[activeQuestionIdx] : undefined;

  // Keep window.questions and window.activeQuestionIdx in sync for evaluation
  useEffect(() => {
    window.questions = questions;
    window.activeQuestionIdx = activeQuestionIdx;
  }, [questions, activeQuestionIdx]);

  //handle resize for terminal open and close
  useEffect(() => {
    if (panelRef.current) {
      if (showTerminal) {
        panelRef.current.resize(45); // Show with size 45%
      } else {
        panelRef.current.resize(0); // Collapse to 0%
      }
    }
  }, [showTerminal]);

  // Mobile layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <Header
          title={question ? question.title : 'No questions available'}
          onTimeUp={handleTimeUp}
          timeLimit={question && question.timeLimit ? question.timeLimit : 3600}
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
            <QuestionPane 
              questions={questions}
              activeQuestionIdx={activeQuestionIdx}
              setActiveQuestionIdx={setActiveQuestionIdx}
              testCaseResults={testCaseResults}
            />
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
              onStopAll={handleStopAll}
              isRunning={isRunning}
              isSubmitting={isSubmitting}
              saveStatus={saveStatus}
              renameFile={renameFile}
              updateFileLanguage={updateFileLanguage}
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
        title={question ? question.title : 'No questions available'}
        onTimeUp={handleTimeUp}
        timeLimit={question && question.timeLimit ? question.timeLimit : 3600}
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
                      questions={questions}
                      activeQuestionIdx={activeQuestionIdx}
                      setActiveQuestionIdx={setActiveQuestionIdx}
                      onClose={() => setShowQuestion(false)}
                      testCaseResults={testCaseResults[questions[activeQuestionIdx]?.id] || []}
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
                  activeFile={activeFile}
                  updateCode={updateCode}
                  addNewFile={addNewFile}
                  onRun={handleRun}
                  onEvaluate={handleEvaluate}
                  onSubmit={handleSubmit}
                  onStopAll={handleStopAll}
                  isRunning={isRunning}
                  isSubmitting={isSubmitting}
                  showQuestion={showQuestion}
                  onToggleQuestion={() => setShowQuestion(true)}
                  showTerminal={showTerminal}
                  setShowTerminal={setShowTerminal}
                  onCloseFile={handleCloseFile}
                  saveStatus={saveStatus}
                  renameFile={renameFile}
                  updateFileLanguage={updateFileLanguage}
                />
              </Panel>
            </PanelGroup>
          </Panel>
          {/* Always render TerminalPane panel, but hide with CSS if not visible */}
          <ResizeHandle orientation="horizontal" style={{ display: showTerminal ? undefined : 'none' }} />
          <Panel
            ref={panelRef}
            defaultSize={45}
            minSize={0}
            maxSize={100}
            id="terminal-panel"
            order={3}
          >
            <TerminalPane onClose={() => setShowTerminal(false)} termVisible={showTerminal} />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}