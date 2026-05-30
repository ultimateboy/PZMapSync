# PZMapSync Project Zomboid Mod

PZMapSync exports local Project Zomboid player position and map marker data to a JSON file for the PZMapSync browser map overlay.

## Install

Copy this folder from the repository:

```text
PZMapSync
```

to your Project Zomboid local mods directory.

The most common Windows install path is:

```text
Windows: C:\Users\<you>\Zomboid\mods\PZMapSync
```

From PowerShell in the repository root, install or update the mod with:

```powershell
$mods = Join-Path $env:USERPROFILE "Zomboid\mods"
New-Item -ItemType Directory -Force -Path $mods
Remove-Item -Recurse -Force (Join-Path $mods "PZMapSync") -ErrorAction SilentlyContinue
Copy-Item -Recurse "mod\PZMapSync" (Join-Path $mods "PZMapSync")
```

Other common locations:

```text
macOS: ~/Zomboid/mods/PZMapSync
Linux: ~/Zomboid/mods/PZMapSync
```

On macOS or Linux from the repository root:

```sh
mkdir -p "$HOME/Zomboid/mods"
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
- exported map markers and notes
- `markerProbe` data for troubleshooting marker export

## Current Limitations

- Only the local player is exported.
- The browser extension currently reads the JSON through the Windows native messaging host.
- The `markerProbe` block is diagnostic data and may change.

## Troubleshooting

If the mod does not appear in the Mods menu:

- Confirm the folder paths include both:

```text
Windows: C:\Users\<you>\Zomboid\mods\PZMapSync\mod.info
Windows: C:\Users\<you>\Zomboid\mods\PZMapSync\42.0\mod.info
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
