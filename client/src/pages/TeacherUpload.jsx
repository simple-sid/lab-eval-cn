import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import axios from 'axios';
import { Link } from 'react-router-dom';
import TiptapEditor from '../components/TiptapEditor';
import { 
  ArrowLeftIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { TabButton, FormSection, FormLabel, ErrorMessage, TestCaseSection } from '../components/FormComponents'
import Editor from "@monaco-editor/react";

// Updated initial question including evaluation settings and matchType in testCases
const initialQuestion = {
  title: '',
  description: '',
  precode: { 'server.c': '// Add starter code here\n' },
  clientPrecode: { 'client.c': '// Add starter code here\n' },
  solution: { 'server.c': '// Add solution code here\n' },
  clientSolution: { 'client.c': '// Add solution code here\n' },
  testCases: {
    server: [{ input: '', expectedOutput: '', description: '', points: 5, matchType: 'exact' }],
    client: []
  },
  evaluationScript: '',
  clientCount: 0,
  clientDelay: 0,
};

export default function TeacherUpload() {
  const [message, setMessage] = useState('');
  const [codeType, setCodeType] = useState('precode');
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState('upload');

  // Initialize react-hook-form
  const { 
    register, 
    handleSubmit: handleFormSubmit, 
    formState: { errors }, 
    control,
    reset,
    setValue,
    watch
  } = useForm({
    defaultValues: initialQuestion
  });

  const watchedValues = watch(); // Get current form values for code editors

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/questions');
      setQuestions(response.data);
    } catch (err) {
      console.error('Error fetching questions:', err);
    }
  };
  
  const handleTestCaseChange = (type, idx, field, value) => {
    const testCases = [...(watchedValues.testCases[type] || [])];
    testCases[idx][field] = field === 'points' ? parseInt(value) || 0 : value;
    setValue(`testCases.${type}`, testCases);
  };

  const addTestCase = (type) => {
    const testCases = [...(watchedValues.testCases[type] || [])];
    testCases.push({ input: '', expectedOutput: '', description: '', points: 5, matchType: 'exact' });
    setValue(`testCases.${type}`, testCases);
  };

  const removeTestCase = (type, idx) => {
    const testCases = [...(watchedValues.testCases[type] || [])].filter((_, i) => i !== idx);
    setValue(`testCases.${type}`, testCases);
  };

  const handleCodeChange = (type, file, code) => {
    const currentFiles = watchedValues[type] || {};
    const updatedFiles = { ...currentFiles, [file]: code };
    setValue(type, updatedFiles);
  };

  const addCodeFile = (type) => {
    let fileName = prompt(`Enter new file name for ${type} (with extension, e.g. server.c):`);
    if (!fileName) return;
    fileName = fileName.trim();
    // Prevent files without extension
    if (!fileName.includes('.')) {
      alert('Please include a file extension, e.g. server.c');
      return;
    }
    const files = { ...watchedValues[type] };
    if (files[fileName]) {
      alert('File already exists!');
      return;
    }
    files[fileName] = '// New file\n';
    setValue(type, files);
  };

  const deleteCodeFile = (type, file) => {
    if (confirm(`Delete ${file} from ${type}?`)) {
      const files = { ...watchedValues[type] };
      delete files[file];
      setValue(type, files);
    }
  };
  
  const onSubmit = async (data) => {
    setIsLoading(true);

    try {
      // Process the description: upload any base64 images and replace them with URLs
      let processedDescription = data.description;
      const base64ImagePattern = /src="data:image\/(.*?);base64,(.*?)"/g;
      const matches = [...processedDescription.matchAll(base64ImagePattern)];

      for (const match of matches) {
        const fullMatch = match[0];
        const mimeType = match[1];
        const base64Data = match[2];

        // Convert base64 to file
        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArrays.push(byteCharacters.charCodeAt(i));
        }
        const byteArray = new Uint8Array(byteArrays);
        const blob = new Blob([byteArray], { type: `image/${mimeType}` });
        const file = new File([blob], `image-${Date.now()}.${mimeType}`, { type: `image/${mimeType}` });
        
        // Upload the image
        const formData = new FormData();
        formData.append('image', file);
        const response = await axios.post('http://localhost:5001/api/questions/upload-image', formData);
        
        // Replace the base64 string with the returned URL
        processedDescription = processedDescription.replace(fullMatch, `src="${response.data.url}"`);
      }

      // Remove unnecessary fields (like evalType) that are not defined in the schema
      const { evalType, ...payload } = data;

      // Build the payload without stringifying object fields. Our backend expects
      // precode, clientPrecode, solution, clientSolution, and testCases to be objects.
      const questionData = {
        ...payload,
        description: processedDescription,
        precode: data.precode,
        clientPrecode: data.clientPrecode,
        solution: data.solution,
        clientSolution: data.clientSolution,
        testCases: data.testCases,
        moduleType: "CNQuestion",
        lab: "123" // Replace with a valid lab ID if needed
      };

      console.log("Submitting questionData:", questionData); // Debug log

      await axios.post('http://localhost:5001/api/questions', questionData);
      setMessage('Question uploaded successfully!');
      reset(initialQuestion);
      fetchQuestions();
    } catch (err) {
      console.error('Upload error:', err.response ? err.response.data : err.message);
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteQuestion = async (id) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
      await axios.delete(`http://localhost:5001/api/questions/${id}`);
      fetchQuestions();
    } catch (err) {
      alert(`Error deleting question: ${err.message}`);
    }
  };

  function getLanguageFromFilename(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'py') return 'python';
    if (ext === 'js') return 'javascript';
    if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') return 'cpp';
    if (ext === 'java') return 'java';
    if (ext === 'html') return 'html';
    if (ext === 'css') return 'css';
    if (ext === 'json') return 'json';
    return 'c';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Question Upload Portal</h1>
            <Link 
              to="/" 
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowLeftIcon className="h-4 w-4 hover:text-blue-700 mr-2" />
              <div className="hover:text-blue-700">Back to Home</div>
            </Link>
          </div>
          
          <div className="bg-white shadow-sm rounded-lg overflow-hidden border">
            <div className="flex border-b">
              <TabButton active={activeTab === 'upload'} onClick={() => setActiveTab('upload')}>
                Upload New Question
              </TabButton>
              <TabButton active={activeTab === 'manage'} onClick={() => setActiveTab('manage')}>
                Manage Questions
              </TabButton>
            </div>
            
            {activeTab === 'upload' ? (
              <div className="p-6">
                {message && (
                  <div 
                    className={`p-4 mb-6 rounded-md ${
                      message.includes('Error') ? 'bg-red-50 text-red-700 border-l-4 border-red-500' : 'bg-green-50 text-green-700 border-l-4 border-green-500'
                    }`}
                  >
                    {message}
                  </div>
                )}
                
                <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-8">
                  <FormSection title="Basic Information">
                    <div>
                      <FormLabel htmlFor="title" required>Question Title</FormLabel>
                      <input 
                        id="title"
                        {...register('title', { 
                          required: "Title is required", 
                          minLength: { value: 3, message: "Title must be at least 3 characters" } 
                        })}
                        className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter a descriptive title"
                      />
                      {errors.title && <ErrorMessage>{errors.title.message}</ErrorMessage>}
                    </div>
                    
                    <div>
                      <FormLabel htmlFor="description" required>Question Description</FormLabel>
                      <Controller
                        name="description"
                        control={control}
                        rules={{ required: "Description is required" }}
                        render={({ field }) => (
                          <TiptapEditor value={field.value} onChange={field.onChange} />
                        )}
                      />
                      {errors.description && <ErrorMessage>{errors.description.message}</ErrorMessage>}
                    </div>
                  </FormSection>
                  
                  <FormSection title="Evaluation Settings">
                    <div className="mb-4">
                      <FormLabel htmlFor="evaluationScript">Evaluation Script (optional)</FormLabel>
                      <Controller
                        name="evaluationScript"
                        control={control}
                        render={({ field }) => (
                          <Editor 
                            height="200px"
                            language="javascript"
                            value={field.value}
                            onChange={field.onChange}
                            options={{
                              minimap: { enabled: false },
                              automaticLayout: true,
                              fontSize: 14
                            }}
                          />
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <FormLabel htmlFor="clientCount">Client Count</FormLabel>
                        <input 
                          id="clientCount"
                          type="number"
                          {...register('clientCount', { valueAsNumber: true })}
                          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter client count"
                        />
                      </div>
                      <div>
                        <FormLabel htmlFor="clientDelay">Client Delay (ms)</FormLabel>
                        <input 
                          id="clientDelay"
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          {...register('clientDelay', { valueAsNumber: true })}
                          className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter delay in ms"
                        />
                      </div>
                      <div>
                        <FormLabel htmlFor="matchType">Default Match Type</FormLabel>
                        <input
                          id="matchType"
                          type="text"
                          value=""
                          disabled
                          className="w-full border rounded-md px-3 py-2 bg-gray-100 text-gray-400 cursor-not-allowed"
                          placeholder="Set per test case below"
                        />
                      </div>
                    </div>
                  </FormSection>
                  
                  <FormSection title="Code Files">
                    <div className="flex space-x-2 mb-4 flex-wrap">
                      {['precode', 'clientPrecode', 'solution', 'clientSolution'].map(type => (
                        <button
                          key={ type}
                          type="button"
                          onClick={() => setCodeType(type)}
                          className={`px-3 py-1.5 rounded-md mb-2 transition-colors ${
                            codeType === type 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </button>
                      ))}
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <div className="mb-3 flex justify-between items-center">
                        <span className="font-medium text-gray-700">
                          Files for {codeType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                        <button
                          type="button"
                          onClick={() => addCodeFile(codeType)}
                          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <PlusIcon className="w-3 h-3 mr-1" />
                          <span>Add File</span>
                        </button>
                      </div>
                      
                      {/* Render Monaco Editor for each file */}
                      {Object.entries(watchedValues[codeType] || {}).map(([filename, code]) => (
                        <div key={filename} className="mb-4 rounded-md overflow-hidden border border-gray-300 bg-white">
                          <div className="flex justify-between items-center px-4 py-2 bg-gray-100">
                            <div className="flex items-center">
                              <svg className="h-4 w-4 text-gray-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="font-mono text-sm">{filename}</span>
                            </div>
                            <button 
                              type="button"
                              onClick={() => deleteCodeFile(codeType, filename)}
                              className="text-gray-500 hover:text-red-500"
                            >
                              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          <div className="h-60">
                            <Editor
                              height="100%"
                              language={getLanguageFromFilename(filename)}
                              value={typeof code === 'string' ? code : ''}
                              onChange={(value) => handleCodeChange(codeType, filename, value ?? '')}
                              options={{
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                fontSize: 14,
                                tabSize: 2,
                                automaticLayout: true
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </FormSection>
                  
                  <FormSection title="Test Cases">
                    <TestCaseSection
                      type="server"
                      testCases={watchedValues.testCases?.server || []}
                      addTestCase={addTestCase}
                      removeTestCase={removeTestCase}
                      handleTestCaseChange={handleTestCaseChange}
                      showMatchTypeSelect
                    />
                    <TestCaseSection
                      type="client"
                      testCases={watchedValues.testCases?.client || []}
                      addTestCase={addTestCase}
                      removeTestCase={removeTestCase}
                      handleTestCaseChange={handleTestCaseChange}
                      showMatchTypeSelect
                    />
                  </FormSection>
                  
                  <div className="pt-4 border-t">
                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70"
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Uploading...
                        </>
                      ) : 'Upload Question'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Existing Questions</h2>
                
                {questions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No questions available. Start by creating one!</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Server Tests</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client Tests</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {questions.map((q) => (
                          <tr key={q._id}>
                            <td className="px-6 py-4 whitespace-nowrap">{q.title}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{q.testCases?.server?.length || 0}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{q.testCases?.client?.length || 0}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => deleteQuestion(q._id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}