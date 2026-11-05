// Content script that runs on Fabasoft pages (or the custom URLs set in Settings)

let wasBusy = false;
let audioElement = null;

function urlMatches(url, patterns) {
  return patterns.some(pattern => {
    try {
      return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')).test(url);
    } catch {
      return false;
    }
  });
}

// Rendered, not hidden via visibility and not fully transparent
function isShown(el) {
  if (el.checkVisibility) {
    return el.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true });
  }
  return el.getClientRects().length > 0;
}

// Fabasoft is busy while an overlay container holds a shown <div> reading
// "Laden ..." or "Loading ...". The container on its own does not count.
function isBusyIndicatorVisible(selectors) {
  for (const selector of selectors) {
    for (const container of document.querySelectorAll(selector)) {
      for (const div of container.querySelectorAll('div')) {
        if (isBusyText(div.textContent) && isShown(div)) return true;
      }
    }
  }
  return false;
}

// The tab counts as active while it is in the foreground. Whether its window has
// focus is checked by the background script, which sees all windows.
function isPageActive() {
  return document.visibilityState === 'visible';
}

async function playNotificationSound() {
  const data = await browser.storage.local.get(['soundUrl', 'soundEnabled']);
  if (!data.soundEnabled || !data.soundUrl) return;
  try {
    if (!audioElement) audioElement = new Audio();
    audioElement.src = data.soundUrl;
    audioElement.volume = 0.5;
    audioElement.play().catch(() => {});
  } catch (e) {}
}

browser.storage.local.get(['customUrls', 'customSelectors']).then((result) => {
  const urlPatterns = result.customUrls && result.customUrls.length ? result.customUrls : FABASOFT_URL_PATTERNS;
  const selectors = result.customSelectors && result.customSelectors.length ? result.customSelectors : FABASOFT_SELECTORS;
  if (!urlMatches(window.location.href, urlPatterns)) return;

  function checkAndNotify() {
    const busy = isBusyIndicatorVisible(selectors);
    if (busy && !wasBusy && isPageActive()) playNotificationSound();
    wasBusy = busy;
    // Ping every tick: the background decides what to count, and the ping keeps the
    // background script alive.
    browser.runtime.sendMessage({ action: 'statusChanged' }).catch(() => {});
  }

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getStatus') {
      sendResponse({ isBusy: isBusyIndicatorVisible(selectors), isActive: isPageActive() });
    }
  });

  // React immediately when the user switches to or away from this tab
  document.addEventListener('visibilitychange', checkAndNotify);

  setInterval(checkAndNotify, 1000);
  checkAndNotify();
});
