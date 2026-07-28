/* ==========================================================================
   India Mathematics AR — debug-safe main.js
   Goals:
     1. Verify MindAR target events are firing.
     2. Show a simple test cube first so we know the marker space is visible.
     3. Load temple.glb safely and compute bounds with THREE.Box3.
     4. Auto-center and ground the model without relying on a guessed scale.
     5. Reveal labels only after the temple is confirmed visible.
   ========================================================================== */

(function () {
  "use strict";

  const THREE = AFRAME.THREE;

  const DEBUG = true;
  const MODEL_TARGET_SCALE = 0.35;
  const RISE_Y_OFFSET = -0.12;
  const LABEL_DELAY = 850;
  const ROTATE_SPEED_MS = 26000;

  const state = {
    sceneReady: false,
    arReady: false,
    modelReady: false,
    targetFound: false,
    firstTargetFound: false,
    labelsStarted: false,
    modelPlaced: false,
    baseScale: MODEL_TARGET_SCALE,
    lastVisibleState: false,
    timers: [],
  };

  const dom = {
    loadingScreen: document.getElementById("loading-screen"),
    progressFill: document.getElementById("progress-bar-fill"),
    progressLabel: document.getElementById("progress-label"),
    errorScreen: document.getElementById("error-screen"),
    errorMessage: document.getElementById("error-message"),
    retryButton: document.getElementById("retry-button"),
    scanningOverlay: document.getElementById("scanning-overlay"),
    labelsContainer: document.getElementById("ar-labels-container"),
    labels: {
      triangles: document.getElementById("label-triangles"),
      geometry: document.getElementById("label-geometry"),
      symmetry: document.getElementById("label-symmetry"),
      architecture: document.getElementById("label-architecture"),
    },
    leaderSvg: document.getElementById("leader-line-svg"),
  };

  const scene = document.getElementById("ar-scene");
  const targetRoot = document.getElementById("target-root");
  const templeAnchor = document.getElementById("temple-anchor");
  const templeModelEntity = document.getElementById("temple-model-entity");
  const glowLight = document.getElementById("glow-light");
  const glowRing = document.getElementById("glow-ring");
  const cameraEl = document.getElementById("ar-camera");

  const labelConfigs = {
    triangles: { dx: 120, dy: -55, color: "#ffd700" },
    geometry: { dx: -135, dy: 0, color: "#34d67a" },
    symmetry: { dx: 130, dy: 40, color: "#38e0ff" },
    architecture: { dx: 0, dy: 92, color: "#ff8c3c" },
  };

  const labelAnchorRatios = {
    triangles: 0.92,
    geometry: 0.58,
    symmetry: 0.30,
    architecture: 0.04,
  };

  function setProgress(percent, text) {
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    dom.progressFill.style.width = p + "%";
    dom.progressLabel.textContent = (text || "Loading") + " " + p + "%";
  }

  function showError(message) {
    dom.errorMessage.textContent = message;
    dom.loadingScreen.classList.add("hidden");
    dom.scanningOverlay.classList.add("hidden");
    dom.errorScreen.classList.remove("hidden");
  }

  function hideLoading() {
    dom.loadingScreen.classList.add("hidden");
    dom.scanningOverlay.classList.remove("hidden");
  }

  function clearTimers() {
    state.timers.forEach(window.clearTimeout);
    state.timers.length = 0;
  }

  function hideLabels() {
    Object.values(dom.labels).forEach((el) => el.classList.remove("visible"));
    dom.labelsContainer.classList.add("hidden");
    const existing = dom.leaderSvg.querySelectorAll("line");
    existing.forEach((line) => line.remove());
  }

  function showLabelsSequentially() {
    if (state.labelsStarted) return;
    state.labelsStarted = true;
    dom.labelsContainer.classList.remove("hidden");

    const order = ["triangles", "geometry", "symmetry", "architecture"];
    order.forEach((key, index) => {
      const t = window.setTimeout(() => {
        dom.labels[key].classList.add("visible");
      }, index * LABEL_DELAY);
      state.timers.push(t);
    });
  }

  function setVisibleDebugMessage(msg) {
    if (!DEBUG) return;
    dom.progressLabel.textContent = msg;
  }

  function makeDebugBox() {
    let debugBox = document.getElementById("debug-box");
    if (debugBox) return debugBox;

    debugBox = document.createElement("a-box");
    debugBox.setAttribute("id", "debug-box");
    debugBox.setAttribute("color", "#ff0000");
    debugBox.setAttribute("opacity", "0.9");
    debugBox.setAttribute("position", "0 0.05 0");
    debugBox.setAttribute("scale", "0.08 0.08 0.08");
    debugBox.setAttribute("visible", "true");
    templeAnchor.appendChild(debugBox);
    return debugBox;
  }

  function removeDebugBox() {
    const debugBox = document.getElementById("debug-box");
    if (debugBox && debugBox.parentNode) {
      debugBox.parentNode.removeChild(debugBox);
    }
  }

  function computeWorldBounds(rootObj) {
    const box = new THREE.Box3();
    box.makeEmpty();
    rootObj.updateMatrixWorld(true);

    rootObj.traverse((node) => {
      if (node.isMesh && node.geometry) {
        const geoBox = node.geometry.boundingBox || new THREE.Box3().setFromBufferAttribute(node.geometry.attributes.position);
        if (!node.geometry.boundingBox && node.geometry.attributes && node.geometry.attributes.position) {
          node.geometry.computeBoundingBox();
        }
        box.expandByObject(node);
      }
    });

    return box;
  }

  function placeModel() {
    const mesh = templeModelEntity.getObject3D("mesh");
    if (!mesh) {
      showError("The temple model loaded, but the mesh root is missing. Please reload the page.");
      return;
    }

    templeModelEntity.object3D.position.set(0, 0, 0);
    templeModelEntity.object3D.rotation.set(0, 0, 0);
    templeModelEntity.object3D.scale.set(1, 1, 1);
    templeModelEntity.object3D.updateMatrixWorld(true);

    const box = computeWorldBounds(mesh);
    if (box.isEmpty()) {
      showError("The temple model bounding box is empty. Please check temple.glb.");
      return;
    }

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const horizontal = Math.max(size.x, size.z, 0.0001);
    const scale = MODEL_TARGET_SCALE / horizontal;

    templeModelEntity.object3D.scale.setScalar(scale);
    templeModelEntity.object3D.updateMatrixWorld(true);

    const scaledBox = computeWorldBounds(mesh);
    const scaledCenter = new THREE.Vector3();
    const scaledSize = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);
    scaledBox.getSize(scaledSize);

    templeModelEntity.object3D.position.set(
      -scaledCenter.x,
      -scaledBox.min.y + RISE_Y_OFFSET,
      -scaledCenter.z
    );
    templeModelEntity.object3D.updateMatrixWorld(true);

    state.modelPlaced = true;

    if (DEBUG) {
      console.log("temple bounds", {
        originalSize: size,
        originalCenter: center,
        scale,
        scaledSize,
        scaledBoxMin: scaledBox.min,
        scaledBoxMax: scaledBox.max,
      });
    }

    removeDebugBox();
    state.modelReady = true;
    setProgress(85, "Temple ready");
  }

  function startTempleEffects() {
    if (!state.modelPlaced) return;

    templeAnchor.emit("temple-rise");
    templeAnchor.emit("temple-glow");

    state.timers.push(
      window.setTimeout(() => {
        templeAnchor.emit("temple-rotate-start");
      }, 1200)
    );
  }

  function stopTempleEffects() {
    templeAnchor.emit("temple-rotate-pause");
    clearTimers();
    state.labelsStarted = false;
    hideLabels();
  }

  function setupLabelPositions() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const svg = dom.leaderSvg;
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
  }

  function projectPoint(vec3) {
    const camera = cameraEl.getObject3D("camera");
    if (!camera) return null;

    const p = vec3.clone().project(camera);
    const x = (p.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    return { x, y, z: p.z };
  }

  function updateLabelOverlay() {
    requestAnimationFrame(updateLabelOverlay);

    if (!state.targetFound || !state.modelPlaced) return;

    setupLabelPositions();

    const camera = cameraEl.getObject3D("camera");
    if (!camera) return;

    templeAnchor.object3D.updateMatrixWorld(true);

    const labelDefs = [
      ["triangles", labelAnchorRatios.triangles],
      ["geometry", labelAnchorRatios.geometry],
      ["symmetry", labelAnchorRatios.symmetry],
      ["architecture", labelAnchorRatios.architecture],
    ];

    labelDefs.forEach(([key, ratio]) => {
      const labelEl = dom.labels[key];
      const anchorPoint = new THREE.Vector3(0, state.templeHeight * ratio, 0);
      const worldPoint = templeAnchor.object3D.localToWorld(anchorPoint);

      const projected = projectPoint(worldPoint);
      if (!projected) return;

      const offset = labelConfigs[key];
      const labelX = projected.x + offset.dx;
      const labelY = projected.y + offset.dy;

      labelEl.style.left = labelX + "px";
      labelEl.style.top = labelY + "px";
      labelEl.style.transform = "translate(-50%, -50%)";

      let line = document.getElementById("leader-" + key);
      if (!line) {
        line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("id", "leader-" + key);
        line.setAttribute("stroke", offset.color);
        line.setAttribute("stroke-width", "3");
        line.setAttribute("stroke-linecap", "round");
        dom.leaderSvg.appendChild(line);
      }

      line.setAttribute("x1", projected.x);
      line.setAttribute("y1", projected.y);
      line.setAttribute("x2", labelX);
      line.setAttribute("y2", labelY);
      line.style.opacity = dom.labels[key].classList.contains("visible") ? "1" : "0";
    });
  }

  AFRAME.registerComponent("temple-placement", {
    init: function () {
      this.el.addEventListener("model-loaded", () => {
        state.modelReady = true;
        setProgress(75, "Model loaded");
        placeModel();
      });

      this.el.addEventListener("model-error", (e) => {
        console.error("model-error", e);
        showError("The temple.glb model could not load. Check the file path and reload.");
      });
    },
  });

  AFRAME.registerComponent("target-events", {
    init: function () {
      this.el.addEventListener("targetFound", () => {
        state.targetFound = true;
        dom.scanningOverlay.classList.add("hidden");
        setVisibleDebugMessage("targetFound fired");

        if (!state.firstTargetFound) {
          state.firstTargetFound = true;
          if (state.modelPlaced) {
            startTempleEffects();
            showLabelsSequentially();
          } else {
            const wait = window.setInterval(() => {
              if (state.modelPlaced) {
                window.clearInterval(wait);
                startTempleEffects();
                showLabelsSequentially();
              }
            }, 100);
            state.timers.push(wait);
          }
        } else {
          templeAnchor.emit("temple-rotate-resume");
          showLabelsSequentially();
        }
      });

      this.el.addEventListener("targetLost", () => {
        state.targetFound = false;
        dom.scanningOverlay.classList.remove("hidden");
        stopTempleEffects();
      });
    },
  });

  function boot() {
    setupLabelPositions();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError("This browser does not support camera access. Use Chrome on Android.");
      return;
    }

    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      showError("Camera access requires HTTPS or localhost.");
      return;
    }

    dom.retryButton.addEventListener("click", () => window.location.reload());

    scene.addEventListener("loaded", () => {
      state.sceneReady = true;
      setProgress(25, "Scene ready");
    });

    scene.addEventListener("arReady", () => {
      state.arReady = true;
      setProgress(60, "Camera ready");
      hideLoading();
    });

    scene.addEventListener("arError", () => {
      showError("Could not start the camera. Please allow camera permission and reload.");
    });

    window.addEventListener("resize", setupLabelPositions);

    makeDebugBox();
    setProgress(10, "Starting");
    requestAnimationFrame(updateLabelOverlay);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
