import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { configureRuntimeDependencies } from './app/bootstrap/configure-runtime';
import { registerBuiltins } from './widgets/registry/register-builtins';

registerBuiltins();
configureRuntimeDependencies();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
