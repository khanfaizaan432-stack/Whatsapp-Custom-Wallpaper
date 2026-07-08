// Shared theme defaults and limits for WhatsApp Themes.
// Loaded as a classic script, so values are exposed on window.WAThemeShared.
(() => {
  'use strict';

  const defaults = Object.freeze({
    enabled: true,
    outBubbleColor: '#144d37',
    inBubbleColor: '#242626',
    outBubbleOpacity: 100,
    inBubbleOpacity: 100,
    blurIntensity: 8,
    fontFamily: '',
    fontSize: 14,
    headerColor: '#202c33',
    convHeaderOpacity: 100,
    convHeaderBlur: 0,
    chatlistHeaderColor: '#202c33',
    chatlistHeaderOpacity: 100,
    chatlistHeaderBlur: 0,
    sidebarTintColor: '#111b21',
    sidebarTintOpacity: 0,
    sidebarBlurIntensity: 8,
    sidebarColor: '#111b21',
    chatCardBgColor: '#1d1f1f',
    chatCardOpacity: 100,
    chatCardBlurIntensity: 4,
    navStripColor: '#202c33',
    navStripOpacity: 100,
    navStripBlur: 0,
  });

  const limits = Object.freeze({
    imageMaxMb: 8,
    videoMaxMb: 200,
    heavyStorageWarningMb: 300,
    ranges: Object.freeze({
      outBubbleOpacity: [0, 100, 100],
      inBubbleOpacity: [0, 100, 100],
      blurIntensity: [2, 30, 8],
      fontSize: [10, 22, 14],
      convHeaderOpacity: [0, 100, 100],
      convHeaderBlur: [0, 30, 0],
      chatlistHeaderOpacity: [0, 100, 100],
      chatlistHeaderBlur: [0, 30, 0],
      sidebarTintOpacity: [0, 100, 0],
      sidebarBlurIntensity: [2, 30, 8],
      chatCardOpacity: [0, 100, 100],
      chatCardBlurIntensity: [2, 20, 4],
      navStripOpacity: [0, 100, 100],
      navStripBlur: [0, 30, 0],
    }),
  });

  const rangeLabels = Object.freeze([
    ['outBubbleOpacity', 'outOpacityVal'],
    ['inBubbleOpacity', 'inOpacityVal'],
    ['blurIntensity', 'blurVal'],
    ['sidebarTintOpacity', 'sidebarTintVal'],
    ['sidebarBlurIntensity', 'sidebarBlurVal'],
    ['chatCardOpacity', 'chatCardOpacityVal'],
    ['chatCardBlurIntensity', 'chatCardBlurIntensityVal'],
    ['navStripOpacity', 'navStripOpacityVal'],
    ['navStripBlur', 'navStripBlurVal'],
    ['fontSize', 'fontSizeVal'],
    ['convHeaderOpacity', 'convHeaderOpacityVal'],
    ['convHeaderBlur', 'convHeaderBlurVal'],
    ['chatlistHeaderOpacity', 'chatlistHeaderOpacityVal'],
    ['chatlistHeaderBlur', 'chatlistHeaderBlurVal'],
  ]);

  window.WAThemeShared = Object.freeze({
    ...(window.WAThemeShared || {}),
    defaults,
    limits,
    rangeLabels,
  });
})();
