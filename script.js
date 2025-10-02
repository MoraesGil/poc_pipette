const inner = document.querySelector('.inner-div');
const preview = document.querySelector('.bat-preview');
const previewCanvas = document.getElementById('bat-preview-canvas');
const orientationRadios = document.querySelectorAll('input[name="orientation"]');
const viewRadios = document.querySelectorAll('input[name="view"]');
const contentRadios = document.querySelectorAll('input[name="content"]');

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
};

const applyOrientation = value => {
  previewState.orientation = value;
  applyModifier([inner, preview], 'orientation', value, orientationValues);
};

const applyView = value => {
  previewState.view = value;
  applyModifier([inner, preview], 'view', value, viewValues);
};

const applyContent = value => {
  previewState.content = value;
  applyModifier([preview], 'content', value, ['image', 'color']);
};

const getRadioValue = name => {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : null;
};

const BASE_PREVIEW_WIDTH = 200;
const BASE_PREVIEW_HEIGHT = 60;
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

  if (previewState.content === 'image') {
    ctx.save();
    if (previewState.orientation === 'right' && previewState.view === 'top') {
      ctx.translate(rect.width / 2, rect.height / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-rect.width / 2, -rect.height / 2);
    }
    const imgWidth = contentImage.naturalWidth || contentImage.width;
    const imgHeight = contentImage.naturalHeight || contentImage.height;
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

    const drawX = maskX + (maskWidth - drawWidth) / 2;
    const drawY = maskY + (maskHeight - drawHeight) / 2;

    ctx.drawImage(contentImage, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskImage, maskX, maskY, maskWidth, maskHeight);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.fillRect(maskX, maskY, maskWidth, maskHeight);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskImage, maskX, maskY, maskWidth, maskHeight);
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

updateState();
