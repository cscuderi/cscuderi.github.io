import { createFace } from "./face.js";
import { initYearRoman } from "./year.js";

const publicApi = (() => {
  const obj = window.face && typeof window.face === "object" ? window.face : {};
  window.face = obj;
  return obj;
})();

initYearRoman();

let debugEnabled = Boolean(publicApi.debug);

let face;

const canvas = document.querySelector("#face-canvas");
const faceJiggle = document.querySelector(".face-jiggle");
const ciaoJiggle = document.querySelector(".ciao-jiggle");
const faceWrap = document.querySelector(".face-wrap");
const tapHint = document.querySelector(".tap-hint");
const scrollHint = document.querySelector(".scroll-hint");
const blurb = document.querySelector(".blurb");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const isTouch = window.matchMedia("(pointer: coarse)").matches;

const intro = {
  enabled: !prefersReducedMotion.matches,
  startAt: performance.now(),
};

const withTimeout = (promise, timeoutMs) =>
  new Promise((resolve) => {
    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ ok: false, timeout: true });
    }, timeoutMs);

    promise
      .then((value) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve({ ok: true, value });
      })
      .catch((error) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve({ ok: false, error });
      });
  });

const waitForImg = (img) =>
  new Promise((resolve) => {
    if (!img) {
      resolve();
      return;
    }
    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }
    const done = () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", done);
      resolve();
    };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });

const waitForHeroAssets = async () => {
  const hero = document.querySelector(".hero");
  const imgs = hero ? Array.from(hero.querySelectorAll("img")) : [];
  const imageWait = Promise.all(imgs.map(waitForImg));

  let fontWait = Promise.resolve();
  if (document.fonts && typeof document.fonts.load === "function") {
    fontWait = (async () => {
      // These weights match the Google Fonts request in index.html.
      await Promise.all([
        document.fonts.load('900 1em "Montserrat"'),
        document.fonts.load('400 1em "Montserrat"'),
        document.fonts.load('400 1em "EB Garamond"'),
      ]);
      await document.fonts.ready;
    })();
  }

  await Promise.all([withTimeout(imageWait, 5000), withTimeout(fontWait, 5000)]);
};

let introSmileScheduled = false;

const INTRO_TOTAL_MS = 3600;
let scrollHintTimer = 0;
let scrollHintHideTimer = 0;
let scrollHintDismissed = false;
const scrollHintDismissKeys = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Spacebar"]);

const setScrollHintVisible = (visible) => {
  if (!scrollHint) {
    return;
  }

  if (visible) {
    if (!scrollHint.hidden) {
      return;
    }
    scrollHint.hidden = false;
    window.requestAnimationFrame(() => {
      scrollHint.classList.add("is-visible");
    });
    return;
  }

  scrollHint.classList.remove("is-visible");
  if (scrollHintHideTimer) {
    window.clearTimeout(scrollHintHideTimer);
  }
  scrollHintHideTimer = window.setTimeout(() => {
    if (scrollHint) {
      scrollHint.hidden = true;
    }
  }, 250);
};

const hasRoomForScrollHint = () => {
  if (!scrollHint || !blurb) {
    return false;
  }
  if (window.scrollY > 4) {
    return false;
  }
  if (window.innerHeight < 520) {
    return false;
  }
  const rect = blurb.getBoundingClientRect();
  const space = window.innerHeight - rect.bottom;
  return space > 120;
};

const scheduleScrollHint = (delayMs) => {
  if (!scrollHint || scrollHintDismissed) {
    return;
  }
  if (scrollHintTimer) {
    window.clearTimeout(scrollHintTimer);
  }
  scrollHintTimer = window.setTimeout(() => {
    scrollHintTimer = 0;
    if (scrollHintDismissed) {
      return;
    }
    if (!hasRoomForScrollHint()) {
      return;
    }
    setScrollHintVisible(true);
  }, delayMs);
};

const scheduleIntroSmile = () => {
  if (!intro.enabled || introSmileScheduled || !face) {
    return;
  }

  const elapsed = performance.now() - intro.startAt;
  const smileOnAt = 1650;
  const smileOffAt = 2550;
  const inMs = (ms, fn) => window.setTimeout(fn, Math.max(0, ms - elapsed));

  inMs(smileOnAt, () => face?.setWakeBoost?.(1));
  inMs(smileOffAt, () => face?.setWakeBoost?.(0));
  introSmileScheduled = true;
};

const startIntro = () => {
  document.body.classList.remove("is-preintro");
  document.body.classList.add("has-intro-started");

  intro.startAt = performance.now();

  if (intro.enabled) {
    document.body.classList.add("is-intro");
    window.setTimeout(() => {
      document.body.classList.remove("is-intro");
    }, INTRO_TOTAL_MS);
    scheduleIntroSmile();
  }

  // Show a "Scroll down" hint only after the intro settles and the user hasn't scrolled.
  scheduleScrollHint((intro.enabled ? INTRO_TOTAL_MS : 0) + 2000);
};

if (intro.enabled) {
  // Don’t kick off the intro until visible hero assets are ready.
  waitForHeroAssets().then(startIntro);
} else {
  // Reduced motion: show the page immediately.
  startIntro();
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
  },
});

const ensureErrorOverlay = () => {
  let node = document.querySelector(".js-debug-overlay");
  if (node) {
    return node;
  }

  node = document.createElement("div");
  node.className = "js-debug-overlay";
  node.style.cssText =
    'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:980px;margin:0 auto;background:rgba(31,27,23,.92);color:#f6f1e9;padding:10px 12px;border-radius:10px;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;display:none;box-shadow:0 16px 60px rgba(0,0,0,.25);white-space:pre-wrap;';
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
  const message = error ? error.stack || error.message : event?.message || "Script error";
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
    lines.push(
      `draw: calls=${info.renderInfo.calls} tris=${info.renderInfo.triangles} geoms=${info.renderInfo.geometries} tex=${info.renderInfo.textures}`,
    );
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

  scheduleIntroSmile();

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

const jiggle = {
  lastScrollY: window.scrollY || 0,
  lastScrollAt: 0,
  velocity: 0,
  value: 0,
  speed: 0,
  faceKick: 0,
  faceKickSpeed: 0,
};

const applyJiggle = (time) => {
  if (prefersReducedMotion.matches) {
    if (faceJiggle) faceJiggle.style.transform = "";
    if (ciaoJiggle) ciaoJiggle.style.transform = "";
    return;
  }

  const active = time - jiggle.lastScrollAt < 160;
  const dir = clamp(jiggle.velocity / 60, -1, 1);
  const target = active ? clamp(Math.abs(jiggle.velocity) * 0.006, 0, 1) : 0;

  // Spring for squash-and-stretch + follow-through.
  const stiffness = 0.16;
  const damping = 0.68;
  jiggle.speed += (target - jiggle.value) * stiffness;
  jiggle.speed *= damping;
  jiggle.value += jiggle.speed;

  // Signed value allows overshoot: goes skinny first, then bounces wider.
  const amt = clamp(jiggle.value, -1.1, 1.1);
  const abs = Math.abs(amt);

  // Extra kick on tap/click (face only).
  jiggle.faceKickSpeed += (0 - jiggle.faceKick) * 0.14;
  jiggle.faceKickSpeed *= 0.7;
  jiggle.faceKick += jiggle.faceKickSpeed;

  if (faceJiggle) {
    const kick = jiggle.faceKick;
    const y = -dir * abs * 10 + kick * -22;
    const sx = clamp(1 - (amt + kick) * 0.11, 0.82, 1.18);
    const sy = clamp(1 + (amt + kick) * 0.18, 0.78, 1.26);
    const rz = -dir * abs * 1.0 + kick * 1.6;
    faceJiggle.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) rotate(${rz.toFixed(3)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  }

  if (ciaoJiggle) {
    const y = -dir * abs * 14;
    const sx = clamp(1 - amt * 0.16, 0.78, 1.26);
    const sy = clamp(1 + amt * 0.24, 0.74, 1.36);
    const rz = -dir * abs * 1.4;
    ciaoJiggle.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) rotate(${rz.toFixed(3)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  }
};

window.addEventListener(
  "scroll",
  () => {
    const now = performance.now();
    const y = window.scrollY || 0;
    const delta = y - jiggle.lastScrollY;
    jiggle.lastScrollY = y;
    jiggle.velocity = delta;
    jiggle.lastScrollAt = now;
  },
  { passive: true },
);

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
    x: Math.sin(t * 1.1) * 0.24,
    y: Math.cos(t * 1.4) * 0.16,
  };
};

const updateFaceTarget = (time) => {
  if (prefersReducedMotion.matches) {
    return;
  }

  if (!isTouch) {
    const idle = time - lastPointerTime > 2000;
    const autoTarget = getAutopilotTarget(time);
    const target = idle ? { x: autoTarget.x * 0.6, y: autoTarget.y * 0.6 } : lastPointer;
    face.setTarget(target.x, target.y);
    face.setResponsiveness(idle ? 0.08 : 0.1);
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
    face.setResponsiveness(0.07);
    face.setWakeBoost(0);
  }
};

const tick = (time) => {
  if (!running) {
    return;
  }
  updateFaceTarget(time);
  applyJiggle(time);
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
    if (face && faceWrap) {
      const rect = faceWrap.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (inside) {
        face.triggerMouthOpen?.();
        jiggle.faceKickSpeed -= 1.15;
      }
    }
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

// Keep face responsive even if only its container changes.
if (faceWrap && typeof ResizeObserver !== "undefined") {
  const ro = new ResizeObserver(() => {
    if (face) {
      face.resize();
    }
  });
  ro.observe(faceWrap);
}

// Keep face responsive even when only the container changes.
if (canvas && typeof ResizeObserver !== "undefined") {
  const ro = new ResizeObserver(() => {
    if (face) {
      face.resize();
    }
  });
  ro.observe(canvas);
}

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
