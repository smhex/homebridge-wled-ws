jest.mock('wled-client', () => require('./helpers/fakeWled').wledClientModule);

import { WledWsPlatformAccessory } from '../src/WledWsPlatformAccessory';
import {
  clients,
  createAccessory,
  createService,
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

describe('WledWsPlatformAccessory cached preset switches', () => {
  let accessory: ReturnType<typeof createAccessory>;
  let instance: WledWsPlatformAccessory;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    clients.length = 0;
    accessory = createAccessory();
    // preset switch restored from the Homebridge accessory cache
    accessory.presetServices['WLED-PRESET-1'] = createService('WLED-PRESET-1');
    instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      accessory as any,
      false,
    );
  });

  afterEach(() => {
    instance.disconnect();
    jest.useRealTimers();
  });

  it('rejects changes before the presets have been received', async () => {
    const characteristic = accessory.presetServices['WLED-PRESET-1'].characteristic;
    const setHandler = characteristic.onSet.mock.calls[0][0];
    const getHandler = characteristic.onGet.mock.calls[0][0];

    expect(() => setHandler(true)).toThrow(HapStatusError);
    expect(getHandler()).toBe(false);
    expect(clients[0].setPreset).not.toHaveBeenCalled();
  });

  it('replaces the offline handlers once the presets are received', async () => {
    clients[0].emit('open');
    await flushPromises();
    clients[0].emit('update:presets');

    const characteristic = accessory.presetServices['WLED-PRESET-1'].characteristic;
    const calls = characteristic.onSet.mock.calls;
    const setHandler = calls[calls.length - 1][0];
    await setHandler(true);
    expect(clients[0].setPreset).toHaveBeenCalledWith('1');
  });
});

describe('WledWsPlatformAccessory presets received again', () => {
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
    clients[0].emit('update:state');
    clients[0].emit('update:info');
  });

  afterEach(() => {
    instance.disconnect();
    jest.useRealTimers();
  });

  it('does not duplicate presets', () => {
    clients[0].emit('update:presets');
    clients[0].emit('update:presets');

    expect(instance['presetList'].map((p) => p.id)).toEqual(['1', '2']);
  });

  it('keeps the active preset so it is switched off when another preset is selected', async () => {
    clients[0].emit('update:presets');
    clients[0].state.presetId = 1;
    clients[0].emit('update:state');

    clients[0].emit('update:presets');
    const preset1 = accessory.presetServices['WLED-PRESET-1'];
    const getCalls = preset1.characteristic.onGet.mock.calls;
    const getPreset1 = getCalls[getCalls.length - 1][0];
    await expect(getPreset1()).resolves.toBe(true);

    preset1.updateCharacteristic.mockClear();
    clients[0].state.presetId = 2;
    clients[0].emit('update:state');

    expect(preset1.updateCharacteristic).toHaveBeenCalledWith('On', false);
    await expect(getPreset1()).resolves.toBe(false);
  });
});
