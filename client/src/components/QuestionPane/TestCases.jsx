import React, { useState } from 'react';
import { 
  PlayIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

export default function TestCases({ testCases = [], testCaseResults = [] }) {
  const [expandedTests, setExpandedTests] = useState(new Set([0])); // first test expanded by default

  const toggleExpanded = (index) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTests(newExpanded);
  };

  const formatTestInput = (input) => {
    if (Array.isArray(input)) {
      return input.map((item, i) => `Input ${i + 1}: ${item}`).join('\n');
    }
    return String(input);
  };

  const formatTestOutput = (output) => {
    if (Array.isArray(output)) {
      return output.map((item, i) => `Output ${i + 1}: ${item}`).join('\n');
    }
    return String(output);
  };

  // Prefer dynamic testCaseResults if present
  const displayCases = (testCaseResults && testCaseResults.length > 0) ? testCaseResults : testCases;

  if (!displayCases.length) {
    return (
      <div className="p-6 text-center text-gray-500">
        <PlayIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>No test cases available</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Test Cases</h3>
        <span className="text-sm text-gray-500">
          {displayCases.length} test{displayCases.length !== 1 ? 's' : ''}
        </span>
      </div>

      {displayCases.map((testCase, index) => {
        const isExpanded = expandedTests.has(index);
        return (
          <div
            key={testCase.id || index}
            className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm"
          >
            {/* Test case header */}
            <div
              className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleExpanded(index)}
            >
              <div className="flex items-center space-x-3">
                <span className="font-medium text-gray-900">
                  Test Case {index + 1}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                {typeof testCase.points === 'number' && (
                  <span className="text-sm font-medium text-blue-800 bg-blue-100 px-2 py-1 rounded">
                    {testCase.points} pts
                  </span>
                )}
              </div>
            </div>

            {/* Test case details */}
            {isExpanded && (
              <div className="p-4 border-t border-gray-200">
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Input:
                    </label>
                    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 overflow-x-auto">
                      {formatTestInput(testCase.input)}
                    </pre>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expected Output:
                    </label>
                    <pre className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-gray-800 overflow-x-auto">
                      {formatTestOutput(testCase.expectedOutput)}
                    </pre>
                  </div>

                  {testCase.actualOutput != null && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Actual Output:
                    </label>
                    <pre className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-800 overflow-x-auto">
                      {formatTestOutput(testCase.actualOutput)}
                    </pre>
                  </div>
                  )}

                  {testCase.stderr && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Error Output:
                    </label>
                    <pre className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-gray-800 overflow-x-auto">
                      {formatTestOutput(testCase.stderr)}
                    </pre>
                  </div>
                  )}

                  {testCase.description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description:
                      </label>
                      <p className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        {testCase.description}
                      </p>
                    </div>
                  )}

                  {testCase.status && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status:
                    </label>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${testCase.status === 'PASS' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                      {testCase.status}
                    </span>
                  </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <div className="flex items-center space-x-2 mb-2">
          <InformationCircleIcon className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-blue-900">Test Summary</span>
        </div>
        <div className="text-sm text-blue-800">
          <p>Total test cases: <strong>{displayCases.length}</strong></p>
          <p>Total points: <strong>{displayCases.reduce((sum, tc) => sum + (tc.points || 0), 0)}</strong></p>
        </div>
      </div>
    </div>
  );
}