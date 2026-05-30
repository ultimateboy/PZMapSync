# PZMapSync

PZMapSync is a proof-of-concept bridge between a local Project Zomboid game and the Build 42 web map at [b42map.com](https://b42map.com/).

The goal is simple: export player/map data from Project Zomboid, then overlay that data on the browser map so you can see your live position and eventually your in-game map markers outside the game.

## Current Status

This repo currently contains two early components:

- **Browser extension prototype**: overlays mock player and marker data on `b42map.com`.
- **Project Zomboid mod prototype**: writes local player position to JSON and probes the game's map-marker API.

The browser overlay concept has been validated against the live b42map page. The next major piece is a native messaging bridge so the browser extension can read the real JSON file written by the mod.

## Repository Layout

```text
docs/          Project plan and implementation notes
extension/     Manifest V3 browser extension prototype
mod/PZMapSync/ Project Zomboid Lua mod
scripts/       Local development and verification helpers
```

## Try The Browser Overlay Mock

Load the extension unpacked in Chrome or Chromium:

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Choose **Load unpacked**.
4. Select the `extension/` directory from this repo.
5. Open [https://b42map.com/](https://b42map.com/).

To animate the mock player around the map:

```sh
node scripts/mock-snapshot-writer.js
```

The extension polls `extension/public/fixtures/mock-snapshot.json` during development, so the mock player should move without a page reload.

If Chrome policy blocks unpacked extensions, use the direct verification helper while Chrome is running with remote debugging on port `9223`:

```sh
node scripts/stream-mock-to-page.js
```

## Install The Project Zomboid Mod

Copy `mod/PZMapSync` into your Project Zomboid local mods directory.

Typical locations:

```text
Windows: C:\Users\<you>\Zomboid\mods\PZMapSync
macOS:   ~/Zomboid/mods/PZMapSync
Linux:   ~/Zomboid/mods/PZMapSync
```

On macOS from this repo:

```sh
mkdir -p "$HOME/Zomboid/mods"
cp -R mod/PZMapSync "$HOME/Zomboid/mods/PZMapSync"
```

Then enable **PZMapSync** in Project Zomboid's Mods menu and load a save. The mod writes `PZMapSync_pzmapsync.json` using Project Zomboid's Lua file writer.

See [mod/PZMapSync/README.md](mod/PZMapSync/README.md) for more detail.

## Development Checks

JavaScript syntax checks:

```sh
node --check extension/src/content/content-script.js
node --check extension/src/content/page-bridge.js
node --check extension/src/background/service-worker.js
```

Lua syntax check:

```sh
luac -p mod/PZMapSync/media/lua/shared/PZMapSync/PZMapSync_Config.lua mod/PZMapSync/media/lua/shared/PZMapSync/PZMapSync_Json.lua mod/PZMapSync/media/lua/client/PZMapSync/PZMapSync_Client.lua mod/PZMapSync/media/lua/client/PZMapSync/PZMapSync_MapMarkers.lua mod/PZMapSync/media/lua/client/PZMapSync/PZMapSync_Writer.lua
```

## Roadmap

- Confirm the exact on-disk location of `PZMapSync_pzmapsync.json` in-game.
- Build the native messaging host for browser-to-local-file access.
- Wire the extension to live mod output instead of mock fixture data.
- Convert the mod's marker probe into real marker export if vanilla marker coordinates are available from Lua.
- Add extension popup controls for status, toggles, and troubleshooting.

## Project Notes

The larger implementation plan is in [docs/project-plan.md](docs/project-plan.md).
