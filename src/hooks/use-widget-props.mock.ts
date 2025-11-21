import { useOpenAiGlobal } from "./use-openai-global";

export function useWidgetProps<T extends Record<string, unknown>>(
  defaultState?: T | (() => T)
): T {
  // Mock data for figma/figjam widgets
  const mockData = {
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

  return mockData as unknown as T;
}









