import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function TerminalTabs({ 
  terminals, 
  activeTerminalId, 
  setActiveTerminalId, 
  closeTerminal,
  setTerminals
}) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const startRename = (terminalId, currentName) => {
    setEditingId(terminalId);
    setEditName(currentName);
  };

  const finishRename = () => {
    if (editingId && editName.trim()) {
      setTerminals(prev => prev.map(t => t.id === editingId ? { ...t, name: editName.trim() } : t));
    }
    setEditingId(null);
    setEditName('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      finishRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditName('');
    }
  };

  return (
    <div className="flex bg-gray-800 border-b border-gray-700 overflow-x-auto">
      {terminals.map((terminal) => (
        <div
          key={terminal.id}
          className={`
            group relative flex items-center min-w-0 px-3 py-2 border-r border-gray-700 cursor-pointer transition-colors
            ${activeTerminalId === terminal.id 
              ? 'bg-gray-900 text-green-400' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }
          `}
          onClick={() => setActiveTerminalId(terminal.id)}
        >
          <div className={`w-2 h-2 rounded-full mr-2 ${
            activeTerminalId === terminal.id ? 'bg-green-400' : 'bg-gray-500'
          }`} />
          
          {/* edit terminal name */}
          {editingId === terminal.id ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={finishRename}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-none outline-none text-sm text-white min-w-0 flex-1"
              autoFocus
            />
          ) : (
            <span 
              className="text-sm truncate max-w-32"
              onDoubleClick={() => startRename(terminal.id, terminal.name)}
              title={terminal.name}
            >
              {terminal.name}
            </span>
          )}

          {/* Close */}
          {terminals.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(terminal.id);
              }}
              className="ml-2 p-0.5 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Close terminal"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}