import { useState } from 'react';
import TerminalTabs from './TerminalTabs';
import XTerminal from './XTerminal';
import { 
  CommandLineIcon,
  XMarkIcon,
  TrashIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

export default function TerminalPane({ output = [], onClose, onClear }) {
  const [terminals, setTerminals] = useState([
    { id: 'main', name: 'Main Terminal', output: output }
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState('main');

  const addTerminal = () => {
    const newId = `terminal_${Date.now()}`;
    const newTerminal = {
      id: newId,
      name: `Terminal ${terminals.length + 1}`,
      output: []
    };
    setTerminals([...terminals, newTerminal]);
    setActiveTerminalId(newId);
  };

  const closeTerminal = (terminalId) => {
    if (terminals.length <= 1) return; // Keep at least one terminal
    
    setTerminals(terminals.filter(t => t.id !== terminalId));
    
    if (activeTerminalId === terminalId) {
      setActiveTerminalId(terminals[0]?.id || 'main');
    }
  };

  const clearTerminal = (terminalId) => {
    setTerminals(terminals.map(t => 
      t.id === terminalId ? { ...t, output: [] } : t
    ));
  };

  const activeTerminal = terminals.find(t => t.id === activeTerminalId) || terminals[0];

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <CommandLineIcon className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-white">Terminal</h2>
        </div>

        <div className="flex items-center space-x-2">
          {/* Clear button */}
          <button
            onClick={() => clearTerminal(activeTerminalId)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Clear terminal"
          >
            <TrashIcon className="w-4 h-4" />
          </button>

          {/* Add terminal */}
          <button
            onClick={addTerminal}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="New terminal"
          >
            <PlusIcon className="w-4 h-4" />
          </button>

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Close terminal"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal tabs */}
      <TerminalTabs
        terminals={terminals}
        activeTerminalId={activeTerminalId}
        setActiveTerminalId={setActiveTerminalId}
        closeTerminal={closeTerminal}
        setTerminals={setTerminals}
      />

      {/* Terminal content */}
      <div className="flex-1 overflow-hidden">
        <XTerminal
          terminalId={activeTerminalId}
          output={activeTerminal?.output || []}
        />
      </div>
    </div>
  );
}