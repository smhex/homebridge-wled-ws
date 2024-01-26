import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { WledWsHomebridgePlatform } from './WledWsPlatform';
import { WledController } from './WledController';
import { WLEDClient } from 'wled-client';
import { Logger } from 'homebridge';
import Timeout = NodeJS.Timeout;

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class WledWsPlatformAccessory {
  private service: Service;
  private wledClient;
  private connClosed = false;
  private wsPingIntervalMillis = 5000;
  private wsPingIntervalId: Timeout | null = null;
  private wsReconnectIntervalId: Timeout | null = null;
  private wsReconnectIntervalMillis = 10000;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private exampleStates = {
    On: false,
    Brightness: 100,
  };

  constructor(
    private readonly platform: WledWsHomebridgePlatform,
    private readonly log: Logger,
    private readonly accessory: PlatformAccessory,
    private readonly loggingEnabled : boolean,
  ) {

    this.log = log;

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this))       // SET - bind to the 'setBrightness` method below
      .onGet(this.getBrightness.bind(this));      // GET - bind to the `getBrightness` method below

    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */


    this.connect();
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    this.exampleStates.On = value as boolean;

    // org debug
    this.platform.log.info('Set Characteristic On ->', value);
    if (value) {
      this.wledClient.turnOn();
    } else{
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
    // implement your own code to check if the device is on
    const isOn = this.exampleStates.On;

    // org debg
    this.platform.log.info('Get Characteristic On ->', isOn);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return isOn;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    // implement your own code to set the brightness
    this.exampleStates.Brightness = value as number;

    // org log debug
    this.platform.log.info('Set Characteristic Brightness -> ', value);
    this.wledClient.setBrightness(Math.round(this.exampleStates.Brightness*255/100));
  }

  /**
    */
  async getBrightness(): Promise<CharacteristicValue> {

    // implement your own code to check if the device is on
    const brightness = this.exampleStates.Brightness;

    // org debg
    this.platform.log.info('Get Characteristic Brightness ->', brightness);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    return brightness;
  }

  /**
   * Connect the controller and bind the callback handlers for
   * 	state, info, effects, palettes, presets, deviceOptions, lightCapabilities, config
   */
  async connect(): Promise<boolean> {

    this.connClosed = false;

    const controller = <WledController>this.accessory.context.device;
    this.log.info('Connecting to controller %s at address %s', controller.name, controller.address);
    this.wledClient = new WLEDClient(controller.address);

    this.wledClient.on('open', () => {
      this.connected();
    });

    this.wledClient.on('close', () => {
      this.disconnected();
    });

    // update accessory state
    this.wledClient.on('update:state', () => {
      this.stateReceived();
    });

    this.wledClient.on('update:presets', () => {
      this.presetsReceived();
    });

    this.wledClient.on('update:effects', () => {
      this.effectsReceived();
    });

    this.wledClient.on('update:config', () => {
      this.configReceived();
    });

    /**
    wledClient.on('error', (error) => {
      this.log.error('Controller %s communication error: ' + error.message);
      this.clearWsPingInterval();
      if (!this.connClosed) {
        this.setWsReconnectInterval(listener);
      }
    });
    */
    try {
      await this.wledClient.init();
      this.updateAccessoryInformation();
    } catch(e) {
      this.log.error('Caught rejected \'init\' promise.');
    }
    return true;
  }

  /**
   * Callback: each time controller's state changes this function is called. State changes can
   * triggered by user interaction or other clients
   */
  stateReceived(){
    const controller = <WledController>this.accessory.context.device;
    this.log.info(`Received state for controller %s ${this.loggingEnabled?JSON.stringify(this.wledClient.state):''}`, controller.name);
    this.exampleStates.On = this.wledClient.state.on;
    this.exampleStates.Brightness = Math.round(this.wledClient.state.brightness*100/255);
    this.service.updateCharacteristic(this.platform.Characteristic.On, this.exampleStates.On);
    this.service.updateCharacteristic(this.platform.Characteristic.Brightness, this.exampleStates.Brightness);
    if (!this.exampleStates.On){
      //this.refreshPresets();
    }
  }

  /**
   * Callback: each time controller's presets changes this function is called. Preset changes can
   * triggered by user interaction or other clients
   */
  presetsReceived(){
    const controller = <WledController>this.accessory.context.device;
    this.log.info(`Received presets for controller %s ${this.loggingEnabled?JSON.stringify(this.wledClient.presets):''}`, controller.name);
  }

  /**
   * Callback: each time controller's effects changes this function is called. Effect changes can
   * triggered by user interaction or other clients
   */
  effectsReceived(){
    const controller = <WledController>this.accessory.context.device;
    this.log.info(`Received effects for controller %s ${this.loggingEnabled?JSON.stringify(this.wledClient.effects):''}`, controller.name);
  }

  /**
   * Callback: each time controller's config changes this function is called. Config changes can
   * triggered by user interaction or other clients
   */
  configReceived(){
    const controller = <WledController>this.accessory.context.device;
    this.log.info(`Received config for controller %s ${this.loggingEnabled?JSON.stringify(this.wledClient.config):''}`, controller.name);
  }

  /**
   * Refresh presets to update preset information. This is done, when the controller is turned off
   * to avoid too much cpu load on the controller when the lights or effetcs are on. Presets can be
   * configured by the user or an API anytime - so we need to update this information regularly.
   */
  refreshPresets(){
    const controller = <WledController>this.accessory.context.device;
    this.log.info('Requesting presets for controller %s', controller.name);
    this.wledClient.refreshPresets();
  }

  /**
   * Refresh effects to update effect information.
   */
  refreshEffects(){
    const controller = <WledController>this.accessory.context.device;
    this.log.info('Requesting effetcs for controller %s', controller.name);
    this.wledClient.refreshEffects();
  }

  /**
   * Callback: connection to the controller is established
   */
  connected(){
    const controller = <WledController>this.accessory.context.device;
    this.log.info('Controller %s connected', controller.name);
  }

  /**
   * Callback: connection to the controller is closed
   */
  disconnected(){
    const controller = <WledController>this.accessory.context.device;
    this.log.info('Controller %s disconnected', controller.name);
  }

  /**
   * After successful connect to the controller, its properties are read and set as
   * accessory information.
   */
  updateAccessoryInformation(){
    const controller = <WledController>this.accessory.context.device;
    this.log.debug(`Received info for controller %s (${JSON.stringify(this.wledClient)})`, controller.name);
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, this.wledClient.info.brand)
      .setCharacteristic(this.platform.Characteristic.Model, this.wledClient.info.product)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.wledClient.info.version)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.wledClient.info.mac);
  }

}


