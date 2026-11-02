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

describe('WledWsPlatformAccessory failed commands', () => {
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

  // WLEDClient rejects like this if neither websocket nor HTTP could deliver the command
  const noTransport = () =>
    Promise.reject(new Error('No transport available to handle state update.'));

  it('reports a failed command to Homekit instead of leaving the rejection unhandled', async () => {
    clients[0].turnOn.mockImplementation(noTransport);

    await expect(instance.setOn(true)).rejects.toBeInstanceOf(HapStatusError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to %s on controller %s: %s',
      'turn on',
      'TestDevice',
      'No transport available to handle state update.',
    );
  });

  it.each([
    ['setOn', false, 'turnOff'],
    ['setBrightness', 50, 'setBrightness'],
    ['setHue', 120, 'setColor'],
    ['setSaturation', 50, 'setColor'],
    ['setColorTemperature', 250, 'updateSegment'],
    ['liveSetOn', true, 'allowLiveData'],
    ['liveSetOn', false, 'ignoreLiveData'],
  ] as const)('reports a failed %s(%s) command', async (handler, value, command) => {
    clients[0][command].mockImplementationOnce(noTransport);

    await expect(instance[handler](value)).rejects.toBeInstanceOf(HapStatusError);
    expect(clients[0][command]).toHaveBeenCalled();
  });

  it('waits for the command before completing the request', async () => {
    let resolveCommand: () => void = () => {};
    clients[0].setBrightness.mockReturnValue(
      new Promise<void>((resolve) => (resolveCommand = resolve)),
    );

    let done = false;
    const request = instance.setBrightness(50).then(() => (done = true));
    await flushPromises();
    expect(done).toBe(false);

    resolveCommand();
    await request;
    expect(clients[0].setBrightness).toHaveBeenCalledWith(128);
  });

  it('rejects a failed preset change', async () => {
    clients[0].setPreset.mockImplementation(noTransport);
    clients[0].emit('update:presets');
    const preset = instance['presetList'].find((item) => item.id === '1')!;

    await expect(instance.setPreset(preset, true)).rejects.toBeInstanceOf(HapStatusError);
    expect(clients[0].setPreset).toHaveBeenCalledWith('1');
    expect(preset.on).toBe(false);
  });
});
