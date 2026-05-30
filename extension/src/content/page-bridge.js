(function initPZMapSyncPageBridge() {
  const ROOT_ID = "pzmapsync-overlay-root";
  const STATUS_ID = "pzmapsync-status";
  const SNAPSHOT_EVENT = "PZMapSync:snapshot";
  const READY_EVENT = "PZMapSync:ready";

  let snapshot = null;
  let root = null;
  let status = null;
  let rafId = 0;
  let lastError = "";

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
      status.textContent = "PZMapSync mock";
      root.appendChild(status);
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

  function squareToScreen(point, state) {
    const map = state.baseMap;
    const layer = Number.isFinite(point.z) ? point.z : state.currentLayer;
    const squareToMap = map.type === "top" ? fromTopSquare : fromIsoSquare;
    const coords = squareToMap(map.sqr, point.x, point.y, layer);
    const imageX = (map.x0 + coords[0]) / map.scale;
    const imageY = (map.y0 + coords[1]) / map.scale;
    const viewportPoint = state.tiledImage.imageToViewportCoordinates(imageX, imageY);

    return state.viewer.viewport.pixelFromPoint(viewportPoint, true);
  }

  function markerGlyph(marker) {
    const id = String(marker.symbolId || "").toLowerCase();
    if (id.includes("house")) return "H";
    if (id.includes("car") || id.includes("vehicle")) return "V";
    if (id.includes("warning") || id.includes("danger")) return "!";
    if (marker.kind === "text") return "T";
    return "M";
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
    label.textContent = type === "player" ? item.name || "Player" : item.label || item.symbolId || "Marker";

    node.append(dot, label);
    return node;
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

    const items = [
      ...(snapshot.players || []).map((item) => ({ item, type: "player" })),
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
    updateStatus(`PZMapSync mock: ${count}`, Boolean(lastError));
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
