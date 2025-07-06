import { PlusIcon } from '@heroicons/react/24/outline';

const formInputClasses = "w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
const formNumberInputClasses = "w-24 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export const TabButton = ({ active, onClick, children, curved = false }) => (
  <div
    onClick={onClick}
    className={`
      relative px-5 py-2 text-sm font-medium
      flex items-center space-x-2
      cursor-pointer group
      ${active
        ? 'text-indigo-600 border-t-2 border-indigo-600 bg-white'
        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}
    `}
    style={{
      borderTopLeftRadius: curved && active ? '6px' : '0',
      borderTopRightRadius: curved && active ? '6px' : '0',
      marginRight: '2px',
      position: curved && active ? 'relative' : 'static',
    }}
    role="button"
    tabIndex={0}
  >
    {children}
    
    {/* Add pseudo-elements for the curved bottom effect when tab is active and curved */}
    {curved && active && (
      <>
        <span className="absolute bottom-0 left-0 right-0 h-1 bg-white" />
        
        {/* Left bottom inverted curve */}
        <span 
          className="absolute bottom-0 left-0 w-2 h-2 bg-white"
          style={{
            transform: 'translateY(1px)',
            boxShadow: '-3px 3px 0 0 white',
            borderBottomLeftRadius: '5px',
            marginLeft: '-1px',
            zIndex: 5,
          }}
        />
        
        {/* Right bottom inverted curve */}
        <span 
          className="absolute bottom-0 right-0 w-2 h-2 bg-white"
          style={{
            transform: 'translateY(1px)',
            boxShadow: '3px 3px 0 0 white',
            borderBottomRightRadius: '5px',
            marginRight: '-1px',
            zIndex: 5,
          }}
        />
      </>
    )}
  </div>
);



// Form section component
export const FormSection = ({ title, children }) => (
  <div className="bg-white rounded-lg">
    <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

// Form label component
export const FormLabel = ({ htmlFor, required, children }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    {required && <span className="ml-1 text-red-500">*</span>}
  </label>
);

// Error message component
export const ErrorMessage = ({ children }) => (
  <p className="mt-1 text-sm text-red-600">{children}</p>
);

// Test case section component
export const TestCaseSection = ({ type, testCases, addTestCase, removeTestCase, handleTestCaseChange, showMatchTypeSelect }) => (
  <div className="bg-gray-50 rounded-lg p-4 border mb-6">
    <div className="flex justify-between items-center mb-3">
      <h4 className="font-medium text-gray-700">{type.charAt(0).toUpperCase() + type.slice(1)} Test Cases</h4>
      <button
        type="button"
        onClick={() => addTestCase(type)}
        className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
      >
        <PlusIcon className="w-3 h-3 mr-1" />
        <span>Add Test Case</span>
      </button>
    </div>
    
    {testCases.length === 0 ? (
      <p className="text-sm text-gray-500 italic">No test cases added yet.</p>
    ) : (
      testCases.map((tc, idx) => (  
        <div key={idx} className="mb-4 bg-white rounded-md border p-4 last:mb-0">
          <div className="flex justify-between items-center mb-3">
            <h5 className="font-medium text-gray-900">Test Case #{idx + 1}</h5>
            <button
              type="button"
              onClick={() => removeTestCase(type, idx)}
              disabled={testCases.length === 1}
              className={`text-sm text-red-500 hover:text-red-700 ${testCases.length === 1 && type === 'server' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Input</label>
              <input 
                value={tc.input} 
                onChange={e => handleTestCaseChange(type, idx, 'input', e.target.value)} 
                placeholder="Test input" 
                className={formInputClasses}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Expected Output</label>
              <input 
                value={tc.expectedOutput} 
                onChange={e => handleTestCaseChange(type, idx, 'expectedOutput', e.target.value)} 
                placeholder="Expected output" 
                className={formInputClasses} 
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <input 
                value={tc.description} 
                onChange={e => handleTestCaseChange(type, idx, 'description', e.target.value)} 
                placeholder="What this test case verifies" 
                className={formInputClasses} 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Points</label>
              <input 
                type="number" 
                value={tc.points} 
                onChange={e => handleTestCaseChange(type, idx, 'points', e.target.value)} 
                placeholder="Points" 
                className={formNumberInputClasses} 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Client Count</label>
              <input 
                type="number"
                value={tc.clientCount || ''}
                onChange={e => handleTestCaseChange(type, idx, 'clientCount', e.target.value)}
                placeholder="Enter client count for this test case"
                className={formInputClasses}
              />
            </div>
            {showMatchTypeSelect && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Match Type</label>
                <select
                  value={tc.matchType || 'contains'}
                  onChange={e => handleTestCaseChange(type, idx, 'matchType', e.target.value)}
                  className={formInputClasses}
                >
                  <option value="contains">Contains</option>
                  <option value="exact">Exact</option>
                  <option value="regex">Regex</option>
                  <option value="datetime">Datetime</option>
                  <option value="arithmetic">Arithmetic</option>
                </select>
              </div>
            )}
          </div>
        </div>
      ))
    )}
  </div>
);