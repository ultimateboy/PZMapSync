# PZMapSync Browser Extension

This is the browser-side proof of concept. It injects live Project Zomboid player and map marker data onto `https://b42map.com/` using the local JSON snapshot written by the PZMapSync mod. If the native host is unavailable, it falls back to `public/fixtures/mock-snapshot.json`.

## Load Unpacked

1. Open Chromium or Chrome.
2. Go to `chrome://extensions`.
3. Enable Developer Mode.
4. Choose **Load unpacked**.
5. Select this `extension/` directory.
6. Open `https://b42map.com/`.

## Live Snapshot Bridge

On Windows, register the native messaging host before loading the extension:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-native-host.ps1
```

The native host reads:

```text
C:\Users\<you>\Zomboid\Lua\PZMapSync_pzmapsync.json
```

The extension ID is pinned in `manifest.json` so the native host registration stays stable:

```text
eiocboniaogecljgkoembpgpabaogfoa
```

To sanity-check the host without a browser:

```powershell
C:\Users\matt\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe scripts\test-native-host.js
```

When the bridge is working, the overlay status on `b42map.com` should read something like `PZMapSync live: 1 player, 16 markers`.

The content script injects `src/content/page-bridge.js` into the page context because b42map's OpenSeadragon viewer and map metadata live in page-owned JavaScript globals. The bridge converts Project Zomboid world square coordinates into screen pixels using the same formulas as b42map's coordinate module.

## Current Fixture

The fixture uses Muldraugh-area coordinates so markers should appear near the default map view. The content script polls this fixture every 250ms in development, so changes to the JSON file are reflected without a page reload.

- player near `10640,9565,0`
- safehouse near `10620,9485,0`
- vehicle cache near `10885,10020,0`
- horde warning near `10490,9820,0`
- hardware loot note near `10750,9400,0`

To animate the mock player around these points:

```sh
node scripts/mock-snapshot-writer.js
```

Use `Ctrl+C` to stop it. For a single fixture rewrite:

```sh
node scripts/mock-snapshot-writer.js --once
```

## Next Steps

- Add native messaging so the extension can read the real file written by the Project Zomboid mod.
- Add popup controls for status and overlay toggles.
- Replace fixture polling with live snapshot updates.

## Verification

The repository includes two local verification helpers:

```sh
node scripts/verify-extension.js
node scripts/verify-overlay-in-page.js
```

`verify-extension.js` expects Chrome to be running with remote debugging on port `9223` and the unpacked extension loaded.

`verify-overlay-in-page.js` injects the same page bridge, CSS, and mock snapshot into the live `b42map.com` page through Chrome DevTools Protocol. This is useful when local Chrome policy blocks unpacked extension loading. In the current test environment, Chrome reported Developer Mode as managed and did not list the unpacked extension, so the page bridge was verified with this direct injection path.
