// Settings and helpers shared by the background, content, popup and settings scripts

// Pages the tracker runs on. Fabasoft Cloud / Fabasphere systems live under
// *.fabasoft.com (e.g. at.cloud.fabasoft.com, de.cloud.fabasoft.com).
const FABASOFT_URL_PATTERNS = [
  'https://*.fabasoft.com/*'
];

// Containers of Fabasoft's loading overlay (<div class="FscBusy" role="status">).
// The container alone is not a busy signal, it can be present while the client is
// idle: busy needs a shown <div> with the loading text below inside it.
// Override the containers under Settings → Detection.
const FABASOFT_SELECTORS = ['.FscBusy[role="status"]'];

// Text of the loading <div>: "Laden ..." in the German UI, "Loading ..." in the English one
const FABASOFT_BUSY_TEXTS = ['laden', 'loading'];

// Matches "Laden ...", "Loading...", "Loading …" etc., ignoring case and trailing dots
function isBusyText(text) {
  return FABASOFT_BUSY_TEXTS.includes(text.trim().replace(/[\s.…]+$/, '').toLowerCase());
}

// Default leaderboard server (see server/). Empty by default — the leaderboard is
// off until you self-host a server and enter its URL in Settings.
const DEFAULT_LEADERBOARD_SERVER = '';

function getLeaderboardServer(customServer) {
  return (customServer || DEFAULT_LEADERBOARD_SERVER).trim().replace(/\/$/, '');
}

// Converts data saved by a legacy tracker (totalTime + today_<year>_<month>_<day> keys)
function convertLegacyData(data) {
  const dailyData = {};
  for (const key in data) {
    const match = key.match(/^today_(\d+)_(\d+)_(\d+)$/);
    if (match) {
      dailyData[new Date(match[1], match[2] - 1, match[3]).toDateString()] = data[key];
    }
  }
  const today = new Date().toDateString();
  return {
    todaySeconds: dailyData[today] || 0,
    totalSeconds: data.totalTime || 0,
    lastReset: today,
    dailyData
  };
}
