// see config.schema.json
export interface WledController{
    name : string;
    address : string;
    presets : string;
}

export enum LightCapability {
    OnOff = 0,
    RGB = 1,
    White = 2,
    RGBW = 3
  }