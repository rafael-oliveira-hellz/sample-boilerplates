import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { DEFAULT_SHELL_CONTEXT, ShellContext } from '../../contracts/src';

export const SHELL_CONTEXT = new InjectionToken<ShellContext>('SHELL_CONTEXT');

export function provideShellContext(context?: Partial<ShellContext>): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SHELL_CONTEXT,
      useValue: {
        ...DEFAULT_SHELL_CONTEXT,
        ...(context ?? {}),
        session: {
          ...DEFAULT_SHELL_CONTEXT.session,
          ...(context?.session ?? {})
        },
        featureFlags: {
          ...DEFAULT_SHELL_CONTEXT.featureFlags,
          ...(context?.featureFlags ?? {})
        }
      } satisfies ShellContext
    }
  ]);
}
