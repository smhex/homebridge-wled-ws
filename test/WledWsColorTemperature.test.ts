jest.mock('wled-client', () => require('./helpers/fakeWled').wledClientModule);

import { WledWsPlatformAccessory } from '../src/WledWsPlatformAccessory';
import {
  clients,
  createAccessory,
  flushPromises,
  mockLogger,
  mockPlatform,
} from './helpers/fakeWled';

describe('WledWsPlatformAccessory color temperature', () => {
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
    clients[0].info.leds.lightCapabilities = 6; // WCCT
    clients[0].emit('update:state');
    clients[0].emit('update:info');
    // the initial state was received before the light capabilities were known - apply it now
    clients[0].emit('update:state');
    jest.clearAllMocks();
  });

  afterEach(() => {
    instance.disconnect();
    jest.useRealTimers();
  });

  it('returns the color temperature in mired after it was set', async () => {
    await instance.setColorTemperature(250);

    expect(clients[0].setCCT).toHaveBeenCalledWith(177);
    await expect(instance.getColorTemperature()).resolves.toBe(250);
  });

  it('updates HomeKit only when the color temperature of the controller changes', () => {
    clients[0].emit('update:state');
    expect(accessory.mainService.updateCharacteristic).not.toHaveBeenCalledWith(
      'ColorTemperature',
      expect.anything(),
    );
    expect(mockLogger.info).not.toHaveBeenCalled();

    clients[0].state.segments[0].cct = 0;
    clients[0].emit('update:state');
    expect(accessory.mainService.updateCharacteristic).toHaveBeenCalledWith(
      'ColorTemperature',
      500,
    );
  });
});
