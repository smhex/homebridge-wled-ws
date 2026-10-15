// Use the HAP dependency belonging to the installed Homebridge version, without
// importing Homebridge's runtime (which also initializes Matter on Homebridge 2).
jest.mock('wled-client', () => ({ WLEDClient: jest.fn() }));

import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { WLEDClient } from 'wled-client';
import { WledWsPlatformAccessory } from '../src/WledWsPlatformAccessory';

const homebridgeRequire = createRequire(require.resolve('homebridge'));
const hap = (() => {
  try {
    return homebridgeRequire('@homebridge/hap-nodejs');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
    return homebridgeRequire('hap-nodejs');
  }
})();

const createClient = () => Object.assign(new EventEmitter(), {
  init: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn(),
  setPreset: jest.fn().mockResolvedValue(undefined),
  turnOff: jest.fn().mockResolvedValue(undefined),
  WSAPI: {
    websocket: Object.assign(new EventEmitter(), {
      ping: jest.fn(),
      terminate: jest.fn(),
    }),
  },
  state: {
    on: true,
    liveDataOverride: 1,
    brightness: 128,
    segments: [{ colors: [[255, 0, 0]], cct: 127 }],
    presetId: -1,
    // This playlist is already selected: triggering it again must reset the
    // switch even when WLED does not report a different playlist ID.
    playlistId: 3,
  },
  presets: {
    '1': { name: 'Preset1', segments: [] },
    '3': { name: 'Playlist', playlist: { presets: [1] } },
  },
});

describe('preset writes through the real HomeKit characteristic lifecycle', () => {
  let client: ReturnType<typeof createClient>;
  let accessory: any;
  let instance: WledWsPlatformAccessory;
  let playlistOn: any;
  const log = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const platform = { Service: hap.Service, Characteristic: hap.Characteristic, log, api: { hap } };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    client = createClient();
    (WLEDClient as unknown as jest.Mock).mockImplementation(() => client);
    accessory = new hap.Accessory('Preset Test', hap.uuid.generate('wled-preset-hap-test'));
    accessory.context = {
      device: {
        name: 'Preset Test',
        address: '127.0.0.1',
        presets: 'Preset1,Playlist',
        showRealTimeModeButton: false,
        resetRealTimeModeAfterStream: false,
      },
    };
    instance = new WledWsPlatformAccessory(platform as any, log as any, accessory, false);
    client.emit('open');
    await new Promise<void>(jest.requireActual('node:timers').setImmediate);
    client.emit('update:state');
    client.emit('update:presets');
    playlistOn = accessory
      .getServiceById(hap.Service.Switch, 'WLED-PRESET-3')
      .getCharacteristic(hap.Characteristic.On);
  });

  afterEach(() => {
    instance.disconnect();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('resets each playlist trigger after HAP completes the write, even with an unchanged playlist ID', async () => {
    client.setPreset.mockImplementation(async () => {
      // Real WLED responses may arrive before the command promise resolves.
      // HAP still writes true after awaiting the plugin's onSet handler.
      client.emit('update:state');
    });

    for (let trigger = 1; trigger <= 2; trigger++) {
      await playlistOn.handleSetRequest(true);
      expect(client.setPreset).toHaveBeenNthCalledWith(trigger, '3');
      expect(playlistOn.value).toBe(true);

      jest.advanceTimersByTime(0);
      expect(playlistOn.value).toBe(false);
      await expect(playlistOn.handleGetRequest()).resolves.toBe(false);
    }

    await playlistOn.handleSetRequest(false);
    expect(client.turnOff).not.toHaveBeenCalled();
    expect(client.state.on).toBe(true);
  });

  it('returns a failed playlist command as a controlled HAP communication error', async () => {
    const failure = new Error('simulated write failure');
    const playlist = instance['presetList'].find((preset) => preset.id === '3')!;

    client.setPreset.mockRejectedValueOnce(failure);
    await expect(instance.setPreset(playlist, true)).rejects.toBeInstanceOf(hap.HapStatusError);

    client.setPreset.mockRejectedValueOnce(failure);
    await expect(playlistOn.handleSetRequest(true))
      .rejects.toBe(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    expect(playlistOn.statusCode).toBe(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    expect(playlistOn.value).toBe(false);
    await expect(playlistOn.handleGetRequest()).resolves.toBe(false);
    expect(client.turnOff).not.toHaveBeenCalled();
  });

  it.each([
    [false, 1], // A preset may store an off state.
    [true, 2], // A newer controller response may select a different preset.
  ])('keeps a response received during the write (on=%s, preset=%s)', async (on, presetId) => {
    const presetOn = accessory.getServiceById(hap.Service.Switch, 'WLED-PRESET-1')
      .getCharacteristic(hap.Characteristic.On);
    const preset = instance['presetList'].find((item) => item.id === '1')!;
    client.setPreset.mockImplementation(async () => {
      client.state.on = on;
      client.state.presetId = presetId;
      client.emit('update:state');
    });

    await presetOn.handleSetRequest(true);
    expect(preset.on).toBe(false);
    jest.advanceTimersByTime(0);
    expect(presetOn.value).toBe(false);
  });

  it('acknowledges a regular write until the controller responds', async () => {
    const presetOn = accessory.getServiceById(hap.Service.Switch, 'WLED-PRESET-1')
      .getCharacteristic(hap.Characteristic.On);

    await presetOn.handleSetRequest(true);
    jest.advanceTimersByTime(0);
    expect(presetOn.value).toBe(true);

    client.state.on = false;
    client.state.presetId = 1;
    client.emit('update:state');
    expect(presetOn.value).toBe(false);
  });

  it('keeps the deferred playlist reset when the preset list refreshes during HAP completion', async () => {
    client.setPreset.mockImplementation(async () => {
      // Refresh after the plugin finishes the write but before HAP stores the requested value.
      Promise.resolve().then(() => Promise.resolve().then(() => client.emit('update:presets')));
    });

    await playlistOn.handleSetRequest(true);
    jest.advanceTimersByTime(0);
    expect(playlistOn.value).toBe(false);
    await expect(playlistOn.handleGetRequest()).resolves.toBe(false);
  });
});
