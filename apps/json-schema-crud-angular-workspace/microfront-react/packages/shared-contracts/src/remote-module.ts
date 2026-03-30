import type { AppEvent } from './app-event';
import type { ShellContext } from './shell-context';

export interface RemoteMountOptions {
  hostElement: HTMLElement;
  context: ShellContext;
  onEvent?(event: AppEvent): void;
}

export interface RemoteModule {
  mount(options: RemoteMountOptions): Promise<void>;
  unmount(): Promise<void>;
}
