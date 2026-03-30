import { Injectable, signal } from '@angular/core';
import { AppEvent } from '@shared/contracts';

type AppEventListener = (event: AppEvent) => void;

@Injectable({ providedIn: 'root' })
export class AppEventBus {
  private readonly listeners = new Set<AppEventListener>();
  readonly history = signal<AppEvent[]>([]);

  emit(event: AppEvent): void {
    this.history.update((current) => [...current.slice(-19), event]);
    this.listeners.forEach((listener) => listener(event));
  }

  subscribe(listener: AppEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
