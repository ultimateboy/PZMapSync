# Development

This document collects mock-data workflows, verification helpers, and lower-level notes that are not needed for normal installation.

## Repository Layout

```text
docs/          Project plan and implementation notes
extension/     Manifest V3 browser extension
mod/PZMapSync/ Project Zomboid Lua mod
native-host/   Native messaging host for live JSON reads
scripts/       Local development and verification helpers
```

## Browser Overlay Mock

The extension falls back to `extension/public/fixtures/mock-snapshot.json` when the native host is unavailable.

To animate the mock player around the map:

```sh
node scripts/mock-snapshot-writer.js
```

Use `Ctrl+C` to stop it. For a single fixture rewrite:

```sh
node scripts/mock-snapshot-writer.js --once
```

The fixture uses Muldraugh-area coordinates:

- player near `10640,9565,0`
- safehouse near `10620,9485,0`
- vehicle cache near `10885,10020,0`
- horde warning near `10490,9820,0`
- hardware loot note near `10750,9400,0`

## Verification Helpers

JavaScript syntax checks:

```sh
node --check extension/src/content/content-script.js
node --check extension/src/content/page-bridge.js
node --check extension/src/background/service-worker.js
node --check native-host/pzmapsync-native-host.js
```

Native host protocol check:

```sh
node scripts/test-native-host.js
```

Browser extension check:

```sh
node scripts/verify-extension.js
```

`verify-extension.js` expects a Chromium browser to be running with remote debugging on port `9223` and the unpacked extension loaded.

Direct page-injection check:

```sh
node scripts/verify-overlay-in-page.js
```

This injects the page bridge, CSS, and mock snapshot into `b42map.com` through Chrome DevTools Protocol. It is useful when unpacked extensions are blocked by browser policy.

To stream any snapshot file into an already-open b42map tab:

```sh
node scripts/stream-mock-to-page.js
```

Set `PZMAPSYNC_SNAPSHOT` to stream a different JSON file.

## Lua Syntax Check

If `luac` is available:

```sh
luac -p mod/PZMapSync/media/lua/shared/PZMapSync/PZMapSync_Config.lua mod/PZMapSync/media/lua/shared/PZMapSync/PZMapSync_Json.lua mod/PZMapSync/media/lua/client/PZMapSync/PZMapSync_Client.lua mod/PZMapSync/media/lua/client/PZMapSync/PZMapSync_MapMarkers.lua mod/PZMapSync/media/lua/client/PZMapSync/PZMapSync_Writer.lua
```

## Browser Internals

The content script injects `src/content/page-bridge.js` into the page context because b42map's OpenSeadragon viewer and map metadata live in page-owned JavaScript globals. The bridge converts Project Zomboid world square coordinates into screen pixels using b42map's coordinate metadata.

The extension ID is pinned in `manifest.json` so native messaging registration stays stable:

```text
eiocboniaogecljgkoembpgpabaogfoa
```
