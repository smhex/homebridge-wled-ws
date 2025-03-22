import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
} from 'homebridge';
import { WledWsHomebridgePlatform } from './WledWsPlatform';
import {
  WledController,
  LightCapability,
  WledControllerPreset,
} from './WledController';
import { WLEDClient } from 'wled-client';
import { Logger } from 'homebridge';
import { PLUGIN_NAME, PLUGIN_AUTHOR } from './settings';
import { rgbToHsv, hsvToRgb } from './WledUtils';
import Timeout = NodeJS.Timeout;

/**
 * Helper interface for dealing with preset
 */
interface PresetElementDescription {
  id: string;
  name: string;
  isPlaylist: boolean;
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class WledWsPlatformAccessory {
  private service: Service;
  private realTimeService?: Service;
  private presetList: WledControllerPreset[] = [];
  private activePreset: WledControllerPreset | null = null;
  private activePlaylist: WledControllerPreset | null = null;
  private wledClient;
  private connectionClosed = false;
  private connectionEstablished = false;
  private reconnectIntervalId: Timeout | null = null;
  private reconnectIntervalMillis = 10000;
  private init = false;

  /**
   * Tracks the LED state
   */
  private ledState = {
    On: false,
    Live: false,
    Brightness: 100,
    Hue: 0,
    Saturation: 0,
    Value: 0,
    PresetId: '-1',
    PlaylistId: '-1',
    LightCapability: LightCapability.OnOff,
  };

  constructor(
    private readonly platform: WledWsHomebridgePlatform,
    private readonly log: Logger,
    private readonly accessory: PlatformAccessory,
    private readonly loggingEnabled: boolean,
  ) {
    this.log = log;

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    // in case more services are added, this one will be our primary service
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name,
    );
    this.service.setPrimaryService(true);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    // Set initial accessory information - this will be overwritten as soon as the controller is connected
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        PLUGIN_AUTHOR,
      )
      .setCharacteristic(this.platform.Characteristic.Model, PLUGIN_NAME)
      .setCharacteristic(
        this.platform.Characteristic.FirmwareRevision,
        'not set',
      )
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'not set');

    // check if real time mode button should be shown
    const controller = <WledController>this.accessory.context.device;
    if (controller.showRealTimeModeButton) {
      // get switch service if it exists, otherwise create a new switch service
      this.realTimeService =
        this.accessory.getServiceById(
          this.platform.Service.Switch,
          'WLED-LIVE',
        ) ||
        this.accessory.addService(
          this.platform.Service.Switch,
          'Live Mode',
          'WLED-LIVE',
        );

      // name set to ambilight as most people are familiar with this term
      this.realTimeService.setCharacteristic(
        this.platform.Characteristic.Name,
        'Ambilight',
      );

      // register handlers for the On/Off Characteristic
      this.realTimeService
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.liveSetOn.bind(this))
        .onGet(this.liveGetOn.bind(this));

      // link service to main service
      this.service.addLinkedService(this.realTimeService);
    }

    // Connect the controller with Reconnect-Flag set to false
    this.connect(false);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    // only proceed if controller is connected
    const controller = <WledController>this.accessory.context.device;
    if (!this.connectionEstablished) {
      this.log.error('No connection to controller %s', controller.name);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }

    this.ledState.On = value as boolean;

    this.platform.log.info(
      'Set controller %s On state to: %s',
      controller.name,
      value ? 'On' : 'Off',
    );
    if (value) {
      this.wledClient.turnOn();
    } else {
      this.wledClient.turnOff();
    }
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    const isOn = this.ledState.On;
    const controller = <WledController>this.accessory.context.device;
    this.platform.log.debug(
      'Get controller %s On state: %s',
      controller.name,
      isOn ? 'On' : 'Off',
    );
    return isOn;
  }

  /**
   * Set if the real time mode is active. This is a separate switch in Homekit to enable/disable
   */
  async liveSetOn(value: CharacteristicValue) {
    // only proceed if controller is connected
    const controller = <WledController>this.accessory.context.device;
    if (!this.connectionEstablished) {
      this.log.error('No connection to controller %s', controller.name);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }

    this.ledState.Live = value as boolean;

    this.platform.log.info(
      'Set controller %s On state to: %s',
      controller.name,
      value ? 'On' : 'Off',
    );
    if (value) {
      this.wledClient.allowLiveData();
    } else {
      this.platform.log.info(
        'Resetting real time mode after stream for controller %s',
        controller.resetRealTimeModeAfterStream ? 'true' : 'false',
      );
      this.wledClient.ignoreLiveData(!controller.resetRealTimeModeAfterStream);
    }
  }

  /**
   * Returns the real time mode state to Homekit
   */
  async liveGetOn(): Promise<CharacteristicValue> {
    const isLive = this.ledState.Live;
    const controller = <WledController>this.accessory.context.device;
    this.platform.log.debug(
      'Get controller %s Live state: %s',
      controller.name,
      isLive ? 'On' : 'Off',
    );
    return isLive;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    // only proceed if controller is connected
    const controller = <WledController>this.accessory.context.device;
    if (!this.connectionEstablished) {
      this.log.error('No connection to controller %s', controller.name);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }

    this.ledState.Brightness = value as number;

    this.platform.log.info(
      'Set controller %s brightness to: %s',
      controller.name,
      value,
    );
    this.wledClient.setBrightness(
      Math.round((this.ledState.Brightness * 255) / 100),
    );
  }

  /**
   * Returns current brightness to Homekit
   */
  async getBrightness(): Promise<CharacteristicValue> {
    const brightness = this.ledState.Brightness;
    const controller = <WledController>this.accessory.context.device;
    this.platform.log.debug(
      'Get controller %s brightness: %s',
      controller.name,
      brightness,
    );
    return brightness;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Hue
   */
  async setHue(value: CharacteristicValue) {
    // only proceed if controller is connected
    const controller = <WledController>this.accessory.context.device;
    if (!this.connectionEstablished) {
      this.log.error('No connection to controller %s', controller.name);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }

    this.ledState.Hue = value as number;

    const { r, g, b } = hsvToRgb(
      (value as number) / 360,
      this.ledState.Saturation / 100,
      this.ledState.Brightness / 100,
    );
    this.platform.log.info(
      `Set controller %s hue to: %s (RGB: ${r},${g},${b})`,
      controller.name,
      value,
    );
    this.wledClient.setColor([r, g, b]);
  }

  /**
   * Returns the Hue value to Homekit
   */
  async getHue(): Promise<CharacteristicValue> {
    const hue = this.ledState.Hue;
    const controller = <WledController>this.accessory.context.device;
    this.platform.log.debug('Get controller %s hue: %s', controller.name, hue);
    return hue;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Saturation
   */
  async setSaturation(value: CharacteristicValue) {
    // only proceed if controller is connected
    const controller = <WledController>this.accessory.context.device;
    if (!this.connectionEstablished) {
      this.log.error('No connection to controller %s', controller.name);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }

    this.ledState.Saturation = value as number;
    const { r, g, b } = hsvToRgb(
      this.ledState.Hue / 360,
      (value as number) / 100,
      this.ledState.Brightness / 100,
    );
    this.platform.log.info(
      `Set controller %s saturation to: %s (RGB: ${r},${g},${b})`,
      controller.name,
      value,
    );
    this.wledClient.setColor([r, g, b]);
  }

  /**
   * Returns the saturation value to Homekit
   */
  async getSaturation(): Promise<CharacteristicValue> {
    const saturation = this.ledState.Saturation;
    const controller = <WledController>this.accessory.context.device;
    this.platform.log.debug(
      'Get controller %s saturation: %s',
      controller.name,
      saturation,
    );
    return saturation;
  }

  /**
   * Sets the preset state from Homekit
   */
  async setPreset(
    preset: WledControllerPreset,
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ) {
    // only proceed if controller is connected
    const controller = <WledController>this.accessory.context.device;
    if (!this.connectionEstablished) {
      this.log.error('No connection to controller %s', controller.name);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }

    this.platform.log.info(
      'Set On state for %s %s (%s) of controller %s to: %s',
      preset.isPlaylist ? 'playlist' : 'preset',
      preset.id,
      preset.name,
      preset.controller.name,
      value ? 'On' : 'Off',
    );

    // switch on new preset
    preset.on = <boolean>value;
    if (preset.on) {
      this.wledClient.setPreset(preset.id);
    } else {
      this.wledClient.turnOff();
    }
    callback(null);
  }

  /**
   * Returns the preset state to Homekit
   */
  getPreset(preset: WledControllerPreset, callback: CharacteristicGetCallback) {
    this.platform.log.debug(
      'Get On state for %s %s (%s) of controller %s: %s',
      preset.isPlaylist ? 'playlist' : 'preset',
      preset.id,
      preset.name,
      preset.controller.name,
      preset.on ? 'On' : 'Off',
    );
    callback(null, preset.on);
  }

  /**
   * Connect the controller and bind the callback handlers for
   * 	state, info, effects, palettes, presets, deviceOptions, lightCapabilities, config
   */
  async connect(isReconnect: boolean): Promise<boolean> {
    this.connectionClosed = false;

    const controller = <WledController>this.accessory.context.device;
    this.log.info(
      `${isReconnect ? 'Reconnecting' : 'Connecting'} to controller %s at address %s`,
      controller.name,
      controller.address,
    );

    //this.wledClient = new WLEDClient(controller.address);
    this.wledClient = new WLEDClient({
      host: controller.address,
      websocket: {
        reconnect: true,
      },
      immediate: true,
      secure: false,
      init: {
        presets: true,
        config: true,
      },
    });

    this.wledClient.on('open', () => {
      this.onConnected();
    });

    this.wledClient.on('close', () => {
      this.onDisconnected();
    });

    // update accessory state
    this.wledClient.on('update:state', () => {
      this.onStateReceived();
    });

    this.wledClient.on('update:presets', () => {
      this.onPresetsReceived();
    });

    this.wledClient.on('update:effects', () => {
      this.onEffectsReceived();
    });

    this.wledClient.on('update:config', () => {
      this.onConfigReceived();
    });

    this.wledClient.on('update:info', () => {
      this.onInfoReceived();
    });

    this.wledClient.on('error', (error) => {
      this.onError(error);
    });

    try {
      await this.wledClient.init();
    } catch {
      this.log.error(
        'Error connecting controller %s at address %s',
        controller.name,
        controller.address,
      );
    }
    return true;
  }

  /**
   * Disconnects the controller. This happens on shutdown of the plugin only
   */
  disconnect() {
    if (!this.connectionClosed) {
      const controller = <WledController>this.accessory.context.device;
      this.log.info('Disconnecting controller %s', controller.name);

      if (this.reconnectIntervalId !== null) {
        clearTimeout(this.reconnectIntervalId);
      }

      this.connectionClosed = true;
      this.wledClient.disconnect();
    }
  }

  /**
   * Callback: each time controller's state changes this function is called. State changes can
   * triggered by user interaction or other clients
   */
  onStateReceived() {
    const controller = <WledController>this.accessory.context.device;
    this.log.info(
      `Received controller %s state update ${this.loggingEnabled ? JSON.stringify(this.wledClient.state) : ''}`,
      controller.name,
    );

    if (this.ledState.On !== this.wledClient.state.on) {
      this.ledState.On = this.wledClient.state.on;
      this.platform.log.info(
        'Controller %s updated current On state to: %s',
        controller.name,
        this.ledState.On,
      );
      this.service.updateCharacteristic(
        this.platform.Characteristic.On,
        this.ledState.On,
      );
    }

    // liveDataOverride === 0 means live mode is active
    if (this.ledState.Live !== (this.wledClient.state.liveDataOverride === 0)) {
      this.ledState.Live = this.wledClient.state.liveDataOverride === 0;
      this.platform.log.info(
        'Controller %s updated current Live state to: %s',
        controller.name,
        this.ledState.Live,
      );
      if (this.realTimeService) {
        this.realTimeService.updateCharacteristic(
          this.platform.Characteristic.On,
          this.ledState.Live,
        );
      }
    }

    if (this.ledState.LightCapability !== LightCapability.OnOff) {
      const brightness = Math.round(
        (this.wledClient.state.brightness * 100) / 255,
      );
      if (this.ledState.Brightness !== brightness) {
        this.ledState.Brightness = brightness;
        this.platform.log.info(
          'Controller %s updated current brightness to: %s',
          controller.name,
          this.ledState.Brightness,
        );
        this.service.updateCharacteristic(
          this.platform.Characteristic.Brightness,
          this.ledState.Brightness,
        );
      }
    }

    // update current color settings (if changed outside Homekit)
    if (
      this.ledState.LightCapability === LightCapability.RGB ||
      this.ledState.LightCapability === LightCapability.RGBW
    ) {
      const val = this.wledClient.state.segments[0].colors[0];
      const { h, s, v } = rgbToHsv(val[0], val[1], val[2]);
      if (
        this.ledState.Hue !== h * 360 ||
        this.ledState.Saturation !== s * 100 ||
        this.ledState.Value !== v * 100
      ) {
        this.platform.log.debug(
          'Controller %s updated current color to: RGB %s:%s:%s -> HSV %s:%s:%s',
          controller.name,
          val[0],
          val[1],
          val[2],
          h,
          s,
          v,
        );

        // store new values and update Homekit
        this.ledState.Hue = h * 360;
        this.ledState.Saturation = s * 100;
        this.ledState.Value = v * 100;
        this.service.updateCharacteristic(
          this.platform.Characteristic.Hue,
          this.ledState.Hue,
        );
        this.service.updateCharacteristic(
          this.platform.Characteristic.Saturation,
          this.ledState.Saturation,
        );
      }
    }

    // check for updated preset
    if (this.ledState.PresetId !== this.wledClient.state.presetId) {
      this.platform.log.info(
        'Controller %s updated current preset to: %s',
        controller.name,
        this.wledClient.state.presetId,
      );

      // switch off active preset first
      if (this.activePreset !== null) {
        this.activePreset.on = false;
        this.platform.log.info(
          'Set On state for last active %s %s (%s) of controller %s to: %s',
          this.activePreset.isPlaylist ? 'playlist' : 'preset',
          this.activePreset.id,
          this.activePreset.name,
          this.activePreset.controller.name,
          this.activePreset.on ? 'On' : 'Off',
        );
        this.activePreset.hapService.updateCharacteristic(
          this.platform.Characteristic.On,
          this.activePreset.on,
        );
        this.activePreset = null;
      } else {
        this.platform.log.debug(
          'Last active preset not set for controller %s',
          controller.name,
        );
      }

      // switch to new preset and update state
      const newPreset = this.presetList.find(
        (obj) => obj.id === this.wledClient.state.presetId.toString(),
      );
      if (newPreset !== undefined) {
        newPreset.on = this.ledState.On;
        this.platform.log.info(
          'Set On state for new %s %s (%s) of controller %s to: %s',
          newPreset.isPlaylist ? 'playlist' : 'preset',
          newPreset.id,
          newPreset.name,
          newPreset.controller.name,
          newPreset.on ? 'On' : 'Off',
        );
        newPreset.hapService.updateCharacteristic(
          this.platform.Characteristic.On,
          newPreset.on,
        );

        // set new preset as active preset
        this.activePreset = newPreset;
      } else {
        if (this.wledClient.state.presetId.toString() === '-1') {
          this.platform.log.debug(
            'No preset selected by controller %s',
            controller.name,
          );
        } else {
          this.platform.log.debug(
            'Preset not configured for controller %s',
            controller.name,
          );
        }
      }
    }
    this.ledState.PresetId = this.wledClient.state.presetId;

    // check for updated playlist
    if (this.ledState.PlaylistId !== this.wledClient.state.playlistId) {
      if (this.wledClient.state.playlistId !== '-1') {
        this.platform.log.info(
          'Controller %s updated current playlist to: %s',
          controller.name,
          this.wledClient.state.playlistId,
        );

        // immediately switch off playlist
        const newPlaylist = this.presetList.find(
          (obj) => obj.id === this.wledClient.state.playlistId.toString(),
        );
        if (newPlaylist !== undefined) {
          newPlaylist.on = false;
          this.platform.log.info(
            'Set On state for new %s %s (%s) of controller %s to: %s',
            newPlaylist.isPlaylist ? 'playlist' : 'preset',
            newPlaylist.id,
            newPlaylist.name,
            newPlaylist.controller.name,
            newPlaylist.on ? 'On' : 'Off',
          );
          newPlaylist.hapService.updateCharacteristic(
            this.platform.Characteristic.On,
            newPlaylist.on,
          );
        }
      }
      this.ledState.PlaylistId = this.wledClient.state.playlistId;
    }
  }

  /**
   * Callback: each time controller's presets changes this function is called. Preset changes can
   * triggered by user interaction or other clients. This function checks, if the configured presets
   * are available on the controller. If not, a error message is logged to the console
   */
  onPresetsReceived() {
    const controller = <WledController>this.accessory.context.device;
    this.log.info(
      `Received presets for controller %s ${this.loggingEnabled ? JSON.stringify(this.wledClient.presets) : ''}`,
      controller.name,
    );

    // check if presets are configured by user and create list of available presets on the controller
    if (controller.presets !== undefined) {
      const configuredPresets: string[] = controller.presets.split(',');
      const presetElementList: PresetElementDescription[] = [];
      for (const key of Object.keys(this.wledClient.presets)) {
        if (
          Object.prototype.hasOwnProperty.call(this.wledClient.presets, key)
        ) {
          if (
            Object.prototype.hasOwnProperty.call(
              this.wledClient.presets[key],
              'name',
            )
          ) {
            const isPlaylist = !Object.prototype.hasOwnProperty.call(
              this.wledClient.presets[key],
              'segments',
            );
            presetElementList.push({
              id: key,
              name: this.wledClient.presets[key].name,
              isPlaylist: isPlaylist,
            });
            this.log.debug(
              'Got %s %s from controller %s',
              isPlaylist ? 'playlist' : 'preset',
              this.wledClient.presets[key].name,
              controller.name,
            );
          }
        }
      }

      const missingPresets = configuredPresets.filter(
        (str) => !presetElementList.some((obj) => obj.name === str),
      );

      if (missingPresets.length > 0) {
        this.log.error(
          'Configured preset(s) %s not supported by controller %s',
          missingPresets,
          controller.name,
        );
      }

      // reduce list with presets to the user configured elements
      const existingPresets = presetElementList.filter((obj) =>
        configuredPresets.includes(obj.name),
      );
      for (const preset of existingPresets) {
        // add a switch for each preset in Homekit
        let presetSwitchService = this.accessory.getServiceById(
          this.platform.Service.Switch,
          'WLED-PRESET-' + preset.id,
        );
        if (presetSwitchService === undefined) {
          presetSwitchService = this.accessory.addService(
            this.platform.Service.Switch,
            preset.name,
            'WLED-PRESET-' + preset.id,
          );
          presetSwitchService.addOptionalCharacteristic(
            this.platform.Characteristic.ConfiguredName,
          );
          presetSwitchService.setCharacteristic(
            this.platform.Characteristic.ConfiguredName,
            preset.name,
          );
          this.service.addLinkedService(presetSwitchService);
        }

        // create a preset object for the callback handler
        const wledControllerPreset: WledControllerPreset = {
          name: preset.name,
          id: preset.id,
          on: false,
          hapService: presetSwitchService,
          controller: controller,
          isPlaylist: preset.isPlaylist,
        };

        presetSwitchService
          .getCharacteristic(this.platform.Characteristic.On)
          .on('get', (callback) => {
            this.getPreset(wledControllerPreset, callback);
          })
          .on('set', (value, callback) => {
            this.setPreset(wledControllerPreset, value, callback);
          });

        // store them for later usage
        this.presetList.push(wledControllerPreset);

        //this.switchServices.push(presetSwitchService);
        this.log.debug(
          'Added %s switch %s (id:%s) for controller %s',
          preset.isPlaylist ? 'playlist' : 'preset',
          preset.name,
          preset.id,
          controller.name,
        );
      }

      // Delete orphaned services which were created earlier and not needed anymore
      for (let i = 0; i <= 250; i++) {
        const cachedService = this.accessory.getServiceById(
          this.platform.Service.Switch,
          'WLED-PRESET-' + i,
        );
        if (cachedService) {
          if (!existingPresets.some((obj) => obj.id === i.toString())) {
            this.log.debug(
              'Remove cached preset switch with id %s for controller',
              i,
              controller.name,
            );
            this.service.removeLinkedService(cachedService);
            this.accessory.removeService(cachedService);
          }
        }
      }
    }
  }

  /**
   * Callback: each time controller's effects changes this function is called. Effect changes can
   * triggered by user interaction or other clients
   */
  onEffectsReceived() {
    const controller = <WledController>this.accessory.context.device;
    this.log.info(
      `Received effects for controller %s ${this.loggingEnabled ? JSON.stringify(this.wledClient.effects) : ''}`,
      controller.name,
    );
  }

  /**
   * Callback: each time controller's config changes this function is called. Config changes can
   * triggered by user interaction or other clients
   */
  onConfigReceived() {
    const controller = <WledController>this.accessory.context.device;
    this.log.info(
      `Received config for controller %s ${this.loggingEnabled ? JSON.stringify(this.wledClient.config) : ''}`,
      controller.name,
    );
  }

  /**
   * Callback: each time controller's info changes this function is called. State info can
   * triggered by user interaction or other clients
   */
  onInfoReceived() {
    const controller = <WledController>this.accessory.context.device;
    this.log.info(
      `Received ${!this.init ? 'initial ' : ''}info for controller %s`,
      controller.name,
    );

    // initialize accessory information only once at startup
    if (!this.init) {
      this.updateAccessoryInformation();
      this.init = true;
    }
  }

  /**
   * Refresh presets to update preset information. This is done, when the controller is turned off
   * to avoid too much cpu load on the controller when the lights or effetcs are on. Presets can be
   * configured by the user or an API anytime - so we need to update this information regularly.
   */
  refreshPresets() {
    const controller = <WledController>this.accessory.context.device;
    this.log.info('Requesting presets for controller %s', controller.name);
    this.wledClient.refreshPresets();
  }

  /**
   * Refresh effects to update effect information.
   */
  refreshEffects() {
    const controller = <WledController>this.accessory.context.device;
    this.log.info('Requesting effects for controller %s', controller.name);
    this.wledClient.refreshEffects();
  }

  /**
   * Callback: connection to the controller is established
   */
  onConnected() {
    const controller = <WledController>this.accessory.context.device;
    this.log.info('Controller %s connected', controller.name);
    this.connectionEstablished = true;
  }

  /**
   * Callback: connection to the controller is closed
   */
  onDisconnected() {
    this.connectionEstablished = false;
    const controller = <WledController>this.accessory.context.device;
    this.log.info('Controller %s disconnected', controller.name);
  }

  /**
   * Callback: connection to the controller throws an error (e.g. is closed by controller)
   */
  onError(error) {
    const controller = <WledController>this.accessory.context.device;
    this.log.error(
      'Controller %s communication error: ' + error.message,
      controller.name,
    );
    this.connectionEstablished = false;

    if (this.reconnectIntervalId !== null) {
      clearTimeout(this.reconnectIntervalId);
    }

    if (!this.connectionClosed) {
      this.reconnectIntervalId = setTimeout(() => {
        this.connect(true);
      }, this.reconnectIntervalMillis);
    }
  }

  /**
   * After successful connect to the controller, its properties are read and set as
   * accessory information. WLED support different LED stripe types. The configuration is
   * sent via the JSON object "info" and its element "lightCapabilities". The plugin adds
   * its services and characteristics according to the retrieved data. If a specific service
   * is not needed it can be disabled using the settings dialog.
   *
   * See https://kno.wled.ge/interfaces/json-api/#light-capabilities
   *
   * The following behaviour is implemented:
   * Single Color LED stripe or OnOff only: LightBulb with characteristic On and Brightness
   * RGB Color LED stripe: LightBulb with characteristic On, Brightness, Hue, Saturation
   * RGB Color LED stripe with White LED:
   *        - LightBulb with characteristic On, Brightness, Hue, Saturation for RGB
   *        - LightBulb with characteristic On, Brightness for White (can be disabled in settings)
   */
  updateAccessoryInformation() {
    const controller = <WledController>this.accessory.context.device;
    this.log.info(
      'Update accessory info for controller %s to: brand=%s product=%s version=%s mac=%s lc=%s',
      controller.name,
      this.wledClient.info.brand,
      this.wledClient.info.product,
      this.wledClient.info.version,
      this.wledClient.info.mac,
      this.wledClient.info.leds.lightCapabilities,
    );
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        this.wledClient.info.brand,
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        this.wledClient.info.product,
      )
      .setCharacteristic(
        this.platform.Characteristic.FirmwareRevision,
        this.wledClient.info.version,
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.wledClient.info.mac,
      );

    const lc: LightCapability = <LightCapability>(
      JSON.parse(this.wledClient.info.leds.lightCapabilities)
    );

    if (lc === LightCapability.OnOff) {
      this.log.info('Controller %s supports OnOff channel', controller.name);
    }

    if (lc === LightCapability.RGB) {
      this.log.info('Controller %s supports RGB channel', controller.name);
    }

    if (lc === LightCapability.White) {
      this.log.info('Controller %s supports White channel', controller.name);
    }

    if (lc === LightCapability.RGBW) {
      this.log.info('Controller %s supports RGBW channel', controller.name);
    }

    // register handlers for the Brightness Characteristic
    if (
      lc === LightCapability.RGB ||
      lc === LightCapability.RGBW ||
      lc === LightCapability.White
    ) {
      this.service
        .getCharacteristic(this.platform.Characteristic.Brightness)
        .onSet(this.setBrightness.bind(this))
        .onGet(this.getBrightness.bind(this));
    }

    // register handlers for the Hue and Saturation Characteristic
    if (lc === LightCapability.RGB || lc === LightCapability.RGBW) {
      this.service
        .getCharacteristic(this.platform.Characteristic.Hue)
        .onSet(this.setHue.bind(this))
        .onGet(this.getHue.bind(this));

      this.service
        .getCharacteristic(this.platform.Characteristic.Saturation)
        .onGet(this.getSaturation.bind(this))
        .onSet(this.setSaturation.bind(this));
    }
    this.ledState.LightCapability = lc;
  }
}
