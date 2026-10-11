jest.mock('wled-client', () => require('./helpers/fakeWled').wledClientModule);

import { WledWsPlatformAccessory } from '../src/WledWsPlatformAccessory';
import {
  clients,
  createAccessory,
  flushPromises,
  mockLogger,
  mockPlatform,
} from './helpers/fakeWled';

describe('WledWsPlatformAccessory client replacement on reconnect', () => {
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

  it('terminates the websocket of the previous client', async () => {
    await instance.connect(true);

    expect(clients).toHaveLength(2);
    expect(clients[0].WSAPI.websocket.terminate).toHaveBeenCalled();
  });

  it('ignores events of a replaced client', async () => {
    await instance.connect(true);
    clients[1].emit('open');
    expect(instance['connectionEstablished']).toBe(true);

    // late close event of the old socket must not mark the new connection as lost
    clients[0].emit('close');
    expect(instance['connectionEstablished']).toBe(true);
    jest.advanceTimersByTime(10000);
    expect(clients).toHaveLength(2);
  });

  it('is not connected before the new client reports open', async () => {
    await instance.connect(true);

    expect(instance['connectionEstablished']).toBe(false);
  });
});
