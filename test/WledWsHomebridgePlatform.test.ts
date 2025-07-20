import { WledWsHomebridgePlatform } from '../src/WledWsHomebridgePlatform';

// Mocks für Homebridge-Abhängigkeiten
const mockLog = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockService = {
  getCharacteristic: jest.fn().mockReturnThis(),
  onSet: jest.fn().mockReturnThis(),
  onGet: jest.fn().mockReturnThis(),
  setCharacteristic: jest.fn().mockReturnThis(),
  setPrimaryService: jest.fn(),
  addLinkedService: jest.fn(),
  updateCharacteristic: jest.fn(),
  removeLinkedService: jest.fn(),
};

const mockPlatformAccessory = {
  getService: jest.fn().mockReturnValue(mockService), 
  addService: jest.fn().mockReturnValue(mockService),
  getServiceById: jest.fn().mockReturnValue(mockService),
  removeService: jest.fn(),
  context: { device: { name: 'TestDevice', address: '127.0.0.1' } },
  displayName: 'TestDevice',
  UUID: 'test-uuid',
};

const mockApi = {
  hap: {
    Service: {},
    Characteristic: {},
    uuid: {
      generate: jest.fn((address: string) => `uuid-${address}`),
    },
  },
  on: jest.fn((event, cb) => {
    // Simuliere sofortiges Auslösen der Events
    if (event === 'didFinishLaunching') cb();
    if (event === 'shutdown') cb();
  }),
  updatePlatformAccessories: jest.fn(),
  unregisterPlatformAccessories: jest.fn(),
  registerPlatformAccessories: jest.fn(),
  platformAccessory: jest.fn(function (name, uuid) {
    // Rückgabe des erweiterten Mocks!
    return {
      ...mockPlatformAccessory,
      displayName: name,
      UUID: uuid,
      context: { device: { address: uuid, name } },
    };
  }),
};

const mockConfig = {
  name: 'TestPlatform',
  logging: true,
  controllers: {
    '1': { name: 'Controller1', address: '192.168.1.1' },
    '2': { name: 'Controller2', address: '192.168.1.2' },
  },
};

describe('WledWsHomebridgePlatform', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log error if no controllers are configured', () => {
    new WledWsHomebridgePlatform(mockLog as any, { name: 'Test', controllers: undefined } as any, mockApi as any);
    expect(mockLog.error).toHaveBeenCalledWith('Please configure at least one controller');
  });

  it('should initialize and discover devices', () => {
    const platform = new WledWsHomebridgePlatform(mockLog as any, mockConfig as any, mockApi as any);
    expect(mockLog.debug).toHaveBeenCalledWith('Finished initializing platform:', 'TestPlatform');
    expect(mockLog.info).toHaveBeenCalledWith(
      'Loading configuration for controller %s at address %s',
      'Controller1',
      '192.168.1.1'
    );
    expect(mockLog.info).toHaveBeenCalledWith(
      'Loading configuration for controller %s at address %s',
      'Controller2',
      '192.168.1.2'
    );
    expect(mockApi.registerPlatformAccessories).toHaveBeenCalled();
  });

  it('should add accessory to cache in configureAccessory', () => {
    const platform = new WledWsHomebridgePlatform(mockLog as any, mockConfig as any, mockApi as any);
    const accessory = { displayName: 'TestAccessory', context: { device: { address: 'addr1', name: 'Controller1' } } };
    platform.configureAccessory(accessory as any);
    expect(platform.accessories).toContain(accessory as any);
    expect(mockLog.info).toHaveBeenCalledWith('Loading accessory from cache:', 'TestAccessory');
  });

  it('should call disconnect on all accessories in disconnectDevices', () => {
    const platform = new WledWsHomebridgePlatform(mockLog as any, mockConfig as any, mockApi as any);
    const mockAccessory = { disconnect: jest.fn() };
    platform['accessoryMap'].set('uuid-addr1', mockAccessory);
    platform['accessoryMap'].set('uuid-addr2', mockAccessory);
    platform.disconnectDevices();
    expect(mockLog.info).toHaveBeenCalledWith('Shutdown - disconnecting all accessories');
    expect(mockAccessory.disconnect).toHaveBeenCalledTimes(2);
  });

  // Zusätzlicher Test: Prüfe, ob das Mock-Accessory die Methoden hat
  it('mockPlatformAccessory should provide required methods', () => {
    const accessory = mockApi.platformAccessory('TestDevice', 'test-uuid');
    expect(typeof accessory.getService).toBe('function');
    expect(typeof accessory.addService).toBe('function');
    expect(typeof accessory.getServiceById).toBe('function');
    expect(typeof accessory.removeService).toBe('function');
  });
});