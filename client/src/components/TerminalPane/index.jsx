import { useState } from 'react';
import TerminalTabs from './TerminalTabs';
import TerminalComponent from './Terminal';
import { v4 as uuidv4 } from 'uuid';
import {
  CommandLineIcon,
  XMarkIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

export default function TerminalPane({ 
  onClose,
  termVisible,
  setCurrentWorkingDir
}) {
  const jwtToken = localStorage.getItem('jwt'); // assuming JWT is stored here

  const [terminals, setTerminals] = useState([
    { id: 'main', name: 'Main Terminal', buffer: [] }
  ]);

  const [activeTerminalId, setActiveTerminalId] = useState('main');

  const addTerminal = () => {
    const newId = uuidv4();
    const newTerminal = {
      id: newId,
      name: `Terminal ${terminals.length + 1}`,
      buffer: [],
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

  const updateBuffer = (termId, chunk) => {
    setTerminals(ts => 
      ts.map(t => t.id === termId
        ? { ...t, buffer: [...t.buffer, chunk] }
        : t
      )
    )
  }

  const activeTerminal = terminals.find(t => t.id === activeTerminalId) || terminals[0];

  const TerminalRender = terminals.map((term) => (
    <TerminalComponent
      key={term.id}
      isVisible={term.id === activeTerminalId}
      isTermVisible= {termVisible}
      terminalId={term.id}
      initialBuffer={term.buffer}
      onData={chunk => updateBuffer(term.id, chunk)}
      token={jwtToken}
      setCurrentWorkingDir={(termId, cwd) => setCurrentWorkingDir(cwd)} 
    />
  ));

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between py-0.5 px-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <CommandLineIcon className="w-5 h-5 text-green-400" />
          <h2 className="text-md font-semibold text-white">Terminal</h2>
        </div>

        <div className="flex items-center space-x-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Close terminal"
            >
              <XMarkIcon className="w-5 h-5" />
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
        addTerminal={addTerminal}
      />

      {TerminalRender}
    </div>
  );
}