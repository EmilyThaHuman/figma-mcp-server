import React from 'react';
import ReactDOM from 'react-dom/client';
import FigjamDiagram from './figjam-diagram';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <FigjamDiagram />
    </React.StrictMode>
  );
}









