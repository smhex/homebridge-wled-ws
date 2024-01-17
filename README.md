# homebridge-wled-ws

[![npm](https://img.shields.io/npm/v/homebridge-wled-ws.svg?style=plastic)](https://www.npmjs.com/package/homebridge-wled-ws)
[![npm](https://img.shields.io/npm/dt/homebridge-wled-ws.svg?style=plastic)](https://www.npmjs.com/package/homebridge-wled-ws)
[![GitHub last commit](https://img.shields.io/github/last-commit/smhex/homebridge-wled-ws.svg?style=plastic)](https://github.com/smhex/homebridge-wled-ws)
![GitHub build](https://img.shields.io/github/actions/workflow/status/smhex/homebridge-wled-ws/build.yml?style=plastic)

## Homebridge WLED plugin

</span>

This is a Homebridge dynamic platform plugin for controlling LED strips using Websockets. It is based on the fantastic [wled-client](https://github.com/ShiftLimits/wled-client) library, which provides access to WLED's JSON API using websockets.

> [!NOTE]
> Websockets are enabled by default since WLED version 0.10.2

### Configuration

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

### TODOs
- harden controller communication (reconnects)
- support color picker
- add effects and presets

