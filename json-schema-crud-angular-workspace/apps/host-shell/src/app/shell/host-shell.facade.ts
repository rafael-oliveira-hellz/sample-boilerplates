import { Injectable, computed, inject } from '@angular/core';
import { AppEventBus } from '../core/app-event-bus';
import { ShellContextStore } from '../core/shell-context.store';
import { REMOTE_REGISTRY } from '../remotes/remote-registry';

@Injectable({ providedIn: 'root' })
export class HostShellFacade {
  readonly eventBus = inject(AppEventBus);
  readonly contextStore = inject(ShellContextStore);
  readonly remotes = REMOTE_REGISTRY;
  readonly shellContext = this.contextStore.context;
  readonly recentEvents = computed(() => this.eventBus.history());
}
