import { Controller } from 'react-hook-form';
import axios from 'axios';
import { FormSection, FormLabel, ErrorMessage, TestCaseSection } from '../FormComponents';
import TiptapEditor from '../TiptapEditor';
import Editor from "@monaco-editor/react";
import { PlusIcon } from '@heroicons/react/24/outline';

const QuestionForm = ({ 
  handleFormSubmit, 
  onSubmit, 
  register, 
  errors, 
  control, 
  reset, 
  initialQuestion,
  editingQuestionId,
  isLoading,
  watchedValues,
  codeType,
  setCodeType,
  handleCodeChange,
  addCodeFile,
  deleteCodeFile,
  addTestCase,
  removeTestCase,
  handleTestCaseChange,
  getLanguageFromFilename
}) => {
  return (
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
            className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                language="python"
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
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
              key={type}
              type="button"
              onClick={() => setCodeType(type)}
              className={`px-3 py-1.5 rounded-md mb-2 transition-colors ${
                codeType === type 
                  ? 'bg-indigo-600 text-white shadow-sm' 
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
      
      <FormSection title="Import/Export">
        <div className="space-y-4">
          <div>
            <FormLabel htmlFor="jsonImport">Import Question from JSON</FormLabel>
            <div className="flex items-center space-x-3">
              <input
                type="file"
                id="jsonImport"
                accept=".json"
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const jsonData = JSON.parse(event.target.result);
                        
                        // Reset the form with the imported data
                        reset({
                          title: jsonData.title || '',
                          description: jsonData.description || '',
                          precode: jsonData.precode || initialQuestion.precode,
                          clientPrecode: jsonData.clientPrecode || initialQuestion.clientPrecode,
                          solution: jsonData.solution || initialQuestion.solution,
                          clientSolution: jsonData.clientSolution || initialQuestion.clientSolution,
                          testCases: jsonData.testCases || initialQuestion.testCases,
                          clientCount: jsonData.clientCount || initialQuestion.clientCount,
                          clientDelay: jsonData.clientDelay || initialQuestion.clientDelay,
                          evaluationScript: jsonData.evaluationScript || ''
                        });
                        
                        // Show success message
                        alert('Question data imported successfully!');
                      } catch (error) {
                        console.error('Error parsing JSON:', error);
                        alert('Error importing JSON: ' + error.message);
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Upload a JSON file to import question data</p>
          </div>
          
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => {
                // Export current form data to JSON
                const formData = watchedValues;
                const jsonStr = JSON.stringify(formData, null, 2);
                
                // Create a download link
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `question_${formData.title ? formData.title.replace(/\s+/g, '_').toLowerCase() : 'export'}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors duration-200"
            >
              Export as JSON
            </button>
          </div>
        </div>
      </FormSection>
      
      <div className="pt-4 border-t flex space-x-4">
        <button
          type="button"
          onClick={() => reset(initialQuestion)}
          className="flex-1 py-2 px-4 border rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 hover:shadow-lg"
        >
          Clear Form
        </button>
        {editingQuestionId && (
          <button
            type="button"
            onClick={async () => {
              try {
                const response = await axios.get(`http://localhost:5001/api/questions/${editingQuestionId}`);
                reset(response.data);
              } catch(err) {
                console.error('Error fetching question for reset:', err);
              }
            }}
            className="flex-1 py-2 px-4 border rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            Reset to DB
          </button>
        )}
      </div>

      <div className="pt-4 border-t">
        <button 
          type="submit" 
          disabled={isLoading}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading...
            </>
          ) : editingQuestionId ? 'Update Question' : 'Upload Question'}
        </button>
      </div>
    </form>
  );
};

export default QuestionForm;
