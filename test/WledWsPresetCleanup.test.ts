jest.mock('wled-client', () => require('./helpers/fakeWled').wledClientModule);

import { WledWsPlatformAccessory } from '../src/WledWsPlatformAccessory';
import {
  clients,
  createAccessory,
  createService,
  flushPromises,
  mockLogger,
  mockPlatform,
} from './helpers/fakeWled';

describe('WledWsPlatformAccessory cleanup of cached preset switches', () => {
  let accessory: ReturnType<typeof createAccessory>;
  let instance: WledWsPlatformAccessory;

  const receivePresets = async (presets: string | undefined) => {
    (accessory.context.device as { presets?: string }).presets = presets;
    instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      accessory as any,
      false,
    );
    clients[0].emit('open');
    await flushPromises();
    clients[0].emit('update:presets');
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    clients.length = 0;
    accessory = createAccessory();
    // preset switches restored from the Homebridge accessory cache
    accessory.presetServices['WLED-PRESET-1'] = createService('WLED-PRESET-1');
    accessory.presetServices['WLED-PRESET-2'] = createService('WLED-PRESET-2');
  });

  afterEach(() => {
    instance.disconnect();
    jest.useRealTimers();
  });

  it.each([
    ['no presets are configured', undefined],
    ['the preset list is empty', ''],
  ])('removes all cached preset switches when %s', async (_, presets) => {
    const preset1 = accessory.presetServices['WLED-PRESET-1'];
    const preset2 = accessory.presetServices['WLED-PRESET-2'];
    await receivePresets(presets);

    expect(accessory.removeService).toHaveBeenCalledWith(preset1);
    expect(accessory.removeService).toHaveBeenCalledWith(preset2);
    expect(accessory.mainService.removeLinkedService).toHaveBeenCalledWith(preset1);
    expect(accessory.mainService.removeLinkedService).toHaveBeenCalledWith(preset2);
    expect(accessory.addService).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('removes only the switches of presets that are no longer configured', async () => {
    const preset1 = accessory.presetServices['WLED-PRESET-1'];
    const preset2 = accessory.presetServices['WLED-PRESET-2'];
    await receivePresets('Preset1');

    expect(accessory.removeService).toHaveBeenCalledTimes(1);
    expect(accessory.removeService).toHaveBeenCalledWith(preset2);
    expect(accessory.removeService).not.toHaveBeenCalledWith(preset1);
  });
});
