# homebridge-wled-ws

[![npm](https://img.shields.io/npm/v/homebridge-wled-ws.svg?style=plastic)](https://www.npmjs.com/package/homebridge-wled-ws)
[![npm](https://img.shields.io/npm/dt/homebridge-wled-ws.svg?style=plastic)](https://www.npmjs.com/package/homebridge-wled-ws)
[![GitHub last commit](https://img.shields.io/github/last-commit/smhex/homebridge-wled-ws.svg?style=plastic)](https://github.com/smhex/homebridge-wled-ws)
![GitHub build](https://img.shields.io/github/actions/workflow/status/smhex/homebridge-wled-ws/build_package.yml?style=plastic)

## Homebridge WLED plugin

This is a Homebridge dynamic platform plugin for controlling LED strips using Websockets. It is based on the fantastic [wled-client](https://github.com/ShiftLimits/wled-client) library, which provides access to WLED's JSON API using websockets.


> [!NOTE] 
> Websockets are enabled by default since WLED version 0.10.2

The plugin adds a Lightbulb to Homekit for every configured WLED controller. The Lightbulb can be switched on and off and it's dimmable. Depending on the LED configuration additional services will be made available (e.g. color selection). 

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
            "address": "192.168.1.100"
        }
    ],
    "logging": false
}
```
### Settings

| Setting    | Value                       | Comment |
| :----------| :-------------------------- | :------ |
| name       | Name of the WLED controller | This name is used for the acessory in Homekit and for the Homebridge logs |
| address    | IP address or host name     | Enter the address of the controller - make sure it is the same which is shown as Client IP in the WLED Wifi settings |
| logging    | True or False               | If enabled (=True) WLED's JSON data will be logged. Leave it disabled if everything works as expected. If you want to file an issue on Github turn it on for later analysis|

## Why using websockets instead of MQTT or HTTP?

Before starting the implementation of this plugin I intended to use WLED's MQTT feature to control my LED strips. While sending data in JSON format to the WLED controller is straightforward, it was difficult for me to parse the answer, which is in XML format. I am not aware of an existing MQTT Homebridge plugin to handle such a device. The HTTP interface is more consistent in that sense, but requires polling to get state updates when the WLED state is modified outside Homekit/Homebridge (e.g. by mobile apps or other smart home automation systems). The websocket approach allows real-time state updates for all connected clients. 

## Limitations

1. WLED supports segments, however the created Homekit accessory only controls the first (main) segment
2. The brightness is set for the whole strip, brightness per segment is ignored


## TODOs
- ~~harden controller communication (reconnects)~~
- ~~support color picker~~
- add effects and presets
- add support for playlists
