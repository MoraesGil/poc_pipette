const pipetteContainer = document.getElementById('pipette-container');
const pipetteImage = document.getElementById('pipette-image');
const preview = document.getElementById('pipette-overlay');
const previewCanvas = document.getElementById('image-canva');
const orientationRadios = document.querySelectorAll('input[name="orientation"]');
const viewRadios = document.querySelectorAll('input[name="view"]');
const contentRadios = document.querySelectorAll('input[name="content"]');
const zoomRange = document.getElementById('zoom-range');
const zoomValueLabel = document.getElementById('zoom-value');
const zoomIncreaseBtn = document.getElementById('zoom-increase');
const zoomDecreaseBtn = document.getElementById('zoom-decrease');
const overlayZoomRange = document.getElementById('overlay-zoom-range');
const overlayZoomValueLabel = document.getElementById('overlay-zoom-value');
const overlayZoomIncreaseBtn = document.getElementById('overlay-zoom-increase');
const overlayZoomDecreaseBtn = document.getElementById('overlay-zoom-decrease');
const moveButtons = document.querySelectorAll('[data-move]');
const overlayMoveButtons = document.querySelectorAll('[data-overlay-move]');
const maskedMoveButtons = document.querySelectorAll('[data-masked-move]');
const imageUploadInput = document.getElementById('image-upload');
const uploadStatus = document.getElementById('upload-status');
const areaHeightRange = document.getElementById('area-height-range');
const areaHeightValueLabel = document.getElementById('area-height-value');
const areaHeightIncreaseBtn = document.getElementById('area-height-increase');
const areaHeightDecreaseBtn = document.getElementById('area-height-decrease');
const zoomControlHint = document.querySelector('[aria-label="Zoom da imagem"] .control-hint');
const contentMoveHint = document.querySelector('[aria-label="Posição da imagem"] .control-hint');
const areaZoomHint = document.querySelector('[aria-label="Zoom da área"] .control-hint');
const areaMoveHint = document.querySelector('[aria-label="Posição da área"] .control-hint');
const maskedMoveHint = document.querySelector('[aria-label="Movimento da imagem mascarada"] .control-hint');
const areaHeightHint = document.querySelector('[aria-label="Altura da área"] .control-hint');

const HOLD_INITIAL_DELAY = 250;
const HOLD_REPEAT_INTERVAL = 70;

const setupHoldRepeater = (buttons, attribute, handler) => {
  buttons.forEach(button => {
    const direction = button.getAttribute(attribute);
    if (!direction) return;

    let holdTimeoutId = null;
    let holdIntervalId = null;
    let activePointerId = null;

    const clearTimers = () => {
      if (holdTimeoutId !== null) {
        clearTimeout(holdTimeoutId);
        holdTimeoutId = null;
      }
      if (holdIntervalId !== null) {
        clearInterval(holdIntervalId);
        holdIntervalId = null;
      }
    };

    const stopHold = () => {
      clearTimers();
      if (activePointerId !== null && button.hasPointerCapture?.(activePointerId)) {
        button.releasePointerCapture?.(activePointerId);
      }
      if (button.dataset.holdActive === 'true') {
        requestAnimationFrame(() => {
          button.dataset.holdActive = 'false';
        });
      }
      activePointerId = null;
    };

    button.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      clearTimers();
      activePointerId = event.pointerId;
      button.dataset.holdActive = 'true';
      button.setPointerCapture?.(activePointerId);
      handler(direction);
      holdTimeoutId = window.setTimeout(() => {
        holdIntervalId = window.setInterval(() => handler(direction), HOLD_REPEAT_INTERVAL);
      }, HOLD_INITIAL_DELAY);
    });

    ['pointerup', 'pointerleave', 'pointercancel', 'pointerout', 'lostpointercapture', 'blur'].forEach(evt => {
      button.addEventListener(evt, () => stopHold());
    });

    button.addEventListener('click', event => {
      if (button.dataset.holdActive === 'true') {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      handler(direction);
    });
  });
};

const orientationValues = ['left', 'right'];
const viewValues = ['side', 'top'];

const applyModifier = (elements, prefix, value, values) => {
  if (!elements.length) return;
  const classNames = values.map(option => `${prefix}-${option}`);
  elements.filter(Boolean).forEach(element => {
    element.classList.remove(...classNames);
    element.classList.add(`${prefix}-${value}`);
  });
};

const previewState = {
  position: 'top',
  orientation: 'left',
  view: 'side',
  content: 'image',
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  maskedOffsetX: 0,
  maskedOffsetY: 0,
  overlayScale: 1,
  overlayOffsetX: 0,
  overlayOffsetY: 0,
  overlayHeightPercent: 24,
};

const applyOrientation = value => {
  previewState.orientation = value;
  applyModifier([pipetteContainer, pipetteImage, preview], 'orientation', value, orientationValues);
};

const applyView = value => {
  previewState.view = value;
  applyModifier([pipetteContainer, pipetteImage, preview], 'view', value, viewValues);
  applyOverlayTransform();
};

const applyContent = value => {
  previewState.content = value;
  const contentTargets = [preview?.querySelector('.wrapper-crop')].filter(Boolean);
  applyModifier(contentTargets, 'content', value, ['image', 'upload', 'color']);
};

const applyOverlayTransform = () => {
  if (!preview) return;

  preview.style.setProperty('--overlay-scale', previewState.overlayScale);
  preview.style.setProperty('--overlay-offset-x', previewState.overlayOffsetX);
  preview.style.setProperty('--overlay-offset-y', previewState.overlayOffsetY);
  preview.style.setProperty('--overlay-height-percent', `${previewState.overlayHeightPercent}%`);
};

const getRadioValue = name => {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : null;
};

const BASE_PREVIEW_WIDTH = 200;
const MASK_BASE_HEIGHT = 200;
const MASK_ASPECT_RATIO = 1374.667 / 1166.667;
const MASK_BASE_WIDTH = MASK_BASE_HEIGHT * MASK_ASPECT_RATIO;
const MASK_BASE_LEFT = -20;
const MASK_BASE_TOP = {
  top: -16,
  middle: -70,
  bottom: -122,
};

const contentImage = new Image();
contentImage.src = 'image_uploaded.jpg';
const maskImage = new Image();
maskImage.src = 'morcego_canva_antigo.svg';

let uploadedImage = null;
let hasUploadedImage = false;

let loadedImages = 0;
const ensureDraw = () => {
  loadedImages += 1;
  if (loadedImages >= 2) {
    drawPreview();
  }
};

contentImage.addEventListener('load', ensureDraw);
maskImage.addEventListener('load', ensureDraw);

const drawPreview = () => {
  if (!previewCanvas || !previewCanvas.getContext) return;
  if (loadedImages < 2) return;

  const ctx = previewCanvas.getContext('2d');
  const rect = previewCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = rect.width * dpr;
  const canvasHeight = rect.height * dpr;

  if (previewCanvas.width !== canvasWidth || previewCanvas.height !== canvasHeight) {
    previewCanvas.width = canvasWidth;
    previewCanvas.height = canvasHeight;
  }

  ctx.resetTransform?.();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  ctx.save();
  ctx.translate(rect.width / 2, rect.height / 2);

  if (previewState.orientation === 'right' && previewState.view === 'side') {
    ctx.rotate(Math.PI);
  }

  ctx.translate(-rect.width / 2, -rect.height / 2);

  const scale = rect.width / BASE_PREVIEW_WIDTH;
  const maskWidth = MASK_BASE_WIDTH * scale;
  const maskHeight = MASK_BASE_HEIGHT * scale;
  const maskX = MASK_BASE_LEFT * scale;
  const maskY = (MASK_BASE_TOP[previewState.position] || 0) * scale;

  if (previewState.content === 'image' || previewState.content === 'upload') {
    ctx.save();
    if (previewState.orientation === 'right' && previewState.view === 'top') {
      ctx.translate(rect.width / 2, rect.height / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-rect.width / 2, -rect.height / 2);
    }
    const activeImage = previewState.content === 'upload' && uploadedImage ? uploadedImage : contentImage;
    const imgWidth = activeImage.naturalWidth || activeImage.width;
    const imgHeight = activeImage.naturalHeight || activeImage.height;
    const imgRatio = imgWidth / imgHeight;
    const maskRatio = maskWidth / maskHeight;

    let drawWidth;
    let drawHeight;

    if (imgRatio > maskRatio) {
      drawHeight = maskHeight;
      drawWidth = drawHeight * imgRatio;
    } else {
    drawWidth = maskWidth;
    drawHeight = drawWidth / imgRatio;
    }

  drawWidth *= previewState.scale;
  drawHeight *= previewState.scale;

  const drawX = maskX + (maskWidth - drawWidth) / 2 + previewState.offsetX * scale;
  const drawY = maskY + (maskHeight - drawHeight) / 2 + previewState.offsetY * scale;

    ctx.drawImage(activeImage, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-in';
    const maskDrawX = maskX + previewState.maskedOffsetX * scale;
    const maskDrawY = maskY + previewState.maskedOffsetY * scale;
    ctx.drawImage(maskImage, maskDrawX, maskDrawY, maskWidth, maskHeight);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    const maskDrawX = maskX + previewState.maskedOffsetX * scale;
    const maskDrawY = maskY + previewState.maskedOffsetY * scale;
    ctx.fillRect(maskDrawX, maskDrawY, maskWidth, maskHeight);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskImage, maskDrawX, maskDrawY, maskWidth, maskHeight);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
};

if (window.ResizeObserver && previewCanvas) {
  const observer = new ResizeObserver(() => drawPreview());
  observer.observe(previewCanvas.parentElement || previewCanvas);
} else {
  window.addEventListener('resize', () => drawPreview());
}

const updateState = () => {
  const orientation = getRadioValue('orientation');
  const view = getRadioValue('view');
  let position = previewState.position;

  if (view === 'side') {
    position = orientation === 'left' ? 'top' : 'bottom';
  } else if (view === 'top') {
    position = 'middle';
  }

  previewState.position = position;
  applyOrientation(orientation);
  applyView(view);
  applyContent(getRadioValue('content'));
  applyOverlayTransform();
  drawPreview();
};

orientationRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    updateState();
  });
});

viewRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    updateState();
  });
});

contentRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    updateState();
  });
});

const updateZoomRange = () => {
  if (zoomRange) {
    zoomRange.value = String(Math.round(previewState.scale * 100));
  }
};

const updateZoomDisplay = () => {
  zoomValueLabel.textContent = `${Math.round(previewState.scale * 100)}%`;
  updateZoomRange();
  if (zoomControlHint) {
    zoomControlHint.querySelector('[data-hint="zoom-scale"]').textContent = previewState.scale.toFixed(2);
  }
};

const updateOverlayZoomDisplay = () => {
  if (!overlayZoomValueLabel) return;
  overlayZoomValueLabel.textContent = `${Math.round(previewState.overlayScale * 100)}%`;
  if (areaZoomHint) {
    const overlayScaleEl = areaZoomHint.querySelector('[data-hint="overlay-scale"]');
    if (overlayScaleEl) overlayScaleEl.textContent = previewState.overlayScale.toFixed(2);
  }
};

zoomRange.addEventListener('input', event => {
  const value = Number(event.target.value) || 0;
  previewState.scale = value / 100;
  updateZoomDisplay();
  drawPreview();
});

updateZoomDisplay();

const updateOverlayZoomRange = () => {
  if (overlayZoomRange) {
    overlayZoomRange.value = String(Math.round(previewState.overlayScale * 100));
  }
};

if (overlayZoomRange) {
  overlayZoomRange.addEventListener('input', event => {
    const value = Number(event.target.value) || 0;
    previewState.overlayScale = value / 100;
    updateOverlayZoomDisplay();
    updateOverlayZoomRange();
    applyOverlayTransform();
    drawPreview();
  });

  updateOverlayZoomDisplay();
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const changeZoom = delta => {
  const newScale = clamp(previewState.scale + delta, 0.1, 3);
  if (previewState.scale === newScale) return;
  previewState.scale = newScale;
  updateZoomDisplay();
  drawPreview();
};

const changeOverlayZoom = delta => {
  const newScale = clamp(previewState.overlayScale + delta, 0.5, 3);
  if (previewState.overlayScale === newScale) return;
  previewState.overlayScale = newScale;
  updateOverlayZoomDisplay();
  updateOverlayZoomRange();
  applyOverlayTransform();
  drawPreview();
  if (areaZoomHint) {
    const overlayScaleEl = areaZoomHint.querySelector('[data-hint="overlay-scale"]');
    if (overlayScaleEl) overlayScaleEl.textContent = previewState.overlayScale.toFixed(2);
  }
};

const AREA_HEIGHT_STEP = 1;
const AREA_HEIGHT_MIN = 10;
const AREA_HEIGHT_MAX = 60;

const updateAreaHeightInputs = () => {
  if (areaHeightRange) {
    areaHeightRange.value = String(Math.round(previewState.overlayHeightPercent));
  }
  if (areaHeightValueLabel) {
    areaHeightValueLabel.textContent = `${Math.round(previewState.overlayHeightPercent)}%`;
  }
  if (areaHeightHint) {
    const overlayHeightEl = areaHeightHint.querySelector('[data-hint="overlay-height-percent"]');
    if (overlayHeightEl) overlayHeightEl.textContent = `${previewState.overlayHeightPercent}%`;
  }
};

const changeAreaHeight = delta => {
  const newHeight = clamp(previewState.overlayHeightPercent + delta, AREA_HEIGHT_MIN, AREA_HEIGHT_MAX);
  if (newHeight === previewState.overlayHeightPercent) return;
  previewState.overlayHeightPercent = newHeight;
  updateAreaHeightInputs();
  applyOverlayTransform();
  drawPreview();
  if (areaHeightHint) {
    const overlayHeightEl = areaHeightHint.querySelector('[data-hint="overlay-height-percent"]');
    if (overlayHeightEl) overlayHeightEl.textContent = `${previewState.overlayHeightPercent}%`;
  }
};

const ZOOM_STEP_FINE = 0.02;
const OVERLAY_ZOOM_STEP_FINE = 0.02;

if (zoomIncreaseBtn) {
  zoomIncreaseBtn.dataset.zoomDirection = 'increase';
  setupHoldRepeater([zoomIncreaseBtn], 'data-zoom-direction', () => changeZoom(ZOOM_STEP_FINE));
}

if (zoomDecreaseBtn) {
  zoomDecreaseBtn.dataset.zoomDirection = 'decrease';
  setupHoldRepeater([zoomDecreaseBtn], 'data-zoom-direction', () => changeZoom(-ZOOM_STEP_FINE));
}

if (overlayZoomIncreaseBtn) {
  overlayZoomIncreaseBtn.dataset.overlayZoomDirection = 'increase';
  setupHoldRepeater([overlayZoomIncreaseBtn], 'data-overlay-zoom-direction', () => changeOverlayZoom(OVERLAY_ZOOM_STEP_FINE));
}

if (overlayZoomDecreaseBtn) {
  overlayZoomDecreaseBtn.dataset.overlayZoomDirection = 'decrease';
  setupHoldRepeater([overlayZoomDecreaseBtn], 'data-overlay-zoom-direction', () => changeOverlayZoom(-OVERLAY_ZOOM_STEP_FINE));
}

const MASKED_MOVE_STEP = 4;

const moveMaskedContent = direction => {
  switch (direction) {
    case 'up':
      previewState.maskedOffsetY -= MASKED_MOVE_STEP;
      break;
    case 'down':
      previewState.maskedOffsetY += MASKED_MOVE_STEP;
      break;
    case 'left':
      previewState.maskedOffsetX -= MASKED_MOVE_STEP;
      break;
    case 'right':
      previewState.maskedOffsetX += MASKED_MOVE_STEP;
      break;
    case 'center':
      previewState.maskedOffsetX = 0;
      previewState.maskedOffsetY = 0;
      break;
  }
  applyOverlayTransform();
  drawPreview();
  if (maskedMoveHint) {
    const maskedOffsetXEl = maskedMoveHint.querySelector('[data-hint="masked-offset-x"]');
    const maskedOffsetYEl = maskedMoveHint.querySelector('[data-hint="masked-offset-y"]');
    if (maskedOffsetXEl) maskedOffsetXEl.textContent = previewState.maskedOffsetX;
    if (maskedOffsetYEl) maskedOffsetYEl.textContent = previewState.maskedOffsetY;
  }
};

setupHoldRepeater(maskedMoveButtons, 'data-masked-move', dir => moveMaskedContent(dir));

if (areaHeightRange) {
  areaHeightRange.addEventListener('input', event => {
    const value = Number(event.target.value);
    previewState.overlayHeightPercent = clamp(value, AREA_HEIGHT_MIN, AREA_HEIGHT_MAX);
    updateAreaHeightInputs();
    applyOverlayTransform();
    drawPreview();
  });
  updateAreaHeightInputs();
}

if (areaHeightIncreaseBtn) {
  areaHeightIncreaseBtn.dataset.areaHeightDirection = 'increase';
  setupHoldRepeater([areaHeightIncreaseBtn], 'data-area-height-direction', () => changeAreaHeight(AREA_HEIGHT_STEP));
}

if (areaHeightDecreaseBtn) {
  areaHeightDecreaseBtn.dataset.areaHeightDirection = 'decrease';
  setupHoldRepeater([areaHeightDecreaseBtn], 'data-area-height-direction', () => changeAreaHeight(-AREA_HEIGHT_STEP));
}

const MOVE_STEP = 6;
const AREA_MOVE_STEP = 3;

const moveImage = direction => {
  switch (direction) {
    case 'up':
      previewState.offsetY -= MOVE_STEP;
      break;
    case 'down':
      previewState.offsetY += MOVE_STEP;
      break;
    case 'left':
      previewState.offsetX -= MOVE_STEP;
      break;
    case 'right':
      previewState.offsetX += MOVE_STEP;
      break;
    case 'center':
      previewState.offsetX = 0;
      previewState.offsetY = 0;
      break;
  }
  if (contentMoveHint) {
    const offsetXEl = contentMoveHint.querySelector('[data-hint="content-offset-x"]');
    const offsetYEl = contentMoveHint.querySelector('[data-hint="content-offset-y"]');
    if (offsetXEl) offsetXEl.textContent = previewState.offsetX;
    if (offsetYEl) offsetYEl.textContent = previewState.offsetY;
  }
  drawPreview();
};

setupHoldRepeater(moveButtons, 'data-move', dir => moveImage(dir));

const moveOverlay = direction => {
  switch (direction) {
    case 'up':
      previewState.overlayOffsetY -= AREA_MOVE_STEP;
      break;
    case 'down':
      previewState.overlayOffsetY += AREA_MOVE_STEP;
      break;
    case 'left':
      previewState.overlayOffsetX -= AREA_MOVE_STEP;
      break;
    case 'right':
      previewState.overlayOffsetX += AREA_MOVE_STEP;
      break;
    case 'center':
      previewState.overlayOffsetX = 0;
      previewState.overlayOffsetY = 0;
      break;
  }
  applyOverlayTransform();
  drawPreview();
  if (areaMoveHint) {
    const overlayOffsetXEl = areaMoveHint.querySelector('[data-hint="overlay-offset-x"]');
    const overlayOffsetYEl = areaMoveHint.querySelector('[data-hint="overlay-offset-y"]');
    if (overlayOffsetXEl) overlayOffsetXEl.textContent = previewState.overlayOffsetX;
    if (overlayOffsetYEl) overlayOffsetYEl.textContent = previewState.overlayOffsetY;
  }
};

setupHoldRepeater(overlayMoveButtons, 'data-overlay-move', dir => moveOverlay(dir));

// Função para validar tipos de arquivo
const validateFileType = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  return allowedTypes.includes(file.type);
};

// Função para habilitar a opção upload
const enableUploadOption = () => {
  const uploadRadio = document.querySelector('input[name="content"][value="upload"]');
  if (uploadRadio) {
    uploadRadio.disabled = false;
    hasUploadedImage = true;
  }
};

// Função para atualizar o status do upload
const updateUploadStatus = (message, isError = false) => {
  if (uploadStatus) {
    uploadStatus.textContent = message;
    uploadStatus.style.color = isError ? '#d32f2f' : '#2e7d32';
  }
};

// Event listener para o upload de imagens
if (imageUploadInput) {
  imageUploadInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    
    if (!file) {
      return;
    }
    
    // Validar tipo de arquivo
    if (!validateFileType(file)) {
      updateUploadStatus('Formato não suportado. Use apenas JPG, JPEG ou PNG.', true);
      event.target.value = ''; // Limpar o input
      return;
    }
    
    // Validar tamanho (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      updateUploadStatus('Arquivo muito grande. Máximo: 5MB.', true);
      event.target.value = ''; // Limpar o input
      return;
    }
    
    // Ler o arquivo
    const reader = new FileReader();
    reader.onload = (e) => {
      // Criar nova imagem
      const newImage = new Image();
      newImage.onload = () => {
        uploadedImage = newImage;
        enableUploadOption();
        updateUploadStatus(`Imagem carregada: ${file.name}`);
        
        // Se é o primeiro upload, automaticamente selecionar a opção upload
        const uploadRadio = document.querySelector('input[name="content"][value="upload"]');
        const isFirstUpload = !hasUploadedImage;
        
        if (uploadRadio && isFirstUpload) {
          uploadRadio.checked = true;
          updateState();
        } else if (previewState.content === 'upload') {
          // Se já havia upload e está selecionado, redesenhar
          drawPreview();
        }
      };
      newImage.onerror = () => {
        updateUploadStatus('Erro ao carregar a imagem.', true);
        event.target.value = ''; // Limpar o input
      };
      newImage.src = e.target.result;
    };
    reader.onerror = () => {
      updateUploadStatus('Erro ao ler o arquivo.', true);
      event.target.value = ''; // Limpar o input
    };
    reader.readAsDataURL(file);
  });
}

updateState();
