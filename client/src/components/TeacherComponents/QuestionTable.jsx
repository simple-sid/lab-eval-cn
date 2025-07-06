const QuestionTable = ({ questions, editQuestion, deleteQuestion }) => {
  return (
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
                  onClick={() => editQuestion(q)}
                  className="text-indigo-600 hover:text-indigo-900 mr-2"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteQuestion(q._id)}
                  className="text-red-600 hover:text-red-900 ml-2"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default QuestionTable;
