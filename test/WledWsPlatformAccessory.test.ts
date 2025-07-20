// Mock the wled-client module
jest.mock('wled-client');

import { WledWsPlatformAccessory } from '../src/WledWsPlatformAccessory';
import { LightCapability } from '../src/WledController';
import { PlatformAccessory } from 'homebridge';

// Mock-Objekte für Abhängigkeiten
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

const mockAccessory: Partial<PlatformAccessory> =  {
  getService: jest.fn().mockReturnValue(mockService),
  addService: jest.fn().mockReturnValue(mockService),
  getServiceById: jest.fn().mockReturnValue(mockService),
  removeService: jest.fn(),
  context: {
    device: {
      name: 'TestDevice',
      address: '127.0.0.1',
      showRealTimeModeButton: false,
      presets: 'Preset1,Preset2',
    },
  },
  displayName: 'TestDevice',
  UUID: 'test-uuid',
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
  log: { info: jest.fn(), error: jest.fn(), debug: jest.fn() },
  api: {
    hap: {
      HapStatusError: Error,
      HAPStatus: { SERVICE_COMMUNICATION_FAILURE: 1 },
    },
  },
};

const mockLogger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };

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

describe('WledWsPlatformAccessory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // setServiceById für RealTimeMode
    mockAccessory.getServiceById = jest.fn().mockReturnValue(undefined);
  });

  it('should instantiate without errors', () => {

      // Prüfe, ob die Methoden im Mock vorhanden sind
    expect(typeof mockAccessory.getService).toBe('function');
    expect(typeof mockAccessory.addService).toBe('function');
    expect(typeof mockService.setCharacteristic).toBe('function');

    const instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      mockAccessory as any,
      true
    );
    // wledClient wird im Konstruktor gesetzt, hier mocken
    instance['wledClient'] = mockWledClient;
    expect(instance).toBeDefined();
  });

  it('should throw error if controller is not connected on setOn', async () => {
    const instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      mockAccessory as any,
      true
    );
    instance['connectionEstablished'] = false;
    instance['wledClient'] = mockWledClient;
    await expect(instance.setOn(true)).rejects.toThrow(Error);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should call turnOn on wledClient when setOn(true)', async () => {
    const instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      mockAccessory as any,
      true
    );
    instance['connectionEstablished'] = true;
    instance['wledClient'] = mockWledClient;
    await instance.setOn(true);
    expect(mockWledClient.turnOn).toHaveBeenCalled();
  });

  it('should call turnOff on wledClient when setOn(false)', async () => {
    const instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      mockAccessory as any,
      true
    );
    instance['connectionEstablished'] = true;
    instance['wledClient'] = mockWledClient;
    await instance.setOn(false);
    expect(mockWledClient.turnOff).toHaveBeenCalled();
  });

  it('should return ledState.On on getOn', async () => {
    const instance = new WledWsPlatformAccessory(
      mockPlatform as any,
      mockLogger as any,
      mockAccessory as any,
      true
    );
    instance['ledState'].On = true;
    instance['wledClient'] = mockWledClient;
    const result = await instance.getOn();
    expect(result).toBe(true);
  });

  // Weitere Tests für liveSetOn, setBrightness, setHue, setSaturation etc. können analog ergänzt werden.
});