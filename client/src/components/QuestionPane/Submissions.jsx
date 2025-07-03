import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, CodeBracketIcon, ClockIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function Submissions({ userId, questionId }) {
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const query = new URLSearchParams({ userId, questionId });
        const res = await fetch(`http://localhost:5001/api/submission/fetch?${query}`);
        const data = await res.json();
        setSubmissions(data);
      } catch (err) {
        console.error('[Frontend] Failed to load submissions:', err);
      }
    };

    fetchSubmissions();
  }, [userId, questionId]);

  if (selectedSubmission) {
    return (
      <div className="p-6 space-y-4 fade-in-up">
        <button
          className="flex items-center text-sm text-blue-600 hover:underline"
          onClick={() => setSelectedSubmission(null)}
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          Back to Submissions
        </button>

        <h3 className="text-lg font-semibold text-gray-800">Submission Code</h3>

        {selectedSubmission.sourceCode &&
          Object.entries(selectedSubmission.sourceCode).map(([fname, code]) => (
            <div key={fname} className="relative group">
              <div className="font-mono text-xs text-gray-500 mb-1">
                Submitted code: <b>{fname}</b>
              </div>
              {/* Copy to clipboard */}
              <button
                className="absolute top-1 right-1 text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-500 hover:text-white transition hidden group-hover:block"
                onClick={() => {
                  navigator.clipboard.writeText(code);
                }}
              >
                📋 Copy
              </button>
              <pre className="bg-gray-100 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap mb-4">
                {code}
              </pre>
            </div>
          ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 fade-in-up">
      <h3 className="text-lg font-semibold text-gray-800">Submission History</h3>

      {submissions.length === 0 ? (
        <div className="text-sm text-gray-500 italic">No submissions yet.</div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-100 bg-white shadow-sm">
          {submissions.map((submission) => (
            <li
              key={submission.id}
              className="flex justify-between items-center p-4 hover:bg-gray-50 transition-all cursor-pointer"
              onClick={() => setSelectedSubmission(submission)}
            >
              <div className="flex items-center space-x-3">
                {submission.status === 'Accepted' ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-500" />
                )}
                <div>
                  <div className="font-medium text-sm text-gray-800">
                    {submission.status}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center space-x-2">
                    <ClockIcon className="w-4 h-4 text-gray-400" />
                    <span>{submission.timestamp}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <CodeBracketIcon className="w-4 h-4 text-blue-500" />
                  <span>{submission.language}</span>
                </div>
                <div className="text-xs font-mono text-gray-700">
                  {submission.passed} / {submission.total} Test Cases
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}