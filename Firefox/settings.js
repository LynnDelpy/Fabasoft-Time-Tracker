// Settings page script

const languageSelect = document.getElementById('language');
const soundEnabledCheckbox = document.getElementById('soundEnabled');
const soundSettings = document.getElementById('soundSettings');
const soundFileInput = document.getElementById('soundFile');
const currentSoundDiv = document.getElementById('currentSound');
const soundPreview = document.getElementById('soundPreview');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFileInput = document.getElementById('importFile');
const resetAllBtn = document.getElementById('resetAllBtn');
const messageDiv = document.getElementById('message');

const leaderboardEnabledCheckbox = document.getElementById('leaderboardEnabled');
const leaderboardUsernameInput = document.getElementById('leaderboardUsername');
const leaderboardServerInput = document.getElementById('leaderboardServer');
const saveLeaderboardBtn = document.getElementById('saveLeaderboardBtn');

const customUrlsInput = document.getElementById('customUrls');
const customSelectorsInput = document.getElementById('customSelectors');
const saveDetectionBtn = document.getElementById('saveDetectionBtn');

if (DEFAULT_LEADERBOARD_SERVER) leaderboardServerInput.placeholder = DEFAULT_LEADERBOARD_SERVER;
customUrlsInput.placeholder = FABASOFT_URL_PATTERNS.join('\n');
customSelectorsInput.placeholder = FABASOFT_SELECTORS.join('\n');

// Load settings on page load
window.addEventListener('DOMContentLoaded', () => initLanguage().then(loadSettings));

async function loadSettings() {
  const data = await browser.storage.local.get(['soundEnabled', 'soundUrl', 'soundFileName', 'leaderboardEnabled', 'leaderboardUsername', 'leaderboardServer', 'customUrls', 'customSelectors']);

  languageSelect.value = currentLanguage;

  soundEnabledCheckbox.checked = data.soundEnabled || false;
  updateSoundSettings();

  currentSoundDiv.textContent = data.soundFileName ? t('currentFile', { name: data.soundFileName }) : '';

  if (data.soundUrl) {
    soundPreview.src = data.soundUrl;
    soundPreview.style.display = 'block';
  }

  leaderboardEnabledCheckbox.checked = data.leaderboardEnabled !== false;
  leaderboardUsernameInput.value = data.leaderboardUsername || '';
  leaderboardServerInput.value = data.leaderboardServer || '';

  customUrlsInput.value = (data.customUrls || []).join('\n');
  customSelectorsInput.value = (data.customSelectors || []).join('\n');
}

// Switch the page language right away
languageSelect.addEventListener('change', async () => {
  currentLanguage = languageSelect.value;
  await browser.storage.local.set({ language: currentLanguage });
  applyTranslations();
  loadSettings();
  showMessage(t('msgSettingsSaved'), 'success');
});

// Toggle sound settings visibility
soundEnabledCheckbox.addEventListener('change', async () => {
  await browser.storage.local.set({ soundEnabled: soundEnabledCheckbox.checked });
  updateSoundSettings();
  showMessage(t('msgSettingsSaved'), 'success');
});

function updateSoundSettings() {
  if (soundEnabledCheckbox.checked) {
    soundSettings.style.display = 'block';
  } else {
    soundSettings.style.display = 'none';
  }
}

// Handle sound file selection
soundFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file is audio
  if (!file.type.startsWith('audio/')) {
    showMessage(t('msgChooseAudio'), 'error');
    return;
  }

  // Convert file to Data URL
  const reader = new FileReader();
  reader.onload = async (event) => {
    const dataUrl = event.target.result;

    await browser.storage.local.set({
      soundUrl: dataUrl,
      soundFileName: file.name
    });

    currentSoundDiv.textContent = t('currentFile', { name: file.name });
    soundPreview.src = dataUrl;
    soundPreview.style.display = 'block';
    showMessage(t('msgSoundSaved'), 'success');
  };

  reader.readAsDataURL(file);
});

// Export data
exportBtn.addEventListener('click', async () => {
  const data = await browser.storage.local.get([
    'todaySeconds', 'totalSeconds', 'lastReset', 'dailyData',
    'activeTodaySeconds', 'activeTotalSeconds', 'activeLastReset', 'activeDailyData'
  ]);

  const exportData = {
    todaySeconds: data.todaySeconds || 0,
    totalSeconds: data.totalSeconds || 0,
    lastReset: data.lastReset || new Date().toDateString(),
    dailyData: data.dailyData || {},
    activeTodaySeconds: data.activeTodaySeconds || 0,
    activeTotalSeconds: data.activeTotalSeconds || 0,
    activeLastReset: data.activeLastReset || new Date().toDateString(),
    activeDailyData: data.activeDailyData || {},
    exportDate: new Date().toISOString()
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `fabasoft-time-${new Date().toISOString().split('T')[0]}.json`;
  link.click();

  URL.revokeObjectURL(url);
  showMessage(t('msgExported'), 'success');
});

// Import data
importBtn.addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      let importedData = JSON.parse(event.target.result);

      // Accept exports from Fabasoft Time Tracker 1.x
      if (typeof importedData.totalTime === 'number') {
        importedData = convertLegacyData(importedData);
      }

      // Validate imported data
      if (typeof importedData.totalSeconds !== 'number' || typeof importedData.todaySeconds !== 'number') {
        throw new Error(t('msgInvalidFormat'));
      }

      await browser.storage.local.set({
        todaySeconds: importedData.todaySeconds,
        totalSeconds: importedData.totalSeconds,
        lastReset: importedData.lastReset || new Date().toDateString(),
        dailyData: importedData.dailyData || {},
        activeTodaySeconds: importedData.activeTodaySeconds || 0,
        activeTotalSeconds: importedData.activeTotalSeconds || 0,
        activeLastReset: importedData.activeLastReset || new Date().toDateString(),
        activeDailyData: importedData.activeDailyData || {}
      });

      showMessage(t('msgImported'), 'success');
      loadSettings();
    } catch (err) {
      showMessage(t('msgImportFailed', { error: err.message }), 'error');
    }
  };

  reader.readAsText(file);
  importFileInput.value = ''; // Reset input
});

// Reset all data
resetAllBtn.addEventListener('click', async () => {
  if (confirm(t('confirmDeleteAll'))) {
    await browser.storage.local.set({
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
      soundFileName: null
    });

    currentSoundDiv.textContent = '';
    soundPreview.style.display = 'none';
    soundEnabledCheckbox.checked = false;
    updateSoundSettings();

    showMessage(t('msgAllDeleted'), 'success');
  }
});

// Leaderboard settings
leaderboardEnabledCheckbox.addEventListener('change', async () => {
  await browser.storage.local.set({ leaderboardEnabled: leaderboardEnabledCheckbox.checked });
  showMessage(t('msgSaved'), 'success');
});

saveLeaderboardBtn.addEventListener('click', async () => {
  await browser.storage.local.set({
    leaderboardUsername: leaderboardUsernameInput.value.trim(),
    leaderboardServer: leaderboardServerInput.value.trim()
  });
  showMessage(t('msgLeaderboardSaved'), 'success');
});

// Detection settings
saveDetectionBtn.addEventListener('click', async () => {
  const customSelectors = customSelectorsInput.value.split('\n').map(s => s.trim()).filter(s => s);
  const invalid = customSelectors.filter(s => !isValidSelector(s));
  if (invalid.length) {
    showMessage(t('msgInvalidSelectors', { list: invalid.join(', ') }), 'error');
    return;
  }
  await browser.storage.local.set({
    customUrls: customUrlsInput.value.split('\n').map(u => u.trim()).filter(u => u),
    customSelectors
  });
  showMessage(t('msgDetectionSaved'), 'success');
});

// Show message helper
function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.style.display = 'block';
  messageDiv.style.backgroundColor = type === 'success' ? '#d4edda' : '#f8d7da';
  messageDiv.style.color = type === 'success' ? '#155724' : '#721c24';
  messageDiv.style.border = `1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'}`;

  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 3000);
}
