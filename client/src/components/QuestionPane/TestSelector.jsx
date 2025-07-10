import { useState } from 'react';
import TestCases from './TestCases';

export default function TestSelector({ question, testCaseResults }) {
  const [activeTestType, setActiveTestType] = useState('server');
  // Get the appropriate test cases and results based on the active test type
  const getTestCases = () => {
    if (!question || !question.testCases) return [];
    
    // Handle both old format (direct array) and new format (object with server/client keys)
    if (Array.isArray(question.testCases)) {
      return question.testCases; // Legacy format - flat array
    }
    
    // New format - object with server/client keys
    return question.testCases[activeTestType] || [];
  };const getTestResults = () => {
    // First check if the passed testCaseResults is populated (from evaluation)
    if (testCaseResults && testCaseResults.length > 0) {
      return testCaseResults;
    }
    
    // Otherwise fall back to results stored in question
    if (activeTestType === 'server') {
      return question?.testCaseResults_server || [];
    } else {
      return question?.testCaseResults_client || [];
    }
  };

  const testCases = getTestCases();
  const results = getTestResults();
  // Calculate test counts, handling both legacy and new formats
  const serverTestCount = Array.isArray(question?.testCases) 
    ? question?.testCases?.length || 0 
    : question?.testCases?.server?.length || 0;
    
  const clientTestCount = Array.isArray(question?.testCases)
    ? question?.testCases?.length || 0
    : question?.testCases?.client?.length || 0;
  console.log('TestSelector state:', {
    activeTestType,
    testCases,
    results,
    serverTestCount,
    clientTestCount,
    questionHasTestCases: !!question?.testCases,
  });

  return (
    <div className="fade-in-up">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Test Cases</h3>
        
        <div className="relative inline-block text-left">
          <div>
            <button 
              type="button"
              className="inline-flex justify-center w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none"
              id="test-type-menu-button"
              aria-expanded="true"
              aria-haspopup="true"
              onClick={() => setActiveTestType(activeTestType === 'server' ? 'client' : 'server')}
            >
              {activeTestType === 'server' ? 'Server Tests' : 'Client Tests'}
              <span className="ml-2 bg-indigo-100 text-indigo-600 text-xs px-2 py-1 rounded-full">
                {activeTestType === 'server' ? serverTestCount : clientTestCount}
              </span>
              {/* <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" aria-hidden="true" /> */}
            </button>
          </div>
        </div>
      </div>
      
      {/* Conditionally render test cases or a placeholder message */}
      {testCases.length > 0 ? (
        <TestCases 
          testCases={testCases} 
          testCaseResults={results} 
        />
      ) : (
        <div className="p-6 text-center text-gray-500">
          <p>No {activeTestType} test cases available for this question.</p>
        </div>
      )}
    </div>
  );
}
