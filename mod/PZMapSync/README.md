# PZMapSync Project Zomboid Mod

PZMapSync exports local Project Zomboid player position data to a JSON file for the PZMapSync browser map overlay.

This is an early proof-of-concept mod. It currently exports the local player's position and writes a marker API probe so we can confirm what vanilla map-marker data Project Zomboid exposes to Lua.

## Install

Copy this folder:

```text
PZMapSync
```

to your Project Zomboid local mods directory.

Typical locations:

```text
Windows: C:\Users\<you>\Zomboid\mods\PZMapSync
macOS:   ~/Zomboid/mods/PZMapSync
Linux:   ~/Zomboid/mods/PZMapSync
```

From this repository on macOS, you can install with:

```sh
mkdir -p "$HOME/Zomboid/mods"
cp -R mod/PZMapSync "$HOME/Zomboid/mods/PZMapSync"
```

If you already installed an older copy, remove it first or overwrite it:

```sh
rm -rf "$HOME/Zomboid/mods/PZMapSync"
cp -R mod/PZMapSync "$HOME/Zomboid/mods/PZMapSync"
```

## Enable In Game

1. Start Project Zomboid.
2. Open **Mods** from the main menu.
3. Enable **PZMapSync**.
4. Start or load a save.

When the mod starts writing snapshots, the game console should show:

```text
[PZMapSync] Writing snapshots to PZMapSync_pzmapsync.json
```

## Output File

The mod writes:

```text
PZMapSync_pzmapsync.json
```

using Project Zomboid's Lua `getFileWriter` API. The exact on-disk location depends on Project Zomboid's active Lua cache/profile behavior for your platform.

The snapshot contains:

- `schemaVersion`
- `sequence`
- `writtenAt`
- game metadata
- local player `x`, `y`, `z`, name, and direction
- empty `markers` array for now
- `markerProbe` data for investigating vanilla map symbols

## Current Limitations

- Only the local player is exported.
- Vanilla map markers are not exported yet.
- The `markerProbe` block is diagnostic data; it exists to determine whether marker positions are available from Lua.
- The browser extension does not yet read this file directly. The next project step is the native messaging bridge.

## Troubleshooting

If the mod does not appear in the Mods menu:

- Confirm the folder paths include both:

```text
Zomboid/mods/PZMapSync/mod.info
Zomboid/mods/PZMapSync/42.0/mod.info
```

Build 42 can use version-specific mod folders, so this mod ships a `42.0/` copy of the Lua files as well as the root metadata.
- Confirm `mod.info` contains `id=PZMapSync`.
- Restart Project Zomboid after copying the mod.

If the JSON file does not appear:

- Confirm the mod is enabled before loading the save.
- Check the Project Zomboid console for `[PZMapSync]` messages.
- Move your character briefly after loading into the world.
- Search your Zomboid user folder for `PZMapSync_pzmapsync.json`.

If Project Zomboid reports a Lua error:

- Copy the error text from the console.
- Run a local syntax check from the repository:

```sh
luac -p mod/PZMapSync/media/lua/shared/PZMapSync/PZMapSync_Config.lua mod/PZMapSync/media/lua/shared/PZMapSync/PZMapSync_Json.lua mod/PZMapSync/media/lua/client/PZMapSync/PZMapSync_Client.lua mod/PZMapSync/media/lua/client/PZMapSync/PZMapSync_MapMarkers.lua mod/PZMapSync/media/lua/client/PZMapSync/PZMapSync_Writer.lua
```
