import React from 'react';
import ReactDOM from 'react-dom/client';
import { DEFAULT_SHELL_CONTEXT } from '@porto/shared-contracts';
import { ShellContextProvider } from '@porto/shared-runtime';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ShellContextProvider context={DEFAULT_SHELL_CONTEXT}>
      <App />
    </ShellContextProvider>
  </React.StrictMode>
);
