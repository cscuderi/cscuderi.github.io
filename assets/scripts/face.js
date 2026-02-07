import * as THREE from "../vendor/three/build/three.module.js";
import { SVGLoader } from "../vendor/three/examples/jsm/loaders/SVGLoader.js";

const CANONICAL_PART_IDS = new Set([
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
  "shadow",
]);

const CANONICAL_PART_BY_LOWER = Object.fromEntries(Array.from(CANONICAL_PART_IDS, (id) => [id.toLowerCase(), id]));

const PART_ALIASES = {
  // Current rig (assets/images/face.svg)
  face: "head",
  "face-2": "head",
  "eye-l": "eyeL",
  "eye-left": "eyeL",
  "eye-r": "eyeR",
  "eye-right": "eyeR",
  mouth: "mouth",
  "mouth-2": "mouth",
  nose: "nose",
  "nose-2": "nose",
  forehead: "highlight",
  "forehead-2": "highlight",
};

const randRange = (min, max) => min + Math.random() * (max - min);

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const loadSvg = (loader, url) =>
  new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });

const setGroupOpacity = (group, opacity) => {
  if (!group) {
    return;
  }
  const clamped = THREE.MathUtils.clamp(opacity, 0, 1);
  group.visible = clamped > 0.001;
  group.traverse((obj) => {
    if (!obj.isMesh || !obj.material) {
      return;
    }
    obj.material.transparent = clamped < 0.999;
    obj.material.opacity = clamped;
    obj.material.depthWrite = clamped >= 0.999;
    obj.visible = clamped > 0.001;
  });
};

const getNodeTokenCandidates = (node) => {
  const tokens = [];
  if (!node) {
    return tokens;
  }

  if (node.id) {
    tokens.push(node.id);
  }

  if (typeof node.getAttribute === "function") {
    const idAttr = node.getAttribute("id");
    if (idAttr) {
      tokens.push(idAttr);
    }

    const classAttr = node.getAttribute("class");
    if (classAttr) {
      classAttr
        .split(/\s+/)
        .filter(Boolean)
        .forEach((token) => tokens.push(token));
    }
  }

  return tokens;
};

const normalizePartId = (token) => {
  if (!token) {
    return null;
  }

  if (CANONICAL_PART_IDS.has(token)) {
    return token;
  }

  const direct = PART_ALIASES[token];
  if (direct) {
    return direct;
  }

  const lower = token.toLowerCase();
  const canonical = CANONICAL_PART_BY_LOWER[lower];
  if (canonical) {
    return canonical;
  }
  const viaLower = PART_ALIASES[lower];
  if (viaLower) {
    return viaLower;
  }

  return null;
};

const findPartId = (node) => {
  let current = node;
  while (current) {
    const candidates = getNodeTokenCandidates(current);
    for (const token of candidates) {
      const partId = normalizePartId(token);
      if (partId) {
        return partId;
      }
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

export const createFace = async (canvas, { reducedMotion = false, debug = false } = {}) => {
  let reducedMotionEnabled = reducedMotion;
  let debugEnabled = Boolean(debug);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const webgl = { ok: false, version: null, renderer: null, error: null };
  try {
    const gl = renderer.getContext();
    webgl.ok = !!gl;
    if (gl) {
      webgl.version = gl.getParameter(gl.VERSION);
      webgl.renderer = gl.getParameter(gl.RENDERER);
    }
  } catch (error) {
    webgl.error = error?.message || String(error);
  }

  const applyDebugStyles = () => {
    try {
      renderer.domElement.style.outline = debugEnabled ? "2px solid rgba(255, 0, 0, 0.35)" : "";
      renderer.domElement.style.background = debugEnabled ? "rgba(255, 0, 0, 0.03)" : "";
    } catch {
      // ignore
    }
  };
  applyDebugStyles();

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  camera.position.set(0, 0, 4);

  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  const directional = new THREE.DirectionalLight(0xffffff, 0.55);
  directional.position.set(0.3, 0.7, 1.1);
  scene.add(ambient, directional);

  const faceGroup = new THREE.Group();
  scene.add(faceGroup);

  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xff3b3b }),
  );
  marker.position.set(0.6, -0.6, 0.2);
  marker.visible = debugEnabled;
  marker.frustumCulled = false;
  scene.add(marker);

  const loader = new SVGLoader();
  const data = await loadSvg(loader, "assets/images/face.svg");
  const rawParts = {};

  const buildGroupFromSvgData = (svgData) => {
    const group = new THREE.Group();
    svgData.paths.forEach((path) => {
      const baseColor = new THREE.Color(path.color || "#1f1b17");
      const fillMaterial = new THREE.MeshStandardMaterial({
        color: baseColor,
        side: THREE.DoubleSide,
        roughness: 0.92,
        metalness: 0.02,
      });

      const attach = (mesh) => {
        mesh.frustumCulled = false;
        group.add(mesh);
      };

      const shapes = SVGLoader.createShapes(path);
      let attachedAny = false;

      if (shapes.length) {
        shapes.forEach((shape) => {
          const geometry = new THREE.ShapeGeometry(shape);
          const pos = geometry.getAttribute("position");
          if (!pos || pos.count === 0) {
            geometry.dispose();
            return;
          }
          geometry.computeVertexNormals();
          attach(new THREE.Mesh(geometry, fillMaterial));
          attachedAny = true;
        });
      }

      if (attachedAny) {
        return;
      }

      const svgStyle = path.userData?.style || {};
      const strokeStyle = {
        stroke: svgStyle.stroke && svgStyle.stroke !== "none" ? svgStyle.stroke : `#${baseColor.getHexString()}`,
        strokeWidth: Number(svgStyle.strokeWidth || 1.6),
        strokeLineJoin: svgStyle.strokeLineJoin || "round",
        strokeLineCap: svgStyle.strokeLineCap || "round",
        strokeMiterLimit: Number(svgStyle.strokeMiterLimit || 4),
      };
      const strokeMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(strokeStyle.stroke),
        side: THREE.DoubleSide,
        roughness: 0.92,
        metalness: 0.02,
      });
      path.subPaths?.forEach((subPath) => {
        const points = subPath.getPoints(96);
        const geometry = SVGLoader.pointsToStroke(points, strokeStyle, 12, 0.5);
        if (!geometry) {
          return;
        }
        geometry.computeVertexNormals();
        attach(new THREE.Mesh(geometry, strokeMaterial));
      });
    });
    return group;
  };

  let meshCount = 0;
  let shapeCount = 0;
  let vertexCount = 0;
  let triangleCount = 0;

  data.paths.forEach((path) => {
    const partId = findPartId(path.userData?.node);
    const baseColor = new THREE.Color(path.color || "#1f1b17");

    const fillMaterial = new THREE.MeshStandardMaterial({
      color: baseColor,
      side: THREE.DoubleSide,
      roughness: 0.92,
      metalness: 0.02,
    });

    const attachMesh = (mesh) => {
      mesh.frustumCulled = false;
      meshCount += 1;
      if (partId) {
        if (!rawParts[partId]) {
          rawParts[partId] = new THREE.Group();
        }
        rawParts[partId].add(mesh);
      } else {
        faceGroup.add(mesh);
      }
    };

    const shapes = SVGLoader.createShapes(path);
    let attachedAny = false;

    if (shapes.length) {
      shapes.forEach((shape) => {
        const geometry = new THREE.ShapeGeometry(shape);
        const pos = geometry.getAttribute("position");
        if (!pos || pos.count === 0) {
          geometry.dispose();
          return;
        }
        geometry.computeVertexNormals();
        shapeCount += 1;
        vertexCount += pos.count;
        triangleCount += Math.floor(pos.count / 3);
        attachMesh(new THREE.Mesh(geometry, fillMaterial));
        attachedAny = true;
      });
    }

    if (attachedAny) {
      return;
    }

    // Fallback: if fill triangulation yields no shapes, render a stroke.
    // This keeps the face visible even when the SVG path is not fill-friendly.
    const svgStyle = path.userData?.style || {};
    const strokeStyle = {
      stroke: svgStyle.stroke && svgStyle.stroke !== "none" ? svgStyle.stroke : `#${baseColor.getHexString()}`,
      strokeWidth: Number(svgStyle.strokeWidth || 1.6),
      strokeLineJoin: svgStyle.strokeLineJoin || "round",
      strokeLineCap: svgStyle.strokeLineCap || "round",
      strokeMiterLimit: Number(svgStyle.strokeMiterLimit || 4),
    };
    const strokeMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(strokeStyle.stroke),
      side: THREE.DoubleSide,
      roughness: 0.92,
      metalness: 0.02,
    });

    path.subPaths?.forEach((subPath) => {
      const points = subPath.getPoints(96);
      const geometry = SVGLoader.pointsToStroke(points, strokeStyle, 12, 0.5);
      if (geometry) {
        geometry.computeVertexNormals();
        const pos = geometry.getAttribute("position");
        if (pos) {
          vertexCount += pos.count;
          triangleCount += Math.floor(pos.count / 3);
        }
        attachMesh(new THREE.Mesh(geometry, strokeMaterial));
      }
    });
  });

  const parts = {};
  Object.entries(rawParts).forEach(([id, group]) => {
    const pivot = createPivotGroup(group);
    pivot.frustumCulled = false;
    parts[id] = pivot;
    faceGroup.add(pivot);
  });

  if (meshCount === 0) {
    throw new Error("Face SVG loaded but produced no renderable geometry");
  }

  const bounds = new THREE.Box3().setFromObject(faceGroup);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  faceGroup.position.sub(center);

  const maxSize = Math.max(size.x, size.y);
  const scale = maxSize > 0 ? 1.6 / maxSize : 1;
  // SVG Y axis points down; Three's Y axis points up.
  faceGroup.scale.set(scale, -scale, scale);
  // faceGroup.position is in SVG units; scale + flip it into world units.
  faceGroup.position.multiplyScalar(scale);
  faceGroup.position.y *= -1;
  const baseFacePosition = faceGroup.position.clone();

  const helper = new THREE.BoxHelper(faceGroup, 0xff3b3b);
  helper.frustumCulled = false;
  helper.visible = debugEnabled;
  scene.add(helper);

  const basePositions = {};
  ["pupilL", "pupilR", "mouth", "lidL", "lidR", "eyeL", "eyeR", "browL", "browR"].forEach((id) => {
    if (parts[id]) {
      basePositions[id] = parts[id].position.clone();
    }
  });

  // Mouth variants: keep base mouth as default; overlay smile/open occasionally.
  const mouthRig = {
    anchor: new THREE.Group(),
    open: null,
    smile: null,
    base: parts.mouth || null,
    baseWidthSvg: 0,
    baseHeightSvg: 0,
    smileW: 0,
    smileV: 0,
    openW: 0,
    openV: 0,
    openUntil: 0,
    smileUntil: 0,
    nextSmileAt: performance.now() + randRange(3500, 7000),
  };
  mouthRig.anchor.frustumCulled = false;
  if (basePositions.mouth) {
    mouthRig.anchor.position.copy(basePositions.mouth);
    mouthRig.anchor.position.z += 0.25;
  } else {
    mouthRig.anchor.position.set(0, -0.32, 0.25);
  }
  faceGroup.add(mouthRig.anchor);

  if (mouthRig.base) {
    const baseBounds = new THREE.Box3().setFromObject(mouthRig.base);
    const baseSize = baseBounds.getSize(new THREE.Vector3());
    // baseBounds is computed in world units; convert back to face SVG units so
    // we can size external SVG mouths before faceGroup scaling is applied.
    const faceScale = Math.max(1e-6, Math.abs(scale));
    mouthRig.baseWidthSvg = baseSize.x / faceScale;
    mouthRig.baseHeightSvg = baseSize.y / faceScale;
  } else {
    // Fallback: approximate mouth width from the face's SVG bounds.
    mouthRig.baseWidthSvg = maxSize * 0.28;
    mouthRig.baseHeightSvg = maxSize * 0.12;
  }

  const normalizeMouth = (group, { targetWidth = 0.62, y = 0 } = {}) => {
    if (!group) {
      return;
    }
    const bounds = new THREE.Box3().setFromObject(group);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    group.position.sub(center);
    const width = Math.max(size.x, 0.0001);
    const scaleToWidth = targetWidth / width;
    group.scale.setScalar(scaleToWidth);
    group.position.multiplyScalar(scaleToWidth);
    group.position.y += y;
  };

  const loadMouthVariant = async (url) => {
    const mouthLoader = new SVGLoader();
    const svgData = await loadSvg(mouthLoader, url);
    const group = buildGroupFromSvgData(svgData);
    group.frustumCulled = false;
    group.renderOrder = 20;
    group.traverse((obj) => {
      if (obj.isMesh) {
        obj.frustumCulled = false;
        obj.renderOrder = 20;
      }
    });
    return group;
  };

  // Fire-and-forget load; if these fail, we just keep the existing face mouth.
  loadMouthVariant("assets/images/mouth-open.svg")
    .then((group) => {
      mouthRig.open = group;
      normalizeMouth(group, {
        targetWidth: mouthRig.baseWidthSvg * 0.3,
        y: -mouthRig.baseHeightSvg * 0.1,
      });
      mouthRig.anchor.add(group);
      setGroupOpacity(group, 0);
    })
    .catch(() => {});

  loadMouthVariant("assets/images/mouth-smile.svg")
    .then((group) => {
      mouthRig.smile = group;
      normalizeMouth(group, {
        targetWidth: mouthRig.baseWidthSvg * 0.7,
        y: mouthRig.baseHeightSvg * 0.018,
      });
      mouthRig.anchor.add(group);
      setGroupOpacity(group, 0);
    })
    .catch(() => {});

  const state = {
    target: new THREE.Vector2(0, 0),
    smoothTarget: new THREE.Vector2(0, 0),
    response: 0.08,
    wakeBoost: 0,
    blink: {
      nextAt: performance.now() + randRange(1800, 4200),
      active: false,
      start: 0,
      duration: 180,
    },
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

  const triggerMouthOpen = (durationMs = 900) => {
    const now = performance.now();
    mouthRig.openUntil = Math.max(mouthRig.openUntil, now + durationMs);
    mouthRig.smileUntil = 0;
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
    if (reducedMotionEnabled) {
      renderer.render(scene, camera);
      return;
    }

    state.smoothTarget.lerp(state.target, state.response);
    const tx = state.smoothTarget.x;
    const ty = state.smoothTarget.y;

    // Keep head motion subtle so the eyes do the "acting".
    // Add a small yaw so the face feels like it turns "into" the target.
    faceGroup.rotation.z = tx * 0.05;
    faceGroup.rotation.x = -ty * 0.04;
    faceGroup.rotation.y = tx * -0.16;
    faceGroup.position.x = baseFacePosition.x + tx * 0.07;
    faceGroup.position.y = baseFacePosition.y + ty * 0.05;

    // Default idle motion (breathing) so the face never feels dead.
    const breath = Math.sin(time * 0.0011) * 0.006;
    const sway = Math.sin(time * 0.0009) * 0.006;
    faceGroup.position.y += breath;
    faceGroup.rotation.z += sway;

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

    // Track in SVG units so motion scales with the art.
    // Boost vertical a bit so up/down reads clearly.
    // Because we flip the SVG Y axis (faceGroup scale.y is negative), translate eyes with inverted Y.
    const invTy = -ty;
    const pupilOffset = new THREE.Vector2(
      THREE.MathUtils.clamp(tx * maxSize * 0.034, -maxSize * 0.055, maxSize * 0.055),
      THREE.MathUtils.clamp(invTy * maxSize * 0.048, -maxSize * 0.072, maxSize * 0.072),
    );
    const eyeOffset = new THREE.Vector2(
      THREE.MathUtils.clamp(tx * maxSize * 0.012, -maxSize * 0.022, maxSize * 0.022),
      THREE.MathUtils.clamp(invTy * maxSize * 0.02, -maxSize * 0.034, maxSize * 0.034),
    );

    if (parts.eyeL && basePositions.eyeL) {
      parts.eyeL.position.x = basePositions.eyeL.x + eyeOffset.x;
      parts.eyeL.position.y = basePositions.eyeL.y + eyeOffset.y;
    }
    if (parts.eyeR && basePositions.eyeR) {
      parts.eyeR.position.x = basePositions.eyeR.x + eyeOffset.x;
      parts.eyeR.position.y = basePositions.eyeR.y + eyeOffset.y;
    }

    if (parts.pupilL && basePositions.pupilL) {
      parts.pupilL.position.x = basePositions.pupilL.x + pupilOffset.x;
      parts.pupilL.position.y = basePositions.pupilL.y + pupilOffset.y;
    }

    if (parts.pupilR && basePositions.pupilR) {
      parts.pupilR.position.x = basePositions.pupilR.x + pupilOffset.x;
      parts.pupilR.position.y = basePositions.pupilR.y + pupilOffset.y;
    }

    // Mouth state machine.
    if (state.wakeBoost > 0.5) {
      mouthRig.openUntil = Math.max(mouthRig.openUntil, time + 250);
    }

    if (time > mouthRig.openUntil) {
      if (time < mouthRig.smileUntil) {
        // keep smiling
      } else if (time > mouthRig.nextSmileAt) {
        mouthRig.smileUntil = time + randRange(1000, 2000);
        mouthRig.nextSmileAt = time + randRange(5200, 9200);
      }
    }

    const targetOpen = time < mouthRig.openUntil ? 1 : 0;
    const targetSmile = targetOpen > 0 ? 0 : time < mouthRig.smileUntil ? 1 : 0;

    const stiffness = 0.16;
    const damping = 0.72;

    mouthRig.openV += (targetOpen - mouthRig.openW) * stiffness;
    mouthRig.openV *= damping;
    mouthRig.openW = THREE.MathUtils.clamp(mouthRig.openW + mouthRig.openV, 0, 1);

    mouthRig.smileV += (targetSmile - mouthRig.smileW) * stiffness;
    mouthRig.smileV *= damping;
    mouthRig.smileW = THREE.MathUtils.clamp(mouthRig.smileW + mouthRig.smileV, 0, 1);

    const overlayW = Math.max(mouthRig.openW, mouthRig.smileW);
    const baseW = 1 - overlayW;

    if (mouthRig.base) {
      setGroupOpacity(mouthRig.base, baseW);
    }
    if (mouthRig.open) {
      setGroupOpacity(mouthRig.open, mouthRig.openW);
    }
    if (mouthRig.smile) {
      setGroupOpacity(mouthRig.smile, mouthRig.smileW);
    }

    // Add a little squash during transitions.
    const motion = Math.abs(mouthRig.openV) + Math.abs(mouthRig.smileV);
    const squash = THREE.MathUtils.clamp(motion * 6, 0, 1);
    mouthRig.anchor.scale.set(1 + squash * 0.12, 1 - squash * 0.08, 1);


    if (parts.browL && basePositions.browL) {
      parts.browL.position.y = basePositions.browL.y + ty * 0.1;
    }
    if (parts.browR && basePositions.browR) {
      parts.browR.position.y = basePositions.browR.y + ty * 0.1;
    }

    if (debugEnabled) {
      helper.update();
    }

    renderer.render(scene, camera);
  };

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const aspect = width / height;
    const baseFrustumHeight = 2;
    // If the canvas is narrow, widen the view so the face scales down instead of cropping.
    const widen = aspect < 1 ? Math.min(1 / Math.max(0.25, aspect), 1.6) : 1;
    const frustumHeight = baseFrustumHeight * widen;
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

  const setReducedMotion = (value) => {
    reducedMotionEnabled = value;
  };

  const setDebug = (value) => {
    debugEnabled = Boolean(value);
    marker.visible = debugEnabled;
    helper.visible = debugEnabled;
    applyDebugStyles();
  };

  return {
    update,
    resize,
    setTarget,
    setResponsiveness,
    setWakeBoost,
    setReducedMotion,
    setDebug,
    triggerMouthOpen,
    getDebugInfo: () => ({
      meshCount,
      shapeCount,
      partCount: Object.keys(parts).length,
      vertexCount,
      triangleCount,
      faceBounds: {
        size: { x: size.x, y: size.y, z: size.z },
        center: { x: center.x, y: center.y, z: center.z },
        maxSize,
        scale,
      },
      threeRevision: THREE.REVISION,
      webgl: { ...webgl },
      rendererSize: {
        w: renderer.getSize(new THREE.Vector2()).x,
        h: renderer.getSize(new THREE.Vector2()).y,
        dpr: renderer.getPixelRatio(),
      },
      renderInfo: {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      },
    }),
  };
};
