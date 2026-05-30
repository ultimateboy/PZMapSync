# Project Zomboid Mod

The first mod implementation lives in `mod/PZMapSync`.

## What It Does

- Registers a client-side `Events.OnPlayerUpdate` handler.
- Writes a throttled JSON snapshot to `PZMapSync_pzmapsync.json`.
- Exports local player position as `x`, `y`, `z`, name, direction, timestamp, and sequence.
- Includes a `markerProbe` section that inspects the vanilla map-symbol API when available.

The output filename is intentionally simple for the first proof-of-concept. It avoids relying on nested directory creation from Project Zomboid's Lua file writer. Once the exact disk location is confirmed in-game, the browser/native bridge can be pointed at that file.

## Install For Local Testing

Copy:

```text
mod/PZMapSync
```

into the Project Zomboid local mods directory.

The primary target is Windows:

```text
Windows: C:\Users\<you>\Zomboid\mods\PZMapSync
```

From PowerShell in the repository root:

```powershell
$mods = Join-Path $env:USERPROFILE "Zomboid\mods"
New-Item -ItemType Directory -Force -Path $mods
Remove-Item -Recurse -Force (Join-Path $mods "PZMapSync") -ErrorAction SilentlyContinue
Copy-Item -Recurse "mod\PZMapSync" (Join-Path $mods "PZMapSync")
```

macOS and Linux use the same folder layout under the home directory:

```text
macOS/Linux: ~/Zomboid/mods/PZMapSync
```

From a shell:

```sh
mkdir -p "$HOME/Zomboid/mods"
rm -rf "$HOME/Zomboid/mods/PZMapSync"
cp -R mod/PZMapSync "$HOME/Zomboid/mods/PZMapSync"
```

Then enable `PZMapSync` in the game's Mods menu and start a save.

## Expected Output

The mod logs a line like:

```text
[PZMapSync] Writing snapshots to PZMapSync_pzmapsync.json
```

The JSON file should update several times per second while a player exists. Its exact location is determined by Project Zomboid's `getFileWriter` behavior for the active platform/profile.

## Marker Probe

The first implementation does not assume vanilla marker coordinates are available. It writes a `markerProbe` block containing:

- whether `MapItem.getSingleton()` is available
- symbol count
- modification count
- up to 25 inspected symbols
- fields exposed by Lua such as type, symbol id, text, and any x/y/z getters if present

If the probe shows usable coordinates, the next step is converting that probe into real `markers` entries matching the browser extension schema.
