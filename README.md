# PZMapSync

PZMapSync overlays your live Project Zomboid Build 42 position and map markers on [b42map.com](https://b42map.com/).

PZMapSync is an unofficial community project. It works with b42map.com and Project Zomboid data, but it is not affiliated with, endorsed by, or directly associated with b42map.com, The Indie Stone, or Project Zomboid.

![PZMapSync overlay showing live Project Zomboid markers on b42map](docs/assets/pzmapsync-overlay.jpg)

It has three pieces:

- a Project Zomboid mod that writes `PZMapSync_pzmapsync.json`
- a small native messaging host that lets the browser extension read that file
- a Chromium/Edge extension that draws player and marker overlays on b42map

## Install

### 1. Install the Project Zomboid mod

Copy:

```text
mod\PZMapSync
```

to your Zomboid local mods folder:

```text
C:\Users\<you>\Zomboid\mods\PZMapSync
```

Then start Project Zomboid, enable **PZMapSync** in the Mods menu, and add it to your save if you are loading an existing world. Once loaded in-game, the mod writes:

```text
C:\Users\<you>\Zomboid\Lua\PZMapSync_pzmapsync.json
```

### 2. Register the browser native host

On Windows, from the repository root, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-native-host.ps1
```

This registers `com.pzmapsync.host` for Chrome and Edge so the extension can read the Zomboid JSON file.

On macOS or Linux, native host registration is a browser manifest file. From the repository root, set the host executable path and install the manifest for your browser:

```sh
HOST_NAME="com.pzmapsync.host"
EXTENSION_ID="eiocboniaogecljgkoembpgpabaogfoa"
REPO_ROOT="$(pwd)"
HOST_EXEC="$REPO_ROOT/native-host/pzmapsync-native-host"
HOST_MANIFEST="$REPO_ROOT/native-host/$HOST_NAME.json"

mkdir -p "$REPO_ROOT/native-host"
cat > "$HOST_MANIFEST" <<EOF
{
  "name": "$HOST_NAME",
  "description": "PZMapSync native messaging host",
  "path": "$HOST_EXEC",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF
```

Then copy that manifest to the browser-specific native messaging directory.

macOS Chrome:

```sh
mkdir -p "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
cp "$HOST_MANIFEST" "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/$HOST_NAME.json"
```

macOS Edge:

```sh
mkdir -p "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
cp "$HOST_MANIFEST" "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts/$HOST_NAME.json"
```

Linux Chrome:

```sh
mkdir -p "$HOME/.config/google-chrome/NativeMessagingHosts"
cp "$HOST_MANIFEST" "$HOME/.config/google-chrome/NativeMessagingHosts/$HOST_NAME.json"
```

Linux Chromium:

```sh
mkdir -p "$HOME/.config/chromium/NativeMessagingHosts"
cp "$HOST_MANIFEST" "$HOME/.config/chromium/NativeMessagingHosts/$HOST_NAME.json"
```

Linux Edge:

```sh
mkdir -p "$HOME/.config/microsoft-edge/NativeMessagingHosts"
cp "$HOST_MANIFEST" "$HOME/.config/microsoft-edge/NativeMessagingHosts/$HOST_NAME.json"
```

`HOST_EXEC` must point to an executable native host wrapper on your machine. If your wrapper has a different filename, update `HOST_EXEC` before writing the manifest.

### 3. Load the extension

In Edge or Chrome:

1. Open `edge://extensions` or `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the `extension` folder from this repository.
5. Open [https://b42map.com/](https://b42map.com/).

If everything is connected, the overlay status should say something like:

```text
PZMapSync live: 2 players, 16 markers
```

## Use

- Player and marker pins update from your live Zomboid snapshot.
- In multiplayer, server admins can opt in to broadcasting all online player positions with **PZMapSync > Broadcast all online players**. This allows the browser overlay to show far-away online players, similar to all-player map mods.
- The all-player broadcast is off by default and its frequency is controlled with **PZMapSync > All-player sync interval**.
- Right-click the player pin and choose **Follow** to keep the map centered on that player.
- Right-click again and choose **Stop following** to disable follow mode.

## Troubleshooting

If the overlay is not live:

- Confirm `C:\Users\<you>\Zomboid\Lua\PZMapSync_pzmapsync.json` exists and is updating.
- Re-run `scripts\install-native-host.ps1`.
- Reload the unpacked extension from the browser extensions page.
- Reload `https://b42map.com/`.

To test the native host directly:

```powershell
C:\Users\<you>\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe scripts\test-native-host.js
```

Developer notes, mock overlay workflows, and verification helpers live in [docs/development.md](docs/development.md).

## License

PZMapSync is released under the [MIT License](LICENSE).
