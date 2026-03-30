import { ShellContext, UserSession } from './shell-context';

export type AppEvent =
  | { type: 'AUTH/SESSION_UPDATED'; payload: UserSession }
  | { type: 'MAPPER/LOADED'; payload: { source: 'standalone' | 'shell' } }
  | { type: 'MAPPER/SAVE_STARTED'; payload: { nomeParceiro: string } }
  | { type: 'MAPPER/SAVE_SUCCEEDED'; payload: { configId?: string; nomeParceiro: string } }
  | { type: 'MAPPER/SAVE_FAILED'; payload: { message: string } }
  | { type: 'MAPPER/LOAD_LATEST_SUCCEEDED'; payload: { configId?: string } }
  | { type: 'MAPPER/PREVIEW_OPENED'; payload: { activeTab: 'schema' | 'errors' } }
  | { type: 'SHELL/CONTEXT_UPDATED'; payload: ShellContext };
