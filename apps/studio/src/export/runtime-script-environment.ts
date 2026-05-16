export const EXPORT_RUNTIME_ENVIRONMENT_SECTION = ``;

export const EXPORT_RUNTIME_FONTS_SECTION = `
  function inferRuntimeFontFormat(src) {
    const normalized = String(src || '').toLowerCase();
    if (normalized.includes('.woff2')) return 'woff2';
    if (normalized.includes('.woff')) return 'woff';
    if (normalized.includes('.ttf')) return 'truetype';
    if (normalized.includes('.otf')) return 'opentype';
    return '';
  }

  function ensureRuntimeFontFaces() {
    if (!runtime || !Array.isArray(runtime.fontFaces) || !runtime.fontFaces.length) return;
    const styleId = 'smx-runtime-font-faces';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = runtime.fontFaces.map((fontFace) => {
      if (!fontFace || !fontFace.family || !fontFace.src) return '';
      const format = inferRuntimeFontFormat(fontFace.src);
      return '@font-face{font-family:"' + String(fontFace.family).replace(/"/g, '\\"') + '";src:url("' + String(fontFace.src).replace(/"/g, '\\"') + '")' + (format ? ' format("' + format + '")' : '') + ';font-display:swap;font-style:normal;font-weight:400;}';
    }).join('\\n');
    document.head.appendChild(style);
  }

  ensureRuntimeFontFaces();
`;

export const EXPORT_RUNTIME_MOTION_SECTION = `
  function createRuntimeWidgetIndex() {
    if (!runtime || !Array.isArray(runtime.scenes)) return {};
    return runtime.scenes.reduce((acc, scene) => {
      if (!scene || !Array.isArray(scene.widgets)) return acc;
      scene.widgets.forEach((widget) => {
        if (widget && widget.id) acc[widget.id] = widget;
      });
      return acc;
    }, {});
  }

  function ensureRuntimeMotionStyleTag() {
    const styleId = 'smx-runtime-motion-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '@keyframes smx-runtime-hover-pulse{0%,100%{transform:var(--smx-motion-base-transform);}50%{transform:var(--smx-motion-hover-transform);}}';
    document.head.appendChild(style);
  }

  function resolveRuntimeHoverMotionConfig(widget) {
    const style = widget && widget.style ? widget.style : {};
    const preset = String(style.hoverMotionPreset || 'none');
    return {
      preset: preset === 'lift' || preset === 'zoom' || preset === 'pulse' ? preset : 'none',
      durationMs: Math.max(120, Number(style.hoverMotionDurationMs || 240)),
      distancePx: Math.max(0, Number(style.hoverMotionDistancePx || 12)),
      scale: Math.max(1, Number(style.hoverMotionScale || 1.04)),
    };
  }

  function resolveRuntimeTransforms(widget) {
    const config = resolveRuntimeHoverMotionConfig(widget);
    const rotation = Number(widget && widget.frame ? widget.frame.rotation || 0 : 0);
    const baseTransform = 'rotate(' + rotation + 'deg)';
    const hoverTransform = config.preset === 'zoom'
      ? baseTransform + ' scale(' + config.scale + ')'
      : baseTransform + ' translateY(-' + config.distancePx + 'px) scale(' + config.scale + ')';
    return { config, baseTransform, hoverTransform };
  }

  function applyRuntimeHoverMotion() {
    const widgetsById = createRuntimeWidgetIndex();
    const widgetIds = Object.keys(widgetsById);
    if (!widgetIds.length) return;
    ensureRuntimeMotionStyleTag();
    widgetIds.forEach((widgetId) => {
      const widget = widgetsById[widgetId];
      const node = document.querySelector('[data-widget-id="' + widgetId + '"]');
      if (!node || node.getAttribute('data-smx-hover-motion-bound') === 'true') return;
      const motion = resolveRuntimeTransforms(widget);
      if (motion.config.preset === 'none') return;
      node.setAttribute('data-smx-hover-motion-bound', 'true');
      node.style.setProperty('--smx-motion-base-transform', motion.baseTransform);
      node.style.setProperty('--smx-motion-hover-transform', motion.hoverTransform);
      node.style.transform = motion.baseTransform;
      node.style.transition = 'transform ' + motion.config.durationMs + 'ms ease, box-shadow ' + motion.config.durationMs + 'ms ease, filter ' + motion.config.durationMs + 'ms ease, opacity ' + motion.config.durationMs + 'ms ease';

      const activate = () => {
        if (motion.config.preset === 'pulse') {
          node.style.animation = 'smx-runtime-hover-pulse ' + motion.config.durationMs + 'ms ease-in-out infinite';
          node.style.transform = motion.baseTransform;
          return;
        }
        node.style.animation = 'none';
        node.style.transform = motion.hoverTransform;
      };

      const deactivate = () => {
        node.style.animation = 'none';
        node.style.transform = motion.baseTransform;
      };

      node.addEventListener('pointerenter', activate);
      node.addEventListener('pointerleave', deactivate);
      node.addEventListener('focus', activate);
      node.addEventListener('blur', deactivate);
    });
  }

  applyRuntimeHoverMotion();

  const smxBaseShowSceneForMotion = showScene;
  showScene = function patchedShowSceneForMotion(index) {
    smxBaseShowSceneForMotion(index);
    applyRuntimeHoverMotion();
  };
`;

export const EXPORT_RUNTIME_TIMELINE_SECTION = `
  function applyTimelineEasing(progress, easing) {
    const clamped = Math.max(0, Math.min(1, progress));
    if (easing === 'ease-in') return clamped * clamped;
    if (easing === 'ease-out') return 1 - (1 - clamped) * (1 - clamped);
    if (easing === 'ease-in-out') return clamped < 0.5 ? 2 * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
    return clamped;
  }

  function getWidgetTrackValue(widget, property, playheadMs, fallback) {
    const keyframes = widget && widget.timeline && Array.isArray(widget.timeline.keyframes) ? widget.timeline.keyframes : [];
    const track = keyframes
      .filter((item) => item && item.property === property)
      .sort((left, right) => Number(left.atMs || 0) - Number(right.atMs || 0));
    if (!track.length) return fallback;
    const before = [...track].reverse().find((item) => Number(item.atMs || 0) <= playheadMs) || track[0];
    const after = track.find((item) => Number(item.atMs || 0) >= playheadMs) || track[track.length - 1];
    if (!before || !after) return fallback;
    if (Number(after.atMs || 0) === Number(before.atMs || 0)) return Number(before.value ?? fallback);
    const progress = (playheadMs - Number(before.atMs || 0)) / Math.max(1, Number(after.atMs || 0) - Number(before.atMs || 0));
    const eased = applyTimelineEasing(progress, after.easing || 'linear');
    return Number(before.value ?? fallback) + (Number(after.value ?? fallback) - Number(before.value ?? fallback)) * eased;
  }

  function syncTimelineAnimatedWidgets(sceneRuntime, elapsedMs) {
    if (!sceneRuntime || !Array.isArray(sceneRuntime.widgets)) return;
    sceneRuntime.widgets.forEach((widget) => {
      if (!widget || !widget.timeline || !Array.isArray(widget.timeline.keyframes) || !widget.timeline.keyframes.length) return;
      const node = document.querySelector('[data-widget-id="' + widget.id + '"]');
      if (!node) return;
      const frame = widget.frame || {};
      const style = node.style;
      if (!node.getAttribute('data-smx-base-opacity')) {
        node.setAttribute('data-smx-base-opacity', style.opacity || '1');
      }
      style.left = String(getWidgetTrackValue(widget, 'x', elapsedMs, Number(frame.x || 0))) + 'px';
      style.top = String(getWidgetTrackValue(widget, 'y', elapsedMs, Number(frame.y || 0))) + 'px';
      style.width = String(getWidgetTrackValue(widget, 'width', elapsedMs, Number(frame.width || 0))) + 'px';
      style.height = String(getWidgetTrackValue(widget, 'height', elapsedMs, Number(frame.height || 0))) + 'px';
      style.opacity = String(getWidgetTrackValue(widget, 'opacity', elapsedMs, Number(node.getAttribute('data-smx-base-opacity') || 1)));
    });
  }

  let smxTimelineFrame = 0;
  function stopWidgetTimelineLoop() {
    if (!smxTimelineFrame) return;
    window.cancelAnimationFrame(smxTimelineFrame);
    smxTimelineFrame = 0;
  }

  function startWidgetTimelineLoop(sceneIndex) {
    stopWidgetTimelineLoop();
    const sceneRuntime = getRuntimeScene(sceneIndex);
    if (!sceneRuntime || !Array.isArray(sceneRuntime.widgets) || !sceneRuntime.widgets.some((widget) => widget && widget.timeline && Array.isArray(widget.timeline.keyframes) && widget.timeline.keyframes.length)) return;
    const startedAt = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
    const durationMs = Math.max(0, Number(sceneRuntime.durationMs || 0));

    function tick(now) {
      const currentNow = typeof now === 'number' ? now : (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
      const elapsedMs = Math.max(0, Math.min(durationMs || 0, Math.round(currentNow - startedAt)));
      syncTimelineAnimatedWidgets(sceneRuntime, elapsedMs);
      if (elapsedMs >= durationMs) {
        smxTimelineFrame = 0;
        return;
      }
      smxTimelineFrame = window.requestAnimationFrame(tick);
    }

    syncTimelineAnimatedWidgets(sceneRuntime, 0);
    smxTimelineFrame = window.requestAnimationFrame(tick);
  }

  const smxBaseShowScene = showScene;
  showScene = function patchedShowScene(index) {
    smxBaseShowScene(index);
    startWidgetTimelineLoop(activeSceneIndex);
  };
`;

export const EXPORT_RUNTIME_WEATHER_SECTION = `
  function resolveWeatherCondition(code) {
    if (code === 0) return 'Clear';
    if (code === 1 || code === 2) return 'Partly cloudy';
    if (code === 3) return 'Cloudy';
    if (code === 45 || code === 48) return 'Fog';
    if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return 'Drizzle';
    if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67 || code === 80 || code === 81 || code === 82) return 'Rain';
    if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return 'Snow';
    if (code === 95 || code === 96 || code === 99) return 'Storm';
    return 'Weather';
  }

  function resolveWeatherIcon(condition, isDay) {
    const normalized = String(condition || '').toLowerCase();
    if (normalized.includes('storm')) return '⛈️';
    if (normalized.includes('snow')) return '❄️';
    if (normalized.includes('rain') || normalized.includes('drizzle')) return '🌧️';
    if (normalized.includes('fog')) return '🌫️';
    if (normalized.includes('cloud')) return '☁️';
    return isDay ? '☀️' : '🌙';
  }

  function buildWeatherCacheKey(provider, latitude, longitude) {
    return 'smx-weather:' + provider + ':' + Number(latitude).toFixed(4) + ':' + Number(longitude).toFixed(4);
  }

  function readWeatherCache(key, cacheTtlMs) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const snapshot = JSON.parse(raw);
      const age = Date.now() - Date.parse(snapshot.fetchedAt);
      if (!Number.isFinite(age) || age > cacheTtlMs) return null;
      return snapshot;
    } catch {
      return null;
    }
  }

  function writeWeatherCache(key, snapshot) {
    try {
      window.localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      // ignore cache write failures
    }
  }

  function applyWeatherSnapshot(root, snapshot, statusText) {
    const temperatureNode = root.querySelector('[data-weather-temperature-display]');
    const locationNode = root.querySelector('[data-weather-location-display]');
    const conditionNode = root.querySelector('[data-weather-condition-display]');
    const iconNode = root.querySelector('[data-weather-icon]');
    const statusNode = root.querySelector('[data-weather-status]');
    if (temperatureNode) temperatureNode.textContent = String(snapshot.temperature) + '°';
    if (locationNode) locationNode.textContent = snapshot.location || '';
    if (conditionNode) conditionNode.textContent = snapshot.condition || '';
    if (iconNode) iconNode.textContent = resolveWeatherIcon(snapshot.condition, Boolean(snapshot.isDay));
    if (statusNode) statusNode.textContent = statusText;
  }

  async function initWeatherWidget(root) {
    const live = root.getAttribute('data-weather-live') === 'true';
    const provider = root.getAttribute('data-weather-provider') || 'open-meteo';
    const fetchPolicy = root.getAttribute('data-weather-fetch-policy') || 'cache-first';
    const cacheTtlMs = Math.max(1000, Number(root.getAttribute('data-weather-cache-ttl') || 300000));
    const latitude = Number(root.getAttribute('data-weather-latitude') || 0);
    const longitude = Number(root.getAttribute('data-weather-longitude') || 0);
    const location = root.getAttribute('data-weather-location') || 'Location';
    const fallbackSnapshot = {
      location,
      temperature: Number(root.getAttribute('data-weather-temperature') || 0),
      condition: root.getAttribute('data-weather-condition') || 'Weather',
      conditionCode: -1,
      isDay: true,
      fetchedAt: new Date().toISOString(),
    };

    applyWeatherSnapshot(root, fallbackSnapshot, live && provider === 'open-meteo' ? 'Fetching live weather' : 'Static preview');

    if (!live || provider !== 'open-meteo' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const cacheKey = buildWeatherCacheKey(provider, latitude, longitude);
    const cached = readWeatherCache(cacheKey, cacheTtlMs);
    if (fetchPolicy === 'cache-only') {
      if (cached) applyWeatherSnapshot(root, cached, 'Live weather');
      return;
    }
    if (fetchPolicy === 'cache-first' && cached) {
      applyWeatherSnapshot(root, cached, 'Live weather');
      return;
    }

    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(latitude));
      url.searchParams.set('longitude', String(longitude));
      url.searchParams.set('current', 'temperature_2m,weather_code,is_day');
      url.searchParams.set('timezone', 'auto');
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('weather-fetch-failed');
      const payload = await response.json();
      const current = payload && payload.current ? payload.current : null;
      if (!current) throw new Error('weather-current-missing');
      const snapshot = {
        location,
        temperature: Math.round(Number(current.temperature_2m || fallbackSnapshot.temperature)),
        conditionCode: Number(current.weather_code || 0),
        condition: resolveWeatherCondition(Number(current.weather_code || 0)),
        isDay: Number(current.is_day || 1) === 1,
        fetchedAt: new Date().toISOString(),
      };
      writeWeatherCache(cacheKey, snapshot);
      applyWeatherSnapshot(root, snapshot, 'Live weather');
    } catch {
      if (cached) {
        applyWeatherSnapshot(root, cached, 'Live weather');
        return;
      }
      applyWeatherSnapshot(root, fallbackSnapshot, 'Static fallback');
    }
  }

  document.querySelectorAll('.widget-weather-conditions[data-widget-id]').forEach((root) => {
    void initWeatherWidget(root);
  });
`;

export const EXPORT_RUNTIME_SCRATCH_SECTION = `
  function createScratchProgressCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(16, Math.min(96, Math.round(width / 4)));
    canvas.height = Math.max(16, Math.min(96, Math.round(height / 4)));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function paintScratchCover(canvas, coverImage, coverBlur, accent, onReady) {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    function fallback() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = accent + '22';
      ctx.fillRect(0, 0, width, height);
      if (onReady) onReady();
    }

    if (!coverImage) {
      fallback();
      return;
    }

    function renderImage(image) {
      ctx.clearRect(0, 0, width, height);
      const blur = Math.max(0, Number(coverBlur || 0));
      ctx.filter = blur > 0 ? 'blur(' + blur + 'px)' : 'none';
      ctx.drawImage(image, 0, 0, width, height);
      ctx.filter = 'none';
      if (onReady) onReady();
    }

    function loadImage(useCrossOrigin) {
      const image = new Image();
      if (useCrossOrigin) image.crossOrigin = 'anonymous';
      image.onload = () => renderImage(image);
      image.onerror = () => {
        if (useCrossOrigin) {
          loadImage(false);
          return;
        }
        fallback();
      };
      image.src = coverImage;
    }

    loadImage(true);
  }

  function eraseScratch(canvas, x, y, radius) {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function eraseScratchProgress(progressCanvas, x, y, radius, sourceWidth, sourceHeight) {
    const ctx = progressCanvas?.getContext('2d');
    if (!ctx) return 0;
    const scaleX = progressCanvas.width / Math.max(1, sourceWidth);
    const scaleY = progressCanvas.height / Math.max(1, sourceHeight);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x * scaleX, y * scaleY, radius * Math.max(scaleX, scaleY), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const pixels = ctx.getImageData(0, 0, progressCanvas.width, progressCanvas.height).data;
    let cleared = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] === 0) cleared += 1;
    }
    return (cleared / Math.max(1, progressCanvas.width * progressCanvas.height)) * 100;
  }

  function initializeScratchMask(canvas) {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function applyScratchMask(maskTarget, maskCanvas) {
    if (!maskTarget || !maskCanvas) return;
    const dataUrl = maskCanvas.toDataURL('image/png');
    maskTarget.style.webkitMaskImage = 'url("' + dataUrl + '")';
    maskTarget.style.maskImage = 'url("' + dataUrl + '")';
    maskTarget.style.webkitMaskSize = '100% 100%';
    maskTarget.style.maskSize = '100% 100%';
    maskTarget.style.webkitMaskRepeat = 'no-repeat';
    maskTarget.style.maskRepeat = 'no-repeat';
    maskTarget.style.webkitMaskPosition = 'center';
    maskTarget.style.maskPosition = 'center';
  }

  function playScratchRevealRevealAnimation(node, preset, durationMs, delayMs) {
    if (!node || !preset || preset === 'none' || typeof node.animate !== 'function') return;
    node.getAnimations?.().forEach((animation) => animation.cancel());
    const duration = Math.max(150, Math.min(3000, Number(durationMs || 700)));
    const delay = Math.max(0, Math.min(3000, Number(delayMs || 0)));
    const keyframes =
      preset === 'appear'
        ? [{ opacity: 0 }, { opacity: 1 }]
        : preset === 'fade-up'
          ? [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0px)' }]
          : [{ opacity: 0.35, transform: 'scale(0.92)' }, { opacity: 1, transform: 'scale(1)' }];
    node.animate(keyframes, { duration, delay, easing: 'ease-out', fill: 'backwards' });
  }

  function initScratchReveal(root) {
    const canvas = root?.querySelector('[data-scratch-canvas]');
    if (!canvas) return;
    const revealMedia = root.querySelector('[data-scratch-reveal-media]');
    const maskTarget = root.querySelector('[data-scratch-mask-target]');
    const accent = root.getAttribute('data-scratch-accent') || '#f97316';
    const coverImage = root.getAttribute('data-scratch-cover-image') || '';
    const coverBlur = Number(root.getAttribute('data-scratch-cover-blur') || 0);
    const scratchRadius = Math.max(8, Number(root.getAttribute('data-scratch-radius') || 22));
    const autoRevealThreshold = Math.max(0, Math.min(100, Number(root.getAttribute('data-scratch-auto-reveal-threshold') || 10)));
    const revealAnimationPreset = root.getAttribute('data-scratch-reveal-animation') || 'none';
    const revealAnimationDuration = Number(root.getAttribute('data-scratch-reveal-animation-duration') || 700);
    const revealAnimationDelay = Number(root.getAttribute('data-scratch-reveal-animation-delay') || 0);
    const state = { pointerActive: false, completed: false, progressCanvas: null };

    function syncCanvasSize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      state.progressCanvas = createScratchProgressCanvas(canvas.width, canvas.height);
      state.completed = false;
      revealMedia?.getAnimations?.().forEach((animation) => animation.cancel());
      if (maskTarget) {
        maskTarget.style.opacity = '1';
        initializeScratchMask(canvas);
        applyScratchMask(maskTarget, canvas);
        canvas.style.opacity = '0';
        return;
      }
      paintScratchCover(canvas, coverImage, coverBlur, accent, () => {
        canvas.style.opacity = '1';
      });
    }

    function scratchAtEvent(event) {
      if (state.completed) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
      const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
      eraseScratch(canvas, x, y, scratchRadius);
      if (maskTarget) applyScratchMask(maskTarget, canvas);
      if (!state.progressCanvas || autoRevealThreshold <= 0) return;
      const clearedPercent = eraseScratchProgress(state.progressCanvas, x, y, scratchRadius, canvas.width, canvas.height);
      if (clearedPercent < autoRevealThreshold) return;
      state.completed = true;
      if (maskTarget) {
        maskTarget.style.opacity = '0';
        maskTarget.style.webkitMaskImage = 'none';
        maskTarget.style.maskImage = 'none';
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      playScratchRevealRevealAnimation(revealMedia, revealAnimationPreset, revealAnimationDuration, revealAnimationDelay);
      if (typeof triggerRuntimeGesture === 'function') {
        triggerRuntimeGesture(root.getAttribute('data-scratch-widget-id') || '', 'scratch-complete');
      }
    }

    canvas.style.opacity = '0';
    syncCanvasSize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => syncCanvasSize());
      observer.observe(canvas);
    } else {
      window.addEventListener('resize', syncCanvasSize);
    }

    canvas.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary) return;
      event.preventDefault();
      state.pointerActive = true;
      canvas.setPointerCapture?.(event.pointerId);
      scratchAtEvent(event);
    });
    canvas.addEventListener('pointermove', (event) => {
      event.preventDefault();
      if (!state.pointerActive) return;
      scratchAtEvent(event);
    });
    canvas.addEventListener('pointerup', (event) => {
      state.pointerActive = false;
      canvas.releasePointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointercancel', (event) => {
      state.pointerActive = false;
      canvas.releasePointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('lostpointercapture', () => {
      state.pointerActive = false;
    });
  }

  document.querySelectorAll('.scratch-reveal-shell[data-scratch-widget-id]').forEach((node) => {
    initScratchReveal(node);
  });
`;

export const EXPORT_RUNTIME_COUNTDOWN_SECTION = `
  function renderCountdown(root) {
    const total = Math.max(0, Number(root?.getAttribute('data-countdown-seconds') || 0));
    const startedAt = Date.now();

    function applySegments(remaining) {
      const days = Math.floor(remaining / 86400);
      const hours = Math.floor((remaining % 86400) / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;
      const values = { DD: days, HH: hours, MM: minutes, SS: seconds };
      Object.entries(values).forEach(([label, value]) => {
        const node = root?.querySelector('[data-countdown-value="' + label + '"]');
        if (node) node.textContent = String(value).padStart(2, '0');
      });
    }

    function tick() {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, total - elapsed);
      applySegments(remaining);
      if (remaining <= 0) return;
      window.setTimeout(tick, 1000);
    }

    applySegments(total);
    if (total > 0) window.setTimeout(tick, 1000);
  }

  document.querySelectorAll('.widget-countdown[data-widget-id]').forEach((node) => {
    renderCountdown(node);
  });
`;
