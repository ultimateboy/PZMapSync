# PZMapSync Project Plan

## Goal

PZMapSync will bridge a local Project Zomboid session to the external Build 42 web map at `https://b42map.com/`.

The system has two separately installable components:

1. **Project Zomboid mod**: runs inside the game, samples local player state, reads supported map annotations, and writes a small sync file to disk.
2. **Browser extension**: runs on `b42map.com`, reads the sync data through a local bridge, and draws live player/marker overlays on top of the map.

The first target is single-player/local-player sync. Multiplayer support can be added later if the mod can collect and export remote player positions cleanly.

## Research Notes

- Project Zomboid mods are Lua-based and commonly use a `mod.info` file plus a `media/lua/...` structure. Vanilla Lua is separated into `client`, `server`, and `shared` folders, which is the structure this project should mirror.
- PZ exposes client update hooks such as `Events.OnPlayerUpdate`, which fires every tick for the local player, and `Events.OnPlayerMove`, which fires while walking.
- PZ exposes file writers to Lua. `getFileWriter(filename, createIfNull, append)` writes relative to the Lua cache, while `getModFileWriter(modId, filename, createIfNull, append)` writes relative to the mod common folder. The docs warn against writing inside Lua or script directories because it changes checksums.
- The world map symbol API exposes `MapItem.getSingleton():getSymbols()`, `WorldMapSymbols.getSymbolCount()`, `getSymbolByIndex(index)`, `getModificationCount()`, and text/texture symbol types. Texture symbols expose `getSymbolID()`, and text symbols expose translated/untranslated text. The public docs do not clearly expose x/y/color/scale getters for symbols, so marker extraction needs an early proof-of-concept.
- Browser content scripts can modify page DOM/canvas overlays on matched pages. In Manifest V3, content-script `fetch()` runs in the page context, so it should not be assumed to have direct access to arbitrary local files.
- Native messaging is the clean extension path for reading local disk data because it allows an extension to communicate with a locally installed helper process. This adds install complexity but avoids trying to bypass browser file restrictions.
- `b42map.com` already supports coordinates and uses OpenSeadragon as its map engine. The extension should hook into the page's map viewer or derive transforms from its rendered viewport.

## Component 1: Project Zomboid Mod

### Responsibilities

- Capture local player position:
  - world `x`, `y`, `z`
  - optional direction, username/display name, timestamp
  - optional cell/chunk metadata if useful for debugging
- Capture player-created map markers where feasible:
  - marker id or stable hash
  - marker type: texture/text
  - symbol id or text
  - world `x`, `y`, `z` if obtainable
  - color/scale/visibility if obtainable
- Write a durable JSON snapshot to disk at a predictable path.
- Avoid game hitching by rate-limiting disk writes.
- Keep output local-only and user-controlled.

### Proposed Mod Layout

```text
mods/PZMapSync/
  mod.info
  poster.png
  media/
    lua/
      client/
        PZMapSync/
          PZMapSync_Client.lua
          PZMapSync_Writer.lua
          PZMapSync_MapMarkers.lua
      shared/
        PZMapSync/
          PZMapSync_Config.lua
          PZMapSync_Json.lua
```

### Runtime Flow

1. Register a client-side update handler.
2. On each update, check whether enough time has elapsed since the last write.
3. Read the local player via the player object passed to `OnPlayerUpdate`.
4. Build a sync snapshot table.
5. If the world-map symbol modification count changed, refresh marker data.
6. Serialize the snapshot as JSON.
7. Write atomically where possible:
   - write `pzmapsync.tmp.json`
   - write/replace `pzmapsync.json`
   - if atomic rename is unavailable in PZ Lua, write the full JSON to a single compact file and include a monotonically increasing `sequence` plus `writtenAt`.

### Output Path

Preferred first implementation:

```text
<Project Zomboid Lua cache or local mods common path>/PZMapSync/pzmapsync.json
```

During the proof-of-concept, confirm the exact on-disk location created by:

```lua
getFileWriter("PZMapSync/pzmapsync.json", true, false)
```

If the file lands somewhere awkward for native messaging, switch to `getModFileWriter(nil, "PZMapSync/pzmapsync.json", true, false)` or expose a user-configurable path if PZ allows it safely.

### Data Contract

Initial snapshot shape:

```json
{
  "schemaVersion": 1,
  "sequence": 42,
  "game": {
    "build": "42.x",
    "world": "SaveName"
  },
  "writtenAt": 1710000000000,
  "players": [
    {
      "id": "local-0",
      "name": "Player",
      "x": 10610.5,
      "y": 9562.2,
      "z": 0,
      "direction": "S"
    }
  ],
  "markers": [
    {
      "id": "texture:Base:10600:9560:0",
      "kind": "texture",
      "symbolId": "Base",
      "label": null,
      "x": 10600,
      "y": 9560,
      "z": 0,
      "color": "#ff3333",
      "visible": true
    }
  ]
}
```

### Marker Extraction Spike

Marker extraction is the main unknown. The implementation should first build a small in-game debug exporter that logs:

- whether `MapItem.getSingleton()` is available client-side
- `symbols:getSymbolCount()`
- `symbols:getModificationCount()`
- each symbol's `getType()`
- texture `getSymbolID()` or text `getUntranslatedText()`/`getTranslatedText()`
- whether raw position/color fields are visible from Lua despite missing public Java getters

If x/y fields are not accessible, fallback options are:

- capture only markers created through PZMapSync's own marker UI/actions
- monkey-patch or wrap vanilla map symbol creation methods if Lua exposes them
- defer marker sync and ship player-location overlay first

### Write Frequency

- Player position: default 2-4 writes per second.
- Markers: refresh only when symbol modification count changes.
- Full snapshot: write one combined file so the extension has a single read path.

## Component 2: Browser Extension

### Responsibilities

- Activate only on `https://b42map.com/*`.
- Read the latest PZMapSync snapshot.
- Draw player and marker overlays above the map.
- Keep overlay positions correct during pan/zoom/layer changes.
- Provide a small extension popup/options page for:
  - sync status
  - native host install status
  - overlay toggles
  - marker filtering
  - update interval

### Proposed Extension Layout

```text
extension/
  manifest.json
  src/
    content/
      content-script.ts
      overlay.ts
      b42map-adapter.ts
    background/
      service-worker.ts
      native-client.ts
    popup/
      popup.html
      popup.ts
      popup.css
    shared/
      schema.ts
      messages.ts
  public/
    icons/
```

### Data Access Strategy

Use native messaging for the real extension:

```text
PZ mod -> JSON file on disk -> native helper -> extension background -> content script -> map overlay
```

Reasons:

- Browser extensions cannot reliably poll arbitrary local files from a content script.
- Native messaging is designed for extension-to-local-app communication.
- The helper can handle file path differences across Windows/macOS/Linux and can validate the JSON before passing it to the extension.

For early development, also support a mock mode:

- content script loads bundled fixture JSON
- content script can accept pasted JSON from popup/dev panel
- this lets overlay work proceed before native-host packaging is done

### Native Helper

The helper should be a small Node.js or Python program that:

- receives `getSnapshot` messages over stdio
- reads the configured `pzmapsync.json`
- validates `schemaVersion`
- returns either `{ ok: true, snapshot }` or `{ ok: false, error }`
- never writes to game files

Packaging can come later. During development, install the native-host manifest manually.

### Overlay Strategy

Preferred approach:

1. Detect the OpenSeadragon viewer instance or map container used by `b42map.com`.
2. Convert PZ world coordinates to viewer viewport coordinates.
3. Render a positioned HTML/SVG overlay layer above the map.
4. Reposition overlays on viewer pan/zoom/animation events.

Fallback approach:

- If the page does not expose a usable viewer object, derive coordinate transforms from DOM state and known B42 map bounds.

The extension should keep the overlay independent from the site's own marker system to reduce coupling.

### Coordinate Handling

Assumption for phase 1: B42 map displayed coordinates match Project Zomboid world `x/y` tile coordinates.

Validation tasks:

- use b42map's "Lock Coordinates" feature to confirm known in-game coordinates
- compare a sampled in-game player position with the same coordinate on the web map
- document any offsets or axis inversions in `b42map-adapter.ts`

## Milestones

### Milestone 0: Repository Skeleton

- Create `mod/`, `extension/`, `native-host/`, and `docs/`.
- Add shared schema documentation and fixture snapshot.
- Add minimal lint/test tooling for the extension and helper.

### Milestone 1: PZ Mod Proof-of-Concept

- Build a loadable local PZ mod.
- Export player position to disk on a throttle.
- Confirm file path on Windows and macOS/Linux.
- Add debug logging for map-symbol API visibility.

Exit criteria:

- while in-game, `pzmapsync.json` updates with current player coordinates
- no visible game hitching
- marker extraction feasibility is known

### Milestone 2: Browser Overlay Mock

- Build MV3 extension loaded unpacked in Chromium.
- Inject on `https://b42map.com/*`.
- Render player and marker overlays from fixture JSON.
- Keep overlays aligned during map pan/zoom.

Exit criteria:

- fixture coordinates visibly align with b42map coordinates
- overlay can be toggled without page reload

### Milestone 3: Native Messaging Bridge

- Build native helper.
- Add browser background/native messaging integration.
- Add extension popup status.
- Poll or subscribe to snapshot updates.

Exit criteria:

- extension shows live player position from the PZ-created file
- stale/missing/invalid file states are visible in the popup

### Milestone 4: Marker Sync

- If symbol fields are accessible, export vanilla map markers.
- If not, implement the chosen fallback:
  - PZMapSync-owned marker capture, or
  - player-location-only initial release with marker sync deferred.

Exit criteria:

- markers from the chosen source appear on b42map with stable ids
- marker additions/removals update without restarting game or browser

### Milestone 5: Packaging and Release

- Document mod install path.
- Document unpacked extension install.
- Document native host install for Windows/macOS/Linux.
- Add troubleshooting for file path, browser permissions, and stale data.

## Risks and Open Questions

- **Marker coordinates may not be public from Lua.** This is the highest-risk item and should be tested before committing to full marker sync.
- **B42 map internals may change.** Keep all site-specific code isolated in `b42map-adapter.ts`.
- **Native messaging adds installation friction.** A helper is still the cleanest reliable path for disk access.
- **File writes every tick would be wasteful.** The mod must throttle writes and avoid appending unbounded logs.
- **Multiplayer may need separate handling.** Local player sync is straightforward; remote players may require server-side APIs or permissions.

## Source Links

- Project Zomboid Lua events: https://demiurgequantified.github.io/ProjectZomboidLuaDocs/md_Events.html
- Project Zomboid Lua file writer API: https://demiurgequantified.github.io/ProjectZomboidJavaDocs/zombie/Lua/LuaManager.GlobalObject.html
- Project Zomboid map item/symbol APIs:
  - https://projectzomboid.com/modding/zombie/inventory/types/MapItem.html
  - https://demiurgequantified.github.io/ProjectZomboidJavaDocs/zombie/worldMap/symbols/WorldMapSymbols.html
  - https://projectzomboid.com/modding/zombie/worldMap/symbols/WorldMapBaseSymbol.html
  - https://projectzomboid.com/modding/zombie/worldMap/symbols/WorldMapTextSymbol.html
  - https://projectzomboid.com/modding/zombie/worldMap/symbols/WorldMapTextureSymbol.html
- B42 map: https://b42map.com/
- WebExtensions content scripts: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts
- WebExtensions native messaging: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging
- Chrome extension manifest reference: https://developer.chrome.com/docs/extensions/reference/manifest
