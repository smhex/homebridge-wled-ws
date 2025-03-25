import { Service } from 'homebridge';

// see config.schema.json
export interface WledController {
  name: string;
  address: string;
  presets: string;
  showRealTimeModeButton: boolean;
  resetRealTimeModeAfterStream: boolean;
}

export enum LightCapability {
  OnOff = 0,
  RGB = 1,
  White = 2,
  RGBW = 3,
}

export interface WledControllerPreset {
  id: string;
  name: string;
  on: boolean;
  hapService: Service;
  controller: WledController;
  isPlaylist: boolean;
}
