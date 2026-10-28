// Background service worker for the extension

importScripts('shared.js');

let busyInterval = null;
let busyRunning = false;
let activeInterval = null;
let activeRunning = false;
let serverReachable = true; // session-only flag, checked on startup

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(null);
  if (data.lastReset !== undefined) return;

  const initial = {
    todaySeconds: 0,
    totalSeconds: 0,
    lastReset: new Date().toDateString(),
    dailyData: {},
    activeTodaySeconds: 0,
    activeTotalSeconds: 0,
    activeLastReset: new Date().toDateString(),
    activeDailyData: {},
    soundEnabled: false,
    soundUrl: null,
    leaderboardEnabled: false
  };

  // Carry over stats and the music setting from Fabasoft Time Tracker 1.x
  if (typeof data.totalTime === 'number') {
    Object.assign(initial, convertLegacyData(data), {
      soundEnabled: !!data.playMusic,
      soundUrl: data.musicDataUrl || null,
      soundFileName: data.musicDataUrl ? 'Fabasoft Time Tracker 1.x' : null
    });
  }

  await chrome.storage.local.set(initial);

  const legacyKeys = Object.keys(data).filter(key =>
    key === 'totalTime' || key === 'playMusic' || key === 'musicDataUrl' || key.startsWith('today_'));
  if (legacyKeys.length) await chrome.storage.local.remove(legacyKeys);
});

async function checkServerReachability() {
  const data = await chrome.storage.local.get(['leaderboardEnabled', 'leaderboardServer']);
  if (data.leaderboardEnabled === false) return;
  const serverUrl = getLeaderboardServer(data.leaderboardServer);
  if (!serverUrl) {
    serverReachable = false;
    return;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${serverUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);
    serverReachable = res.ok;
  } catch (e) {
    serverReachable = false;
  }
}

checkServerReachability();

// Re-check when the leaderboard settings change so a newly entered server works without a restart
chrome.storage.onChanged.addListener((changes) => {
  if (changes.leaderboardServer || changes.leaderboardEnabled) checkServerReachability();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'busyStarted') {
    startBusyTimer();
  } else if (request.action === 'busyStopped') {
    stopBusyTimer();
  } else if (request.action === 'activeStarted') {
    startActiveTimer();
  } else if (request.action === 'activeStopped') {
    stopActiveTimer();
  } else if (request.action === 'getServerStatus') {
    sendResponse({ reachable: serverReachable });
  }
});

// Timer for "wasted" time — counts while the busy indicator is on screen
function startBusyTimer() {
  if (busyRunning) return;
  busyRunning = true;

  if (!busyInterval) {
    busyInterval = setInterval(async () => {
      const data = await chrome.storage.local.get(['todaySeconds', 'totalSeconds', 'lastReset', 'dailyData']);
      let todaySeconds = data.todaySeconds || 0;
      let totalSeconds = data.totalSeconds || 0;
      let dailyData = data.dailyData || {};

      const currentDate = new Date().toDateString();
      if (currentDate !== data.lastReset) {
        todaySeconds = 0;
      }

      todaySeconds++;
      totalSeconds++;
      dailyData[currentDate] = (dailyData[currentDate] || 0) + 1;

      await chrome.storage.local.set({
        todaySeconds,
        totalSeconds,
        lastReset: currentDate,
        dailyData
      });

      chrome.action.setBadgeText({ text: formatTimeShort(todaySeconds) });
      chrome.action.setBadgeBackgroundColor({ color: '#ff6b6b' });
    }, 1000);
  }
}

function stopBusyTimer() {
  if (busyInterval) {
    clearInterval(busyInterval);
    busyInterval = null;
  }
  busyRunning = false;
  chrome.action.setBadgeText({ text: '' });
  uploadStats();
}

// Timer for total time — counts while an Fabasoft tab is in the foreground
function startActiveTimer() {
  if (activeRunning) return;
  activeRunning = true;

  if (!activeInterval) {
    activeInterval = setInterval(async () => {
      const data = await chrome.storage.local.get(['activeTodaySeconds', 'activeTotalSeconds', 'activeLastReset', 'activeDailyData']);
      let activeTodaySeconds = data.activeTodaySeconds || 0;
      let activeTotalSeconds = data.activeTotalSeconds || 0;
      let activeDailyData = data.activeDailyData || {};

      const currentDate = new Date().toDateString();
      if (currentDate !== data.activeLastReset) {
        activeTodaySeconds = 0;
      }

      activeTodaySeconds++;
      activeTotalSeconds++;
      activeDailyData[currentDate] = (activeDailyData[currentDate] || 0) + 1;

      await chrome.storage.local.set({
        activeTodaySeconds,
        activeTotalSeconds,
        activeLastReset: currentDate,
        activeDailyData
      });
    }, 1000);
  }
}

function stopActiveTimer() {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
  activeRunning = false;
  uploadStats();
}

async function uploadStats() {
  if (!serverReachable) return;
  const data = await chrome.storage.local.get([
    'totalSeconds', 'todaySeconds', 'leaderboardEnabled', 'leaderboardUsername', 'leaderboardServer', 'lastUploadedUsername'
  ]);
  if (data.leaderboardEnabled === false) return;
  const username = (data.leaderboardUsername || '').trim();
  if (!username) return;
  const serverUrl = getLeaderboardServer(data.leaderboardServer);
  if (!serverUrl) return;

  const lastUploaded = (data.lastUploadedUsername || '').trim();
  if (lastUploaded && lastUploaded !== username) {
    try {
      await fetch(`${serverUrl}/api/user/${encodeURIComponent(lastUploaded)}`, { method: 'DELETE' });
    } catch (e) {}
  }

  try {
    const res = await fetch(`${serverUrl}/api/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        totalSeconds: data.totalSeconds || 0,
        todaySeconds: data.todaySeconds || 0
      })
    });
    if (res.ok) {
      await chrome.storage.local.set({ lastUploadedUsername: username });
    }
  } catch (e) {}
}

// Periodic upload every 5 minutes while extension is active
setInterval(uploadStats, 5 * 60 * 1000);

// Polling fallback: catches cases where content script messages are lost
setInterval(async () => {
  const tabs = await chrome.tabs.query({ url: FABASOFT_URL_PATTERNS });

  if (tabs.length === 0) {
    if (busyRunning) stopBusyTimer();
    if (activeRunning) stopActiveTimer();
    return;
  }

  let anyBusy = false;
  let anyActive = false;
  for (const tab of tabs) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
      if (response?.isBusy) anyBusy = true;
      if (response?.isActive) anyActive = true;
    } catch (e) {}
  }

  if (anyBusy && !busyRunning) startBusyTimer();
  else if (!anyBusy && busyRunning) stopBusyTimer();

  if (anyActive && !activeRunning) startActiveTimer();
  else if (!anyActive && activeRunning) stopActiveTimer();
}, 2000);

function formatTimeShort(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
