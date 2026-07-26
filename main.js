'use strict';

const ui = {
  loadingScreen: document.getElementById('loading-screen'),
  progressBar: document.getElementById('progress-bar'),
  progressText: document.getElementById('progress-text'),
  statusBadge: document.getElementById('status-badge'),
  label1: document.getElementById('label1'),
  label2: document.getElementById('label2'),
  label3: document.getElementById('label3'),
  label4: document.getElementById('label4'),
  line1: document.getElementById('line1'),
  line2: document.getElementById('line2'),
  line3: document.getElementById('line3'),
};

const scene = document.querySelector('a-scene');
const anchor = document.getElementById('anchor');
const templeRig = document.getElementById('templeRig');
const templeWrap = document.getElementById('templeWrap');
const goldGlow = document.getElementById('goldGlow');

const state = {
  trackingVisible: false,
  labelsShown: false,
  templeAnimating: false,
  assetReady: false,
  sceneReady: false,
};

function setProgress(percent, text) {
  const value = Math.max(0, Math.min(100, percent));
  ui.progressBar.style.width = `${value}%`;
  ui.progressText.textContent = text || `Loading ${Math.round(value)}%`;
}

function setStatus(text) {
  ui.statusBadge.textContent = text;
}

function hideLoadingScreen() {
  ui.loadingScreen.classList.add('hidden');
}

function showLabel(labelEl, lineEl) {
  labelEl.classList.add('show');
  if (lineEl) {
    lineEl.classList.add('show');
  }
}

function showSequenceLabels() {
  if (state.labelsShown) return;
  state.labelsShown = true;

  setTimeout(() => showLabel(ui.label1, ui.line1), 250);
  setTimeout(() => showLabel(ui.label2, ui.line2), 1100);
  setTimeout(() => showLabel(ui.label3, ui.line3), 1950);
  setTimeout(() => showLabel(ui.label4, null), 2850);
}

function resetLabels() {
  state.labelsShown = false;
  [ui.label1, ui.label2, ui.label3, ui.label4, ui.line1, ui.line2, ui.line3].forEach((el) => {
    el.classList.remove('show');
  });
}

function startTempleAnimation() {
  if (state.templeAnimating) return;
  state.templeAnimating = true;

  templeRig.setAttribute('animation__rise', {
    property: 'position',
    to: '0 0 0',
    dur: 1800,
    easing: 'easeOutCubic',
    loop: false,
  });

  templeRig.setAttribute('animation__scale', {
    property: 'scale',
    to: '0.62 0.62 0.62',
    dur: 1800,
    easing: 'easeOutBack',
    loop: false,
  });

  templeWrap.setAttribute('animation__spin', {
    property: 'rotation',
    to: '0 540 0',
    dur: 22000,
    easing: 'linear',
    loop: true,
  });

  goldGlow.setAttribute('animation__pulse', {
    property: 'material.opacity',
    dir: 'alternate',
    from: '0.12',
    to: '0.26',
    dur: 1700,
    easing: 'easeInOutSine',
    loop: true,
  });

  goldGlow.setAttribute('animation__glowScale', {
    property: 'scale',
    dir: 'alternate',
    from: '0.92 0.92 0.92',
    to: '1.08 1.08 1.08',
    dur: 1700,
    easing: 'easeInOutSine',
    loop: true,
  });

  setTimeout(showSequenceLabels, 700);
}

function stopTempleAnimation() {
  state.templeAnimating = false;
  templeRig.removeAttribute('animation__rise');
  templeRig.removeAttribute('animation__scale');
  templeWrap.removeAttribute('animation__spin');
  goldGlow.removeAttribute('animation__pulse');
  goldGlow.removeAttribute('animation__glowScale');
  resetLabels();
}

scene.addEventListener('loaded', () => {
  state.sceneReady = true;
  setProgress(35, 'Scene ready');
  setStatus('Loading AR assets...');
});

scene.addEventListener('renderstart', () => {
  setProgress(55, 'Starting renderer');
  setStatus('Requesting camera permission...');
});

scene.addEventListener('arready', () => {
  setProgress(80, 'AR engine ready');
  setStatus('Point the camera at Marker.jpg');
});

scene.addEventListener('artargetfound', () => {
  state.trackingVisible = true;
  setProgress(100, 'Marker detected');
  setStatus('Marker detected');
  hideLoadingScreen();
  startTempleAnimation();
});

scene.addEventListener('artargetlost', () => {
  state.trackingVisible = false;
  setStatus('Scanning for marker...');
  stopTempleAnimation();
});

window.addEventListener('load', () => {
  setProgress(10, 'Initializing project');
  setStatus('Loading interface...');

  const asset = new Image();
  asset.onload = () => {
    state.assetReady = true;
    setProgress(20, 'Assets loaded');
  };
  asset.onerror = () => {
    setStatus('Marker asset check complete');
    setProgress(20, 'Assets loaded');
  };
  asset.src = './assets/Marker.jpg';

  setTimeout(() => {
    if (!state.trackingVisible && !ui.loadingScreen.classList.contains('hidden')) {
      setStatus('Allow camera access to continue');
    }
  }, 1200);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    setStatus('Paused');
  } else if (!state.trackingVisible) {
    setStatus('Scanning for marker...');
  }
});

window.addEventListener('resize', () => {
  if (!state.labelsShown) return;
  if (window.innerWidth <= 768) {
    ui.line1.style.width = '26vw';
    ui.line2.style.width = '24vw';
    ui.line3.style.width = '22vw';
  }
});
