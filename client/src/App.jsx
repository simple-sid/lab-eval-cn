import CNLabWorkspace from './components/CNLabWorkspace';
import './App.css';

const mockQuestion = {
  id: 'tcp-socket-programming',
  title: "TCP Socket Programming",
  difficulty: "Medium",
  timeLimit: 3600, // 60 minutes
  description: `
    <div class="question-content">
      <div class="intro-section">
        <p class="lead-text">In this lab, you will implement a simple TCP client-server communication system using Python.</p>
      </div>
      
      <div class="objectives-section">
        <h3><span class="icon">🎯</span> Objectives</h3>
        <ul class="styled-list">
          <li>Understand TCP socket programming concepts</li>
          <li>Implement client-server communication</li>
          <li>Handle multiple client connections</li>
          <li>Implement proper error handling</li>
        </ul>
      </div>

      <div class="requirements-section">
        <h3><span class="icon">📋</span> Requirements</h3>
        <ol class="requirements-list">
          <li><strong>Server Implementation:</strong>
            <ul class="sub-requirements">
              <li>Create a TCP server that listens on port 8080</li>
              <li>Accept multiple client connections</li>
              <li>Echo back messages sent by clients</li>
              <li>Handle client disconnections gracefully</li>
            </ul>
          </li>
          <li><strong>Client Implementation:</strong>
            <ul class="sub-requirements">
              <li>Connect to the server on localhost:8080</li>
              <li>Send messages to the server</li>
              <li>Display server responses</li>
              <li>Allow graceful disconnection</li>
            </ul>
          </li>
        </ol>
      </div>

      <div class="tips-section">
        <h3><span class="icon">💡</span> Tips</h3>
        <ul class="tips-list">
          <li>Use Python's <code>socket</code> library</li>
          <li>Implement proper exception handling</li>
          <li>Test with multiple clients</li>
          <li>Use threading for handling multiple connections</li>
        </ul>
      </div>
    </div>
  `,
  testCases: [
    {
      id: 'test-1',
      name: "Basic Connection Test",
      input: 'Hello, Server!',
      expectedOutput: 'Echo: Hello, Server!',
      points: 25
    },
    {
      id: 'test-2', 
      name: "Multiple Messages Test",
      input: ['Message 1', 'Message 2', 'Message 3'],
      expectedOutput: ['Echo: Message 1', 'Echo: Message 2', 'Echo: Message 3'],
      points: 25
    },
    {
      id: 'test-3',
      name: "Disconnect Test", 
      input: 'quit',
      expectedOutput: 'Connection closed gracefully',
      points: 25
    },
    {
      id: 'test-4',
      name: "Multiple Clients Test",
      input: 'concurrent_clients_test',
      expectedOutput: 'All clients handled successfully',
      points: 25
    }
  ]
};

const anotherMockQuestion = {
  id: 'udp-socket-programming',
  title: "UDP Socket Programming",
  difficulty: "Easy",
  timeLimit: 1800, // 30 minutes
  description: `
    <div class="question-content">
      <div class="intro-section">
        <p class="lead-text">In this lab, you will implement a simple UDP client-server communication system using Python.</p>
      </div>
      <div class="objectives-section">
        <h3><span class="icon">🎯</span> Objectives</h3>
        <ul class="styled-list">
          <li>Understand UDP socket programming concepts</li>
          <li>Implement client-server communication</li>
        </ul>
      </div>
      <div class="requirements-section">
        <h3><span class="icon">📋</span> Requirements</h3>
        <ol class="requirements-list">
          <li><strong>Server Implementation:</strong>
            <ul class="sub-requirements">
              <li>Create a UDP server that listens on port 9090</li>
              <li>Echo back messages sent by clients</li>
            </ul>
          </li>
          <li><strong>Client Implementation:</strong>
            <ul class="sub-requirements">
              <li>Connect to the server on localhost:9090</li>
              <li>Send messages to the server</li>
              <li>Display server responses</li>
            </ul>
          </li>
        </ol>
      </div>
    </div>
  `,
  testCases: [
    {
      id: 'udp-test-1',
      name: "UDP Basic Test",
      input: 'Hello, UDP Server!',
      expectedOutput: 'Echo: Hello, UDP Server!',
      points: 50
    },
    {
      id: 'udp-test-2',
      name: "UDP Multiple Messages",
      input: ['Hi', 'Bye'],
      expectedOutput: ['Echo: Hi', 'Echo: Bye'],
      points: 50
    }
  ]
};

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="relative z-10">
        <CNLabWorkspace />
      </div>
    </div>
  );
}

export default App;