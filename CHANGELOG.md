## 0.0.4-beta.4 (2024-01-17)

### Features

- Added support for Lightbulb service (On/Off and Brightness)
- Added UI based plugin configuration

### Improvements

- **General**: State changes from other sources than Homekit are sync'ed (e.g. WLED app, Website)


### Known issues

- **Communication**: WLED controller communication does not survive restart of WLED
- **Communication**: WLED controller communication does not start if controller is unreachable
- **Features**: Color is not adjustable
- **Other**: too many log outputs