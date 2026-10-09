jest.mock('wled-client', () => require('./helpers/fakeWled').wledClientModule);

import { WledWsPlatformAccessory } from '../src/WledWsPlatformAccessory';
import {
  clients,
  createAccessory,
  flushPromises,
  HapStatusError,
  mockLogger,
  mockPlatform,
} from './helpers/fakeWled';

describe('WledWsPlatformAccessory preset switches', () => {
  let accessory: ReturnType<typeof createAccessory>;
  let instance: WledWsPlatformAccessory;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    clients.length = 0;
    accessory = createAccessory();
    instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      accessory as any,
      false,
    );
    clients[0].emit('open');
    await flushPromises();
  });

  afterEach(() => {
    instance.disconnect();
    jest.useRealTimers();
  });

  it('rejects preset changes while disconnected instead of throwing from a callback handler', async () => {
    clients[0].emit('update:presets');
    const characteristic = accessory.presetServices['WLED-PRESET-1'].characteristic;
    // a throw inside a legacy .on('set') handler is an unhandled rejection that ends the process
    expect(characteristic.on).not.toHaveBeenCalled();
    const handler = characteristic.onSet.mock.calls[0][0];

    instance['connectionEstablished'] = false;
    await expect(handler(true)).rejects.toBeInstanceOf(HapStatusError);
    expect(clients[0].setPreset).not.toHaveBeenCalled();

    instance['connectionEstablished'] = true;
    await handler(true);
    expect(clients[0].setPreset).toHaveBeenCalledWith('1');
  });

  it('returns the preset state from the get handler', async () => {
    clients[0].emit('update:presets');
    const handler =
      accessory.presetServices['WLED-PRESET-1'].characteristic.onGet.mock.calls[0][0];

    await expect(handler()).resolves.toBe(false);
  });
});
