jest.mock('wled-client', () => require('./helpers/fakeWled').wledClientModule);

import { WledWsPlatformAccessory } from '../src/WledWsPlatformAccessory';
import {
  clients,
  createAccessory,
  createService,
  mockLogger,
  mockPlatform,
} from './helpers/fakeWled';

describe('WledWsPlatformAccessory real time mode switch', () => {
  let accessory: ReturnType<typeof createAccessory>;
  let instance: WledWsPlatformAccessory;

  const createInstance = () => {
    instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      accessory as any,
      false,
    );
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    clients.length = 0;
    accessory = createAccessory();
    // real time mode switch restored from the Homebridge accessory cache
    accessory.presetServices['WLED-LIVE'] = createService('WLED-LIVE');
  });

  afterEach(() => {
    instance.disconnect();
    jest.useRealTimers();
  });

  it('removes the cached switch when the button is turned off', () => {
    const liveService = accessory.presetServices['WLED-LIVE'];
    accessory.context.device.showRealTimeModeButton = false;
    createInstance();

    expect(accessory.mainService.removeLinkedService).toHaveBeenCalledWith(liveService);
    expect(accessory.removeService).toHaveBeenCalledWith(liveService);
  });

  it('keeps the cached switch when the button is turned on', () => {
    const liveService = accessory.presetServices['WLED-LIVE'];
    accessory.context.device.showRealTimeModeButton = true;
    createInstance();

    expect(accessory.removeService).not.toHaveBeenCalled();
    expect(accessory.addService).not.toHaveBeenCalled();
    expect(liveService.characteristic.onSet).toHaveBeenCalled();
  });
});
