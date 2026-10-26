jest.mock('wled-client', () => require('./helpers/fakeWled').wledClientModule);

import { WledWsPlatformAccessory } from '../src/WledWsPlatformAccessory';
import {
  clients,
  createAccessory,
  createService,
  flushPromises,
  HapStatusError,
  mockLogger,
  mockPlatform,
} from './helpers/fakeWled';

describe('preset state across controller events and cached services', () => {
  let accessory: ReturnType<typeof createAccessory>;
  let instance: WledWsPlatformAccessory;

  const createInstance = async () => {
    instance = new WledWsPlatformAccessory(mockPlatform as any, mockLogger as any, accessory as any, false);
    clients[0].emit('open');
    await flushPromises();
  };
  const service = (id: string) => accessory.presetServices['WLED-PRESET-' + id];
  const getHandler = (id: string) => service(id).characteristic.onGet.mock.calls.at(-1)![0];
  const setHandler = (id: string) => service(id).characteristic.onSet.mock.calls.at(-1)![0];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    clients.length = 0;
    accessory = createAccessory();
  });

  afterEach(() => {
    instance.disconnect();
    jest.useRealTimers();
  });

  it('shows the initially active preset when state arrives before presets', async () => {
    await createInstance();
    clients[0].state.presetId = 1;
    clients[0].emit('update:state');
    clients[0].emit('update:info');
    clients[0].emit('update:presets');

    await expect(getHandler('1')()).resolves.toBe(true);
    expect(service('1').updateCharacteristic).toHaveBeenCalledWith('On', true);
    await expect(getHandler('2')()).resolves.toBe(false);
  });

  it('applies state that arrives after the presets and synchronizes cached values first', async () => {
    accessory.presetServices['WLED-PRESET-1'] = createService('WLED-PRESET-1');
    await createInstance();
    clients[0].emit('update:presets');
    expect(service('1').updateCharacteristic).toHaveBeenCalledWith('On', false);

    clients[0].state.presetId = 1;
    clients[0].emit('update:state');
    await expect(getHandler('1')()).resolves.toBe(true);
  });

  it('tracks power changes with the same preset ID and accepts numeric or string IDs', async () => {
    await createInstance();
    clients[0].state.presetId = 1;
    clients[0].emit('update:state');
    clients[0].emit('update:presets');
    await expect(getHandler('1')()).resolves.toBe(true);

    clients[0].state.on = false;
    clients[0].emit('update:state');
    await expect(getHandler('1')()).resolves.toBe(false);
    expect(service('1').updateCharacteristic).toHaveBeenLastCalledWith('On', false);

    (clients[0].state as { presetId: number | string }).presetId = '1';
    clients[0].state.on = true;
    clients[0].emit('update:state');
    await expect(getHandler('1')()).resolves.toBe(true);

    service('1').updateCharacteristic.mockClear();
    clients[0].emit('update:state');
    expect(service('1').updateCharacteristic).not.toHaveBeenCalled();
  });

  it('uses the new client state after reconnect and ignores the replaced client', async () => {
    await createInstance();
    const first = clients[0];
    first.state.presetId = 1;
    first.emit('update:state');
    first.emit('update:presets');

    first.emit('close');
    jest.advanceTimersByTime(10000);
    await flushPromises();
    const second = clients[1];
    second.emit('open');
    second.state.presetId = 2;
    second.emit('update:state');
    second.emit('update:info');
    second.emit('update:presets');
    second.emit('update:presets');

    await expect(getHandler('1')()).resolves.toBe(false);
    await expect(getHandler('2')()).resolves.toBe(true);
    expect(accessory.addService).toHaveBeenCalledTimes(2);
    first.emit('update:state');
    first.emit('update:presets');
    await expect(getHandler('2')()).resolves.toBe(true);
  });

  it('removes missing presets and rejects their old handlers', async () => {
    await createInstance();
    clients[0].state.presetId = 1;
    clients[0].emit('update:state');
    clients[0].emit('update:presets');
    const oldService = service('1');
    const oldGet = getHandler('1');
    const oldSet = setHandler('1');

    delete (clients[0].presets as Partial<typeof clients[0]['presets']>)['1'];
    clients[0].emit('update:presets');
    expect(accessory.removeService).toHaveBeenCalledWith(oldService);
    expect(service('1')).toBeUndefined();
    await expect(oldGet()).resolves.toBe(false);
    await expect(oldSet(true)).rejects.toBeInstanceOf(HapStatusError);
    expect(clients[0].setPreset).not.toHaveBeenCalled();
    expect(instance['presetList'].map((preset) => preset.id)).toEqual(['2']);
  });

  it('does not change a new preset object when an old write completes after a refresh', async () => {
    await createInstance();
    clients[0].emit('update:state');
    clients[0].emit('update:presets');
    let completeWrite!: () => void;
    clients[0].setPreset.mockImplementationOnce(() => new Promise<void>((resolve) => { completeWrite = resolve; }));
    const write = setHandler('1')(true);
    const rejected = expect(write).rejects.toBeInstanceOf(HapStatusError);
    clients[0].emit('update:presets');
    completeWrite();
    await rejected;
    await expect(getHandler('1')()).resolves.toBe(false);
  });

  it('propagates a failed power-off command without changing the reported preset state', async () => {
    await createInstance();
    clients[0].state.presetId = 1;
    clients[0].emit('update:state');
    clients[0].emit('update:presets');
    clients[0].turnOff.mockRejectedValueOnce(new Error('transport failed'));

    await expect(setHandler('1')(false)).rejects.toBeInstanceOf(HapStatusError);
    await expect(getHandler('1')()).resolves.toBe(true);
  });

  it.each([undefined, '', ' ,  '])('cleans disabled cached presets while offline (%s)', async (configured) => {
    (accessory.context.device as { presets?: string }).presets = configured;
    const cached = accessory.presetServices['WLED-PRESET-1'] = createService('WLED-PRESET-1');
    const live = accessory.presetServices['WLED-LIVE'] = createService('WLED-LIVE');
    accessory.context.device.showRealTimeModeButton = true;
    instance = new WledWsPlatformAccessory(mockPlatform as any, mockLogger as any, accessory as any, false);

    expect(accessory.removeService).toHaveBeenCalledWith(cached);
    expect(accessory.mainService.removeLinkedService).toHaveBeenCalledWith(cached);
    expect(accessory.removeService).not.toHaveBeenCalledWith(live);
    expect(service('1')).toBeUndefined();
    expect(clients[0].setPreset).not.toHaveBeenCalled();
    await flushPromises();
  });

  it('empties the internal list as well as the services when configuration is cleared', async () => {
    await createInstance();
    clients[0].emit('update:state');
    clients[0].emit('update:presets');
    accessory.context.device.presets = '';
    clients[0].emit('update:presets');

    expect(instance['presetList']).toEqual([]);
    expect(service('1')).toBeUndefined();
    expect(service('2')).toBeUndefined();
  });
});
