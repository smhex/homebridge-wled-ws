## 0.0.27 (Unreleased)

### Bugfixes
- **Initial state**: Applies brightness and colors after the controller's light capabilities are known (#471).
- **Cached switches**: Removes disabled live-mode switches and all preset switches when no presets are configured, including while the controller is offline (#474, #475).
- **Presets**: Rebuilds the preset list without duplicates and synchronizes switches after startup, reconnects, and power changes with an unchanged preset ID (#473). Rejects stale callbacks and reports failed writes as HomeKit communication errors.
- **Playlists**: Resets momentary switches after HomeKit completes each write, including repeated triggers of the same playlist.
- **Color temperature**: Keeps HomeKit values in Mired and synchronizes the first controller value even when it equals the internal default. Suppresses unchanged updates and respects the logging setting (#472).

### Improvements
- **Homebridge 2**: Builds against Homebridge 2.1.1 with the required ES2022 and Web API type definitions. Keeps the emitted JavaScript target at ES2018.
- **Compatibility checks**: Builds and tests against the latest Homebridge 1.x on Node.js 20/22/24 and Homebridge 2.x on Node.js 22/24 without running automatic dependency repairs during CI.
- **GitHub Actions**: Updates checkout and setup-node to v7 with the Node.js 24 action runtime, and caches npm downloads in the build workflow.
- **Dependencies**: Updates ESLint and typescript-eslint, groups weekly minor/patch updates and security updates separately, and defers TypeScript 7 until the test and lint tools support it.

## 0.0.26 (2026-10-15)

### Bugfixes
- **Connection recovery**: Ignores events from replaced WLED clients to prevent stale updates after reconnecting (#467).
- **WebSocket reconnect**: Retries connections when HTTP succeeds but the WebSocket connection fails (#468).
- **Heartbeat timeout**: Detects missing heartbeat responses after 10 seconds and reconnects automatically (#469).
- **Preset switches**: Prevents crashes when used while disconnected and rejects changes until cached presets have been loaded (#470).

### Improvements
- **Security**: Fixes vulnerabilities in dependencies.
- **Development**: Uses TypeScript and Node.js watch modes for automatic builds and restarts.
- **Tests**: Adds regression tests for connection recovery and preset switches, fixes the TypeScript 6 test setup, and runs tests in the build workflow.

## 0.0.25 (2026-09-15)

### Improvements
- **Connection recovery**: Adds a WebSocket heartbeat and uses a single reconnect strategy to improve recovery from idle-period connection loss.

## 0.0.24 (2026-09-14)

### Improvements
- **Security**: Updated vulnerable transitive dependencies

## 0.0.23 (2026-05-09)

### Features
- **CCT Support**: Adds CCT support for white or RGB lights

### Improvements
- **Security**: Updated dependencies and fixed vulnerabilities

### Bugfixes
- **Brightness**: Brightness is now correctly set

### Known issues
