import { Injectable, signal } from '@angular/core';
import { DEFAULT_SHELL_CONTEXT, ShellContext } from '@shared/contracts';

@Injectable({ providedIn: 'root' })
export class ShellContextStore {
  readonly context = signal<ShellContext>(DEFAULT_SHELL_CONTEXT);

  update(patch: Partial<ShellContext>): void {
    this.context.update((current) => ({
      ...current,
      ...patch,
      session: {
        ...current.session,
        ...(patch.session ?? {})
      },
      featureFlags: {
        ...current.featureFlags,
        ...(patch.featureFlags ?? {})
      }
    }));
  }
}
