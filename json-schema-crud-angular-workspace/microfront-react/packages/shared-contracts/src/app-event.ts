import type { ShellContext, UserSession } from './shell-context';

export type AppEvent =
  | { type: 'AUTH/SESSION_UPDATED'; payload: UserSession }
  | { type: 'MAPPER/LOADED'; payload: { source: 'standalone' | 'shell' } }
  | { type: 'MAPPER/PREVIEW_OPENED'; payload: { activeTab: 'schema' | 'errors' } }
  | { type: 'SHELL/CONTEXT_UPDATED'; payload: ShellContext };
