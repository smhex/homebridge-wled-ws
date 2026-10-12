jest.mock('wled-client', () => require('./helpers/fakeWled').wledClientModule);

import { WledWsPlatformAccessory } from '../src/WledWsPlatformAccessory';
import {
  clients,
  createAccessory,
  flushPromises,
  mockLogger,
  mockPlatform,
} from './helpers/fakeWled';

describe('WledWsPlatformAccessory reconnect', () => {
  let instance: WledWsPlatformAccessory;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    clients.length = 0;
  });

  afterEach(() => {
    instance.disconnect();
    jest.useRealTimers();
  });

  it('schedules a reconnect when only the websocket connection failed', async () => {
    // HTTP succeeded, websocket did not: init resolves without open/error/close events
    instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      createAccessory() as any,
      false,
    );
    await flushPromises();
    expect(instance['connectionEstablished']).toBe(false);

    jest.advanceTimersByTime(10000);
    expect(clients).toHaveLength(2);
  });

  it('does not schedule a reconnect when the websocket is open', async () => {
    instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      createAccessory() as any,
      false,
    );
    clients[0].emit('open');
    await flushPromises();

    jest.advanceTimersByTime(10000);
    expect(clients).toHaveLength(1);
  });
});
