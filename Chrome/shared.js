// Settings and helpers shared by the background, content, popup and settings scripts

// Pages the tracker runs on. Fabasoft Cloud / Fabasphere systems live under
// *.fabasoft.com (e.g. at.cloud.fabasoft.com, de.cloud.fabasoft.com).
const FABASOFT_URL_PATTERNS = [
  'https://*.fabasoft.com/*'
];

// The busy indicator — "wasted" time is counted while one of these is visible.
// Fabasoft's loading spinner uses a different class than SAP UI5, so there is no
// reliable default. Left empty (total time still works); set the real selector
// under Settings → Detection once you have it.
const FABASOFT_SELECTORS = [];

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
