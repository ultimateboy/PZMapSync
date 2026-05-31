# PZMapSync Browser Extension

The extension overlays live Project Zomboid player and map marker data on `https://b42map.com/`.

## Install

1. Register the native host from the repository root:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\install-native-host.ps1
   ```

2. Open `edge://extensions` or `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select this `extension` folder.
6. Open `https://b42map.com/`.

When connected, the status badge should read `PZMapSync live: ...`.

## Use

- Use the **PZMapSync** controls in the b42map sidebar to show or hide players and map markings.
- Search the player list, then use **Jump** to pan to a player or **Follow** to keep the map centered on them. Double-clicking a player also jumps to them.
- Right-click a player pin to follow or stop following that player.
- Texture markers display as compact icon pins; text markers keep their note text.

Developer notes and mock-data workflows are in [../docs/development.md](../docs/development.md).
