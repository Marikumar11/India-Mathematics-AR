(function () {
  "use strict";

  const THREE = AFRAME.THREE;

  const state = {
    targetFound: false,
    modelLoaded: false,
    modelPlaced: false,
    firstRevealDone: false,
    labelsShown: false,
    templeHeight: 0,
    labelTimers: [],
    overlayRAF: 0,
  };

  const CONFIG = {
    modelTargetScale: 0.35,
    riseOffsetY: -0.12,
    labelDelayMs: 850,
    readinessTimeoutMs: 30000,
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
    leaderSvg: document.getElementById("leader-line-svg"),
    labels: {
      triangles: document.getElementById("label-triangles"),
      geometry: document.getElementById("label-geometry"),
      symmetry: document.getElementById("label-symmetry"),
      architecture: document.getElementById("label-architecture"),
    },
  };

  const sceneEl = document.getElementById("ar-scene");
  const templeAnchor = document.getElementById("temple-anchor");
  const templeModelEntity = document.getElementById("temple-model-entity");
  const cameraEl = document.getElementById("ar-camera");

  const LABELS = [
    { key: "triangles", ratio: 0.92, dx: 120, dy: -55, color: "#ffd700" },
    { key: "geometry", ratio: 0.58, dx: -135, dy: 0, color: "#34d67a" },
    { key: "symmetry", ratio: 0.30, dx: 130, dy: 40, color: "#38e0ff" },
    { key: "architecture", ratio: 0.04, dx: 0, dy: 92, color: "#ff8c3c" },
  ];

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

  function clearLabelTimers() {
    state.labelTimers.forEach((id) => window.clearTimeout(id));
    state.labelTimers.length = 0;
  }

  function hideLabels() {
    state.labelsShown = false;
    dom.labelsContainer.classList.add("hidden");
    Object.values(dom.labels).forEach((el) => el.classList.remove("visible"));
    dom.leaderSvg.querySelectorAll("line").forEach((line) => line.remove());
  }

  function showLabelsSequentially() {
    if (state.labelsShown) return;
    state.labelsShown = true;
    dom.labelsContainer.classList.remove("hidden");

    const order = ["triangles", "geometry", "symmetry", "architecture"];
    order.forEach((key, index) => {
      const id = window.setTimeout(() => {
        dom.labels[key].classList.add("visible");
      }, index * CONFIG.labelDelayMs);
      state.labelTimers.push(id);
    });
  }

  function isSecureContextOk() {
    const host = window.location.hostname;
    return window.isSecureContext || host === "localhost" || host === "127.0.0.1";
  }

  function hasCameraSupport() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function getMeshRoot() {
    return templeModelEntity.getObject3D("mesh");
  }

  function computeBounds(root) {
    const box = new THREE.Box3();
    box.makeEmpty();
    root.updateMatrixWorld(true);

    root.traverse((node) => {
      if (node.isMesh && node.geometry) {
        if (!node.geometry.boundingBox) {
          node.geometry.computeBoundingBox();
        }
        box.expandByObject(node);
      }
    });

    return box;
  }

  function normalizeModelMaterials(root) {
    root.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      node.visible = true;
      if (Array.isArray(node.material)) {
        node.material.forEach((mat) => {
          if (!mat) return;
          mat.opacity = 1;
          mat.transparent = false;
          mat.metalness = 0;
          mat.roughness = 1;
          mat.needsUpdate = true;
        });
      } else {
        node.material.opacity = 1;
        node.material.transparent = false;
        node.material.metalness = 0;
        node.material.roughness = 1;
        node.material.needsUpdate = true;
      }
      node.castShadow = false;
      node.receiveShadow = false;
    });
  }

  function placeTempleModel() {
    const meshRoot = getMeshRoot();
    if (!meshRoot) return;

    normalizeModelMaterials(meshRoot);

    templeModelEntity.object3D.position.set(0, 0, 0);
    templeModelEntity.object3D.rotation.set(0, 0, 0);
    templeModelEntity.object3D.scale.set(1, 1, 1);
    templeModelEntity.object3D.updateMatrixWorld(true);

    const rawBox = computeBounds(meshRoot);
    if (rawBox.isEmpty()) {
      showError("The temple model bounds are empty. Please verify temple.glb.");
      return;
    }

    const rawSize = new THREE.Vector3();
    const rawCenter = new THREE.Vector3();
    rawBox.getSize(rawSize);
    rawBox.getCenter(rawCenter);

    const horizontal = Math.max(rawSize.x, rawSize.z, 0.0001);
    const scale = CONFIG.modelTargetScale / horizontal;

    templeModelEntity.object3D.scale.setScalar(scale);
    templeModelEntity.object3D.updateMatrixWorld(true);

    const scaledBox = computeBounds(meshRoot);
    const scaledCenter = new THREE.Vector3();
    const scaledSize = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);
    scaledBox.getSize(scaledSize);

    templeModelEntity.object3D.position.set(
      -scaledCenter.x,
      -scaledBox.min.y + CONFIG.riseOffsetY,
      -scaledCenter.z
    );
    templeModelEntity.object3D.updateMatrixWorld(true);

    state.templeHeight = scaledSize.y;
    state.modelPlaced = true;
    state.modelLoaded = true;
    setProgress(85, "Temple ready");
  }

  function startTempleReveal() {
    templeAnchor.emit("temple-rise");
    templeAnchor.emit("temple-glow");

    window.setTimeout(() => {
      templeAnchor.emit("temple-rotate-start");
      showLabelsSequentially();
    }, 1200);
  }

  function stopTempleReveal() {
    templeAnchor.emit("temple-rotate-pause");
    clearLabelTimers();
    hideLabels();
  }

  function updateLeaderLine(key, x1, y1, x2, y2, color) {
    let line = document.getElementById("leader-" + key);
    if (!line) {
      line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("id", "leader-" + key);
      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", "3");
      line.setAttribute("stroke-linecap", "round");
      dom.leaderSvg.appendChild(line);
    }

    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.style.opacity = dom.labels[key].classList.contains("visible") ? "1" : "0";
  }

  function updateLabelOverlay() {
    state.overlayRAF = window.requestAnimationFrame(updateLabelOverlay);

    if (!state.targetFound || !state.modelPlaced) return;

    const camera = cameraEl.getObject3D("camera");
    if (!camera) return;

    templeAnchor.object3D.updateMatrixWorld(true);

    LABELS.forEach((item) => {
      const labelEl = dom.labels[item.key];
      const localPoint = new THREE.Vector3(0, state.templeHeight * item.ratio, 0);
      const worldPoint = templeAnchor.object3D.localToWorld(localPoint);
      const projected = worldPoint.clone().project(camera);

      const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-projected.y * 0.5 + 0.5) * window.innerHeight;

      const labelX = screenX + item.dx;
      const labelY = screenY + item.dy;

      labelEl.style.left = labelX + "px";
      labelEl.style.top = labelY + "px";
      labelEl.style.transform = "translate(-50%, -50%)";

      updateLeaderLine(item.key, screenX, screenY, labelX, labelY, item.color);
    });
  }

  AFRAME.registerComponent("temple-placement", {
    init: function () {
      this.el.addEventListener("model-loaded", () => {
        placeTempleModel();
      });

      this.el.addEventListener("model-error", () => {
        showError("The temple.glb model could not load. Check the file path and reload.");
      });
    },
  });

  AFRAME.registerComponent("target-events", {
    init: function () {
      this.el.addEventListener("targetFound", () => {
        state.targetFound = true;
        dom.scanningOverlay.classList.add("hidden");

        clearLabelTimers();
        hideLabels();

        if (!state.firstRevealDone && state.modelPlaced) {
          state.firstRevealDone = true;
          startTempleReveal();
        } else if (!state.firstRevealDone) {
          const wait = window.setInterval(() => {
            if (state.modelPlaced) {
              window.clearInterval(wait);
              state.firstRevealDone = true;
              startTempleReveal();
            }
          }, 100);
          state.labelTimers.push(wait);
        } else {
          templeAnchor.emit("temple-rotate-resume");
          showLabelsSequentially();
        }
      });

      this.el.addEventListener("targetLost", () => {
        state.targetFound = false;
        dom.scanningOverlay.classList.remove("hidden");
        stopTempleReveal();
      });
    },
  });

  function boot() {
    if (!hasCameraSupport()) {
      showError("This browser does not support camera access. Use Chrome on Android.");
      return;
    }

    if (!isSecureContextOk()) {
      showError("Camera access requires HTTPS or localhost.");
      return;
    }

    dom.retryButton.addEventListener("click", () => window.location.reload());

    sceneEl.addEventListener("loaded", () => {
      setProgress(25, "Scene ready");
    });

    sceneEl.addEventListener("arReady", () => {
      setProgress(60, "Camera ready");
      hideLoading();
    });

    sceneEl.addEventListener("arError", () => {
      showError("Could not start the camera. Please allow camera permission and reload.");
    });

    window.addEventListener("resize", () => {
      dom.leaderSvg.setAttribute("width", window.innerWidth);
      dom.leaderSvg.setAttribute("height", window.innerHeight);
    });

    dom.leaderSvg.setAttribute("width", window.innerWidth);
    dom.leaderSvg.setAttribute("height", window.innerHeight);

    window.setTimeout(() => {
      if (!state.modelPlaced) {
        setProgress(40, "Waiting for model");
      }
    }, 4000);

    window.setTimeout(() => {
      if (!state.arReady) {
        showError("The camera did not start in time. Please check permission and reload.");
      }
    }, CONFIG.readinessTimeoutMs);

    setProgress(10, "Starting");
    requestAnimationFrame(updateLabelOverlay);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
