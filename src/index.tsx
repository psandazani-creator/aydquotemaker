if (window.location.pathname.startsWith('/admin')) {
  const isDev = import.meta.env.DEV;
  if (isDev) {
    window.location.href = window.location.href + '';
  } else {
    window.location.replace('/');
  }
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/window.css';
import './styles/theme.css';
import './styles/global.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
