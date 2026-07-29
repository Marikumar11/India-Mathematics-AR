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
  const subtext = document.querySelector('.loader-subtext');

  // --- state ---
  let markerFound = false;
  let labelIndex = 0;
  const labelIds = ['label1', 'label2', 'label3', 'label4'];
  let labelTimers = [];
  let cameraStarted = false;

  // --- wait for A-Frame scene to load ---
  const scene = document.querySelector('a-scene');

  if (!scene) {
    console.error('A-Frame scene not found');
    return;
  }

  // --- helper: update loading progress ---
  function setProgress(value, text) {
    const bar = progressBar.querySelector('span');
    if (bar) {
      const clamped = Math.min(100, Math.max(0, value));
      bar.style.width = clamped + '%';
    }
    if (text && subtext) {
      subtext.textContent = text;
    }
  }

  // --- helper: hide loading overlay ---
  function hideLoading() {
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 600);
    }
  }

  // --- start camera manually ---
  function startCamera() {
    if (cameraStarted) return;
    cameraStarted = true;

    try {
      // Get MindAR system
      const mindarSystem = scene.systems['mindar-image'];
      if (mindarSystem) {
        setProgress(70, 'Starting camera...');
        // Start the AR system
        mindarSystem.start().then(() => {
          console.log('MindAR started successfully');
          setProgress(90, 'Camera ready');
          setTimeout(() => {
            setProgress(100, 'Scanning for marker...');
            hideLoading();
          }, 500);
        }).catch((err) => {
          console.error('Failed to start MindAR:', err);
          setProgress(80, 'Please allow camera access');
          // Retry after 2 seconds
          setTimeout(() => {
            cameraStarted = false;
            startCamera();
          }, 2000);
        });
      } else {
        console.warn('MindAR system not found, retrying...');
        setTimeout(() => {
          cameraStarted = false;
          startCamera();
        }, 1000);
      }
    } catch (err) {
      console.error('Camera start error:', err);
      setProgress(80, 'Camera error - please refresh');
    }
  }

  // --- request camera permission explicitly ---
  async function requestCameraPermission() {
    try {
      setProgress(30, 'Requesting camera permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      stream.getTracks().forEach(track => track.stop());
      setProgress(50, 'Camera permission granted');
      return true;
    } catch (err) {
      console.warn('Camera permission denied:', err);
      setProgress(50, 'Please allow camera access');
      // Show a retry button or message
      return false;
    }
  }

  // --- show labels one after another ---
  function startLabelSequence() {
    labelTimers.forEach(t => clearTimeout(t));
    labelTimers = [];
    labelIndex = 0;

    labelIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('visible', false);
    });

    showNextLabel();
  }

  function showNextLabel() {
    if (labelIndex >= labelIds.length) {
      return;
    }

    const id = labelIds[labelIndex];
    const el = document.getElementById(id);
    if (el) {
      el.setAttribute('visible', true);
      labelIndex++;

      const timer = setTimeout(() => {
        showNextLabel();
      }, 2500);
      labelTimers.push(timer);
    } else {
      labelIndex++;
      showNextLabel();
    }
  }

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
    scene.addEventListener('targetFound', (event) => {
      console.log('Marker detected!');
      if (!markerFound) {
        markerFound = true;
        startLabelSequence();

        const templeGroup = document.getElementById('temple-group');
        if (templeGroup) {
          templeGroup.removeAttribute('animation__rise');
          templeGroup.removeAttribute('animation__scale');

          templeGroup.setAttribute('animation__rise', {
            property: 'position',
            from: '0 -0.5 0',
            to: '0 0 0',
            dur: 1200,
            easing: 'easeOutCubic'
          });

          templeGroup.setAttribute('animation__scale', {
            property: 'scale',
            from: '0.1 0.1 0.1',
            to: '0.85 0.85 0.85',
            dur: 1400,
            easing: 'easeOutElastic',
            elasticity: 300
          });
        }

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
      resetLabels();
    });
  }

  // --- init ---
  async function init() {
    setProgress(10, 'Loading...');
    overlay.style.display = 'flex';

    // Wait for scene to load
    if (!scene.hasLoaded) {
      await new Promise(resolve => {
        scene.addEventListener('loaded', resolve);
      });
    }
    setProgress(30, 'Scene loaded');

    // Request camera permission
    const hasPermission = await requestCameraPermission();
    
    // Setup marker detection
    setupMarkerDetection();
    setProgress(60, 'Setting up AR...');

    // Start camera after a short delay
    setTimeout(() => {
      startCamera();
    }, 500);

    // Fallback: hide loading after 10 seconds even if camera doesn't start
    setTimeout(() => {
      if (overlay.style.display !== 'none') {
        hideLoading();
      }
    }, 10000);
  }

  // --- start ---
  init().catch(err => {
    console.error('Init error:', err);
    setTimeout(hideLoading, 3000);
  });

  // --- handle visibility change (pause/resume) ---
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Pause AR when tab is hidden
      const mindarSystem = scene.systems['mindar-image'];
      if (mindarSystem && mindarSystem.isRunning) {
        mindarSystem.stop();
      }
    } else {
      // Resume AR when tab is visible
      const mindarSystem = scene.systems['mindar-image'];
      if (mindarSystem && !mindarSystem.isRunning) {
        mindarSystem.start();
      }
    }
  });

  console.log('India Mathematics AR initialized');
})();
