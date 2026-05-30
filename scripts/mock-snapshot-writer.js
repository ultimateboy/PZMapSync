const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_TARGET = path.join(ROOT, "extension/public/fixtures/mock-snapshot.json");

const args = new Set(process.argv.slice(2));
const once = args.has("--once");
const intervalMs = readNumberArg("--interval", 250);
const target = readStringArg("--target", DEFAULT_TARGET);

const route = [
  { x: 10640, y: 9565, direction: "SE" },
  { x: 10765, y: 9630, direction: "SE" },
  { x: 10885, y: 10020, direction: "S" },
  { x: 10710, y: 10110, direction: "W" },
  { x: 10490, y: 9820, direction: "NW" },
  { x: 10620, y: 9485, direction: "NE" }
];

const markers = [
  {
    id: "safehouse-muldraugh",
    kind: "texture",
    symbolId: "house",
    label: "Safehouse",
    x: 10620,
    y: 9485,
    z: 0,
    color: "#33d17a",
    visible: true
  },
  {
    id: "vehicle-cache",
    kind: "texture",
    symbolId: "car",
    label: "Vehicle Cache",
    x: 10885,
    y: 10020,
    z: 0,
    color: "#62a0ea",
    visible: true
  },
  {
    id: "danger-zone",
    kind: "texture",
    symbolId: "warning",
    label: "Heavy Horde",
    x: 10490,
    y: 9820,
    z: 0,
    color: "#ff5c5c",
    visible: true
  },
  {
    id: "loot-note",
    kind: "text",
    symbolId: null,
    label: "Hardware loot",
    x: 10750,
    y: 9400,
    z: 0,
    color: "#f6d32d",
    visible: true
  }
];

let sequence = 1;
let step = 0;

function readStringArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readNumberArg(name, fallback) {
  const raw = readStringArg(name, "");
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function interpolate(a, b, t) {
  return {
    x: Number((a.x + (b.x - a.x) * t).toFixed(2)),
    y: Number((a.y + (b.y - a.y) * t).toFixed(2)),
    direction: t < 0.5 ? a.direction : b.direction
  };
}

function buildSnapshot() {
  const segmentTicks = Math.max(1, Math.round(2000 / intervalMs));
  const segmentIndex = Math.floor(step / segmentTicks) % route.length;
  const nextIndex = (segmentIndex + 1) % route.length;
  const t = (step % segmentTicks) / segmentTicks;
  const player = interpolate(route[segmentIndex], route[nextIndex], t);

  return {
    schemaVersion: 1,
    sequence: sequence++,
    game: {
      build: "42.mock",
      world: "Mock Debug World"
    },
    writtenAt: Date.now(),
    players: [
      {
        id: "local-0",
        name: "Mock Player",
        x: player.x,
        y: player.y,
        z: 0,
        direction: player.direction
      }
    ],
    markers
  };
}

function writeSnapshot() {
  const snapshot = buildSnapshot();
  const tmpPath = `${target}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(tmpPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  fs.renameSync(tmpPath, target);
  step += 1;
  return snapshot;
}

function main() {
  const first = writeSnapshot();
  console.log(`Wrote ${target}`);
  console.log(`Sequence ${first.sequence}: Mock Player at ${first.players[0].x}, ${first.players[0].y}`);

  if (once) {
    return;
  }

  console.log(`Updating every ${intervalMs}ms. Press Ctrl+C to stop.`);
  setInterval(() => {
    const snapshot = writeSnapshot();
    const player = snapshot.players[0];
    process.stdout.write(`\rSequence ${snapshot.sequence}: ${player.x}, ${player.y} ${player.direction}   `);
  }, intervalMs);
}

main();
