import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

const savedMode = localStorage.getItem('drizzle-dark-mode');
const dark = savedMode ? savedMode === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.classList.toggle('dark', dark);
document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);