import { createFace } from "./face.js";

const canvas = document.querySelector("#face-canvas");
const tapHint = document.querySelector(".tap-hint");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const isTouch = window.matchMedia("(pointer: coarse)").matches;

document.body.classList.toggle("reduce-motion", prefersReducedMotion.matches);
document.body.classList.toggle("touch", isTouch);

const face = await createFace(canvas, { reducedMotion: prefersReducedMotion.matches });

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
  face.resize();
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
  if (event.matches) {
    stop();
    face.update(performance.now());
  } else {
    start();
  }
});

start();
