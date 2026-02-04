import { createFace } from "./face.js";

const publicApi = (() => {
  const obj = (window.face && typeof window.face === "object") ? window.face : {};
  window.face = obj;
  return obj;
})();

let debugEnabled = Boolean(publicApi.debug);

let face;

const canvas = document.querySelector("#face-canvas");
const tapHint = document.querySelector(".tap-hint");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const isTouch = window.matchMedia("(pointer: coarse)").matches;

Object.defineProperty(publicApi, "debug", {
  configurable: true,
  enumerable: true,
  get() {
    return debugEnabled;
  },
  set(value) {
    debugEnabled = Boolean(value);
    if (face?.setDebug) {
      face.setDebug(debugEnabled);
    }
    if (debugEnabled) {
      startDebugLoop();
    } else {
      stopDebugLoop();
    }
  }
});

const ensureErrorOverlay = () => {
  let node = document.querySelector(".js-debug-overlay");
  if (node) {
    return node;
  }

  node = document.createElement("div");
  node.className = "js-debug-overlay";
  node.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:980px;margin:0 auto;background:rgba(31,27,23,.92);color:#f6f1e9;padding:10px 12px;border-radius:10px;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",\"Courier New\",monospace;display:none;box-shadow:0 16px 60px rgba(0,0,0,.25);white-space:pre-wrap;";
  document.body.appendChild(node);
  return node;
};

const showError = (message) => {
  if (!debugEnabled) {
    console.error(message);
    return;
  }
  const overlay = ensureErrorOverlay();
  overlay.textContent = String(message || "Unknown error");
  overlay.style.display = "block";
};

const showDebug = (message) => {
  if (!debugEnabled) {
    return;
  }
  const overlay = ensureErrorOverlay();
  overlay.textContent = String(message || "");
  overlay.style.display = "block";
};

window.addEventListener("error", (event) => {
  const error = event?.error;
  const message = error ? (error.stack || error.message) : (event?.message || "Script error");
  showError(message);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  showError(reason?.stack || reason?.message || reason);
});

document.body.classList.toggle("reduce-motion", prefersReducedMotion.matches);
document.body.classList.toggle("touch", isTouch);
let debugTimer = 0;

function debugLoop() {
  if (!debugEnabled || !face) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const info = face.getDebugInfo?.() || {};
  const lines = [];
  lines.push("window.face.debug = true");
  lines.push(`webgl: ${info.webgl?.ok ? "ok" : "unknown"}`);
  if (info.webgl?.error) {
    lines.push(`webgl_error: ${info.webgl.error}`);
  }
  if (info.webgl?.renderer) {
    lines.push(`gpu: ${info.webgl.renderer}`);
  }
  if (info.webgl?.version) {
    lines.push(`gl: ${info.webgl.version}`);
  }
  if (info.threeRevision) {
    lines.push(`three: r${info.threeRevision}`);
  }
  lines.push(`canvas_css: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
  if (info.rendererSize) {
    lines.push(`canvas_px: ${info.rendererSize.w}x${info.rendererSize.h} (dpr=${info.rendererSize.dpr})`);
  }
  if (typeof info.meshCount === "number") {
    lines.push(`meshes: ${info.meshCount} (shapes=${info.shapeCount || 0}) parts=${info.partCount || 0}`);
  }
  if (typeof info.vertexCount === "number") {
    lines.push(`geo: verts=${info.vertexCount} tris_est=${info.triangleCount || 0}`);
  }
  if (info.faceBounds?.scale) {
    lines.push(`bounds: max=${Math.round(info.faceBounds.maxSize)} scale=${info.faceBounds.scale.toFixed(4)}`);
  }
  if (info.renderInfo) {
    lines.push(`draw: calls=${info.renderInfo.calls} tris=${info.renderInfo.triangles} geoms=${info.renderInfo.geometries} tex=${info.renderInfo.textures}`);
  }
  showDebug(lines.join("\n"));
  debugTimer = window.setTimeout(debugLoop, 500);
}

function startDebugLoop() {
  if (debugTimer) {
    return;
  }
  debugLoop();
}

function stopDebugLoop() {
  if (debugTimer) {
    window.clearTimeout(debugTimer);
    debugTimer = 0;
  }
  const overlay = document.querySelector(".js-debug-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

try {
  if (!canvas) {
    throw new Error("Missing #face-canvas");
  }
  face = await createFace(canvas, { reducedMotion: prefersReducedMotion.matches, debug: debugEnabled });

  // Only hide the SVG fallback once we know the WebGL face actually built geometry.
  const debug = face.getDebugInfo?.();
  if (!debug || debug.meshCount <= 0) {
    throw new Error("Face initialized but produced no geometry");
  }

  // Wait until layout has settled so canvas has non-zero size.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      try {
        face.resize();
        face.update(performance.now());
        document.body.classList.add("has-webgl");
      } catch (error) {
        console.error(error);
        showError(error?.stack || error?.message || error);
      }
    });
  });

  // Apply any pre-set value.
  publicApi.debug = debugEnabled;
} catch (error) {
  console.error(error);
  showError(error?.stack || error?.message || error);
}

let rafId = 0;
let running = false;
let lastPointerTime = 0;
let lastPointer = { x: 0, y: 0 };
let wakeUntil = 0;
let wakeTarget = { x: 0, y: 0 };

const markInteracted = () => {
  if (!document.body.classList.contains("has-interacted")) {
    document.body.classList.add("has-interacted");
  }
  if (tapHint) {
    tapHint.setAttribute("aria-hidden", "true");
  }
};

const pointerToTarget = (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  return { x, y };
};

const getAutopilotTarget = (time) => {
  const t = time * 0.00012;
  return {
    x: Math.sin(t * 1.1) * 0.18,
    y: Math.cos(t * 1.4) * 0.12
  };
};

const updateFaceTarget = (time) => {
  if (prefersReducedMotion.matches) {
    return;
  }

  if (!isTouch) {
    const idle = time - lastPointerTime > 2000;
    const target = idle ? { x: 0, y: 0 } : lastPointer;
    face.setTarget(target.x, target.y);
    face.setResponsiveness(idle ? 0.05 : 0.1);
    face.setWakeBoost(0);
    return;
  }

  if (time < wakeUntil) {
    face.setTarget(wakeTarget.x, wakeTarget.y);
    face.setResponsiveness(0.16);
    face.setWakeBoost(1);
  } else {
    const autoTarget = getAutopilotTarget(time);
    face.setTarget(autoTarget.x, autoTarget.y);
    face.setResponsiveness(0.06);
    face.setWakeBoost(0);
  }
};

const tick = (time) => {
  if (!running) {
    return;
  }
  updateFaceTarget(time);
  face.update(time);
  rafId = window.requestAnimationFrame(tick);
};

const start = () => {
  if (!face) {
    return;
  }
  if (running || prefersReducedMotion.matches) {
    face.update(performance.now());
    return;
  }
  running = true;
  rafId = window.requestAnimationFrame(tick);
};

const stop = () => {
  running = false;
  if (rafId) {
    window.cancelAnimationFrame(rafId);
  }
};

if (!prefersReducedMotion.matches) {
  window.addEventListener("pointermove", (event) => {
    if (isTouch) {
      return;
    }
    lastPointer = pointerToTarget(event);
    lastPointerTime = performance.now();
    markInteracted();
  });

  window.addEventListener("pointerdown", (event) => {
    if (!isTouch) {
      return;
    }
    wakeTarget = pointerToTarget(event);
    wakeUntil = performance.now() + 3000;
    lastPointerTime = performance.now();
    markInteracted();
  });
}

window.addEventListener("resize", () => {
  if (face) {
    face.resize();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stop();
  } else {
    start();
  }
});

prefersReducedMotion.addEventListener("change", (event) => {
  document.body.classList.toggle("reduce-motion", event.matches);
  if (face) {
    face.setReducedMotion(event.matches);
  }
  if (event.matches) {
    stop();
    if (face) {
      face.update(performance.now());
    }
  } else {
    start();
  }
});

start();
