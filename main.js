/**
 * India Mathematics AR
 * Main application script for MindAR + A-Frame
 * Handles loading, camera permissions, marker detection, animations, and labels
 */

(function() {
  'use strict';

  // --- DOM refs ---
  const overlay = document.getElementById('loading-overlay');
  const progressBar = document.getElementById('progress-bar');

  // --- state ---
  let markerFound = false;
  let labelIndex = 0;
  const labelIds = ['label1', 'label2', 'label3', 'label4'];
  let labelTimers = [];

  // --- wait for A-Frame scene to load ---
  const scene = document.querySelector('a-scene');

  if (!scene) {
    console.error('A-Frame scene not found');
    return;
  }

  // --- helper: update loading progress ---
  function setProgress(value) {
    const bar = progressBar.querySelector('span');
    if (bar) {
      const clamped = Math.min(100, Math.max(0, value));
      bar.style.width = clamped + '%';
    }
  }

  // --- helper: hide loading overlay ---
  function hideLoading() {
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 500);
    }
  }

  // --- request camera permission explicitly (Chrome/Android) ---
  async function requestCameraPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // release immediately, MindAR will re-acquire
      return true;
    } catch (err) {
      console.warn('Camera permission denied or error:', err);
      // fallback: let MindAR handle it
      return false;
    }
  }

  // --- show labels one after another ---
  function startLabelSequence() {
    // clear any pending timers
    labelTimers.forEach(t => clearTimeout(t));
    labelTimers = [];
    labelIndex = 0;

    // hide all labels first
    labelIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('visible', false);
    });

    // show first label immediately
    showNextLabel();
  }

  function showNextLabel() {
    if (labelIndex >= labelIds.length) {
      // all labels shown
      return;
    }

    const id = labelIds[labelIndex];
    const el = document.getElementById(id);
    if (el) {
      el.setAttribute('visible', true);
      // add a small fade-in via A-Frame animation (optional)
      // but we just set visible
      labelIndex++;

      // schedule next label after 2.5 seconds
      const timer = setTimeout(() => {
        showNextLabel();
      }, 2500);
      labelTimers.push(timer);
    } else {
      // if element not found, skip
      labelIndex++;
      showNextLabel();
    }
  }

  // --- reset labels (when marker lost) ---
  function resetLabels() {
    labelTimers.forEach(t => clearTimeout(t));
    labelTimers = [];
    labelIndex = 0;
    labelIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('visible', false);
    });
  }

  // --- handle marker detection ---
  function setupMarkerDetection() {
    // MindAR fires events on the a-scene
    scene.addEventListener('targetFound', (event) => {
      console.log('Marker detected!');
      if (!markerFound) {
        markerFound = true;
        // start label sequence
        startLabelSequence();

        // trigger temple rise + scale animation via A-Frame animation
        const templeGroup = document.getElementById('temple-group');
        if (templeGroup) {
          // remove any existing animation components to avoid conflicts
          templeGroup.removeAttribute('animation__rise');
          templeGroup.removeAttribute('animation__scale');

          // rise from ground (y: -0.5 -> 0)
          templeGroup.setAttribute('animation__rise', {
            property: 'position',
            from: '0 -0.5 0',
            to: '0 0 0',
            dur: 1200,
            easing: 'easeOutCubic'
          });

          // scale from 0 to 0.8 (with slight overshoot)
          templeGroup.setAttribute('animation__scale', {
            property: 'scale',
            from: '0.1 0.1 0.1',
            to: '0.85 0.85 0.85',
            dur: 1400,
            easing: 'easeOutElastic',
            elasticity: 300
          });
        }

        // start rotation animation (continuous)
        const model = document.getElementById('temple-model');
        if (model) {
          model.removeAttribute('animation__rotate');
          model.setAttribute('animation__rotate', {
            property: 'rotation',
            from: '0 0 0',
            to: '0 360 0',
            dur: 20000,
            easing: 'linear',
            loop: true
          });
        }
      }
    });

    scene.addEventListener('targetLost', () => {
      console.log('Marker lost');
      markerFound = false;
      // reset labels
      resetLabels();

      // optional: reset temple position/scale (but we keep it visible)
      // we can also pause rotation if needed, but we keep it rotating
    });
  }

  // --- force camera permissions and start ---
  async function init() {
    // show loading
    setProgress(10);
    overlay.style.display = 'flex';

    // request camera permission
    await requestCameraPermission();
    setProgress(30);

    // wait for scene to be ready
    if (!scene.hasLoaded) {
      await new Promise(resolve => {
        scene.addEventListener('loaded', resolve);
      });
    }
    setProgress(60);

    // setup marker detection
    setupMarkerDetection();
    setProgress(80);

    // additional loading: wait for model to load (optional)
    const model = document.getElementById('temple-model');
    if (model) {
      // wait for model loaded event
      await new Promise((resolve) => {
        if (model.components && model.components['gltf-model'] && model.components['gltf-model'].data) {
          // already loaded
          resolve();
        } else {
          model.addEventListener('model-loaded', resolve, { once: true });
          // fallback timeout
          setTimeout(resolve, 5000);
        }
      });
    }
    setProgress(100);

    // hide loading overlay after a short delay
    setTimeout(() => {
      hideLoading();
    }, 400);
  }

  // --- start the app ---
  init().catch(err => {
    console.error('Initialization error:', err);
    // still hide loading after a while
    setTimeout(hideLoading, 3000);
  });

  // --- handle window resize for better responsiveness ---
  window.addEventListener('resize', () => {
    // no-op, but keeps compatibility
  });

  // --- handle errors globally ---
  window.addEventListener('error', (e) => {
    console.warn('Global error caught:', e.message);
  });

  // --- expose for debugging (optional) ---
  window.__ar = {
    scene,
    resetLabels,
    startLabelSequence
  };

  console.log('India Mathematics AR initialized');
})();
