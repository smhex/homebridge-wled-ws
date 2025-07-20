jest.mock('wled-client');

import { WledWsPlatformAccessory } from '../src/WledWsPlatformAccessory';
import { LightCapability, WledControllerPreset } from '../src/WledController';

// Mock-Objekte für Abhängigkeiten
const mockLogger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };

const mockService = {
  getCharacteristic: jest.fn().mockReturnThis(),
  onSet: jest.fn().mockReturnThis(),
  onGet: jest.fn().mockReturnThis(),
  setCharacteristic: jest.fn().mockReturnThis(),
  setPrimaryService: jest.fn(),
  addLinkedService: jest.fn(),
  updateCharacteristic: jest.fn(),
  removeLinkedService: jest.fn(),
  addOptionalCharacteristic: jest.fn(),
};

const mockAccessory =  {
  getService: jest.fn().mockReturnValue(mockService),
  addService: jest.fn().mockReturnValue(mockService),
  getServiceById: jest.fn().mockReturnValue(undefined),
  removeService: jest.fn(),
  context: {
    device: {
      name: 'TestDevice',
      address: '127.0.0.1',
      showRealTimeModeButton: false,
      presets: 'Preset1,Preset2',
      resetRealTimeModeAfterStream: false // für liveSetOn-Test
    },
  },
  displayName: 'TestDevice',
  UUID: 'test-uuid',
    ledState: {
    On: false,
    Live: false,
    Brightness: 0,
    Hue: 0,
    Saturation: 0,
    PresetId: '',
    LightCapability: LightCapability.OnOff,
  },
};

const mockPlatform = {
  Service: {
    Lightbulb: {},
    Switch: {},
    AccessoryInformation: {},
  },
  Characteristic: {
    Name: 'Name',
    On: 'On',
    Brightness: 'Brightness',
    Hue: 'Hue',
    Saturation: 'Saturation',
    Manufacturer: 'Manufacturer',
    Model: 'Model',
    FirmwareRevision: 'FirmwareRevision',
    SerialNumber: 'SerialNumber',
    ConfiguredName: 'ConfiguredName',
  },
  log: mockLogger, 
  api: {
    hap: {
      HapStatusError: Error,
      HAPStatus: { SERVICE_COMMUNICATION_FAILURE: 1 },
    },
  },
};

const mockWledClient = {
  turnOn: jest.fn(),
  turnOff: jest.fn(),
  allowLiveData: jest.fn(),
  ignoreLiveData: jest.fn(),
  setBrightness: jest.fn(),
  setColor: jest.fn(),
  setPreset: jest.fn(),
  disconnect: jest.fn(),
  refreshPresets: jest.fn(),
  refreshEffects: jest.fn(),
  on: jest.fn(),
  init: jest.fn().mockResolvedValue(true),
  state: {
    on: false,
    liveDataOverride: 1,
    brightness: 128,
    segments: [{ colors: [[255, 0, 0]] }],
    presetId: '-1',
    playlistId: '-1',
  },
  presets: {},
  effects: {},
  config: {},
  info: {
    brand: 'WLED',
    product: 'LED Controller',
    version: '0.15.0',
    mac: 'AA:BB:CC:DD:EE:FF',
    leds: { lightCapabilities: JSON.stringify(LightCapability.OnOff) },
  },
};

let instance: WledWsPlatformAccessory;

describe('WledWsPlatformAccessory', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockAccessory.getServiceById = jest.fn().mockReturnValue(undefined);
    if (mockAccessory.context && mockAccessory.context.device) {
      mockAccessory.context.device.resetRealTimeModeAfterStream = false;
    }
    instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      mockAccessory as any,
      true
    );
    instance['connectionEstablished'] = true;
    await instance.connect(false); 
    instance['wledClient'] = mockWledClient;
    instance['connectionEstablished'] = true;
  });

  it('should instantiate without errors', () => {
    expect(instance).toBeDefined();
  });

  it('should log info when connect is called', async () => {
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Connecting to controller %s at address %s',
      mockAccessory.context.device.name,
      mockAccessory.context.device.address
    );
  });

  it('should throw error if controller is not connected on setOn', async () => {
    instance['connectionEstablished'] = false;
    await expect(instance.setOn(true)).rejects.toThrow(Error);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should call turnOn on wledClient when setOn(true)', async () => {
    await instance.setOn(true);
    expect(mockWledClient.turnOn).toHaveBeenCalled();
  });

  it('should call turnOff on wledClient when setOn(false)', async () => {
    await instance.setOn(false);
    expect(mockWledClient.turnOff).toHaveBeenCalled();
  });

  it('should return ledState.On on getOn', async () => {
    instance['ledState'].On = true;
    const result = await instance.getOn();
    expect(result).toBe(true);
  });

  it('should call allowLiveData on wledClient when liveSetOn(true)', async () => {
    await instance.liveSetOn(true);
    expect(mockWledClient.allowLiveData).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Set controller %s On state to: %s',
      mockAccessory.context.device.name,
      'On'
    );
  });

  it('should call ignoreLiveData on wledClient when liveSetOn(false)', async () => {
    mockAccessory.context.device.resetRealTimeModeAfterStream = true;
    await instance.liveSetOn(false);
    expect(mockWledClient.ignoreLiveData).toHaveBeenCalledWith(false);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Resetting real time mode after stream for controller %s',
      'true'
    );
  });

  it('should update ledState and log info when onStateReceived is called', () => {
    // Vorbereiten: z.B. LED-Status im Mock setzen
    mockWledClient.state.on = true;
    mockWledClient.state.liveDataOverride = 0;
    mockWledClient.state.brightness = 128;
    mockWledClient.state.segments = [{ colors: [ [255, 0, 0] ] }];

    // ggf. LightCapability setzen
    instance['ledState'].LightCapability = LightCapability.RGB;

    // Handler aufrufen
    instance.onStateReceived();

    // Erwartete Änderungen prüfen
    expect(instance['ledState'].On).toBe(true);
    expect(instance['ledState'].Live).toBe(true);
    expect(instance['ledState'].Brightness).toBe(Math.round((128 * 100) / 255));
    expect(instance['ledState'].Hue).toBe(0); // RGB (255,0,0) -> Hue 0°
    expect(instance['ledState'].Saturation).toBe(100); // RGB (255,0,0) -> Sättigung 100%
    expect(mockLogger.info).toHaveBeenCalled(); // Logger wurde genutzt
});
});