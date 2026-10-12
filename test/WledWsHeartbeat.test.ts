jest.mock('wled-client', () => require('./helpers/fakeWled').wledClientModule);

import { WledWsPlatformAccessory } from '../src/WledWsPlatformAccessory';
import {
  clients,
  createAccessory,
  flushPromises,
  mockLogger,
  mockPlatform,
} from './helpers/fakeWled';

describe('WledWsPlatformAccessory websocket heartbeat', () => {
  let instance: WledWsPlatformAccessory;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    clients.length = 0;
    instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      createAccessory() as any,
      false,
    );
    clients[0].emit('open');
    await flushPromises();
  });

  afterEach(() => {
    instance.disconnect();
    jest.useRealTimers();
  });

  it('keeps the connection when the ping is answered with a pong', () => {
    jest.advanceTimersByTime(30000);
    expect(clients[0].WSAPI.websocket.ping).toHaveBeenCalledTimes(1);

    clients[0].WSAPI.websocket.emit('pong');
    jest.advanceTimersByTime(10000);

    expect(clients[0].WSAPI.websocket.terminate).not.toHaveBeenCalled();
    expect(instance['connectionEstablished']).toBe(true);
  });

  it('keeps the connection when other data arrives after the ping', () => {
    jest.advanceTimersByTime(30000);
    clients[0].emit('update:effects');
    jest.advanceTimersByTime(10000);

    expect(clients[0].WSAPI.websocket.terminate).not.toHaveBeenCalled();
    expect(instance['connectionEstablished']).toBe(true);
  });

  it('reconnects when the ping is not answered', () => {
    jest.advanceTimersByTime(30000);
    expect(clients[0].WSAPI.websocket.ping).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(10000);
    expect(clients[0].WSAPI.websocket.terminate).toHaveBeenCalled();
    expect(instance['connectionEstablished']).toBe(false);

    jest.advanceTimersByTime(10000);
    expect(clients).toHaveLength(2);
  });

  it('reconnects when the ping throws', () => {
    clients[0].WSAPI.websocket.ping.mockImplementation(() => {
      throw new Error('WebSocket is not open');
    });
    jest.advanceTimersByTime(30000);

    expect(clients[0].WSAPI.websocket.terminate).toHaveBeenCalled();
    jest.advanceTimersByTime(10000);
    expect(clients).toHaveLength(2);
  });
});
