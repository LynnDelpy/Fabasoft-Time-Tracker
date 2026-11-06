// Content script that runs on Fabasoft pages

let wasBusy = false;
let audioElement = null;

// Loading overlay containers: the configurable list from Settings → Detection,
// falling back to the built-in default. Loaded from storage and kept in sync.
let selectors = FABASOFT_SELECTORS;
chrome.storage.local.get(['customSelectors']).then((data) => {
  selectors = pickSelectors(data.customSelectors);
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.customSelectors) selectors = pickSelectors(changes.customSelectors.newValue);
});

// Rendered, not hidden via visibility and not fully transparent
function isShown(el) {
  if (el.checkVisibility) {
    return el.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true });
  }
  return el.getClientRects().length > 0;
}

// Fabasoft is busy while an overlay container holds a shown <div> reading
// "Laden ..." or "Loading ...". The container on its own does not count.
function isBusyIndicatorVisible() {
  for (const selector of selectors) {
    for (const container of document.querySelectorAll(selector)) {
      for (const div of container.querySelectorAll('div')) {
        if (isBusyText(div.textContent) && isShown(div)) return true;
      }
    }
  }
  return false;
}

// The tab counts as active while it is in the foreground. Focus is decided by the
// background script, which combines the window focus it sees with document.hasFocus().
function isPageActive() {
  return document.visibilityState === 'visible';
}

function checkAndNotify() {
  const busy = isBusyIndicatorVisible();
  if (busy && !wasBusy && isPageActive()) playNotificationSound();
  wasBusy = busy;
  // Ping every tick: the background decides what to count, and the ping keeps the
  // service worker alive.
  chrome.runtime.sendMessage({ action: 'statusChanged' }).catch(() => {});
}

async function playNotificationSound() {
  const data = await chrome.storage.local.get(['soundUrl', 'soundEnabled']);
  if (!data.soundEnabled || !data.soundUrl) return;
  try {
    if (!audioElement) audioElement = new Audio();
    audioElement.src = data.soundUrl;
    audioElement.volume = 0.5;
    audioElement.play().catch(() => {});
  } catch (e) {}
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    sendResponse({ isBusy: isBusyIndicatorVisible(), isActive: isPageActive(), hasFocus: document.hasFocus() });
  }
});

// React immediately when the user switches to or away from this tab or window
document.addEventListener('visibilitychange', checkAndNotify);
window.addEventListener('focus', checkAndNotify);
window.addEventListener('blur', checkAndNotify);

setInterval(checkAndNotify, 1000);
checkAndNotify();
