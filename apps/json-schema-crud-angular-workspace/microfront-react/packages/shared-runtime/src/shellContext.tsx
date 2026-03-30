import React, { createContext, useContext } from 'react';
import { DEFAULT_SHELL_CONTEXT, type ShellContext } from '@porto/shared-contracts';

const ShellContextReact = createContext<ShellContext>(DEFAULT_SHELL_CONTEXT);

interface ShellContextProviderProps {
  context: ShellContext;
  children: React.ReactNode;
}

export function ShellContextProvider({ context, children }: ShellContextProviderProps): JSX.Element {
  return <ShellContextReact.Provider value={context}>{children}</ShellContextReact.Provider>;
}

export function useShellContext(): ShellContext {
  return useContext(ShellContextReact);
}
