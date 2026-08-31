import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Tokens first — every stylesheet after this resolves against them.
import './styles/tokens.css';
import './styles/index.css';
import './styles/icons.css';
import './styles/animations.css';
import { ToastProvider } from './components/ui/Toast';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
