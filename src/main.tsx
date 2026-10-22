import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces/soft.css';
import '@fontsource-variable/archivo/wdth.css';
import './styles/app.css';
import { App } from './App';
import { startRenderer } from './engine/renderer';

startRenderer();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
