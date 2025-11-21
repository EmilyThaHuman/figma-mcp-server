import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/index.css';

// Import widget
import FigjamDiagram from '../components/figjam-diagram';

// Mock data for preview mode
const mockDiagram = {
  title: 'User Authentication Flow',
  description: 'This diagram illustrates the complete user authentication process including login, session management, and token refresh flows.',
  diagramType: 'flowchart',
  mermaidCode: `flowchart TD
    Start([User Opens App]) --> CheckAuth{Is User\\nAuthenticated?}
    CheckAuth -->|Yes| LoadDashboard[Load Dashboard]
    CheckAuth -->|No| ShowLogin[Show Login Page]
    ShowLogin --> EnterCreds[User Enters Credentials]
    EnterCreds --> ValidateCreds{Validate\\nCredentials}
    ValidateCreds -->|Valid| CreateSession[Create Session Token]
    ValidateCreds -->|Invalid| ShowError[Show Error Message]
    ShowError --> ShowLogin
    CreateSession --> StoreToken[Store Token in LocalStorage]
    StoreToken --> LoadDashboard
    LoadDashboard --> CheckTokenExp{Token\\nExpired?}
    CheckTokenExp -->|Yes| RefreshToken[Refresh Token]
    CheckTokenExp -->|No| Continue[Continue Using App]
    RefreshToken --> StoreToken
    Continue --> End([User Active])`,
  fileKey: 'abc123def456',
  nodeId: 'node789',
  lastModified: '2024-11-05T10:30:00Z',
  author: 'John Doe',
};

function App() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: isDark ? '#212121' : '#F5F5F5' }}
    >
      <div className="w-[760px]">
        <FigjamDiagram {...mockDiagram} />
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}








