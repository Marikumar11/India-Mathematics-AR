/**
 * India Mathematics AR
 * Main application script
 */

(function() {
  'use strict';

  const overlay = document.getElementById('loading-overlay');
  const progressBar = document.getElementById('progress-bar');
  const statusText = document.getElementById('status-text');
  const scene = document.querySelector('a-scene');

  let markerFound = false;
  let labelIndex = 0;
  const labelIds = ['label1', 'label2', 'label3', 'label4'];
  let labelTimers = [];

  function setProgress(value, text) {
    const bar = progressBar.querySelector('span');
    if (bar) {
      bar.style.width = Math.min(100, Math.max(0, value)) + '%';
    }
    if (text && statusText) {
      statusText.textContent = text;
    }
  }

  function hideLoading() {
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 600);
    }
  }

  function showNextLabel() {
    if (labelIndex >= labelIds.length) return;

    const id = labelIds[labelIndex];
    const el = document.getElementById(id);
    if (el) {
      el.setAttribute('visible', true);
      labelIndex++;
      const timer = setTimeout(showNextLabel, 2500);
      labelTimers.push(timer);
    } else {
      labelIndex++;
      showNextLabel();
    }
  }

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

  function resetLabels() {
    labelTimers.forEach(t => clearTimeout(t));
    labelTimers = [];
    labelIndex = 0;
    labelIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('visible', false);
    });
  }

  function setupMarkerDetection() {
    scene.addEventListener('targetFound', (event) => {
      console.log('✅ Marker detected!');
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
      console.log('❌ Marker lost');
      markerFound = false;
      resetLabels();
    });
  }

  async function init() {
    setProgress(10, 'Loading...');
    overlay.style.display = 'flex';

    // Wait for scene
    if (!scene.hasLoaded) {
      await new Promise(resolve => {
        scene.addEventListener('loaded', resolve);
      });
    }
    setProgress(30, 'Scene loaded');

    // Request camera
    try {
      setProgress(40, 'Requesting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      stream.getTracks().forEach(track => track.stop());
      setProgress(60, 'Camera ready');
    } catch (err) {
      console.warn('Camera permission error:', err);
      setProgress(60, 'Please allow camera access');
    }

    // Setup marker detection
    setupMarkerDetection();
    setProgress(80, 'Starting AR...');

    // Wait for MindAR system
    let mindarSystem = scene.systems['mindar-image'];
    if (!mindarSystem) {
      await new Promise(resolve => {
        const checkSystem = setInterval(() => {
          mindarSystem = scene.systems['mindar-image'];
          if (mindarSystem) {
            clearInterval(checkSystem);
            resolve();
          }
        }, 100);
      });
    }

    // Start MindAR
    try {
      await mindarSystem.start();
      console.log('✅ MindAR started');
      setProgress(100, 'Scanning for marker...');
      setTimeout(hideLoading, 500);
    } catch (err) {
      console.error('Failed to start MindAR:', err);
      setProgress(90, 'Retrying...');
      // Retry after 2 seconds
      setTimeout(() => {
        mindarSystem.start().then(() => {
          console.log('✅ MindAR started on retry');
          setProgress(100, 'Scanning for marker...');
          setTimeout(hideLoading, 500);
        }).catch(() => {
          setProgress(95, 'Tap to start camera');
          // Add tap handler
          document.addEventListener('click', () => {
            mindarSystem.start();
          }, { once: true });
        });
      }, 2000);
    }
  }

  // Start
  init().catch(err => {
    console.error('Init error:', err);
    setTimeout(hideLoading, 5000);
  });

  // Handle visibility change
  document.addEventListener('visibilitychange', () => {
    const mindarSystem = scene.systems['mindar-image'];
    if (document.hidden && mindarSystem && mindarSystem.isRunning) {
      mindarSystem.stop();
    } else if (!document.hidden && mindarSystem && !mindarSystem.isRunning) {
      mindarSystem.start();
    }
  });

  console.log('🚀 India Mathematics AR initialized');
})();
