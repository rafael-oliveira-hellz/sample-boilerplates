import React from 'react';
import ReactDOM from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { RemoteModule, RemoteMountOptions } from '@porto/shared-contracts';
import { ShellContextProvider } from '@porto/shared-runtime';
import { App } from '../App';
export { JsonMapperSummaryWidget } from '../widgets';

let root: ReactDOM.Root | null = null;

export const jsonMapperRemote: RemoteModule = {
  async mount(options: RemoteMountOptions): Promise<void> {
    root?.unmount();
    options.hostElement.innerHTML = '';
    root = ReactDOM.createRoot(options.hostElement);

    flushSync(() => {
      root?.render(
        <React.StrictMode>
          <ShellContextProvider context={options.context}>
            <App onEvent={options.onEvent} />
          </ShellContextProvider>
        </React.StrictMode>
      );
    });

    options.onEvent?.({
      type: 'MAPPER/LOADED',
      payload: { source: 'shell' }
    });
  },
  async unmount(): Promise<void> {
    root?.unmount();
    root = null;
  }
};

export default jsonMapperRemote;
