import { ApplicationRef } from '@angular/core';
import { RemoteModule, RemoteMountOptions } from '../../../../libs/shared/contracts/src';
import { mountJsonMapperRemote } from '../bootstrap/bootstrap-json-mapper-app';

let appRef: ApplicationRef | null = null;
let mountedHost: HTMLElement | null = null;

export const jsonMapperRemote: RemoteModule = {
  async mount(options: RemoteMountOptions): Promise<void> {
    if (appRef) {
      await jsonMapperRemote.unmount();
    }

    mountedHost = options.hostElement;
    appRef = await mountJsonMapperRemote(options);
    options.onEvent?.({
      type: 'MAPPER/LOADED',
      payload: {
        source: 'shell'
      }
    });
  },

  async unmount(): Promise<void> {
    appRef?.destroy();
    appRef = null;

    if (mountedHost) {
      mountedHost.innerHTML = '';
      mountedHost = null;
    }
  }
};

export default jsonMapperRemote;

