import type { AppEvent } from '@porto/shared-contracts';

export class AppEventBus {
  #events: AppEvent[] = [];
  #listeners = new Set<(events: readonly AppEvent[]) => void>();

  publish(event: AppEvent): void {
    this.#events = [event, ...this.#events].slice(0, 8);
    this.#listeners.forEach((listener) => listener(this.#events));
  }

  subscribe(listener: (events: readonly AppEvent[]) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#events);
    return () => this.#listeners.delete(listener);
  }
}
