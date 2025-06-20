import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const initialQuestion = {
  title: '',
  description: '',
  image: '',
  precode: { 'server.c': '// Add starter code here\n' },
  clientPrecode: { 'client.c': '// Add starter code here\n' },
  solution: { 'server.c': '// Add solution code here\n' },
  clientSolution: { 'client.c': '// Add solution code here\n' },
  testCases: [
    { input: '', expectedOutput: '', description: '', points: 5 }
  ],
  evaluationScript: 'evaluate_server1.sh'
};

export default function TeacherUpload() {
  const [question, setQuestion] = useState(initialQuestion);
  const [message, setMessage] = useState('');
  const [codeType, setCodeType] = useState('precode');
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedImage, setSelectedImage] = useState(null);

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
  const handleChange = (e) => {
    const { name, value } = e.target;
    setQuestion(q => ({ ...q, [name]: value }));
  };
  
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
      
      // Create a preview URL and store it in the question state
      const imageUrl = URL.createObjectURL(e.target.files[0]);
      setQuestion(q => ({ ...q, image: imageUrl }));
    }
  };

  const handleTestCaseChange = (idx, field, value) => {
    setQuestion(q => {
      const testCases = [...q.testCases];
      testCases[idx][field] = field === 'points' ? parseInt(value) || 0 : value;
      return { ...q, testCases };
    });
  };

  const addTestCase = () => {
    setQuestion(q => ({ 
      ...q, 
      testCases: [...q.testCases, { input: '', expectedOutput: '', description: '', points: 5 }] 
    }));
  };

  const removeTestCase = (idx) => {
    setQuestion(q => ({ 
      ...q, 
      testCases: q.testCases.filter((_, i) => i !== idx) 
    }));
  };

  const handleCodeChange = (type, file, code) => {
    setQuestion(q => ({
      ...q,
      [type]: { ...q[type], [file]: code }
    }));
  };

  const addCodeFile = (type) => {
    const fileName = prompt(`Enter new file name for ${type}:`);
    if (fileName && fileName.trim()) {
      setQuestion(q => ({
        ...q,
        [type]: { ...q[type], [fileName]: '// New file\n' }
      }));
    }
  };

  const deleteCodeFile = (type, file) => {
    if (confirm(`Delete ${file} from ${type}?`)) {
      setQuestion(q => {
        const newFiles = { ...q[type] };
        delete newFiles[file];
        return { ...q, [type]: newFiles };
      });
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // For a simple demo, we'll just use a FormData object
      const formData = new FormData();
      
      // Add all question data except image
      Object.keys(question).forEach(key => {
        if (key !== 'image') {
          if (typeof question[key] === 'object') {
            formData.append(key, JSON.stringify(question[key]));
          } else {
            formData.append(key, question[key]);
          }
        }
      });
      
      // Add the image file if one was selected
      if (selectedImage) {
        formData.append('image', selectedImage);
      }
      
      // In a real implementation, the server would save the image and update the image path
      // For demo purposes, we'll assume the server handles this correctly
      await axios.post('http://localhost:5001/api/questions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setMessage('Question uploaded successfully!');
      setQuestion(initialQuestion);
      setSelectedImage(null);
      fetchQuestions();
    } catch (err) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Question Upload Portal</h1>
        
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="flex border-b">
            <button 
              className={`px-4 py-2 ${activeTab === 'upload' ? 'bg-indigo-100 text-indigo-700 border-b-2 border-indigo-500' : 'text-gray-600'}`}
              onClick={() => setActiveTab('upload')}
            >
              Upload New Question
            </button>
            <button 
              className={`px-4 py-2 ${activeTab === 'manage' ? 'bg-indigo-100 text-indigo-700 border-b-2 border-indigo-500' : 'text-gray-600'}`}
              onClick={() => setActiveTab('manage')}
            >
              Manage Questions
            </button>
          </div>
          
          {activeTab === 'upload' ? (
            <div className="p-6">
              {message && (
                <div className={`p-4 mb-4 ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} rounded`}>
                  {message}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question Title</label>
                  <input 
                    name="title" 
                    value={question.title} 
                    onChange={handleChange} 
                    className="w-full border rounded p-2" 
                    required 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea 
                    name="description" 
                    value={question.description} 
                    onChange={handleChange} 
                    className="w-full border rounded p-2" 
                    rows={4} 
                    required 
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image (optional)</label>
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange} 
                      className="w-full border rounded p-2" 
                    />
                    {question.image && (
                      <div className="mt-2 relative">
                        <img 
                          src={question.image} 
                          alt="Preview" 
                          className="h-24 object-contain border rounded"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImage(null);
                            setQuestion(q => ({ ...q, image: '' }));
                          }}
                          className="absolute top-1 right-1 bg-red-100 text-red-700 rounded-sm p-1 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Evaluation Script</label>
                    <select
                      name="evaluationScript" 
                      value={question.evaluationScript} 
                      onChange={handleChange} 
                      className="w-full border rounded p-2"
                    >
                      <option value="evaluate_server1.sh">evaluate_server1.sh</option>
                      <option value="evaluate_server2.sh">evaluate_server2.sh</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Code Files</label>
                  <div className="border rounded p-4 bg-gray-50">
                    <div className="flex space-x-2 mb-4">
                      {['precode', 'clientPrecode', 'solution', 'clientSolution'].map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setCodeType(type)}
                          className={`px-3 py-1 rounded ${codeType === type ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}
                        >
                          {type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </button>
                      ))}
                    </div>
                    
                    <div className="mb-2 flex justify-between">
                      <span className="text-sm text-gray-600">Files for {codeType}</span>
                      <button
                        type="button"
                        onClick={() => addCodeFile(codeType)}
                        className="text-sm bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                      >
                        Add File
                      </button>
                    </div>
                    
                    {Object.entries(question[codeType] || {}).map(([filename, code]) => (
                      <div key={filename} className="mb-3 border rounded bg-white">
                        <div className="flex justify-between items-center bg-gray-100 px-3 py-1">
                          <span className="font-mono text-sm">{filename}</span>
                          <button 
                            type="button"
                            onClick={() => deleteCodeFile(codeType, filename)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                        <textarea
                          value={code}
                          onChange={(e) => handleCodeChange(codeType, filename, e.target.value)}
                          className="w-full p-3 font-mono text-sm h-40"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Test Cases</label>
                  
                  <div className="space-y-3">
                    {question.testCases.map((tc, idx) => (
                      <div key={idx} className="border p-4 rounded bg-gray-50">
                        <div className="flex justify-between items-center mb-2">
                          <h4>Test Case #{idx + 1}</h4>
                          <button
                            type="button"
                            onClick={() => removeTestCase(idx)}
                            disabled={question.testCases.length === 1}
                            className={`text-red-500 ${question.testCases.length === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            Remove
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <input 
                              value={tc.input} 
                              onChange={e => handleTestCaseChange(idx, 'input', e.target.value)} 
                              placeholder="Input" 
                              className="w-full border p-2 mb-2" 
                              required 
                            />
                          </div>
                          
                          <div>
                            <input 
                              value={tc.expectedOutput} 
                              onChange={e => handleTestCaseChange(idx, 'expectedOutput', e.target.value)} 
                              placeholder="Expected Output" 
                              className="w-full border p-2 mb-2" 
                              required 
                            />
                          </div>
                          
                          <div>
                            <input 
                              value={tc.description} 
                              onChange={e => handleTestCaseChange(idx, 'description', e.target.value)} 
                              placeholder="Description" 
                              className="w-full border p-2 mb-2" 
                            />
                          </div>
                          
                          <div>
                            <input 
                              type="number" 
                              value={tc.points} 
                              onChange={e => handleTestCaseChange(idx, 'points', e.target.value)} 
                              placeholder="Points" 
                              className="w-20 border p-2 mb-2" 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={addTestCase}
                      className="text-indigo-600"
                    >
                      + Add Test Case
                    </button>
                  </div>
                </div>
                
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className={`w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 ${isLoading ? 'opacity-70' : ''}`}
                >
                  {isLoading ? 'Uploading...' : 'Upload Question'}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Existing Questions</h2>
              
              {questions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No questions available. Start by creating one!</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test Cases</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eval Script</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {questions.map((q) => (
                        <tr key={q._id}>
                          <td className="px-6 py-4 whitespace-nowrap">{q.title}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{q.testCases?.length || 0}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{q.evaluationScript}</td>
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
        
        <div className="mt-4 text-center">
          <Link to="/workspace" className="text-indigo-600 hover:text-indigo-800">
            Return to Student Workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
