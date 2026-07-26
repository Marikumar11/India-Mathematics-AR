/* ==========================================================================
   India Mathematics AR — main.js
   CBSE Class 6 Mathematics Competition WebAR Experience

   Responsibilities:
     1. Track real loading progress (assets + MindAR readiness).
     2. Handle camera / permission errors gracefully.
     3. Auto-scale and ground the temple.glb model on the marker so it
        never floats, regardless of the model's original size/pivot.
     4. Sequence the "rise + scale + golden glow" reveal, then loop a
        slow rotation forever while the marker is tracked.
     5. Track four educational labels in screen space with leader lines
        that point at real 3D anchor points on the temple, revealing
        them one after another.

   No build step, no modules — plain ES2017+ JavaScript, runs directly
   in the browser via <script src="./main.js"> in index.html.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Constants
     ------------------------------------------------------------------ */

  // Desired horizontal footprint (world units / metres) of the temple
  // once auto-scaled, so it sits neatly within the printed marker.
  const DESIRED_FOOTPRINT = 0.5;

  // Duration (ms) of the rise + scale reveal animation. Must match the
  // `dur` values set on animation__rise / animation__scale in index.html.
  const RISE_DURATION_MS = 1200;

  // Delay (ms) between each label fading in.
  const LABEL_STAGGER_MS = 850;

  // Safety timeout: if MindAR never reports ready (e.g. camera stuck
  // waiting on a permission dialog the user never answers), stop
  // showing a spinning progress bar and surface the error screen.
  const READY_WATCHDOG_MS = 30000;

  /* ------------------------------------------------------------------
     Shared mutable state
     ------------------------------------------------------------------ */

  const AppState = {
    hasAppearedOnce: false, // has the rise animation played at least once?
    anchorsReady: false, // has the model finished loading + been placed?
    isTracking: false, // is the marker currently detected?
    templeHeight: 0, // scaled model height (world units), set after placement
    labelTimers: [], // pending setTimeout ids for the label reveal sequence
  };

  // Local-space anchor points (relative to #temple-anchor) that the
  // labels' leader lines point to. Populated once the model is placed;
  // Y values are fractions of the scaled model height.
  const LabelAnchors = {
    triangles: new AFRAME.THREE.Vector3(),
    geometry: new AFRAME.THREE.Vector3(),
    symmetry: new AFRAME.THREE.Vector3(),
    architecture: new AFRAME.THREE.Vector3(),
  };

  /* ------------------------------------------------------------------
     DOM references
     ------------------------------------------------------------------ */

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

  // Screen-space pixel offset applied from the projected 3D anchor to
  // where each label bubble is drawn, so labels fan out around the
  // temple instead of overlapping each other or the model.
  const LABEL_OFFSETS = {
    triangles: { dx: 110, dy: -40 },
    geometry: { dx: -120, dy: 10 },
    symmetry: { dx: 120, dy: 40 },
    architecture: { dx: 0, dy: 90 },
  };

  const LABEL_COLORS = {
    triangles: "#ffd700",
    geometry: "#34d67a",
    symmetry: "#38e0ff",
    architecture: "#ff8c3c",
  };

  /* ------------------------------------------------------------------
     Loading progress
     ------------------------------------------------------------------ */

  function setProgress(percent, message) {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    dom.progressFill.style.width = clamped + "%";
    dom.progressLabel.textContent = (message || "Loading assets…") + " " + clamped + "%";
  }

  function hideLoadingScreen() {
    dom.loadingScreen.classList.add("hidden");
    dom.scanningOverlay.classList.remove("hidden");
  }

  function showError(message) {
    dom.loadingScreen.classList.add("hidden");
    dom.scanningOverlay.classList.add("hidden");
    dom.errorMessage.textContent = message;
    dom.errorScreen.classList.remove("hidden");
  }

  /* ------------------------------------------------------------------
     Pre-flight checks: secure context is required by getUserMedia in
     every modern browser (HTTPS, or http://localhost during dev).
     ------------------------------------------------------------------ */

  function isSecureContextOk() {
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    return window.isSecureContext || isLocalhost;
  }

  function hasCameraSupport() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /* ------------------------------------------------------------------
     A-Frame component: temple-placement
     Auto-scales and grounds the loaded glTF so it always stands on
     the marker, centred, regardless of the source model's original
     dimensions or pivot point.
     ------------------------------------------------------------------ */

  AFRAME.registerComponent("temple-placement", {
    init: function () {
      this.el.addEventListener("model-loaded", this.placeModel.bind(this));
      this.el.addEventListener("model-error", function () {
        showError(
          "The 3D temple model failed to load. Please check that " +
            "assets/temple.glb exists and reload the page."
        );
      });
    },

    placeModel: function () {
      const mesh = this.el.getObject3D("mesh");
      if (!mesh) return;

      const THREE = AFRAME.THREE;

      // Ensure the entity starts from a neutral transform before we
      // measure it — position/scale are set explicitly here so the
      // math below is predictable no matter what index.html specifies.
      this.el.object3D.position.set(0, 0, 0);
      this.el.object3D.scale.set(1, 1, 1);
      this.el.object3D.rotation.set(0, 0, 0);
      this.el.object3D.updateMatrixWorld(true);

      // Measure the raw model.
      const rawBox = new THREE.Box3().setFromObject(mesh);
      const rawSize = new THREE.Vector3();
      rawBox.getSize(rawSize);

      // Uniform scale factor so the widest horizontal dimension fits
      // the desired footprint on the printed marker.
      const horizontal = Math.max(rawSize.x, rawSize.z) || 1;
      const scaleFactor = DESIRED_FOOTPRINT / horizontal;

      this.el.object3D.scale.set(scaleFactor, scaleFactor, scaleFactor);
      this.el.object3D.updateMatrixWorld(true);

      // Re-measure at the final scale to find exactly how far to shift
      // the model so its lowest point sits at y = 0 (standing on the
      // marker, never floating) and it is centred on X/Z.
      const scaledBox = new THREE.Box3().setFromObject(mesh);
      const scaledCenter = new THREE.Vector3();
      scaledBox.getCenter(scaledCenter);

      this.el.object3D.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);
      this.el.object3D.updateMatrixWorld(true);

      const scaledHeight = scaledBox.max.y - scaledBox.min.y;
      AppState.templeHeight = scaledHeight;

      // Define the four label anchor points relative to #temple-anchor
      // (the parent that also receives the rise/rotate animation), so
      // labels stay attached to the temple wherever it moves/rotates.
      LabelAnchors.triangles.set(0, scaledHeight * 0.93, 0); // upper tower (gopuram)
      LabelAnchors.geometry.set(0, scaledHeight * 0.55, 0); // mid-body carvings
      LabelAnchors.symmetry.set(0, scaledHeight * 0.28, 0); // central vertical axis
      LabelAnchors.architecture.set(0, scaledHeight * 0.02, 0); // base / plinth

      AppState.anchorsReady = true;
    },
  });

  /* ------------------------------------------------------------------
     A-Frame component: target-events
     Wires MindAR's targetFound / targetLost events to the reveal
     animation sequence and the label overlay.
     ------------------------------------------------------------------ */

  AFRAME.registerComponent("target-events", {
    init: function () {
      this.templeAnchor = document.getElementById("temple-anchor");
      this.el.addEventListener("targetFound", this.onTargetFound.bind(this));
      this.el.addEventListener("targetLost", this.onTargetLost.bind(this));
    },

    onTargetFound: function () {
      AppState.isTracking = true;
      dom.scanningOverlay.classList.add("hidden");
      clearLabelTimers();
      hideAllLabels();

      if (!AppState.hasAppearedOnce) {
        // First detection: play the full rise + scale + glow flourish,
        // then start the infinite rotation once it settles.
        AppState.hasAppearedOnce = true;
        this.templeAnchor.emit("temple-rise");
        this.templeAnchor.emit("temple-glow");

        window.setTimeout(() => {
          this.templeAnchor.emit("temple-rotate-start");
          revealLabelsSequentially();
        }, RISE_DURATION_MS);
      } else {
        // Marker re-acquired after briefly losing tracking: resume the
        // rotation from where it paused and replay the label sequence.
        this.templeAnchor.emit("temple-rotate-resume");
        revealLabelsSequentially();
      }
    },

    onTargetLost: function () {
      AppState.isTracking = false;
      dom.scanningOverlay.classList.remove("hidden");
      this.templeAnchor.emit("temple-rotate-pause");
      clearLabelTimers();
      hideAllLabels();
      dom.labelsContainer.classList.add("hidden");
    },
  });

  /* ------------------------------------------------------------------
     Label reveal sequencing
     ------------------------------------------------------------------ */

  function clearLabelTimers() {
    AppState.labelTimers.forEach(window.clearTimeout);
    AppState.labelTimers = [];
  }

  function hideAllLabels() {
    Object.values(dom.labels).forEach((el) => el.classList.remove("visible"));
  }

  function revealLabelsSequentially() {
    dom.labelsContainer.classList.remove("hidden");
    const order = ["triangles", "geometry", "symmetry", "architecture"];
    order.forEach((key, index) => {
      const timerId = window.setTimeout(() => {
        dom.labels[key].classList.add("visible");
      }, index * LABEL_STAGGER_MS);
      AppState.labelTimers.push(timerId);
    });
  }

  /* ------------------------------------------------------------------
     Per-frame screen-space projection of label anchors + leader lines
     ------------------------------------------------------------------ */

  function updateLabelOverlay() {
    requestAnimationFrame(updateLabelOverlay);

    if (!AppState.isTracking || !AppState.anchorsReady) return;

    const sceneEl = document.getElementById("ar-scene");
    const cameraEl = document.getElementById("ar-camera");
    const anchorEl = document.getElementById("temple-anchor");
    if (!sceneEl || !cameraEl || !anchorEl || !sceneEl.renderer) return;

    const camera = cameraEl.getObject3D("camera");
    const renderer = sceneEl.renderer;
    if (!camera || !renderer) return;

    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    if (!width || !height) return;

    const anchorObject3D = anchorEl.object3D;
    anchorObject3D.updateMatrixWorld(true);

    const svgNs = "http://www.w3.org/2000/svg";
    const keys = ["triangles", "geometry", "symmetry", "architecture"];

    keys.forEach((key) => {
      const localPoint = LabelAnchors[key];
      const worldPoint = localPoint.clone();
      anchorObject3D.localToWorld(worldPoint);

      const ndc = worldPoint.clone().project(camera);
      const behindCamera = ndc.z > 1 || ndc.z < -1;

      const screenX = (ndc.x * 0.5 + 0.5) * width;
      const screenY = (-ndc.y * 0.5 + 0.5) * height;

      const labelEl = dom.labels[key];
      const offset = LABEL_OFFSETS[key];
      const labelX = screenX + offset.dx;
      const labelY = screenY + offset.dy;

      if (behindCamera) {
        labelEl.style.opacity = "0";
      } else {
        labelEl.style.transform = "translate(" + labelX + "px, " + labelY + "px) translate(-50%, -50%)";
      }

      updateLeaderLine(key, screenX, screenY, labelX, labelY);
    });
  }

  function updateLeaderLine(key, x1, y1, x2, y2) {
    let line = document.getElementById("leader-" + key);
    if (!line) {
      line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("id", "leader-" + key);
      line.setAttribute("class", "leader-line");
      line.setAttribute("stroke", LABEL_COLORS[key]);
      dom.leaderSvg.appendChild(line);
    }
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
  }

  /* ------------------------------------------------------------------
     Boot sequence
     ------------------------------------------------------------------ */

  function boot() {
    if (!hasCameraSupport()) {
      showError(
        "This browser does not support camera access. Please open " +
          "this page in the latest version of Chrome on Android."
      );
      return;
    }

    if (!isSecureContextOk()) {
      showError(
        "Camera access requires a secure connection. Please open this " +
          "page over HTTPS (or via localhost during development)."
      );
      return;
    }

    setProgress(10, "Starting up");

    const sceneEl = document.getElementById("ar-scene");
    const assetsEl = sceneEl.querySelector("a-assets");

    let watchdog = window.setTimeout(() => {
      showError(
        "The camera is taking longer than expected to start. Please " +
          "check camera permissions and try again."
      );
    }, READY_WATCHDOG_MS);

    assetsEl.addEventListener("loaded", () => {
      setProgress(70, "Preparing temple model");
    });

    sceneEl.addEventListener("loaded", () => {
      setProgress(40, "Initialising AR scene");
    });

    sceneEl.addEventListener("arReady", () => {
      window.clearTimeout(watchdog);
      setProgress(100, "Ready");
      window.setTimeout(hideLoadingScreen, 300);
    });
// TEMPORARY: on-screen debug panel — shows model/tracking status
    // directly on the page so no manual console typing is needed on
    // mobile. Remove this whole block before final submission.
    const debugPanel = document.createElement("div");
    debugPanel.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:99999;" +
      "background:rgba(0,0,0,0.85);color:#0f0;font:12px monospace;" +
      "padding:8px;max-height:40vh;overflow:auto;white-space:pre-wrap;";
    debugPanel.textContent = "Debug panel ready. Point camera at marker…";
    document.body.appendChild(debugPanel);

function updateDebugPanel() {
      const modelEntity = document.getElementById("temple-model-entity");
      const anchor = document.getElementById("temple-anchor");
      const targetRoot = document.getElementById("target-root");
      const camera = document.getElementById("ar-camera");
      const mesh = modelEntity && modelEntity.getObject3D("mesh");
      const renderer = sceneEl.renderer;
      const info = renderer ? renderer.info.render : {};
      const camObj = camera && camera.getObject3D("camera");
      const camPos = camObj ? camObj.getWorldPosition(new AFRAME.THREE.Vector3()) : null;
      const anchorPos = anchor ? anchor.object3D.getWorldPosition(new AFRAME.THREE.Vector3()) : null;
      const lines = [
        "mesh loaded: " + !!mesh,
        "mesh.visible: " + (mesh ? mesh.visible : "n/a"),
        "target visible: " + (targetRoot ? targetRoot.object3D.visible : "n/a"),
        "anchor scale: " + (anchor ? JSON.stringify(anchor.object3D.scale) : "n/a"),
        "anchor world pos: " + (anchorPos ? anchorPos.x.toFixed(2) + "," + anchorPos.y.toFixed(2) + "," + anchorPos.z.toFixed(2) : "n/a"),
        "camera world pos: " + (camPos ? camPos.x.toFixed(2) + "," + camPos.y.toFixed(2) + "," + camPos.z.toFixed(2) : "n/a"),
        "render calls: " + info.calls,
        "triangles drawn: " + info.triangles,
        "anchorsReady: " + AppState.anchorsReady,
        "isTracking: " + AppState.isTracking,
      ];
      debugPanel.textContent = lines.join("\n");
    }
    setInterval(updateDebugPanel, 1000);
    sceneEl.addEventListener("arError", () => {
      window.clearTimeout(watchdog);
      showError(
        "We couldn't access your camera. Please allow camera " +
          "permission for this site and reload the page."
      );
    });

    dom.retryButton.addEventListener("click", () => window.location.reload());

    // Kick off the label-tracking render loop; it self-gates on
    // AppState.isTracking so it is cheap while the marker isn't visible.
    requestAnimationFrame(updateLabelOverlay);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
