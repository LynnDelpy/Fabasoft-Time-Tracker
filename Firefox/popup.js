let chartMeta = null;

// Tell the background the popup is open in this window, so looking at your stats doesn't
// pause the counter of the Fabasoft tab behind it
let popupReady = false;
const popupPort = browser.runtime.connect({ name: 'popup' });
popupPort.onMessage.addListener((msg) => {
  if (msg.ready) {
    popupReady = true;
    updateUI();
  }
});
browser.windows.getCurrent().then((win) => popupPort.postMessage({ windowId: win.id }));

async function updateUI() {
  const data = await browser.storage.local.get(['todaySeconds', 'totalSeconds', 'activeTodaySeconds', 'activeTotalSeconds']);

  document.getElementById('activeTodayTime').textContent = formatTime(data.activeTodaySeconds || 0);
  document.getElementById('activeTotalTime').textContent = formatTime(data.activeTotalSeconds || 0);
  document.getElementById('todayTime').textContent = formatTime(data.todaySeconds || 0);
  document.getElementById('totalTime').textContent = formatTime(data.totalSeconds || 0);

  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  // Only tracked Fabasoft pages run the content script, so an answer means we're on Fabasoft
  let response = null;
  try {
    response = await browser.tabs.sendMessage(currentTab.id, { action: 'getStatus' });
  } catch (e) {}

  // On Fabasoft, also show whether the total-time counter is running right now
  let counting = '';
  if (response && popupReady) {
    let timers = null;
    try {
      timers = await browser.runtime.sendMessage({ action: 'getTimerStatus' });
    } catch (e) {}
    counting = ` · ${t(timers?.active ? 'statusCounting' : 'statusPaused')}`;
  }

  // A Fabasoft tab that still doesn't answer after the background tried to attach to it
  const onFabasoft = !!response || isFabasoftUrl(currentTab?.url);
  if (!response && onFabasoft && popupReady) counting = ` · ${t('statusNotConnected')}`;

  document.getElementById('statusText').textContent = t(onFabasoft ? 'statusOnSap' : 'statusNotOnSap') + counting;
  document.getElementById('loadingIndicator').style.display = response?.isBusy ? 'block' : 'none';
}

function formatYLabel(seconds) {
  if (seconds === 0) return '0';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function renderChart() {
  const data = await browser.storage.local.get(['dailyData', 'activeDailyData']);
  const metric = document.getElementById('metricSelect').value;
  const dailyData = (metric === 'wasted' ? data.dailyData : data.activeDailyData) || {};
  const timespanValue = document.getElementById('timespanSelect').value;

  let dates = [];
  if (timespanValue === 'all') {
    const allDates = Object.keys(dailyData).sort((a, b) => new Date(a) - new Date(b));
    if (allDates.length === 0) {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toDateString());
      }
    } else {
      const cursor = new Date(allDates[0]);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      while (cursor <= today) {
        dates.push(cursor.toDateString());
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  } else {
    const days = parseInt(timespanValue);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toDateString());
    }
  }

  const values = dates.map(d => dailyData[d] || 0); // seconds

  const canvas = document.getElementById('statsChart');
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.parentElement.offsetWidth;
  if (!cssWidth) return; // not laid out yet, skip
  const cssHeight = 140;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.height = cssHeight + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pad = { top: 10, right: 8, bottom: 28, left: 36 };
  const chartW = cssWidth - pad.left - pad.right;
  const chartH = cssHeight - pad.top - pad.bottom;
  const maxVal = Math.max(...values, 1);
  const barW = chartW / dates.length;
  const n = dates.length;

  ctx.clearRect(0, 0, cssWidth, cssHeight);

  // Grid lines + Y labels
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#aaa';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (i / 4) * chartH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.fillText(formatYLabel(maxVal * i / 4), pad.left - 4, y + 3);
  }

  const today = new Date().toDateString();
  const step = n <= 7 ? 1 : n <= 14 ? 2 : n <= 31 ? 3 : Math.ceil(n / 12);

  values.forEach((val, i) => {
    const x = pad.left + i * barW;
    const barH = Math.max((val / maxVal) * chartH, val > 0 ? 2 : 0);
    const y = pad.top + chartH - barH;
    const isToday = dates[i] === today;

    if (isToday) {
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, '#f39c12');
      grad.addColorStop(1, '#e67e22');
      ctx.fillStyle = grad;
    } else {
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, '#667eea');
      grad.addColorStop(1, '#764ba2');
      ctx.fillStyle = grad;
    }
    ctx.fillRect(x + 1, y, Math.max(barW - 2, 1), barH);

    if (i % step === 0 || i === dates.length - 1) {
      const d = new Date(dates[i]);
      const label = n <= 7
        ? d.toLocaleDateString(currentLanguage, { weekday: 'short' })
        : n <= 60
        ? d.toLocaleDateString(currentLanguage, { month: 'numeric', day: 'numeric' })
        : d.toLocaleDateString(currentLanguage, { month: 'short', day: 'numeric' });
      ctx.fillStyle = isToday ? '#e67e22' : '#999';
      ctx.font = isToday ? 'bold 9px sans-serif' : '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barW / 2, cssHeight - pad.bottom + 12);
    }
  });

  chartMeta = { dates, values, pad, barW, cssWidth, cssHeight };
}

function setupTooltip() {
  const canvas = document.getElementById('statsChart');
  const tooltip = document.getElementById('chartTooltip');

  canvas.addEventListener('mousemove', (e) => {
    if (!chartMeta) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const { dates, values, pad, barW, cssHeight } = chartMeta;

    const idx = Math.floor((mouseX - pad.left) / barW);
    const inChartArea = mouseX >= pad.left && mouseY >= pad.top && mouseY <= cssHeight - pad.bottom;

    if (inChartArea && idx >= 0 && idx < dates.length) {
      const d = new Date(dates[idx]);
      const seconds = values[idx];
      const dateLabel = d.toLocaleDateString(currentLanguage, { weekday: 'short', month: 'short', day: 'numeric' });
      tooltip.textContent = `${dateLabel}: ${formatTime(seconds)}`;
      tooltip.style.display = 'block';

      const wrapRect = canvas.parentElement.getBoundingClientRect();
      let tx = e.clientX - wrapRect.left + 10;
      let ty = e.clientY - wrapRect.top - 36;
      // Clamp to right edge
      if (tx + 160 > wrapRect.width) tx = e.clientX - wrapRect.left - 170;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = Math.max(ty, 2) + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  });

  canvas.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadLeaderboard() {
  const data = await browser.storage.local.get(['leaderboardEnabled', 'leaderboardServer', 'leaderboardUsername']);
  const content = document.getElementById('leaderboardContent');

  if (data.leaderboardEnabled === false) {
    document.getElementById('leaderboardSection').style.display = 'none';
    return;
  }

  const serverUrl = getLeaderboardServer(data.leaderboardServer);
  const myUsername = (data.leaderboardUsername || '').trim();

  if (!serverUrl) {
    content.innerHTML = `<p class="lb-info">${t('lbNoServer')}</p>`;
    return;
  }

  try {
    const status = await browser.runtime.sendMessage({ action: 'getServerStatus' });
    if (!status.reachable) {
      content.innerHTML = `<p class="lb-error">${t('lbUnreachable')}</p>`;
      return;
    }
  } catch (e) {}

  try {
    const res = await fetch(`${serverUrl}/api/leaderboard`);
    const board = await res.json();

    if (!board.length) {
      content.innerHTML = `<p class="lb-info">${t('lbEmpty')}</p>`;
      return;
    }

    const you = `<span class="lb-you">${t('lbYou')}</span>`;
    const rows = board.slice(0, 10).map(e => {
      const isMe = myUsername && e.username === myUsername;
      return `<tr class="${isMe ? 'lb-me' : ''}">
        <td class="lb-rank">#${e.rank}</td>
        <td class="lb-name">${escapeHtml(e.username)}${isMe ? ` ${you}` : ''}</td>
        <td class="lb-time">${formatTime(e.totalSeconds)}</td>
      </tr>`;
    }).join('');

    // If current user is outside top 10, append their row
    if (myUsername) {
      const myEntry = board.find(e => e.username === myUsername);
      if (myEntry && myEntry.rank > 10) {
        const sep = '<tr class="lb-sep"><td colspan="3">···</td></tr>';
        const myRow = `<tr class="lb-me">
          <td class="lb-rank">#${myEntry.rank}</td>
          <td class="lb-name">${escapeHtml(myEntry.username)} ${you}</td>
          <td class="lb-time">${formatTime(myEntry.totalSeconds)}</td>
        </tr>`;
        content.innerHTML = `<table class="lb-table"><tbody>${rows}${sep}${myRow}</tbody></table>`;
        return;
      }
    }

    content.innerHTML = `<table class="lb-table"><tbody>${rows}</tbody></table>`;
  } catch (e) {
    content.innerHTML = `<p class="lb-error">${t('lbError')}</p>`;
  }
}

document.getElementById('refreshLeaderboard').addEventListener('click', loadLeaderboard);

document.getElementById('resetTodayBtn').addEventListener('click', async () => {
  if (confirm(t('confirmResetToday'))) {
    await browser.storage.local.set({ todaySeconds: 0, activeTodaySeconds: 0 });
    updateUI();
    renderChart();
  }
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  browser.runtime.openOptionsPage();
});

document.getElementById('timespanSelect').addEventListener('change', renderChart);
document.getElementById('metricSelect').addEventListener('change', renderChart);

async function checkUsernameBanner() {
  const data = await browser.storage.local.get(['leaderboardEnabled', 'leaderboardUsername', 'leaderboardBannerDismissed']);
  if (data.leaderboardEnabled === false) return;
  if (data.leaderboardBannerDismissed) return;
  if ((data.leaderboardUsername || '').trim()) return;

  document.getElementById('usernameBanner').style.display = 'flex';
}

document.getElementById('bannerSettingsLink').addEventListener('click', (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

document.getElementById('bannerDismiss').addEventListener('click', async () => {
  await browser.storage.local.set({ leaderboardBannerDismissed: true });
  document.getElementById('usernameBanner').style.display = 'none';
});

initLanguage().then(() => {
  updateUI();
  renderChart();
  setupTooltip();
  loadLeaderboard();
  checkUsernameBanner();
  setInterval(updateUI, 1000);
  setInterval(renderChart, 5000);
});
