"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const host = spawn(path.join(root, "native-host", "pzmapsync-native-host.cmd"), {
  shell: true,
  stdio: ["pipe", "pipe", "inherit"]
});

let output = Buffer.alloc(0);

function send(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  host.stdin.write(Buffer.concat([header, body]));
}

host.stdout.on("data", (chunk) => {
  output = Buffer.concat([output, chunk]);
  if (output.length < 4) {
    return;
  }

  const length = output.readUInt32LE(0);
  if (output.length < length + 4) {
    return;
  }

  const message = JSON.parse(output.subarray(4, length + 4).toString("utf8"));
  console.log(JSON.stringify({
    ok: message.ok,
    sequence: message.snapshot && message.snapshot.sequence,
    players: message.snapshot && message.snapshot.players && message.snapshot.players.length,
    markers: message.snapshot && message.snapshot.markers && message.snapshot.markers.length,
    path: message.snapshot && message.snapshot.__sourcePath,
    error: message.error
  }, null, 2));
  host.kill();
});

send({ type: "getSnapshot" });
