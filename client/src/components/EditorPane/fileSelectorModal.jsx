export default function FileSelectorModal({ files, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-30 flex items-center justify-center">
      <div className="bg-white p-4 rounded-lg shadow-md w-96 max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-2">Open File</h2>
        <p className="text-xs text-gray-500 mb-3">
          Files are listed based on the current working directory in the last used terminal.
          Use <code>cd</code> in terminal to change location.
          (If current working directory is not correctly shown try closing and reopening the terminal window)
        </p>
        <ul className="divide-y divide-gray-200">
          {files.map(file => (
            <li
              key={file}
              onClick={() => onSelect(file)}
              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition"
            >
              {file}
            </li>
          ))}
        </ul>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}