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
  turnOff = jest.fn();
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

export function createService() {
  const onCharacteristic = {
    onSet: jest.fn().mockReturnThis(),
    onGet: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
  };
  return {
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
    getService: jest.fn().mockReturnValue(mainService),
    addService: jest.fn((_type, _name, subtype: string) => {
      presetServices[subtype] = createService();
      return presetServices[subtype];
    }),
    getServiceById: jest.fn((_type, subtype: string) => presetServices[subtype]),
    removeService: jest.fn(),
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
