export const EXPORT_RUNTIME_INTERACTIVE_SECTION = `
  function getRuntimeInteractionsByGesture(widgetId, gesture) {
    if (!runtime || !Array.isArray(runtime.interactions)) return [];
    return runtime.interactions.filter((interaction) => interaction && interaction.widgetId === widgetId && interaction.gesture === gesture);
  }

  function getRuntimeWidgetNode(widgetId) {
    return document.querySelector('[data-widget-id="' + widgetId + '"]');
  }

  function applyRuntimeWidgetVisibility(widgetId, hidden) {
    const target = getRuntimeWidgetNode(widgetId);
    if (!target) return;
    target.style.display = hidden ? 'none' : '';
    target.setAttribute('data-smx-hidden', hidden ? 'true' : 'false');
  }

  function executeRuntimeInteraction(interaction) {
    if (!interaction || !interaction.actionType) return;
    if (interaction.actionType === 'show-widget' && interaction.targetWidgetId) {
      applyRuntimeWidgetVisibility(interaction.targetWidgetId, false);
      return;
    }
    if (interaction.actionType === 'hide-widget' && interaction.targetWidgetId) {
      applyRuntimeWidgetVisibility(interaction.targetWidgetId, true);
      return;
    }
    if (interaction.actionType === 'toggle-widget' && interaction.targetWidgetId) {
      const target = getRuntimeWidgetNode(interaction.targetWidgetId);
      const hidden = target?.getAttribute('data-smx-hidden') === 'true' || target?.style.display === 'none';
      applyRuntimeWidgetVisibility(interaction.targetWidgetId, !hidden);
      return;
    }
    if (interaction.actionType === 'set-text' && interaction.targetWidgetId) {
      const target = getRuntimeWidgetNode(interaction.targetWidgetId);
      if (target) target.textContent = interaction.text || interaction.label || '';
      return;
    }
    if (interaction.actionType === 'go-to-scene') {
      const sceneIndex = interaction.targetSceneId ? findSceneIndexById(interaction.targetSceneId) : -1;
      if (sceneIndex >= 0) showScene(sceneIndex);
      else nextScene();
      return;
    }
    if (interaction.actionType === 'open-url') {
      performExit(interaction.url || '');
      return;
    }
    if (interaction.actionType === 'emit-analytics-event') {
      window.dispatchEvent(new CustomEvent('smx:analytics-event', {
        detail: {
          widgetId: interaction.widgetId,
          eventName: interaction.eventName || interaction.label || '',
          interactionId: interaction.id,
        },
      }));
    }
  }

  function triggerRuntimeGesture(widgetId, gesture) {
    getRuntimeInteractionsByGesture(widgetId, gesture).forEach((interaction) => executeRuntimeInteraction(interaction));
  }

  function updateCarousel(widgetId, nextIndex) {
    const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-image-carousel');
    if (!root) return;
    const slides = JSON.parse(root.getAttribute('data-carousel-slides') || '[]');
    const accent = root.getAttribute('data-carousel-accent') || '#ffffff';
    if (!Array.isArray(slides) || !slides.length) return;
    const length = slides.length;
    const normalizedIndex = ((nextIndex % length) + length) % length;
    root.setAttribute('data-carousel-index', String(normalizedIndex));
    const activeSlide = slides[normalizedIndex];
    const image = root.querySelector('[data-carousel-image]');
    const caption = root.querySelector('[data-carousel-caption]');
    if (image && activeSlide) {
      image.setAttribute('src', activeSlide.src || '');
      image.setAttribute('alt', shouldShowMediaCaption(activeSlide.caption) ? activeSlide.caption : '');
    }
    if (caption && activeSlide) {
      caption.textContent = shouldShowMediaCaption(activeSlide.caption) ? activeSlide.caption : '';
      caption.style.display = shouldShowMediaCaption(activeSlide.caption) ? 'block' : 'none';
    }
    root.querySelectorAll('[data-carousel-target]').forEach((dot) => {
      const target = Number(dot.getAttribute('data-carousel-target') || 0);
      dot.style.background = target === normalizedIndex ? accent : 'rgba(255,255,255,.45)';
    });
  }

  document.querySelectorAll('[data-smx-action="carousel-prev"], [data-smx-action="carousel-next"], [data-smx-action="carousel-dot"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-image-carousel');
      const currentIndex = Number(root?.getAttribute('data-carousel-index') || 0);
      if (node.getAttribute('data-smx-action') === 'carousel-prev') updateCarousel(widgetId, currentIndex - 1);
      if (node.getAttribute('data-smx-action') === 'carousel-next') updateCarousel(widgetId, currentIndex + 1);
      if (node.getAttribute('data-smx-action') === 'carousel-dot') updateCarousel(widgetId, Number(node.getAttribute('data-carousel-target') || 0));
    });
  });

  function updateGallery(widgetId, nextIndex) {
    const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-interactive-gallery');
    if (!root) return;
    const slides = JSON.parse(root.getAttribute('data-gallery-slides') || '[]');
    const accent = root.getAttribute('data-gallery-accent') || '#111827';
    const total = Math.max(1, Array.isArray(slides) && slides.length ? slides.length : Number(root.getAttribute('data-gallery-count') || 4));
    const normalizedIndex = ((nextIndex % total) + total) % total;
    root.setAttribute('data-gallery-index', String(normalizedIndex));
    const card = root.querySelector('[data-gallery-card]');
    const image = root.querySelector('[data-gallery-image]');
    const caption = root.querySelector('[data-gallery-caption]');
    const count = root.querySelector('[data-gallery-count]');
    const activeSlide = Array.isArray(slides) ? slides[normalizedIndex] : null;
    if (image && activeSlide) {
      image.setAttribute('src', activeSlide.src || '');
      image.setAttribute('alt', shouldShowMediaCaption(activeSlide.caption) ? activeSlide.caption : '');
    }
    if (caption && activeSlide) {
      caption.textContent = shouldShowMediaCaption(activeSlide.caption) ? activeSlide.caption : '';
      caption.style.display = shouldShowMediaCaption(activeSlide.caption) ? 'block' : 'none';
    }
    if (count) count.textContent = String(normalizedIndex + 1) + ' / ' + String(total);
    if (!image && card) card.textContent = String(normalizedIndex + 1) + ' / ' + String(total);
    root.querySelectorAll('[data-gallery-target]').forEach((dot) => {
      const target = Number(dot.getAttribute('data-gallery-target') || 0);
      dot.style.background = target === normalizedIndex ? accent : 'rgba(255,255,255,.4)';
    });
  }

  document.querySelectorAll('[data-smx-action="gallery-prev"], [data-smx-action="gallery-next"], [data-smx-action="gallery-dot"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-interactive-gallery');
      const currentIndex = Number(root?.getAttribute('data-gallery-index') || 0);
      if (node.getAttribute('data-smx-action') === 'gallery-prev') updateGallery(widgetId, currentIndex - 1);
      if (node.getAttribute('data-smx-action') === 'gallery-next') updateGallery(widgetId, currentIndex + 1);
      if (node.getAttribute('data-smx-action') === 'gallery-dot') updateGallery(widgetId, Number(node.getAttribute('data-gallery-target') || 0));
    });
  });

  function updateShoppable(widgetId, nextIndex) {
    const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-shoppable-sidebar');
    if (!root) return;
    const products = JSON.parse(root.getAttribute('data-shoppable-products') || '[]');
    if (!Array.isArray(products) || !products.length) return;
    const orientation = root.getAttribute('data-shoppable-layout') || 'horizontal';
    const normalizedIndex = ((nextIndex % products.length) + products.length) % products.length;
    root.setAttribute('data-shoppable-index', String(normalizedIndex));
    const track = root.querySelector('[data-shoppable-track]');
    if (!track) return;
    const gap = 12;
    const firstCard = track.querySelector('[data-shoppable-card]');
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : Number(root.getAttribute('data-shoppable-card-width') || 124);
    const cardHeight = firstCard ? firstCard.getBoundingClientRect().height : Number(root.getAttribute('data-shoppable-card-height') || 164);
    track.style.transform = orientation === 'vertical'
      ? 'translateY(-' + String(normalizedIndex * (cardHeight + gap)) + 'px)'
      : 'translateX(-' + String(normalizedIndex * (cardWidth + gap)) + 'px)';
  }

  document.querySelectorAll('[data-smx-action="shoppable-prev"], [data-smx-action="shoppable-next"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-shoppable-sidebar');
      const currentIndex = Number(root?.getAttribute('data-shoppable-index') || 0);
      if (node.getAttribute('data-smx-action') === 'shoppable-prev') updateShoppable(widgetId, currentIndex - 1);
      if (node.getAttribute('data-smx-action') === 'shoppable-next') updateShoppable(widgetId, currentIndex + 1);
    });
  });

  document.querySelectorAll('[data-smx-action="shoppable-cta"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      performExit(node.getAttribute('data-product-url') || '');
    });
  });

  document.querySelectorAll('.widget-shoppable-sidebar[data-widget-id]').forEach((root) => {
    const products = JSON.parse(root.getAttribute('data-shoppable-products') || '[]');
    const autoscroll = root.getAttribute('data-shoppable-autoscroll') === 'true';
    const interval = Math.max(1000, Number(root.getAttribute('data-shoppable-interval') || 2600));
    if (!Array.isArray(products) || products.length <= 1 || !autoscroll) return;
    window.setInterval(() => {
      const widgetId = root.getAttribute('data-widget-id') || '';
      const currentIndex = Number(root.getAttribute('data-shoppable-index') || 0);
      updateShoppable(widgetId, currentIndex + 1);
    }, interval);
  });

  document.querySelectorAll('[data-smx-action="button-select"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      const kind = node.getAttribute('data-button-kind') || 'primary';
      const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-buttons');
      if (root) {
        root.querySelectorAll('[data-smx-action="button-select"]').forEach((button) => {
          const isActive = button === node;
          if (button.getAttribute('data-button-kind') === 'primary') {
            button.style.background = isActive ? '#ffffff' : '';
            button.style.color = '#111827';
          } else {
            button.style.background = isActive ? 'rgba(255,255,255,.16)' : 'transparent';
            button.style.color = '#ffffff';
          }
        });
      }
      performExit(resolveExitUrl(widgetId));
      if (kind === 'secondary' && scenes.length > 1) nextScene();
    });
  });

  document.querySelectorAll('.widget-form[data-widget-id]').forEach((root) => {
    let draftTimer = null;
    const submitDraft = async () => {
      const submitTargetType = root.getAttribute('data-form-target-type') || 'none';
      const submitUrl = root.getAttribute('data-form-submit-url') || '';
      const method = root.getAttribute('data-form-method') || 'POST';
      const consentRequired = root.getAttribute('data-form-consent-required') === 'true';
      const inputOne = root.querySelector('[data-form-input="one"]');
      const inputTwo = root.querySelector('[data-form-input="two"]');
      const inputThree = root.querySelector('[data-form-input="three"]');
      const consent = root.querySelector('[data-form-consent"]');
      if (submitTargetType !== 'webhook' || !submitUrl) return;
      try {
        await fetch(submitUrl, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              [root.getAttribute('data-form-field-one') || 'fieldOne']: inputOne ? inputOne.value : '',
              [root.getAttribute('data-form-field-two') || 'fieldTwo']: inputTwo ? inputTwo.value : '',
              [root.getAttribute('data-form-field-three') || 'fieldThree']: inputThree ? inputThree.value : '',
              consent: consentRequired ? String(Boolean(consent && consent.checked)) : 'not-required',
            },
            widgetId: root.getAttribute('data-widget-id') || '',
            event: 'draft',
          }),
        });
      } catch (_error) {}
    };
    root.querySelectorAll('[data-form-input], [data-form-consent]').forEach((field) => {
      field.addEventListener('input', () => {
        if (draftTimer) window.clearTimeout(draftTimer);
        draftTimer = window.setTimeout(submitDraft, 650);
      });
      field.addEventListener('change', () => {
        if (draftTimer) window.clearTimeout(draftTimer);
        draftTimer = window.setTimeout(submitDraft, 200);
      });
    });
    root.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitTargetType = root.getAttribute('data-form-target-type') || 'none';
      const submitUrl = root.getAttribute('data-form-submit-url') || '';
      const method = root.getAttribute('data-form-method') || 'POST';
      const successMessage = root.getAttribute('data-form-success-message') || 'Submitted';
      const consentRequired = root.getAttribute('data-form-consent-required') === 'true';
      const inputOne = root.querySelector('[data-form-input="one"]');
      const inputTwo = root.querySelector('[data-form-input="two"]');
      const inputThree = root.querySelector('[data-form-input="three"]');
      const consent = root.querySelector('[data-form-consent"]');
      const status = root.querySelector('[data-form-status]');
      const button = root.querySelector('[type="submit"]');
      if (consentRequired && consent && !consent.checked) {
        if (status) status.textContent = 'Accept consent to continue';
        return;
      }
      if (button) button.textContent = 'Submitting…';
      try {
        if (submitTargetType === 'webhook' && submitUrl) {
          await fetch(submitUrl, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                [root.getAttribute('data-form-field-one') || 'fieldOne']: inputOne ? inputOne.value : '',
                [root.getAttribute('data-form-field-two') || 'fieldTwo']: inputTwo ? inputTwo.value : '',
                [root.getAttribute('data-form-field-three') || 'fieldThree']: inputThree ? inputThree.value : '',
                consent: consentRequired ? String(Boolean(consent && consent.checked)) : 'not-required',
              },
              widgetId: root.getAttribute('data-widget-id') || '',
            }),
          });
        }
        if (status) status.textContent = successMessage;
        if (button) button.textContent = successMessage;
      } catch (_error) {
        if (status) status.textContent = 'Retry submit';
        if (button) button.textContent = 'Retry submit';
      }
    });
  });

  document.querySelectorAll('[data-smx-action="hotspot-toggle"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-interactive-hotspot');
      const panel = root?.querySelector('[data-hotspot-panel]');
      const label = root?.querySelector('[data-hotspot-label]');
      const isOpen = panel?.style.display === 'grid';
      const autoCloseMs = Math.max(0, Number(root?.getAttribute('data-hotspot-auto-close-ms') || 0));
      const existingTimer = root && root.__smxHotspotTimer;
      if (existingTimer) {
        window.clearTimeout(existingTimer);
        root.__smxHotspotTimer = 0;
      }
      if (panel) panel.style.display = isOpen ? 'none' : 'grid';
      if (label) label.style.display = isOpen ? 'block' : 'none';
      if (!isOpen && autoCloseMs > 0 && root) {
        root.__smxHotspotTimer = window.setTimeout(() => {
          if (panel) panel.style.display = 'none';
          if (label) label.style.display = 'block';
          root.__smxHotspotTimer = 0;
        }, autoCloseMs);
      }
    });
  });

  function runSpeedTest(widgetId) {
    const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-speed-test');
    if (!root || root.getAttribute('data-speed-running') === 'true') return;
    const min = Number(root.getAttribute('data-speed-min') || 10);
    const max = Number(root.getAttribute('data-speed-max') || 100);
    const fixedValue = Number(root.getAttribute('data-speed-current') || 64);
    const duration = Math.max(300, Number(root.getAttribute('data-speed-duration') || 1800));
    const mode = root.getAttribute('data-speed-result-mode') || 'random';
    const units = root.getAttribute('data-speed-units') || 'Mbps';
    const fastThreshold = Number(root.getAttribute('data-speed-fast-threshold') || 70);
    const fastMessage = root.getAttribute('data-speed-fast-message') || 'WOW, very fast network';
    const slowMessage = root.getAttribute('data-speed-slow-message') || 'Slow connection';
    const button = root.querySelector('[data-smx-action="speed-test-start"]');
    const value = root.querySelector('[data-speed-value]');
    const bar = root.querySelector('[data-speed-bar]');
    const status = root.querySelector('[data-speed-status]');
    const needle = root.querySelector('[data-speed-needle]');
    const target = mode === 'fixed'
      ? Math.max(min, Math.min(max, fixedValue))
      : Math.max(min, Math.min(max, Math.round(min + Math.random() * Math.max(1, max - min))));
    const startedAt = performance.now();

    root.setAttribute('data-speed-running', 'true');
    if (button) button.textContent = 'Testing…';
    if (bar) bar.style.width = '0%';
    if (value) value.innerHTML = String(min) + '<span style="font-size:13px;opacity:.8;"> ' + units + '</span>';

    function tick(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(min + (target - min) * eased);
      const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
      const isFast = current >= fastThreshold;
      if (bar) bar.style.width = pct + '%';
      if (bar) bar.style.background = isFast ? '#22c55e' : '#ef4444';
      if (needle) {
        needle.style.background = isFast ? '#22c55e' : '#ef4444';
        needle.style.boxShadow = '0 0 16px ' + (isFast ? '#22c55e' : '#ef4444');
        needle.style.transform = 'translateX(-50%) rotate(' + String(-92 + pct * 1.84) + 'deg)';
      }
      if (value) value.innerHTML = String(current) + '<span style="font-size:13px;opacity:.8;"> ' + units + '</span>';
      if (status) {
        status.textContent = isFast ? fastMessage : slowMessage;
        status.style.color = isFast ? '#22c55e' : '#ef4444';
      }
      if (progress < 1) {
        window.requestAnimationFrame(tick);
        return;
      }
      root.setAttribute('data-speed-running', 'false');
      root.setAttribute('data-speed-current', String(target));
      if (button) button.textContent = button.getAttribute('data-original-label') || button.textContent || 'Start test';
    }

    window.requestAnimationFrame(tick);
  }

  document.querySelectorAll('[data-smx-action="speed-test-start"]').forEach((node) => {
    if (!node.getAttribute('data-original-label')) {
      node.setAttribute('data-original-label', node.textContent || 'Start test');
    }
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      runSpeedTest(widgetId);
    });
  });

  document.querySelectorAll('[data-smx-action="range-update"]').forEach((node) => {
    node.addEventListener('input', () => {
      const root = node.closest('[data-widget-id]');
      const valueLabel = root?.querySelector('[data-range-value]');
      if (valueLabel) {
        const prefix = valueLabel.textContent?.split(':')[0] || 'Value';
        valueLabel.textContent = prefix + ': ' + node.value + (node.getAttribute('data-units') || '');
      }
    });
  });
`;
