// Content script that runs on Fabasoft pages (or the custom URLs set in Settings)

let wasBusy = false;
let wasActive = false;
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

// A busy indicator counts as visible while it is rendered (offsetParent is null for hidden elements)
function isBusyIndicatorVisible(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el.offsetParent !== null) {
      return true;
    }
  }
  return false;
}

// The page counts as active while this tab is in the foreground (visible and not minimized).
// This is what drives the total "time on Fabasoft" counter.
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
    // Busy indicator → "wasted" time spent waiting
    if (isBusyIndicatorVisible(selectors)) {
      if (!wasBusy) {
        wasBusy = true;
        playNotificationSound();
      }
      // Resend busyStarted every tick while visible so a missed message doesn't
      // leave the timer stopped and the background script gets a keep-alive ping.
      browser.runtime.sendMessage({ action: 'busyStarted' }).catch(() => {});
    } else if (wasBusy) {
      wasBusy = false;
      browser.runtime.sendMessage({ action: 'busyStopped' }).catch(() => {});
    }

    // Foreground page → total time spent on Fabasoft
    if (isPageActive()) {
      wasActive = true;
      browser.runtime.sendMessage({ action: 'activeStarted' }).catch(() => {});
    } else if (wasActive) {
      wasActive = false;
      browser.runtime.sendMessage({ action: 'activeStopped' }).catch(() => {});
    }
  }

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getStatus') {
      sendResponse({ isBusy: isBusyIndicatorVisible(selectors), isActive: isPageActive() });
    }
  });

  // React immediately when the user switches to or away from this tab
  document.addEventListener('visibilitychange', checkAndNotify);

  window.addEventListener('beforeunload', () => {
    if (wasBusy) {
      browser.runtime.sendMessage({ action: 'busyStopped' }).catch(() => {});
    }
    if (wasActive) {
      browser.runtime.sendMessage({ action: 'activeStopped' }).catch(() => {});
    }
  });

  setInterval(checkAndNotify, 1000);
  checkAndNotify();
});
