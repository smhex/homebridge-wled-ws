export class WLEDClient {
  turnOn = jest.fn();
  turnOff = jest.fn();
  allowLiveData = jest.fn();
  ignoreLiveData = jest.fn();
  setBrightness = jest.fn();
  setColor = jest.fn();
  setPreset = jest.fn();
  disconnect = jest.fn();
  refreshPresets = jest.fn();
  refreshEffects = jest.fn();
  on = jest.fn();
  init = jest.fn().mockResolvedValue(true);
  state = {
    on: false,
    liveDataOverride: 1,
    brightness: 128,
    segments: [{ colors: [[255, 0, 0]] }],
    presetId: '-1',
    playlistId: '-1',
  };
  presets = {};
  effects = {};
  config = {};
  info = {
    brand: 'WLED',
    product: 'LED Controller',
    version: '0.15.0',
    mac: 'AA:BB:CC:DD:EE:FF',
    leds: { lightCapabilities: JSON.stringify(1) },
  };
}