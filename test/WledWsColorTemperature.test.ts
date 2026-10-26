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

  const receiveInitialState = (cct = 127) => {
    clients[0].info.leds.lightCapabilities = 6; // WCCT
    clients[0].state.segments[0].cct = cct;
    // WLED sends the state before the info that identifies its light capabilities.
    clients[0].emit('update:state');
    clients[0].emit('update:info');
  };

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

  it('replaces a cached HomeKit value when the first controller value equals the internal default', async () => {
    let homeKitMired = 500;
    accessory.mainService.updateCharacteristic.mockImplementation((name, value) => {
      if (name === 'ColorTemperature') {
        homeKitMired = value;
      }
    });

    receiveInitialState(142); // rounds to the internal default of 300 mired

    expect(homeKitMired).toBe(300);
    await expect(instance.getColorTemperature()).resolves.toBe(300);

    accessory.mainService.updateCharacteristic.mockClear();
    clients[0].emit('update:state');
    expect(accessory.mainService.updateCharacteristic).not.toHaveBeenCalledWith(
      'ColorTemperature',
      expect.anything(),
    );
  });

  it.each([
    [250, 177],
    [140, 255],
    [500, 0],
  ])('keeps %i mired in HomeKit while sending WLED CCT %i', async (mired, cct) => {
    receiveInitialState();
    accessory.mainService.updateCharacteristic.mockClear();

    await instance.setColorTemperature(mired);

    expect(clients[0].updateSegment).toHaveBeenCalledWith(0, { colors: [[0, 0, 0, 255]], cct });
    await expect(instance.getColorTemperature()).resolves.toBe(mired);

    // The controller echo represents the same temperature and must not cause another update.
    clients[0].state.segments[0].cct = cct;
    clients[0].emit('update:state');
    expect(accessory.mainService.updateCharacteristic).not.toHaveBeenCalledWith(
      'ColorTemperature',
      expect.anything(),
    );
  });

  it('updates HomeKit only when the color temperature of the controller changes', () => {
    receiveInitialState();
    jest.clearAllMocks();

    clients[0].emit('update:state');
    expect(accessory.mainService.updateCharacteristic).not.toHaveBeenCalledWith(
      'ColorTemperature',
      expect.anything(),
    );

    clients[0].state.segments[0].cct = 0;
    clients[0].emit('update:state');
    expect(accessory.mainService.updateCharacteristic).toHaveBeenCalledWith(
      'ColorTemperature',
      500,
    );

    accessory.mainService.updateCharacteristic.mockClear();
    clients[0].emit('update:state');
    expect(accessory.mainService.updateCharacteristic).not.toHaveBeenCalledWith(
      'ColorTemperature',
      expect.anything(),
    );
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('does not log temperature changes or writes when logging is disabled', async () => {
    receiveInitialState();
    jest.clearAllMocks();

    await instance.setColorTemperature(250);
    clients[0].state.segments[0].cct = 0;
    clients[0].emit('update:state');

    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});
