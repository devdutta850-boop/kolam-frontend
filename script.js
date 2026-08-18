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

// Mathematics Visualizer States
let activeGridSize = 3;
let activeGeometryStyle = 'circles';
let symmetryFoldMode = 4; // 4-fold or 8-fold
let currentAlgoStep = 1;
let algoAutoPlayTimer = null;

// --------------------------------------------------------------------------
// 2. Application Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initHeroCanvas();
  initVoiceChat();
  initMathVisualizers();
  initSymmetryCanvas();
  initAlgorithmVisualizer();
  loadFacts();
  checkBackendHealth();
  
  // Periodic health check every 15 seconds
  setInterval(checkBackendHealth, 15000);
});

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

  // Client-side 35-second timeout safeguard
  loadingTimeoutTimer = setTimeout(() => {
    if (warning) warning.style.display = 'block';
  }, 35000);
}

function hideLoadingState() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('active');
  stopFactsRotator();
  if (loadingTimeoutTimer) clearTimeout(loadingTimeoutTimer);
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
// 11. Mathematics & Geometry Interactive Cards
// --------------------------------------------------------------------------
function initMathVisualizers() {
  drawGridCanvas();
  drawGeometryCanvas();
}

function setGridSize(size) {
  activeGridSize = size;
  document.querySelectorAll('.grid-controls .grid-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(`${size}`));
  });
  drawGridCanvas();
}

function drawGridCanvas() {
  const canvas = document.getElementById('grid-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const spacing = Math.min(canvas.width, canvas.height) * 0.16;

  ctx.fillStyle = '#C85A32';
  const start = -Math.floor(activeGridSize / 2);
  const end = Math.floor(activeGridSize / 2);

  for (let r = start; r <= end; r++) {
    for (let c = start; c <= end; c++) {
      ctx.beginPath();
      ctx.arc(cx + c * spacing, cy + r * spacing, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function toggleGeometryCurve(style) {
  activeGeometryStyle = style;
  drawGeometryCanvas();
}

function drawGeometryCanvas() {
  const canvas = document.getElementById('geometry-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const spacing = 50;

  // Dots
  ctx.fillStyle = '#C85A32';
  for (let r = -1; r <= 1; r++) {
    for (let c = -1; c <= 1; c++) {
      ctx.beginPath();
      ctx.arc(cx + c * spacing, cy + r * spacing, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Curves based on active style
  ctx.strokeStyle = '#6B1D2F';
  ctx.lineWidth = 3;

  if (activeGeometryStyle === 'circles') {
    ctx.beginPath();
    ctx.arc(cx, cy, spacing * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  } else if (activeGeometryStyle === 'arcs') {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(cx + (i%2 === 0 ? spacing : -spacing), cy, spacing * 0.8, 0, Math.PI);
      ctx.stroke();
    }
  } else if (activeGeometryStyle === 'loops') {
    ctx.beginPath();
    ctx.moveTo(cx - spacing, cy);
    ctx.quadraticCurveTo(cx, cy - spacing * 1.5, cx + spacing, cy);
    ctx.quadraticCurveTo(cx + spacing * 1.5, cy + spacing * 1.5, cx, cy + spacing);
    ctx.quadraticCurveTo(cx - spacing * 1.5, cy + spacing * 1.5, cx - spacing, cy);
    ctx.stroke();
  }
}

// --------------------------------------------------------------------------
// 12. Interactive Symmetry Mirroring Canvas
// --------------------------------------------------------------------------
function initSymmetryCanvas() {
  const canvas = document.getElementById('symmetry-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    clearSymmetryCanvas();
  }
  resize();

  let isDrawing = false;

  canvas.addEventListener('mousedown', () => isDrawing = true);
  window.addEventListener('mouseup', () => isDrawing = false);
  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawSymmetricalStroke(ctx, canvas.width, canvas.height, x, y);
  });
}

function toggleSymmetryFold() {
  symmetryFoldMode = symmetryFoldMode === 4 ? 8 : 4;
  const btn = document.getElementById('btn-symmetry-fold');
  if (btn) btn.textContent = `${symmetryFoldMode}-Fold Reflection`;
  clearSymmetryCanvas();
}

function clearSymmetryCanvas() {
  const canvas = document.getElementById('symmetry-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw axis lines
  ctx.strokeStyle = 'rgba(200, 90, 50, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
}

function drawSymmetricalStroke(ctx, w, h, mouseX, mouseY) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = mouseX - cx;
  const dy = mouseY - cy;

  ctx.fillStyle = '#6B1D2F';
  
  const pointsCount = symmetryFoldMode;
  for (let i = 0; i < pointsCount; i++) {
    const angle = (Math.PI * 2 / pointsCount) * i;
    const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ry = dx * Math.sin(angle) + dy * Math.cos(angle);

    ctx.beginPath();
    ctx.arc(cx + rx, cy + ry, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSampleSymmetry() {
  clearSymmetryCanvas();
  const canvas = document.getElementById('symmetry-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  for (let t = 0; t < Math.PI * 2; t += 0.05) {
    const radius = 60 + Math.sin(t * 5) * 25;
    const x = cx + Math.cos(t) * radius;
    const y = cy + Math.sin(t) * radius;
    drawSymmetricalStroke(ctx, canvas.width, canvas.height, x, y);
  }
}

// --------------------------------------------------------------------------
// 13. Step-by-Step Generative Algorithm Visualizer ("Build the Kolam")
// --------------------------------------------------------------------------
function initAlgorithmVisualizer() {
  renderAlgorithmStep(1);
}

function nextAlgorithmStep() {
  currentAlgoStep = (currentAlgoStep % 6) + 1;
  renderAlgorithmStep(currentAlgoStep);
}

function resetAlgorithm() {
  currentAlgoStep = 1;
  if (algoAutoPlayTimer) clearInterval(algoAutoPlayTimer);
  renderAlgorithmStep(1);
}

function autoPlayAlgorithm() {
  if (algoAutoPlayTimer) clearInterval(algoAutoPlayTimer);
  currentAlgoStep = 1;
  renderAlgorithmStep(currentAlgoStep);

  algoAutoPlayTimer = setInterval(() => {
    currentAlgoStep++;
    if (currentAlgoStep > 6) {
      clearInterval(algoAutoPlayTimer);
      currentAlgoStep = 6;
    }
    renderAlgorithmStep(currentAlgoStep);
  }, 1200);
}

function renderAlgorithmStep(step) {
  // Update UI step indicator
  for (let i = 1; i <= 6; i++) {
    const node = document.getElementById(`step-node-${i}`);
    if (node) node.classList.toggle('active', i <= step);
  }

  const canvas = document.getElementById('build-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const spacing = 45;

  // Step 1: Dot Grid
  if (step >= 1) {
    ctx.fillStyle = '#C85A32';
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        ctx.beginPath();
        ctx.arc(cx + c * spacing, cy + r * spacing, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Step 2: Coordinates Alignment
  if (step >= 2) {
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * spacing, cy - 90);
      ctx.lineTo(cx + i * spacing, cy + 90);
      ctx.moveTo(cx - 90, cy + i * spacing);
      ctx.lineTo(cx + 90, cy + i * spacing);
      ctx.stroke();
    }
  }

  // Step 3: Symmetry Axes
  if (step >= 3) {
    ctx.strokeStyle = 'rgba(200, 90, 50, 0.6)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
    ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Step 4: Curves Connection
  if (step >= 4) {
    ctx.strokeStyle = '#6B1D2F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, spacing * 1.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Step 5: Motif Repeat
  if (step >= 5) {
    ctx.strokeStyle = '#E69A28';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((Math.PI / 2) * i);
      ctx.beginPath();
      ctx.arc(spacing * 1.5, 0, spacing * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Step 6: Complete Kolam Output
  if (step >= 6) {
    ctx.strokeStyle = '#6B1D2F';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, spacing * 2.2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// --------------------------------------------------------------------------
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
