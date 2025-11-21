import{c as n,j as e,R as t,F as s}from"./figjam-diagram-BdJLCYlL.js";const a={title:"User Authentication Flow",description:"This diagram illustrates the complete user authentication process including login, session management, and token refresh flows.",diagramType:"flowchart",mermaidCode:`flowchart TD
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
    Continue --> End([User Active])`,fileKey:"abc123def456",nodeId:"node789",lastModified:"2024-11-05T10:30:00Z",author:"John Doe"};function i(){const r=window.matchMedia("(prefers-color-scheme: dark)").matches;return e.jsx("div",{className:"min-h-screen flex items-center justify-center p-4",style:{backgroundColor:r?"#212121":"#F5F5F5"},children:e.jsx("div",{className:"w-[760px]",children:e.jsx(s,{...a})})})}const o=document.getElementById("root");o&&n.createRoot(o).render(e.jsx(t.StrictMode,{children:e.jsx(i,{})}));
