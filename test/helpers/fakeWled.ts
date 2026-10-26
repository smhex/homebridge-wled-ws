// Test doubles for WLEDClient and the Homebridge objects used by WledWsPlatformAccessory.
// Usage in a test file:
//   jest.mock('wled-client', () => require('./helpers/fakeWled').wledClientModule);

type Handler = (...args: unknown[]) => void;

export class FakeWebsocket {
  handlers: Record<string, Handler[]> = {};
  ping = jest.fn();
  terminate = jest.fn();
  on(event: string, handler: Handler) {
    (this.handlers[event] ||= []).push(handler);
  }
  emit(event: string, ...args: unknown[]) {
    (this.handlers[event] || []).forEach((h) => h(...args));
  }
}

// every WLEDClient created by the accessory, in creation order
export const clients: FakeClient[] = [];

export class FakeClient {
  handlers: Record<string, Handler[]> = {};
  WSAPI = { websocket: new FakeWebsocket() };
  init = jest.fn().mockResolvedValue(true);
  disconnect = jest.fn();
  setPreset = jest.fn();
  turnOn = jest.fn();
  turnOff = jest.fn();
  setBrightness = jest.fn();
  setColor = jest.fn();
  setCCT = jest.fn();
  updateSegment = jest.fn();
  allowLiveData = jest.fn();
  ignoreLiveData = jest.fn();
  state = {
    on: true,
    liveDataOverride: 1,
    brightness: 128,
    segments: [{ colors: [[255, 0, 0]], cct: 127 }],
    presetId: -1,
    playlistId: -1,
  };
  info = {
    brand: 'WLED',
    product: 'FOSS',
    version: '0.15.0',
    mac: 'aabbccddeeff',
    leds: { lightCapabilities: 1 },
  };
  presets = {
    '1': { name: 'Preset1', segments: [] },
    '2': { name: 'Preset2', segments: [] },
  };
  constructor() {
    clients.push(this);
  }
  on(event: string, handler: Handler) {
    (this.handlers[event] ||= []).push(handler);
  }
  emit(event: string, ...args: unknown[]) {
    (this.handlers[event] || []).forEach((h) => h(...args));
  }
}

export const wledClientModule = { WLEDClient: jest.fn(() => new FakeClient()) };

export const mockLogger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };

export class HapStatusError extends Error {}

export const mockPlatform = {
  Service: { Lightbulb: {}, Switch: {}, AccessoryInformation: {} },
  Characteristic: {
    Name: 'Name',
    On: 'On',
    Brightness: 'Brightness',
    Hue: 'Hue',
    Saturation: 'Saturation',
    ColorTemperature: 'ColorTemperature',
    Manufacturer: 'Manufacturer',
    Model: 'Model',
    FirmwareRevision: 'FirmwareRevision',
    SerialNumber: 'SerialNumber',
    ConfiguredName: 'ConfiguredName',
  },
  log: mockLogger,
  api: {
    hap: {
      HapStatusError,
      HAPStatus: { SERVICE_COMMUNICATION_FAILURE: -70402 },
    },
  },
};

export function createService(subtype?: string) {
  const onCharacteristic = {
    onSet: jest.fn().mockReturnThis(),
    onGet: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
  };
  return {
    subtype,
    characteristic: onCharacteristic,
    getCharacteristic: jest.fn().mockReturnValue(onCharacteristic),
    setCharacteristic: jest.fn().mockReturnThis(),
    setPrimaryService: jest.fn(),
    addLinkedService: jest.fn(),
    updateCharacteristic: jest.fn(),
    removeLinkedService: jest.fn(),
    addOptionalCharacteristic: jest.fn(),
  };
}

export function createAccessory() {
  const mainService = createService();
  const presetServices: Record<string, ReturnType<typeof createService>> = {};
  return {
    mainService,
    presetServices,
    get services() {
      return [mainService, ...Object.values(presetServices)];
    },
    getService: jest.fn().mockReturnValue(mainService),
    addService: jest.fn((_type, _name, subtype: string) => {
      presetServices[subtype] = createService(subtype);
      return presetServices[subtype];
    }),
    getServiceById: jest.fn((_type, subtype: string) => presetServices[subtype]),
    removeService: jest.fn((service: ReturnType<typeof createService>) => {
      if (service.subtype) {
        delete presetServices[service.subtype];
      }
    }),
    context: {
      device: {
        name: 'TestDevice',
        address: '127.0.0.1',
        showRealTimeModeButton: false,
        presets: 'Preset1,Preset2',
        resetRealTimeModeAfterStream: false,
      },
    },
  };
}

// lets pending promise callbacks (e.g. after await init()) run while fake timers are active
export const flushPromises = () =>
  new Promise(jest.requireActual('timers').setImmediate);
