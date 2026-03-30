import { AppEventBus } from './app-event-bus';

describe('AppEventBus', () => {
  it('stores and emits recent events', () => {
    const bus = new AppEventBus();
    const listener = jasmine.createSpy('listener');

    const unsubscribe = bus.subscribe(listener);
    bus.emit({ type: 'MAPPER/LOADED', payload: { source: 'shell' } });

    expect(listener).toHaveBeenCalled();
    expect(bus.history().length).toBe(1);

    unsubscribe();
    bus.emit({ type: 'MAPPER/PREVIEW_OPENED', payload: { activeTab: 'schema' } });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(bus.history().length).toBe(2);
  });
});
