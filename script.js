/* ==========================================================================
   KOLAM — Where Mathematics Becomes Art
   Master Frontend Logic (Vanilla JS)
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. Global State & Configuration
// --------------------------------------------------------------------------
const API_BASE_URL = "http://localhost:8000";
const DEMO_MODE = false; // Fallback procedural generator active if backend offline

let isBackendOnline = false;
let currentPromptHistory = [];
let selectedImageFile = null;
let compressedImageDataUrl = null;
let currentResultImageDataUrl = null;

let speechRecognition = null;
let isListening = false;
let currentVoiceTranscript = "";

let kolamFacts = [];
let factIntervalTimer = null;
let loadingTimeoutTimer = null;

// Community Wall State
let communitySelectedImageDataUrl = null;
const COMMUNITY_STORAGE_KEY = 'kolam_community_state';

// --------------------------------------------------------------------------
// 2. Application Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initIntroSplash();
  initNavigation();
  initHeroCanvas();
  initVoiceChat();
  initCommunity();
  loadFacts();
  checkBackendHealth();
  initLoadingOverlayPetals();

  // Periodic health check every 15 seconds
  setInterval(checkBackendHealth, 15000);
});

// --------------------------------------------------------------------------
// 2b. Entry Splash — Kolam Drawing Ritual (auto-dismisses, no button)
// --------------------------------------------------------------------------
const SPLASH_DURATION_MS = 10000;

function initIntroSplash() {
  const splash = document.getElementById('intro-splash');
  if (!splash) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dotsGroup = document.getElementById('splash-dots');
  const linesGroup = document.getElementById('splash-lines');
  const statusText = document.getElementById('intro-splash-status-text');
  const titleWord = document.getElementById('intro-splash-title-word');

  // ---- 0. Center title: KOLAM cycles English → Hindi → Tamil every 3.33s ----
  const titleCycle = [
    { text: 'KOLAM', lang: 'en' },
    { text: 'कोलम्', lang: 'hi' },
    { text: 'கோலம்', lang: 'ta' },
  ];
  let titleIndex = 0;
  let titleTimer = null;
  if (titleWord && !prefersReducedMotion) {
    titleTimer = setInterval(() => {
      titleIndex = (titleIndex + 1) % titleCycle.length;
      titleWord.classList.add('is-switching');
      setTimeout(() => {
        titleWord.textContent = titleCycle[titleIndex].text;
        titleWord.setAttribute('lang', titleCycle[titleIndex].lang);
        titleWord.classList.remove('is-switching');
      }, 280);
    }, 3333);
  }

  // ---- 1. Build a 5x5 Pulli (dot) grid, in the order a Kolam artist places them ----
  const GRID = [60, 105, 150, 195, 240];
  const dots = [];
  GRID.forEach(y => GRID.forEach(x => dots.push({ x, y })));

  // Center-outward placement order feels more like a hand actually drawing it
  dots.sort((a, b) => {
    const da = Math.hypot(a.x - 150, a.y - 150);
    const db = Math.hypot(b.x - 150, b.y - 150);
    return da - db;
  });

  const DOT_PHASE_START = 0.9;   // seconds
  const DOT_PHASE_END = 3.2;     // seconds
  const dotStep = (DOT_PHASE_END - DOT_PHASE_START) / dots.length;

  dots.forEach((d, i) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', d.x);
    circle.setAttribute('cy', d.y);
    circle.setAttribute('r', 3.4);
    circle.setAttribute('fill', 'var(--gold)');
    circle.classList.add('splash-dot');
    circle.style.animationDelay = `${(DOT_PHASE_START + i * dotStep).toFixed(2)}s`;
    dotsGroup.appendChild(circle);
  });

  // ---- 2. Trace the continuous looping line (Kambi) around the dots ----
  // Four petal loops radiating from the center dot, then an outer border loop
  // that ties the whole pulli grid together — the way a real Kolam is closed.
  const kolamPaths = [
    { d: 'M 150 150 C 108 138, 84 90, 150 60 C 216 90, 192 138, 150 150', color: 'var(--terracotta)', width: 3 },
    { d: 'M 150 150 C 162 108, 210 84, 240 150 C 210 216, 162 192, 150 150', color: 'var(--terracotta)', width: 3 },
    { d: 'M 150 150 C 192 162, 216 210, 150 240 C 84 210, 108 162, 150 150', color: 'var(--terracotta)', width: 3 },
    { d: 'M 150 150 C 138 192, 90 216, 60 150 C 90 84, 138 108, 150 150', color: 'var(--terracotta)', width: 3 },
    { d: 'M 60 60 Q 150 20 240 60 Q 280 150 240 240 Q 150 280 60 240 Q 20 150 60 60 Z', color: 'var(--maroon)', width: 2.5 },
  ];

  const LINE_PHASE_START = 3.4;  // seconds, right after the last dot lands
  const LINE_PHASE_END = 8.6;    // seconds
  const perPathDuration = 1.15;
  const lineStep = (LINE_PHASE_END - LINE_PHASE_START - perPathDuration) / (kolamPaths.length - 1);

  kolamPaths.forEach((p, i) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', p.d);
    path.setAttribute('pathLength', '1');
    path.setAttribute('stroke', p.color);
    path.setAttribute('stroke-width', p.width);
    path.classList.add('splash-path');
    const delay = LINE_PHASE_START + i * lineStep;
    path.style.animationDelay = `${delay.toFixed(2)}s`;
    path.style.animationDuration = `${perPathDuration}s`;
    linesGroup.appendChild(path);
  });

  // ---- 2b. Four corner Kolam motifs — a small looped flower around a mini pulli grid ----
  const cornerSvgs = document.querySelectorAll('.intro-corner-svg');
  const CORNER_GRID = [20, 60, 100];
  const cornerDots = [];
  CORNER_GRID.forEach(y => CORNER_GRID.forEach(x => cornerDots.push({ x, y })));
  const cornerPaths = [
    'M 60 60 C 40 52, 30 30, 60 20 C 90 30, 80 52, 60 60',
    'M 60 60 C 68 40, 90 30, 100 60 C 90 90, 68 80, 60 60',
    'M 60 60 C 80 68, 90 90, 60 100 C 30 90, 40 68, 60 60',
    'M 60 60 C 52 80, 30 90, 20 60 C 30 30, 52 40, 60 60',
    'M 20 20 Q 60 6 100 20 Q 114 60 100 100 Q 60 114 20 100 Q 6 60 20 20 Z',
  ];

  cornerSvgs.forEach((svg, ci) => {
    const dotsG = svg.querySelector('.corner-dots');
    const linesG = svg.querySelector('.corner-lines');
    const baseDelay = 4.6 + ci * 0.35;

    cornerDots.forEach((d, i) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', d.x);
      c.setAttribute('cy', d.y);
      c.setAttribute('r', 2.2);
      c.setAttribute('fill', 'var(--gold)');
      c.classList.add('corner-dot');
      c.style.animationDelay = `${(baseDelay + i * 0.09).toFixed(2)}s`;
      dotsG.appendChild(c);
    });

    const lineStart = baseDelay + cornerDots.length * 0.09 + 0.15;
    cornerPaths.forEach((d, i) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('pathLength', '1');
      p.setAttribute('stroke', i === cornerPaths.length - 1 ? 'var(--maroon)' : 'var(--terracotta)');
      p.setAttribute('stroke-width', i === cornerPaths.length - 1 ? 2 : 2.2);
      p.classList.add('corner-path');
      p.style.animationDelay = `${(lineStart + i * 0.32).toFixed(2)}s`;
      p.style.animationDuration = '0.55s';
      linesG.appendChild(p);
    });
  });

  // ---- 3. Narrate the drawing as it happens ----
  const statusBeats = [
    { t: 0,    msg: 'Placing the pulli…' },
    { t: DOT_PHASE_END + 0.1, msg: 'Tracing the first loop…' },
    { t: LINE_PHASE_START + perPathDuration + lineStep, msg: 'Closing the pattern…' },
    { t: LINE_PHASE_END, msg: 'Kolam complete.' },
  ];
  const statusTimers = statusBeats.map(b =>
    setTimeout(() => { if (statusText) statusText.textContent = b.msg; }, b.t * 1000)
  );

  // ---- 4. Pulli progress trail — one dot lights per second across the 10s ----
  const dotsRow = document.getElementById('intro-splash-dots');
  const PROGRESS_DOT_COUNT = 10;
  const progressDots = [];
  if (dotsRow) {
    for (let i = 0; i < PROGRESS_DOT_COUNT; i++) {
      const d = document.createElement('span');
      d.classList.add('intro-splash-progress-dot');
      dotsRow.appendChild(d);
      progressDots.push(d);
    }
  }
  let dotProgressTimer = null;
  if (prefersReducedMotion) {
    progressDots.forEach(d => d.classList.add('is-lit'));
  } else {
    let litCount = 0;
    dotProgressTimer = setInterval(() => {
      if (litCount < progressDots.length) {
        progressDots[litCount].classList.add('is-lit');
        litCount++;
      }
    }, SPLASH_DURATION_MS / PROGRESS_DOT_COUNT);
  }

  // ---- 5. Falling flower petals — ambient, continuous for the life of the splash ----
  const petalContainer = document.getElementById('intro-splash-petals');
  if (petalContainer && !prefersReducedMotion) {
    const petalColors = ['var(--terracotta)', 'var(--gold)', 'var(--maroon)', 'var(--saffron)'];
    const rand = (min, max) => Math.random() * (max - min) + min;
    for (let i = 0; i < 14; i++) {
      const petal = document.createElement('span');
      petal.classList.add('intro-petal');
      petal.style.setProperty('--left', `${rand(2, 96)}%`);
      petal.style.setProperty('--size', `${rand(8, 15).toFixed(1)}px`);
      petal.style.setProperty('--duration', `${rand(5, 9).toFixed(2)}s`);
      petal.style.setProperty('--delay', `${rand(0, 5).toFixed(2)}s`);
      petal.style.setProperty('--rot', `${rand(0, 360).toFixed(0)}deg`);
      petal.style.setProperty('--sway', `${rand(-45, 45).toFixed(0)}px`);
      petal.style.background = petalColors[i % petalColors.length];
      petalContainer.appendChild(petal);
    }
  }

  // ---- 6. Cursor parallax on the center kolam + a trailing shimmer of gold dust ----
  const canvasWrap = document.getElementById('intro-splash-canvas-wrap');
  let parallaxRAF = null;
  let pointerHandler = null;
  if (!prefersReducedMotion) {
    const target = { nx: 0, ny: 0 };
    const current = { nx: 0, ny: 0 };
    let lastDustTime = 0;

    const spawnGoldDust = (x, y) => {
      const p = document.createElement('span');
      p.className = 'gold-dust-particle';
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      splash.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    };

    pointerHandler = (e) => {
      const rect = splash.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      target.nx = (x / rect.width - 0.5) * 2;
      target.ny = (y / rect.height - 0.5) * 2;

      const now = performance.now();
      if (now - lastDustTime > 55) {
        lastDustTime = now;
        spawnGoldDust(x, y);
      }
    };
    splash.addEventListener('pointermove', pointerHandler);

    const parallaxLoop = () => {
      current.nx += (target.nx - current.nx) * 0.08;
      current.ny += (target.ny - current.ny) * 0.08;
      if (canvasWrap) {
        canvasWrap.style.transform =
          `translate(${(current.nx * 8).toFixed(2)}px, ${(current.ny * 8).toFixed(2)}px) rotate(${(current.nx * 1.5).toFixed(2)}deg)`;
      }
      parallaxRAF = requestAnimationFrame(parallaxLoop);
    };
    parallaxRAF = requestAnimationFrame(parallaxLoop);
  }

  // ---- 7. Reveal the dashboard automatically — no dismiss button ----
  const totalDelay = prefersReducedMotion ? 2000 : SPLASH_DURATION_MS;
  setTimeout(() => {
    splash.classList.add('is-hiding');
    document.body.classList.remove('splash-locked');
    if (titleTimer) clearInterval(titleTimer);
    if (dotProgressTimer) clearInterval(dotProgressTimer);
    if (parallaxRAF) cancelAnimationFrame(parallaxRAF);
    if (pointerHandler) splash.removeEventListener('pointermove', pointerHandler);
    setTimeout(() => {
      splash.remove();
      statusTimers.forEach(clearTimeout);
    }, 900);
  }, totalDelay);
}

// --------------------------------------------------------------------------
// 3. Navigation & Health Check Logic
// --------------------------------------------------------------------------
function initNavigation() {
  const links = document.querySelectorAll('.nav-link');
  links.forEach(link => {
    link.addEventListener('click', function() {
      links.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
    });
  });

  const toggleBtn = document.getElementById('nav-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const navLinks = document.querySelector('.nav-links');
      navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '70px';
      navLinks.style.right = '20px';
      navLinks.style.background = 'var(--bg-card)';
      navLinks.style.padding = '20px';
      navLinks.style.borderRadius = 'var(--radius-md)';
      navLinks.style.boxShadow = 'var(--shadow-lg)';
    });
  }
}

async function checkBackendHealth() {
  const badge = document.getElementById('health-badge');
  const badgeText = document.getElementById('health-text');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      isBackendOnline = true;
      badge.classList.remove('offline');
      badgeText.textContent = "Engine Online";
    } else {
      throw new Error("Backend return non-200");
    }
  } catch (err) {
    isBackendOnline = false;
    badge.classList.add('offline');
    badgeText.textContent = "Offline (Demo Active)";
  }
}

// Node Selection Handler (DOT 01, DOT 02, DOT 03)
function selectNode(nodeType) {
  // Update node active styling
  document.querySelectorAll('.kolam-node').forEach(node => node.classList.remove('active'));
  const activeNode = document.getElementById(`node-${nodeType}`);
  if (activeNode) activeNode.classList.add('active');

  // Switch active workspace panel
  document.querySelectorAll('.workspace-panel').forEach(panel => panel.classList.remove('active'));
  const targetPanel = document.getElementById(`workspace-${nodeType}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
    targetPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// --------------------------------------------------------------------------
// 4. Hero Section Canvas Animation ("THE FIRST DOT")
// --------------------------------------------------------------------------
function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  let time = 0;
  function animate() {
    time += 0.015;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const gridSize = 5;
    const spacing = Math.min(canvas.width, canvas.height) * 0.08;

    // 1. Draw Grid Dots
    ctx.fillStyle = 'rgba(200, 90, 50, 0.4)';
    for (let r = -Math.floor(gridSize/2); r <= Math.floor(gridSize/2); r++) {
      for (let c = -Math.floor(gridSize/2); c <= Math.floor(gridSize/2); c++) {
        const x = centerX + c * spacing;
        const y = centerY + r * spacing;
        const pulse = Math.sin(time * 2 + (r+c)) * 2;
        
        ctx.beginPath();
        ctx.arc(x, y, 4 + pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Draw Animated Symmetrical Kolam Curves
    ctx.strokeStyle = 'rgba(107, 29, 47, 0.35)';
    ctx.lineWidth = 2.5;

    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i + time * 0.2;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      
      const wave = Math.sin(time * 1.5) * 30;
      ctx.bezierCurveTo(
        spacing * 1.2, spacing * 0.5 + wave,
        spacing * 1.8, spacing * 1.5 - wave,
        spacing * 2, 0
      );
      ctx.bezierCurveTo(
        spacing * 1.8, -spacing * 1.5 + wave,
        spacing * 1.2, -spacing * 0.5 - wave,
        0, 0
      );
      ctx.stroke();

      // Outer Loop
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
      ctx.beginPath();
      ctx.arc(spacing * 1.5, 0, spacing * 0.7 + Math.sin(time)*5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    requestAnimationFrame(animate);
  }
  animate();
}

// --------------------------------------------------------------------------
// 5. Voice Chat Mode (Web Speech API)
// --------------------------------------------------------------------------
function initVoiceChat() {
  const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognitionApi) {
    const statusText = document.getElementById('voice-status');
    if (statusText) statusText.textContent = "Speech API not supported in browser";
    return;
  }

  speechRecognition = new SpeechRecognitionApi();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = true;
  speechRecognition.lang = 'en-US';

  speechRecognition.onstart = () => {
    isListening = true;
    updateVoiceUI(true);
  };

  speechRecognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    currentVoiceTranscript = transcript;
    const box = document.getElementById('voice-transcript');
    if (box) box.innerHTML = `<strong>Transcript:</strong> "${transcript}"`;
  };

  speechRecognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
    stopVoiceRecognition();
    showToast("Voice recognition error: " + event.error, "error");
  };

  speechRecognition.onend = () => {
    isListening = false;
    updateVoiceUI(false);
  };
}

function toggleVoiceRecognition() {
  if (isListening) {
    stopVoiceRecognition();
  } else {
    startVoiceRecognition();
  }
}

function startVoiceRecognition() {
  if (!speechRecognition) {
    showToast("Web Speech API not supported on this browser.", "error");
    return;
  }
  try {
    currentVoiceTranscript = "";
    speechRecognition.start();
  } catch (err) {
    console.warn(err);
  }
}

function stopVoiceRecognition() {
  if (speechRecognition && isListening) {
    speechRecognition.stop();
  }
  isListening = false;
  updateVoiceUI(false);
}

function updateVoiceUI(listening) {
  const btn = document.getElementById('mic-btn');
  const icon = document.getElementById('mic-icon');
  const status = document.getElementById('voice-status');
  const ring1 = document.getElementById('mic-ring-1');
  const ring2 = document.getElementById('mic-ring-2');

  if (listening) {
    if (btn) btn.classList.add('listening');
    if (icon) icon.className = "fa-solid fa-microphone-slash";
    if (status) status.textContent = "◉ LISTENING...";
    if (ring1) ring1.classList.add('pulsing');
    if (ring2) ring2.classList.add('pulsing');
  } else {
    if (btn) btn.classList.remove('listening');
    if (icon) icon.className = "fa-solid fa-microphone";
    if (status) status.textContent = currentVoiceTranscript ? "✓ TRANSCRIPT READY" : "● READY TO LISTEN";
    if (ring1) ring1.classList.remove('pulsing');
    if (ring2) ring2.classList.remove('pulsing');
  }
}

function submitVoicePrompt() {
  if (!currentVoiceTranscript) {
    showToast("Please speak a prompt first!", "error");
    return;
  }
  generateKolamFlow(currentVoiceTranscript);
}

// --------------------------------------------------------------------------
// 6. Text Chat Mode
// --------------------------------------------------------------------------
function applySuggestion(text) {
  const textarea = document.getElementById('text-prompt');
  if (textarea) textarea.value = text;
}

function submitTextPrompt() {
  const textarea = document.getElementById('text-prompt');
  if (!textarea || !textarea.value.trim()) {
    showToast("Please enter a prompt first!", "error");
    return;
  }
  
  const prompt = textarea.value.trim();
  appendChatBubble(prompt, 'user');
  textarea.value = '';
  
  generateKolamFlow(prompt);
}

function appendChatBubble(text, sender) {
  const historyContainer = document.getElementById('chat-history');
  if (!historyContainer) return;
  
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  bubble.textContent = text;
  historyContainer.appendChild(bubble);
  historyContainer.scrollTop = historyContainer.scrollHeight;
}

// --------------------------------------------------------------------------
// 7. Upload & Restore Mode (Client-Side Compression)
// --------------------------------------------------------------------------
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) processSelectedImage(file);
}

// Drag & Drop Setup
const dropzone = document.getElementById('restore-dropzone');
if (dropzone) {
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) processSelectedImage(file);
  });
}

function processSelectedImage(file) {
  if (!file.type.startsWith('image/')) {
    showToast("Please select a valid image file.", "error");
    return;
  }

  selectedImageFile = file;

  // Client-Side Canvas Image Compression (Max 1024px, JPEG 80%)
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 1024;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      compressedImageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      const previewImg = document.getElementById('restore-preview-img');
      const previewContainer = document.getElementById('restore-preview-container');
      const submitBtn = document.getElementById('btn-restore-submit');

      if (previewImg) previewImg.src = compressedImageDataUrl;
      if (previewContainer) previewContainer.style.display = 'block';
      if (submitBtn) submitBtn.style.display = 'inline-flex';
      
      showToast("Image processed and compressed client-side!", "success");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearSelectedImage() {
  selectedImageFile = null;
  compressedImageDataUrl = null;
  const previewContainer = document.getElementById('restore-preview-container');
  const submitBtn = document.getElementById('btn-restore-submit');
  if (previewContainer) previewContainer.style.display = 'none';
  if (submitBtn) submitBtn.style.display = 'none';
}

function submitImageRestoration() {
  if (!compressedImageDataUrl) {
    showToast("Please upload an image first!", "error");
    return;
  }
  restoreKolamFlow(compressedImageDataUrl);
}

// --------------------------------------------------------------------------
// 8. Main API Client & Workflow Orchestration
// --------------------------------------------------------------------------
async function loadFacts() {
  try {
    const res = await fetch('data/kolam-facts.json');
    if (res.ok) {
      kolamFacts = await res.json();
    }
  } catch (err) {
    kolamFacts = [
      { fact: "Kolams are traditionally drawn at dawn using rice flour." },
      { fact: "Dots act as coordinates in mathematical Kolam grids." },
      { fact: "Eulerian loops visit every node without overlapping." }
    ];
  }
}

function startFactsRotator() {
  const textElem = document.getElementById('fact-text');
  if (!textElem || kolamFacts.length === 0) return;
  
  let index = 0;
  textElem.textContent = kolamFacts[index].fact;

  factIntervalTimer = setInterval(() => {
    index = (index + 1) % kolamFacts.length;
    textElem.style.opacity = 0;
    setTimeout(() => {
      textElem.textContent = kolamFacts[index].fact;
      textElem.style.opacity = 1;
    }, 300);
  }, 3500);
}

function stopFactsRotator() {
  if (factIntervalTimer) clearInterval(factIntervalTimer);
}

function showLoadingState(title = "THE PATTERN IS FORMING...") {
  const overlay = document.getElementById('loading-overlay');
  const titleElem = document.getElementById('loading-title');
  const warning = document.getElementById('timeout-warning');

  if (titleElem) titleElem.textContent = title;
  if (warning) warning.style.display = 'none';
  if (overlay) overlay.classList.add('active');

  startFactsRotator();
  startLoadingProgressDots();
  attachLoadingParallax();
  startAmbientInstrumental(); // synthesized, mind-soothing instrumental — user gesture already granted by the button click that got us here

  // Client-side 35-second timeout safeguard
  loadingTimeoutTimer = setTimeout(() => {
    if (warning) warning.style.display = 'block';
  }, 35000);
}

function hideLoadingState() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('active');
  stopFactsRotator();
  stopLoadingProgressDots();
  detachLoadingParallax();
  stopAmbientInstrumental();
  if (loadingTimeoutTimer) clearTimeout(loadingTimeoutTimer);
}

// --------------------------------------------------------------------------
// 5b. Loading Screen — Falling Petals
// --------------------------------------------------------------------------
function initLoadingOverlayPetals() {
  const petalContainer = document.getElementById('loading-petals');
  if (!petalContainer) return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const petalColors = ['var(--terracotta)', 'var(--gold)', 'var(--maroon)', 'var(--saffron)'];
  const rand = (min, max) => Math.random() * (max - min) + min;
  for (let i = 0; i < 12; i++) {
    const petal = document.createElement('span');
    petal.classList.add('intro-petal'); // reuses the entry-splash petalFall keyframes
    petal.style.setProperty('--left', `${rand(2, 96)}%`);
    petal.style.setProperty('--size', `${rand(7, 14).toFixed(1)}px`);
    petal.style.setProperty('--duration', `${rand(5, 9).toFixed(2)}s`);
    petal.style.setProperty('--delay', `${rand(0, 5).toFixed(2)}s`);
    petal.style.setProperty('--rot', `${rand(0, 360).toFixed(0)}deg`);
    petal.style.setProperty('--sway', `${rand(-45, 45).toFixed(0)}px`);
    petal.style.background = petalColors[i % petalColors.length];
    petalContainer.appendChild(petal);
  }
}

// --------------------------------------------------------------------------
// 5c. Loading Screen — Pulli (Dot) Progress Chase
// --------------------------------------------------------------------------
let loadingDotsTimer = null;

function startLoadingProgressDots() {
  const container = document.getElementById('loading-progress-dots');
  if (!container) return;
  container.innerHTML = '';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DOT_COUNT = 9;
  const dots = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    const d = document.createElement('span');
    d.classList.add('loading-progress-dot');
    container.appendChild(d);
    dots.push(d);
  }

  if (prefersReducedMotion) {
    dots.forEach(d => d.classList.add('is-lit'));
    return;
  }

  // Actual generation time is unknown, so the pulli trail chases forward as a
  // continuous "still drawing" signal rather than claiming a false completion %.
  let lit = 0;
  loadingDotsTimer = setInterval(() => {
    dots.forEach(d => d.classList.remove('is-lit'));
    for (let k = 0; k <= lit; k++) dots[k].classList.add('is-lit');
    lit = (lit + 1) % dots.length;
  }, 500);
}

function stopLoadingProgressDots() {
  if (loadingDotsTimer) clearInterval(loadingDotsTimer);
  loadingDotsTimer = null;
  const container = document.getElementById('loading-progress-dots');
  if (container) container.innerHTML = '';
}

// --------------------------------------------------------------------------
// 5d. Loading Screen — Cursor Parallax + Gold-Dust Trail
// --------------------------------------------------------------------------
let loadingParallaxRAF = null;
let loadingPointerHandler = null;

function attachLoadingParallax() {
  const overlay = document.getElementById('loading-overlay');
  const wrap = document.getElementById('loader-kolam-wrap');
  if (!overlay || !wrap) return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const target = { nx: 0, ny: 0 };
  const current = { nx: 0, ny: 0 };
  let lastDustTime = 0;

  const spawnGoldDust = (x, y) => {
    const p = document.createElement('span');
    p.className = 'gold-dust-particle';
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    overlay.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  };

  loadingPointerHandler = (e) => {
    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    target.nx = (x / rect.width - 0.5) * 2;
    target.ny = (y / rect.height - 0.5) * 2;

    const now = performance.now();
    if (now - lastDustTime > 55) {
      lastDustTime = now;
      spawnGoldDust(x, y);
    }
  };
  overlay.addEventListener('pointermove', loadingPointerHandler);

  const parallaxLoop = () => {
    current.nx += (target.nx - current.nx) * 0.08;
    current.ny += (target.ny - current.ny) * 0.08;
    wrap.style.transform =
      `translate(${(current.nx * 10).toFixed(2)}px, ${(current.ny * 10).toFixed(2)}px) rotate(${(current.nx * 2).toFixed(2)}deg)`;
    loadingParallaxRAF = requestAnimationFrame(parallaxLoop);
  };
  loadingParallaxRAF = requestAnimationFrame(parallaxLoop);
}

function detachLoadingParallax() {
  const overlay = document.getElementById('loading-overlay');
  const wrap = document.getElementById('loader-kolam-wrap');
  if (overlay && loadingPointerHandler) overlay.removeEventListener('pointermove', loadingPointerHandler);
  loadingPointerHandler = null;
  if (loadingParallaxRAF) cancelAnimationFrame(loadingParallaxRAF);
  loadingParallaxRAF = null;
  if (wrap) wrap.style.transform = '';
}

// --------------------------------------------------------------------------
// 5e. Loading Screen — Synthesized Ambient Instrumental
// (Composed live via the Web Audio API — a tanpura-style drone plus soft
//  pentatonic bell tones. No external audio file is used.)
// --------------------------------------------------------------------------
let ambientAudioCtx = null;
let ambientMasterGain = null;
let ambientDroneNodes = [];
let ambientBellTimer = null;
let ambientIsPlaying = false;
let ambientMuted = false;

function ensureAmbientAudioCtx() {
  if (!ambientAudioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ambientAudioCtx = new AC();
  }
  return ambientAudioCtx;
}

function startAmbientInstrumental() {
  if (ambientMuted || ambientIsPlaying) return;
  const ctx = ensureAmbientAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  ambientIsPlaying = true;

  ambientMasterGain = ctx.createGain();
  ambientMasterGain.gain.setValueAtTime(0, ctx.currentTime);
  ambientMasterGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 2);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1400;
  ambientMasterGain.connect(filter);
  filter.connect(ctx.destination);

  // Tanpura-style drone: Sa (C3), Pa (G3), Sa octave (C4) — gently detuned, slow breathing
  const droneFreqs = [130.81, 196.00, 261.63];
  ambientDroneNodes = [];
  droneFreqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = i === 2 ? 'sine' : 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = (i - 1) * 4;

    const oscGain = ctx.createGain();
    oscGain.gain.value = i === 0 ? 0.55 : i === 1 ? 0.32 : 0.16;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + i * 0.015;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.1;
    lfo.connect(lfoGain);
    lfoGain.connect(oscGain.gain);

    osc.connect(oscGain);
    oscGain.connect(ambientMasterGain);
    osc.start();
    lfo.start();
    ambientDroneNodes.push(osc, lfo);
  });

  // Soft, sparse pentatonic bell tones (Sa Re Ga Pa Dha) — like a distant temple bell
  const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.00];
  const playBell = () => {
    if (!ambientIsPlaying) return;
    const note = pentatonic[Math.floor(Math.random() * pentatonic.length)];
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = note;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + 3.2);
    osc.connect(gain);
    gain.connect(ambientMasterGain);
    osc.start();
    osc.stop(ctx.currentTime + 3.3);

    ambientBellTimer = setTimeout(playBell, 3400 + Math.random() * 2600);
  };
  ambientBellTimer = setTimeout(playBell, 1800);
}

function stopAmbientInstrumental() {
  if (!ambientIsPlaying) return;
  ambientIsPlaying = false;
  if (ambientBellTimer) clearTimeout(ambientBellTimer);

  if (ambientMasterGain && ambientAudioCtx) {
    const ctx = ambientAudioCtx;
    const g = ambientMasterGain;
    const nodesToStop = ambientDroneNodes.slice();
    try {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    } catch (e) { /* no-op */ }

    setTimeout(() => {
      nodesToStop.forEach(n => {
        try { n.stop(); } catch (e) { /* already stopped */ }
        try { n.disconnect(); } catch (e) { /* no-op */ }
      });
      try { g.disconnect(); } catch (e) { /* no-op */ }
    }, 600);
  }
  ambientDroneNodes = [];
}

function toggleAmbientMute() {
  ambientMuted = !ambientMuted;
  const icon = document.getElementById('loading-sound-icon');
  if (ambientMuted) {
    stopAmbientInstrumental();
    if (icon) icon.className = 'fa-solid fa-volume-xmark';
  } else {
    if (icon) icon.className = 'fa-solid fa-volume-high';
    const overlay = document.getElementById('loading-overlay');
    if (overlay && overlay.classList.contains('active')) startAmbientInstrumental();
  }
}

async function generateKolamFlow(promptText) {
  showLoadingState("THE PATTERN IS FORMING...");
  
  let resultImageSrc = null;

  if (isBackendOnline && !DEMO_MODE) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          history: currentPromptHistory
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      resultImageSrc = data.generated_image_base64 || data.image_url || data.image || data.result;

      if (resultImageSrc && !resultImageSrc.startsWith('data:')) {
        resultImageSrc = `data:image/png;base64,${resultImageSrc}`;
      }

      currentPromptHistory.push({ role: 'user', content: promptText });
      appendChatBubble(`Generated Kolam for: "${promptText}"`, 'ai');
    } catch (err) {
      console.warn("Backend call failed, using high-quality procedural fallback generator:", err);
      showToast("Backend unavailable — generated via Procedural Kolam Engine!", "success");
      resultImageSrc = createProceduralKolamDataUrl(promptText);
    }
  } else {
    // Demo Mode / Standalone fallback generator
    await new Promise(r => setTimeout(r, 2000));
    resultImageSrc = createProceduralKolamDataUrl(promptText);
  }

  hideLoadingState();
  displayGeneratedResult(resultImageSrc, promptText);
}

async function restoreKolamFlow(base64Image) {
  showLoadingState("RECONSTRUCTING PATTERN...");

  let restoredImageSrc = null;

  if (isBackendOnline && !DEMO_MODE) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/reconstruct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      restoredImageSrc = data.generated_image_base64 || data.image_url || data.image;

      if (restoredImageSrc && !restoredImageSrc.startsWith('data:')) {
        restoredImageSrc = `data:image/png;base64,${restoredImageSrc}`;
      }
    } catch (err) {
      console.warn("Restoration API call failed, generating procedural restored Kolam:", err);
      restoredImageSrc = createProceduralKolamDataUrl("Restored Traditional Kolam");
    }
  } else {
    await new Promise(r => setTimeout(r, 2000));
    restoredImageSrc = createProceduralKolamDataUrl("Restored Traditional Kolam");
  }

  hideLoadingState();
  displayRestorationResult(base64Image, restoredImageSrc);
}

function displayGeneratedResult(imageSrc, promptText) {
  currentResultImageDataUrl = imageSrc;
  
  const container = document.getElementById('results-visual-container');
  const resultsSection = document.getElementById('section-results');
  const titleText = document.getElementById('results-title-text');
  const metaText = document.getElementById('results-meta-text');

  if (container) {
    container.innerHTML = `<img src="${imageSrc}" alt="Generated Kolam Artwork" class="results-image" id="results-img">`;
  }
  if (titleText) titleText.textContent = "Generated Kolam Pattern";
  if (metaText) metaText.textContent = `Prompt: "${promptText}"`;

  if (resultsSection) {
    resultsSection.classList.add('active');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function displayRestorationResult(originalImage, restoredImage) {
  currentResultImageDataUrl = restoredImage;

  const container = document.getElementById('results-visual-container');
  const resultsSection = document.getElementById('section-results');
  const titleText = document.getElementById('results-title-text');
  const metaText = document.getElementById('results-meta-text');

  if (container) {
    // Construct Split Comparison Drag Slider
    container.innerHTML = `
      <div class="comparison-slider" id="comparison-slider">
        <img src="${originalImage}" class="before-image" alt="Original Damaged Kolam">
        <img src="${restoredImage}" class="after-image" id="after-img" alt="Restored Kolam">
        <div class="slider-handle" id="slider-handle"></div>
      </div>
    `;
    initComparisonSliderLogic();
  }

  if (titleText) titleText.textContent = "Restoration Complete";
  if (metaText) metaText.textContent = "Original Damaged Photo vs AI Restored Geometry (Drag slider to compare)";

  if (resultsSection) {
    resultsSection.classList.add('active');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }
}

// --------------------------------------------------------------------------
// 9. Interactive Split Comparison Drag Slider Logic
// --------------------------------------------------------------------------
function initComparisonSliderLogic() {
  const slider = document.getElementById('comparison-slider');
  const handle = document.getElementById('slider-handle');
  const afterImg = document.getElementById('after-img');

  if (!slider || !handle || !afterImg) return;

  let isDragging = false;

  function updateSlider(x) {
    const rect = slider.getBoundingClientRect();
    let position = (x - rect.left) / rect.width;
    if (position < 0) position = 0;
    if (position > 1) position = 1;

    const percentage = position * 100;
    handle.style.left = `${percentage}%`;
    afterImg.style.clipPath = `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)`;
  }

  handle.addEventListener('mousedown', () => isDragging = true);
  window.addEventListener('mouseup', () => isDragging = false);
  slider.addEventListener('mousemove', (e) => {
    if (isDragging) updateSlider(e.clientX);
  });

  // Touch device support
  handle.addEventListener('touchstart', () => isDragging = true);
  window.addEventListener('touchend', () => isDragging = false);
  slider.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches[0]) updateSlider(e.touches[0].clientX);
  });
}

// --------------------------------------------------------------------------
// 10. High-Quality Procedural Kolam Generator (SVG/Canvas Fallback Engine)
// --------------------------------------------------------------------------
function createProceduralKolamDataUrl(prompt) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');

  // Background warm rice paper canvas
  ctx.fillStyle = '#FAF7F2';
  ctx.fillRect(0, 0, 800, 800);

  // Background grain texture
  ctx.fillStyle = 'rgba(200, 90, 50, 0.03)';
  for (let i = 0; i < 2000; i++) {
    ctx.fillRect(Math.random()*800, Math.random()*800, 2, 2);
  }

  const cx = 400, cy = 400;
  const size = 5;
  const spacing = 75;

  // Draw Dot Grid (Pulli)
  ctx.fillStyle = '#C85A32';
  for (let r = -Math.floor(size/2); r <= Math.floor(size/2); r++) {
    for (let c = -Math.floor(size/2); c <= Math.floor(size/2); c++) {
      ctx.beginPath();
      ctx.arc(cx + c * spacing, cy + r * spacing, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw Symmetrical Curves around Dots
  ctx.strokeStyle = '#6B1D2F';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const folds = 8;
  for (let f = 0; f < folds; f++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((Math.PI * 2 / folds) * f);

    // Inner Lotus Petal Loop
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(60, 100, 140, 100, 150, 0);
    ctx.stroke();

    // Secondary Saffron Accents
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(180, 0, 35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // Outer Decorative Terracotta Boundary Circle
  ctx.strokeStyle = '#C85A32';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 320, 0, Math.PI * 2);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

// --------------------------------------------------------------------------
// 11. Community Wall — "Kolam of the Day"
// --------------------------------------------------------------------------

// Procedurally generates a distinct radial Kolam pattern as an inline SVG
// string, using only the site's existing terracotta/maroon/gold palette.
function generateKolamSVG({ folds = 6, dotRings = 3, petalCurve = 55, color1 = '#C85A32', color2 = '#6B1D2F', color3 = '#D4AF37', bg = '#F5EFE6' } = {}) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;

  let dots = '';
  for (let ring = 1; ring <= dotRings; ring++) {
    const r = ring * (size * 0.15);
    const count = ring * 6;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const x = (cx + Math.cos(angle) * r).toFixed(1);
      const y = (cy + Math.sin(angle) * r).toFixed(1);
      dots += `<circle cx="${x}" cy="${y}" r="2.4" fill="${color2}" />`;
    }
  }

  let petals = '';
  for (let f = 0; f < folds; f++) {
    const angle = (360 / folds) * f;
    petals += `<g transform="rotate(${angle} ${cx} ${cy})">
      <path d="M ${cx} ${cy} Q ${cx + petalCurve} ${cy - petalCurve * 0.9} ${cx + petalCurve * 1.5} ${cy} Q ${cx + petalCurve} ${cy + petalCurve * 0.9} ${cx} ${cy}" fill="none" stroke="${color1}" stroke-width="3" />
      <circle cx="${(cx + petalCurve * 1.4).toFixed(1)}" cy="${cy}" r="4" fill="${color3}" />
    </g>`;
  }

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="kolam-generated-svg">
    <rect width="${size}" height="${size}" fill="${bg}" />
    <circle cx="${cx}" cy="${cy}" r="${size * 0.44}" fill="none" stroke="${color1}" stroke-width="2" stroke-dasharray="4 5" />
    ${dots}
    ${petals}
    <circle cx="${cx}" cy="${cy}" r="6" fill="${color1}" />
  </svg>`;
}

// 5 sample "seed" posts so the Community Wall never looks empty, even
// before any real backend storage or real user uploads exist.
const KOLAM_SAMPLES = [
  {
    id: 'sample-1',
    title: 'Lotus Bloom Kolam',
    author: 'Meena R.',
    caption: 'Drawn fresh this morning with rice flour — 6-fold lotus symmetry.',
    svg: generateKolamSVG({ folds: 6, dotRings: 3, petalCurve: 55 })
  },
  {
    id: 'sample-2',
    title: '8-Fold Mandala',
    author: 'Priya K.',
    caption: 'My grandmother taught me this mandala style Kolam.',
    svg: generateKolamSVG({ folds: 8, dotRings: 2, petalCurve: 45, color1: '#6B1D2F', color3: '#C85A32' })
  },
  {
    id: 'sample-3',
    title: 'Classic Pulli Grid',
    author: 'Lakshmi S.',
    caption: 'A traditional grid style Kolam, simple and elegant.',
    svg: generateKolamSVG({ folds: 4, dotRings: 4, petalCurve: 65 })
  },
  {
    id: 'sample-4',
    title: 'Sunburst Sikku Loop',
    author: 'Anitha V.',
    caption: 'Continuous loop, no lifted hand — a proper Sikku Kolam!',
    svg: generateKolamSVG({ folds: 12, dotRings: 2, petalCurve: 35, color1: '#D4AF37', color3: '#6B1D2F' })
  },
  {
    id: 'sample-5',
    title: 'Five-Fold Star Kolam',
    author: 'Divya N.',
    caption: 'Festival special design for this Pongal.',
    svg: generateKolamSVG({ folds: 5, dotRings: 3, petalCurve: 50 })
  }
];

const KOLAM_SAMPLE_BASE_LIKES = { 'sample-1': 24, 'sample-2': 41, 'sample-3': 17, 'sample-4': 33, 'sample-5': 29 };

function getCommunityState() {
  let state = JSON.parse(localStorage.getItem(COMMUNITY_STORAGE_KEY) || 'null');
  if (!state) {
    state = { likes: {}, comments: {}, userPosts: [] };
    KOLAM_SAMPLES.forEach(s => {
      state.likes[s.id] = { count: KOLAM_SAMPLE_BASE_LIKES[s.id] || 15, liked: false };
      state.comments[s.id] = [];
    });
    saveCommunityState(state);
  }
  return state;
}

function saveCommunityState(state) {
  localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(state));
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function getKolamOfTheDay() {
  const dayIndex = Math.floor(Date.now() / 86400000) % KOLAM_SAMPLES.length;
  return KOLAM_SAMPLES[dayIndex];
}

function initCommunity() {
  renderKolamOfTheDay();
  renderCommunityFeed();
  setupCommunityDropzone();
}

function renderKolamOfTheDay() {
  const container = document.getElementById('kotd-hero');
  if (!container) return;

  const featured = getKolamOfTheDay();
  const state = getCommunityState();
  const likeData = state.likes[featured.id] || { count: 0, liked: false };
  const commentCount = (state.comments[featured.id] || []).length;
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  container.innerHTML = `
    <div class="kotd-badge"><i class="fa-solid fa-star"></i> Today's Pick — ${dateStr}</div>
    <div class="kotd-card">
      <div class="post-image-frame kotd-image-frame">${featured.svg}</div>
      <div class="post-body kotd-info">
        <h3>${escapeHTML(featured.title)}</h3>
        <p class="post-author"><i class="fa-solid fa-user"></i> ${escapeHTML(featured.author)}</p>
        <p class="post-caption">${escapeHTML(featured.caption)}</p>
        <div class="post-actions">
          <button class="like-btn ${likeData.liked ? 'liked' : ''}" onclick="toggleLike('${featured.id}')" id="like-btn-${featured.id}">
            <i class="fa-solid fa-heart"></i> <span id="like-count-${featured.id}">${likeData.count}</span>
          </button>
          <button class="comment-toggle-btn" onclick="toggleComments('${featured.id}')">
            <i class="fa-solid fa-comment"></i> <span id="comment-count-${featured.id}">${commentCount}</span>
          </button>
        </div>
        <div class="post-comments" id="comments-${featured.id}"></div>
      </div>
    </div>
  `;
}

function buildPostCard(post, isUserPost) {
  const state = getCommunityState();
  const likeData = state.likes[post.id] || { count: 0, liked: false };
  const commentCount = (state.comments[post.id] || []).length;
  const imageContent = isUserPost
    ? `<img src="${post.image}" alt="${escapeHTML(post.title)}" class="post-uploaded-img">`
    : post.svg;

  return `
    <div class="community-post-card">
      <div class="post-image-frame">${imageContent}</div>
      <div class="post-body">
        <p class="post-author"><i class="fa-solid fa-user"></i> ${escapeHTML(post.author)} <span class="post-date">• ${escapeHTML(post.date || 'Today')}</span></p>
        ${post.caption ? `<p class="post-caption">${escapeHTML(post.caption)}</p>` : ''}
        <div class="post-actions">
          <button class="like-btn ${likeData.liked ? 'liked' : ''}" onclick="toggleLike('${post.id}')" id="like-btn-${post.id}">
            <i class="fa-solid fa-heart"></i> <span id="like-count-${post.id}">${likeData.count}</span>
          </button>
          <button class="comment-toggle-btn" onclick="toggleComments('${post.id}')">
            <i class="fa-solid fa-comment"></i> <span id="comment-count-${post.id}">${commentCount}</span>
          </button>
        </div>
        <div class="post-comments" id="comments-${post.id}"></div>
      </div>
    </div>
  `;
}

function renderCommunityFeed() {
  const feedEl = document.getElementById('community-feed');
  if (!feedEl) return;

  const featuredId = getKolamOfTheDay().id;
  const state = getCommunityState();

  const userPostsHTML = state.userPosts.map(p => buildPostCard(p, true)).join('');
  const sampleHTML = KOLAM_SAMPLES.filter(s => s.id !== featuredId).map(s => buildPostCard(s, false)).join('');

  feedEl.innerHTML = userPostsHTML + sampleHTML || '<p style="color: var(--text-muted);">No posts yet.</p>';
}

function toggleLike(postId) {
  const state = getCommunityState();
  if (!state.likes[postId]) state.likes[postId] = { count: 0, liked: false };

  const data = state.likes[postId];
  data.liked = !data.liked;
  data.count += data.liked ? 1 : -1;
  saveCommunityState(state);

  const btn = document.getElementById(`like-btn-${postId}`);
  const countEl = document.getElementById(`like-count-${postId}`);
  if (btn) btn.classList.toggle('liked', data.liked);
  if (countEl) countEl.textContent = data.count;
}

function toggleComments(postId) {
  const panel = document.getElementById(`comments-${postId}`);
  if (!panel) return;
  const isOpen = panel.classList.toggle('open');
  if (isOpen) renderCommentPanel(postId);
}

function renderCommentPanel(postId) {
  const panel = document.getElementById(`comments-${postId}`);
  if (!panel) return;

  const state = getCommunityState();
  const comments = state.comments[postId] || [];

  panel.innerHTML = `
    <div class="comment-list">
      ${comments.length === 0
        ? '<p class="no-comments">No comments yet. Be the first!</p>'
        : comments.map(c => `<div class="comment-item"><strong>${escapeHTML(c.author)}:</strong> ${escapeHTML(c.text)}</div>`).join('')}
    </div>
    <div class="comment-input-row">
      <input type="text" class="comment-input" id="comment-input-${postId}" placeholder="Add a comment..." onkeydown="if(event.key==='Enter') addComment('${postId}')">
      <button class="btn-secondary comment-send-btn" onclick="addComment('${postId}')"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  `;
}

function addComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input || !input.value.trim()) return;

  const state = getCommunityState();
  if (!state.comments[postId]) state.comments[postId] = [];
  state.comments[postId].push({ author: 'You', text: input.value.trim() });
  saveCommunityState(state);

  input.value = '';
  renderCommentPanel(postId);

  const countEl = document.getElementById(`comment-count-${postId}`);
  if (countEl) countEl.textContent = state.comments[postId].length;

  showToast('Comment added!', 'success');
}

// --- Community Upload Flow (mirrors the Restore upload, but posts to the feed) ---

function setupCommunityDropzone() {
  const dropzone = document.getElementById('community-dropzone');
  if (!dropzone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) processCommunityImage(file);
  });
}

function handleCommunityFileSelect(event) {
  const file = event.target.files[0];
  if (file) processCommunityImage(file);
}

function processCommunityImage(file) {
  if (!file.type.startsWith('image/')) {
    showToast("Please select a valid image file.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      communitySelectedImageDataUrl = canvas.toDataURL('image/jpeg', 0.75);

      const previewImg = document.getElementById('community-preview-img');
      const previewContainer = document.getElementById('community-preview-container');
      const submitBtn = document.getElementById('btn-community-submit');

      if (previewImg) previewImg.src = communitySelectedImageDataUrl;
      if (previewContainer) previewContainer.style.display = 'block';
      if (submitBtn) submitBtn.style.display = 'inline-flex';

      showToast("Image ready to share!", "success");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearCommunitySelectedImage() {
  communitySelectedImageDataUrl = null;
  const previewContainer = document.getElementById('community-preview-container');
  const submitBtn = document.getElementById('btn-community-submit');
  const fileInput = document.getElementById('community-file-input');
  if (previewContainer) previewContainer.style.display = 'none';
  if (submitBtn) submitBtn.style.display = 'none';
  if (fileInput) fileInput.value = '';
}

function submitCommunityPost() {
  if (!communitySelectedImageDataUrl) {
    showToast("Please select an image to share!", "error");
    return;
  }

  const captionInput = document.getElementById('community-caption');
  const caption = captionInput ? captionInput.value.trim() : '';

  const newPost = {
    id: `user-${Date.now()}`,
    title: 'Community Kolam',
    author: 'You',
    caption: caption,
    image: communitySelectedImageDataUrl,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  };

  const state = getCommunityState();
  state.userPosts.unshift(newPost);
  state.likes[newPost.id] = { count: 0, liked: false };
  state.comments[newPost.id] = [];
  saveCommunityState(state);

  clearCommunitySelectedImage();
  if (captionInput) captionInput.value = '';

  renderCommunityFeed();
  showToast("Your Kolam has been shared with the community!", "success");
}

// 14. Utilities: Toast & Downloads & Local Storage Gallery
// --------------------------------------------------------------------------
function showToast(message, type = "info") {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function downloadCurrentResult() {
  if (!currentResultImageDataUrl) {
    showToast("No generated pattern to download yet!", "error");
    return;
  }

  const link = document.createElement('a');
  link.download = 'kolam-pattern.png';
  link.href = currentResultImageDataUrl;
  link.click();
  showToast("Downloading Kolam pattern...", "success");
}

function saveCurrentToGallery() {
  if (!currentResultImageDataUrl) {
    showToast("No pattern available to save!", "error");
    return;
  }

  let gallery = JSON.parse(localStorage.getItem('kolam_gallery') || '[]');
  gallery.push({
    image: currentResultImageDataUrl,
    timestamp: new Date().toLocaleDateString()
  });

  localStorage.setItem('kolam_gallery', JSON.stringify(gallery));
  showToast("Saved to Local Gallery!", "success");
}

function openGalleryModal() {
  const modal = document.getElementById('gallery-modal');
  const grid = document.getElementById('gallery-grid');

  if (!modal || !grid) return;

  let gallery = JSON.parse(localStorage.getItem('kolam_gallery') || '[]');

  if (gallery.length === 0) {
    grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">No saved patterns yet. Generate or restore a Kolam to save it here!</p>`;
  } else {
    grid.innerHTML = gallery.map(item => `
      <div class="gallery-item">
        <img src="${item.image}" alt="Saved Kolam">
        <p style="padding: 8px; font-size: 0.8rem; color: var(--text-muted); text-align: center;">${item.timestamp}</p>
      </div>
    `).join('');
  }

  modal.classList.add('active');
}

function closeGalleryModal() {
  const modal = document.getElementById('gallery-modal');
  if (modal) modal.classList.remove('active');
}

function retryLastOperation() {
  hideLoadingState();
  showToast("Retrying generation...", "info");
}
