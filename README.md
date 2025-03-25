<p align="center">

<img src="https://github.com/homebridge/branding/blob/latest/logos/homebridge-color-round-stylized.png" width="150">
<img src="https://github.com/Aircoookie/Akemi/blob/master/akemi/007_happy.png" width="150">

</p>

<span align="center">
    
# Homebridge WLED plugin

[![npm](https://img.shields.io/npm/v/homebridge-wled-ws.svg?style=plastic)](https://www.npmjs.com/package/homebridge-wled-ws)
[![npm](https://img.shields.io/npm/dt/homebridge-wled-ws.svg?style=plastic)](https://www.npmjs.com/package/homebridge-wled-ws)
[![npm](https://img.shields.io/npm/v/homebridge-wled-ws/beta?label=beta&style=plastic)](https://www.npmjs.com/package/homebridge-wled-ws?activeTab=versions)
[![GitHub last commit](https://img.shields.io/github/last-commit/smhex/homebridge-wled-ws.svg?style=plastic)](https://github.com/smhex/homebridge-wled-ws)
![GitHub build](https://img.shields.io/github/actions/workflow/status/smhex/homebridge-wled-ws/build_package.yml?style=plastic)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

</span>

This is a Homebridge dynamic platform plugin for controlling LED strips connected to a [WLED](https://github.com/Aircoookie/WLED) controller. It is based on the fantastic [wled-client](https://github.com/ShiftLimits/wled-client) library, which provides access to WLED's JSON API using websockets.


## Description

The plugin adds a Lightbulb to Homekit for every configured WLED controller. The Lightbulb can be switched on and off and it's dimmable. Depending on the LED configuration additional services will be made available (e.g. color selection). For each configured preset a switch is created that can be used in for  automation. Unlike other plugins the preset selection is not implemented as a Homekit Television service.

## Configuration

The plugin supports schema based configuration. All settings can be entered using the plugin's configuration dialog. There is a basic input data validation included, however this needs to be improved in future versions.

Using Homebridge's integrated JSON Editor requires the following configuration entries:

```
{
    "name": "Homebridge-Wled-WS",
    "platform": "wled-ws",
    "controllers": [
        {
            "name": "My WLED Controller",
            "address": "192.168.1.100",
            "presets": "DoorClosed,DoorOpen",
            "showRealTimeModeButton": false,
            "resetRealTimeModeAfterStream": true
        }
    ],
    "logging": false
}
```
### Settings

| Setting    | Value                       | Comment                                                                                                                                                                                |
| :----------| :-------------------------- |:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| name       | Name of the WLED controller | This name is used for the acessory in Homekit and for the Homebridge logs                                                                                                              |
| address    | IP address or host name     | Enter the address of the controller - make sure it is the same which is shown as Client IP in the WLED Wifi settings                                                                   |
| presets    | list of presets     | Enter a comma separated list of presets. A switch will be created in Homekit for each preset                                                                                           |
| logging    | True or False               | If enabled (=True) WLED's JSON data will be logged. Leave it disabled if everything works as expected. If you want to file an issue on Github turn it on for later analysis            |
| showRealTimeModeButton | True or False | If enabled (=True) a switch will be created in Homekit to enable/disable real-time mode. This is useful if you sometimes want to disable the real time mode.                           |
| resetRealTimeModeAfterStream | True or False | If disabled (=True) the showRealTimeModeButton Switch controls the state of the realtime mode. If enabled realtime mode always turns back on, after finising a real time mode session. |


> [!IMPORTANT] 
> WLED organizes presets by id. This plugin uses names for configuration. When starting, it checks whether the name exists. If not, an error message is generated. In such a case please check the preset name for typos.

## Why using websockets instead of MQTT or HTTP?

Before starting the implementation of this plugin I intended to use WLED's MQTT feature to control my LED strips. While sending data in JSON format to the WLED controller is straightforward, it was difficult for me to parse the answer, which is in XML format. I am not aware of an existing MQTT Homebridge plugin to handle such a device. The HTTP interface is more consistent in that sense, but requires polling to get state updates when the WLED state is modified outside Homekit/Homebridge (e.g. by mobile apps or other smart home automation systems). The websocket approach allows real-time state updates for all connected clients. 

## Limitations

1. WLED supports segments, however the created Homekit accessory only controls the first (main) segment
2. The brightness is set for the whole strip, brightness per segment is ignored


## WLED Compatibility Notes

| Firmware    | Tested                       | Comment |
| :----------| :-------------------------- | :------ |
| 0.13.x  |  ✅ |
| 0.14.1  |  ✅ |
| 0.14.2  | 🔥 | The WLED websocket interface is broken. Using this plugin will most likely trigger a reboot of your controller, hence the connection will fail. |
| 0.14.3  | ✅ |  |
| 0.14.4  | ✅ |  |
| 0.15.0  | ✅ |  |

## Thanks to the contributors

- @LeLunZ for adding live mode support
