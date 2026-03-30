export interface UserSession {
  userId: string;
  tenantId: string;
  roles: readonly string[];
}

export interface ShellContext {
  session: UserSession;
  locale: string;
  theme: 'porto-light' | 'porto-dark';
  featureFlags: Readonly<Record<string, boolean>>;
  apiBaseUrl: string;
  appName?: string;
}

export const DEFAULT_SHELL_CONTEXT: ShellContext = {
  session: {
    userId: 'local-user',
    tenantId: 'porto',
    roles: ['admin']
  },
  locale: 'pt-BR',
  theme: 'porto-light',
  featureFlags: {},
  apiBaseUrl: 'http://localhost:8080/api',
  appName: 'mfe-json-mapper-react'
};
