import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Global styles first, so each screen's own stylesheet can build on them.
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
