(function initPZMapSyncPageBridge() {
  const ROOT_ID = "pzmapsync-overlay-root";
  const STATUS_ID = "pzmapsync-status";
  const MENU_ID = "pzmapsync-context-menu";
  const SNAPSHOT_EVENT = "PZMapSync:snapshot";
  const STATUS_EVENT = "PZMapSync:status";
  const READY_EVENT = "PZMapSync:ready";
  const FOLLOW_STORAGE_KEY = "PZMapSync:follow";
  const FOLLOW_PLAYER_STORAGE_KEY = "PZMapSync:followPlayerId";

  let snapshot = null;
  let sourceStatus = {
    mode: "initializing",
    ok: false
  };
  let root = null;
  let status = null;
  let contextMenu = null;
  let rafId = 0;
  let lastError = "";
  let followEnabled = window.localStorage.getItem(FOLLOW_STORAGE_KEY) === "true";
  let followedPlayerId = window.localStorage.getItem(FOLLOW_PLAYER_STORAGE_KEY) || "local-0";
  let lastFollowAt = 0;

  function getPageState() {
    const pageGlobals = window.g;
    if (!pageGlobals || !pageGlobals.viewer || !pageGlobals.base_map) {
      return null;
    }

    const tiledImage = pageGlobals.viewer.world && pageGlobals.viewer.world.getItemAt
      ? pageGlobals.viewer.world.getItemAt(0)
      : null;
    if (!tiledImage) {
      return null;
    }

    return {
      g: pageGlobals,
      viewer: pageGlobals.viewer,
      baseMap: pageGlobals.base_map,
      currentLayer: pageGlobals.currentLayer || 0,
      tiledImage
    };
  }

  function ensureRoot() {
    const mapContainer = document.querySelector(".map-container") || document.getElementById("map_div");
    if (!mapContainer) {
      return null;
    }

    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.setAttribute("aria-label", "PZMapSync overlay");
      mapContainer.appendChild(root);
    }

    if (!status) {
      status = document.createElement("div");
      status.id = STATUS_ID;
      status.textContent = "PZMapSync initializing";
      root.appendChild(status);
    }

    if (!contextMenu) {
      contextMenu = document.createElement("div");
      contextMenu.id = MENU_ID;
      contextMenu.hidden = true;
      contextMenu.setAttribute("role", "menu");
      root.appendChild(contextMenu);
    }

    return root;
  }

  function fromTopSquare(step, sx, sy) {
    return [sx * step, sy * step];
  }

  function fromIsoSquare(step, sx, sy, layer) {
    return [
      (sx - sy) * step / 2,
      (sx + sy) * step / 4 - 1.5 * layer * step
    ];
  }

  function squareToViewportPoint(point, state) {
    const map = state.baseMap;
    const layer = Number.isFinite(point.z) ? point.z : state.currentLayer;
    const squareToMap = map.type === "top" ? fromTopSquare : fromIsoSquare;
    const coords = squareToMap(map.sqr, point.x, point.y, layer);
    const imageX = (map.x0 + coords[0]) / map.scale;
    const imageY = (map.y0 + coords[1]) / map.scale;
    return state.tiledImage.imageToViewportCoordinates(imageX, imageY);
  }

  function squareToScreen(point, state) {
    const viewportPoint = squareToViewportPoint(point, state);

    return state.viewer.viewport.pixelFromPoint(viewportPoint, true);
  }

  function syncPlayerOptions(players) {
    const nextIds = new Set(players.map((player) => player.id || "local-0"));

    if (!nextIds.has(followedPlayerId) && players[0]) {
      followedPlayerId = players[0].id || "local-0";
      window.localStorage.setItem(FOLLOW_PLAYER_STORAGE_KEY, followedPlayerId);
    }
  }

  function maybeFollowPlayer(players, state) {
    if (!followEnabled || !players.length) {
      return;
    }

    const now = Date.now();
    if (now - lastFollowAt < 200) {
      return;
    }

    const player = players.find((item) => (item.id || "local-0") === followedPlayerId) || players[0];
    try {
      const viewportPoint = squareToViewportPoint(player, state);
      state.viewer.viewport.panTo(viewportPoint, false);
      lastFollowAt = now;
    } catch (error) {
      lastError = error.message || String(error);
    }
  }

  function hideContextMenu() {
    if (contextMenu) {
      contextMenu.hidden = true;
      contextMenu.replaceChildren();
    }
  }

  function setFollow(player) {
    followedPlayerId = player.id || "local-0";
    followEnabled = true;
    window.localStorage.setItem(FOLLOW_PLAYER_STORAGE_KEY, followedPlayerId);
    window.localStorage.setItem(FOLLOW_STORAGE_KEY, "true");
    hideContextMenu();
    requestRender();
  }

  function clearFollow() {
    followEnabled = false;
    window.localStorage.setItem(FOLLOW_STORAGE_KEY, "false");
    hideContextMenu();
    requestRender();
  }

  function showPlayerContextMenu(event, player) {
    ensureRoot();
    if (!contextMenu) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const playerId = player.id || "local-0";
    const isFollowingThisPlayer = followEnabled && followedPlayerId === playerId;
    const action = document.createElement("button");
    action.type = "button";
    action.textContent = isFollowingThisPlayer ? "Stop following" : `Follow ${player.name || "player"}`;
    action.addEventListener("click", () => {
      if (isFollowingThisPlayer) {
        clearFollow();
      } else {
        setFollow(player);
      }
    });

    const rect = event.currentTarget.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const menuX = rect.left - rootRect.left + 18;
    const menuY = rect.top - rootRect.top + Math.max(0, rect.height / 2 - 14);

    contextMenu.replaceChildren(action);
    contextMenu.hidden = false;
    contextMenu.style.left = `${menuX}px`;
    contextMenu.style.top = `${menuY}px`;
  }

  function markerGlyph(marker) {
    const id = String(marker.symbolId || "").toLowerCase();

    if (id.includes("crossover") || id.includes("car") || id.includes("vehicle")) return "🚗";
    if (id.includes("truck")) return "🚚";
    if (id.includes("van")) return "🚐";
    if (id.includes("bus")) return "🚌";
    if (id.includes("gas")) return "⛽";
    if (id.includes("safehouse") || id.includes("house")) return "⌂";
    if (id.includes("chicken")) return "🐔";
    if (id.includes("sheep")) return "🐑";
    if (id.includes("cow")) return "🐄";
    if (id.includes("pig")) return "🐖";
    if (id.includes("horse")) return "🐎";
    if (id.includes("warning") || id.includes("danger")) return "!";
    if (marker.kind === "text" || marker.type === "text") return "T";
    if (id === "x") return "X";
    return "M";
  }

  function markerLabel(marker) {
    if (marker.type === "text" || marker.kind === "text") {
      return marker.text || marker.label || "";
    }

    return "";
  }

  function makeNode(item, type) {
    const node = document.createElement("div");
    node.className = `pzmapsync-pin pzmapsync-${type}`;
    node.dataset.pzmapsyncId = item.id || `${type}:${item.x}:${item.y}:${item.z || 0}`;

    const dot = document.createElement("div");
    dot.className = "pzmapsync-pin-dot";
    dot.textContent = type === "player" ? "P" : markerGlyph(item);
    dot.style.setProperty("--pzmapsync-color", item.color || (type === "player" ? "#ff7b3d" : "#62a0ea"));

    const label = document.createElement("div");
    label.className = "pzmapsync-pin-label";
    label.textContent = type === "player" ? item.name || "Player" : markerLabel(item);
    label.hidden = !label.textContent;

    node.append(dot, label);
    return node;
  }

  function updateNode(node, item, type) {
    node.oncontextmenu = null;
    node.dataset.following = "false";

    const dot = node.querySelector(".pzmapsync-pin-dot");
    const label = node.querySelector(".pzmapsync-pin-label");

    if (dot && type === "marker") {
      dot.textContent = markerGlyph(item);
      dot.style.setProperty("--pzmapsync-color", item.color || "#62a0ea");
    }

    if (label) {
      label.textContent = type === "player" ? item.name || "Player" : markerLabel(item);
      label.hidden = !label.textContent;
    }

    if (type === "player") {
      node.oncontextmenu = (event) => showPlayerContextMenu(event, item);
      if (followEnabled && (item.id || "local-0") === followedPlayerId) {
        node.dataset.following = "true";
      }
    }
  }

  function renderSnapshot(nextSnapshot) {
    snapshot = nextSnapshot;
    ensureRoot();
    requestRender();
  }

  function updateStatus(message, error) {
    if (!ensureRoot() || !status) {
      return;
    }
    status.textContent = message;
    status.dataset.error = error ? "true" : "false";
  }

  function render() {
    rafId = 0;

    if (!snapshot) {
      updateStatus("PZMapSync waiting for mock data", false);
      return;
    }

    const overlayRoot = ensureRoot();
    if (!overlayRoot) {
      lastError = "Map container not found";
      return;
    }

    const state = getPageState();
    if (!state) {
      updateStatus("PZMapSync waiting for map API", false);
      requestRender();
      return;
    }

    const players = snapshot.players || [];
    syncPlayerOptions(players);
    maybeFollowPlayer(players, state);

    const items = [
      ...players.map((item) => ({ item, type: "player" })),
      ...(snapshot.markers || []).filter((item) => item.visible !== false).map((item) => ({ item, type: "marker" }))
    ];

    const expectedIds = new Set();
    for (const entry of items) {
      const id = entry.item.id || `${entry.type}:${entry.item.x}:${entry.item.y}:${entry.item.z || 0}`;
      expectedIds.add(id);

      let node = overlayRoot.querySelector(`[data-pzmapsync-id="${CSS.escape(id)}"]`);
      if (!node) {
        node = makeNode(entry.item, entry.type);
        overlayRoot.appendChild(node);
      }
      updateNode(node, entry.item, entry.type);

      try {
        const screen = squareToScreen(entry.item, state);
        node.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
        node.hidden = false;
      } catch (error) {
        node.hidden = true;
        lastError = error.message || String(error);
      }
    }

    for (const node of Array.from(overlayRoot.querySelectorAll(".pzmapsync-pin"))) {
      if (!expectedIds.has(node.dataset.pzmapsyncId)) {
        node.remove();
      }
    }

    const count = `${snapshot.players?.length || 0} player, ${snapshot.markers?.length || 0} markers`;
    const mode = sourceStatus.mode === "live" ? "live" : "mock";
    updateStatus(`PZMapSync ${mode}: ${count}`, Boolean(lastError) || sourceStatus.ok === false);
    requestRender();
  }

  function requestRender() {
    if (rafId) {
      return;
    }
    rafId = window.requestAnimationFrame(render);
  }

  window.addEventListener(SNAPSHOT_EVENT, (event) => {
    renderSnapshot(event.detail);
  });

  window.addEventListener(STATUS_EVENT, (event) => {
    sourceStatus = event.detail || sourceStatus;
    if (!snapshot && sourceStatus.error) {
      updateStatus(`PZMapSync: ${sourceStatus.error}`, true);
    }
  });

  window.addEventListener("click", hideContextMenu, true);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideContextMenu();
    }
  }, true);

  const waitForMap = window.setInterval(() => {
    ensureRoot();
    if (getPageState()) {
      window.clearInterval(waitForMap);
      window.dispatchEvent(new CustomEvent(READY_EVENT));
      requestRender();
    }
  }, 250);

  window.dispatchEvent(new CustomEvent(READY_EVENT));
})();
