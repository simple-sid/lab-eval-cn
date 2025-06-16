import { useState } from 'react';
import TerminalTabs from './TerminalTabs';
import TerminalComponent from './Terminal';
import { v4 as uuidv4 } from 'uuid';
import {
  CommandLineIcon,
  XMarkIcon,
  TrashIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

export default function TerminalPane({ onClose }) {
  const jwtToken = localStorage.getItem('jwt'); // assuming JWT is stored here

  const [terminals, setTerminals] = useState([
    {
      id: 'main',
      name: 'Main Terminal',
      output: ''
    }
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState('main');

  const addTerminal = () => {
    const newId = uuidv4();
    const newTerminal = {
      id: newId,
      name: `Terminal ${terminals.length + 1}`,
      output: ''
    };
    setTerminals(prev => [...prev, newTerminal]);
    setActiveTerminalId(newId);
  };

  const closeTerminal = (terminalId) => {
    if (terminals.length <= 1) return;
    setTerminals(terminals.filter(t => t.id !== terminalId));
    if (activeTerminalId === terminalId) {
      const remaining = terminals.filter(t => t.id !== terminalId);
      setActiveTerminalId(remaining[0]?.id || 'main');
    }
  };

  const clearTerminal = (terminalId) => {
    setTerminals(terminals.map(t =>
      t.id === terminalId ? { ...t, output: '' } : t
    ));
  };

  const activeTerminal = terminals.find(t => t.id === activeTerminalId) || terminals[0];

  const TerminalRender = terminals.map((term) => (
    <TerminalComponent
      key={term.id}
      isVisible={term.id === activeTerminal.id}
      terminalId={term.id}
      token={jwtToken}
      output={term.output}
      setOutput={(newOutput) => {
        setTerminals(prev =>
          prev.map(t => {
            if (t.id !== term.id) return t;

            const updatedOutput =
              typeof newOutput === 'function' ? newOutput(t.output) : newOutput;

            return { ...t, output: updatedOutput };
          })
        );
      }}
    />
  ));

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <CommandLineIcon className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-white">Terminal</h2>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => clearTerminal(activeTerminalId)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Clear terminal"
          >
            <TrashIcon className="w-4 h-4" />
          </button>

          <button
            onClick={addTerminal}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="New terminal"
          >
            <PlusIcon className="w-4 h-4" />
          </button>

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

      <TerminalTabs
        terminals={terminals}
        activeTerminalId={activeTerminalId}
        setActiveTerminalId={setActiveTerminalId}
        closeTerminal={closeTerminal}
        setTerminals={setTerminals}
      />

      {TerminalRender}
    </div>
  );
}