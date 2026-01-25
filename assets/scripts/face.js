import * as THREE from "../vendor/three/build/three.module.js";
import { SVGLoader } from "../vendor/three/examples/jsm/loaders/SVGLoader.js";

const PART_IDS = new Set([
  "head",
  "eyeL",
  "eyeR",
  "pupilL",
  "pupilR",
  "lidL",
  "lidR",
  "mouth",
  "browL",
  "browR",
  "nose",
  "earL",
  "earR",
  "highlight",
  "shadow"
]);

const randRange = (min, max) => min + Math.random() * (max - min);

const easeInOut = (t) => (t < 0.5
  ? 4 * t * t * t
  : 1 - Math.pow(-2 * t + 2, 3) / 2);

const loadSvg = (loader, url) => new Promise((resolve, reject) => {
  loader.load(url, resolve, undefined, reject);
});

const findPartId = (node) => {
  let current = node;
  while (current) {
    if (current.id && PART_IDS.has(current.id)) {
      return current.id;
    }
    current = current.parentNode;
  }
  return null;
};

const createPivotGroup = (group) => {
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const pivot = new THREE.Group();
  pivot.position.copy(center);
  group.position.sub(center);
  pivot.add(group);
  pivot.userData.center = center.clone();
  return pivot;
};

export const createFace = async (canvas, { reducedMotion = false } = {}) => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  camera.position.set(0, 0, 4);

  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  const directional = new THREE.DirectionalLight(0xffffff, 0.55);
  directional.position.set(0.3, 0.7, 1.1);
  scene.add(ambient, directional);

  const faceGroup = new THREE.Group();
  scene.add(faceGroup);

  const loader = new SVGLoader();
  const data = await loadSvg(loader, "assets/images/face.svg");
  const rawParts = {};

  data.paths.forEach((path) => {
    const shapes = SVGLoader.createShapes(path);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(path.color || "#1f1b17"),
      side: THREE.DoubleSide,
      roughness: 0.92,
      metalness: 0.02
    });

    shapes.forEach((shape) => {
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      const partId = findPartId(path.userData?.node);

      if (partId) {
        if (!rawParts[partId]) {
          rawParts[partId] = new THREE.Group();
        }
        rawParts[partId].add(mesh);
      } else {
        faceGroup.add(mesh);
      }
    });
  });

  const parts = {};
  Object.entries(rawParts).forEach(([id, group]) => {
    const pivot = createPivotGroup(group);
    parts[id] = pivot;
    faceGroup.add(pivot);
  });

  const bounds = new THREE.Box3().setFromObject(faceGroup);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  faceGroup.position.sub(center);

  const maxSize = Math.max(size.x, size.y);
  const scale = maxSize > 0 ? 1.6 / maxSize : 1;
  faceGroup.scale.setScalar(scale);
  const baseFacePosition = faceGroup.position.clone();

  const basePositions = {};
  ["pupilL", "pupilR", "mouth", "lidL", "lidR", "eyeL", "eyeR", "browL", "browR"].forEach((id) => {
    if (parts[id]) {
      basePositions[id] = parts[id].position.clone();
    }
  });

  const state = {
    target: new THREE.Vector2(0, 0),
    smoothTarget: new THREE.Vector2(0, 0),
    response: 0.08,
    wakeBoost: 0,
    blink: {
      nextAt: performance.now() + randRange(1800, 4200),
      active: false,
      start: 0,
      duration: 180
    }
  };

  const setTarget = (x, y) => {
    state.target.set(x, y);
  };

  const setResponsiveness = (value) => {
    state.response = value;
  };

  const setWakeBoost = (value) => {
    state.wakeBoost = value;
  };

  const updateBlink = (time) => {
    if (!state.blink.active && time > state.blink.nextAt) {
      state.blink.active = true;
      state.blink.start = time;
    }

    let blinkAmount = 0;
    if (state.blink.active) {
      const t = (time - state.blink.start) / state.blink.duration;
      if (t >= 1) {
        state.blink.active = false;
        state.blink.nextAt = time + randRange(2500, 6000);
        blinkAmount = 0;
      } else if (t < 0.5) {
        blinkAmount = easeInOut(t * 2);
      } else {
        blinkAmount = easeInOut((1 - t) * 2);
      }
    }
    return blinkAmount;
  };

  const update = (time) => {
    if (reducedMotion) {
      renderer.render(scene, camera);
      return;
    }

    state.smoothTarget.lerp(state.target, state.response);
    const tx = state.smoothTarget.x;
    const ty = state.smoothTarget.y;

    faceGroup.rotation.z = tx * 0.08;
    faceGroup.rotation.x = -ty * 0.06;
    faceGroup.position.x = baseFacePosition.x + tx * 0.12;
    faceGroup.position.y = baseFacePosition.y + ty * 0.08;

    const blinkAmount = updateBlink(time);
    const eyeScale = 1 - blinkAmount * 0.85;
    const lidScale = Math.max(0.01, blinkAmount);

    if (parts.eyeL) {
      parts.eyeL.scale.y = eyeScale;
    }
    if (parts.eyeR) {
      parts.eyeR.scale.y = eyeScale;
    }
    if (parts.lidL) {
      parts.lidL.scale.y = lidScale;
    }
    if (parts.lidR) {
      parts.lidR.scale.y = lidScale;
    }

    if (parts.pupilL && basePositions.pupilL) {
      const pupilOffset = new THREE.Vector2(tx, ty).multiplyScalar(0.22);
      const clamped = pupilOffset.clampLength(0, 0.28);
      parts.pupilL.position.x = basePositions.pupilL.x + clamped.x;
      parts.pupilL.position.y = basePositions.pupilL.y + clamped.y;
    }
    if (parts.pupilR && basePositions.pupilR) {
      const pupilOffset = new THREE.Vector2(tx, ty).multiplyScalar(0.22);
      const clamped = pupilOffset.clampLength(0, 0.28);
      parts.pupilR.position.x = basePositions.pupilR.x + clamped.x;
      parts.pupilR.position.y = basePositions.pupilR.y + clamped.y;
    }

    const mouthPulse = Math.sin(time * 0.002) * 0.08 + 0.1 + state.wakeBoost * 0.1;
    if (parts.mouth) {
      parts.mouth.scale.y = 1 + mouthPulse;
      parts.mouth.scale.x = 1 + mouthPulse * 0.2;
    }

    if (parts.browL && basePositions.browL) {
      parts.browL.position.y = basePositions.browL.y + ty * 0.1;
    }
    if (parts.browR && basePositions.browR) {
      parts.browR.position.y = basePositions.browR.y + ty * 0.1;
    }

    renderer.render(scene, camera);
  };

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = canvas;
    const aspect = width / height || 1;
    const frustumHeight = 2;
    camera.top = frustumHeight / 2;
    camera.bottom = -frustumHeight / 2;
    camera.left = -(frustumHeight * aspect) / 2;
    camera.right = (frustumHeight * aspect) / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  resize();

  if (parts.lidL) {
    parts.lidL.scale.y = 0.01;
  }
  if (parts.lidR) {
    parts.lidR.scale.y = 0.01;
  }

  return {
    update,
    resize,
    setTarget,
    setResponsiveness,
    setWakeBoost
  };
};
