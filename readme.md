# Fabasoft Time Tracker

A browser extension that tracks your total time in Fabasoft Cloud ("the Fabasphere"), and separately the time wasted waiting for the loading spinner.

It runs on all `*.fabasoft.com` systems (for example `at.cloud.fabasoft.com`, `de.cloud.fabasoft.com`).

This is a fork of the [SAP Time Tracker](https://github.com/LynnDelpy/SAP-Time-Tracker) adapted for Fabasoft.

## Heads up: the loading spinner selector

The **Time on Fabasoft** counter (total time) works out of the box, it only needs the tab to be in the foreground.

The **Wasted Time** counter needs the CSS selector of Fabasoft's loading spinner, and that differs from SAP's. There is no reliable default, so it ships empty and wasted time stays at zero until you set it:

1. Open a Fabasoft page and trigger an action that shows the loading spinner.
2. While the spinner is visible, right-click it and choose **Inspect**.
3. In the dev tools, read the element's `class` (and its parent if needed).
4. Open the extension's **Settings → Detection** and paste the CSS selector (for example `.someLoadingClass`), one per line.
5. Reload the Fabasoft tab.

Once a selector is set, wasted time is counted whenever a matching element is visible. Send the selector to the maintainer and it can become the built-in default.

## Features

### Time Tracking
Two independent counters run while you are on a Fabasoft page:

- **Time on Fabasoft** — counts every second the Fabasoft tab is in the foreground (visible). This is your total time spent in the system.
- **Wasted Time** — counts only the seconds a configured loading spinner is on screen, i.e. the time you spend waiting (off until you set a selector, see above).

Each counter keeps a **Today** value (resets at midnight) and a **Total** value (cumulative since installation). A live badge on the extension icon shows the current wasted session time.

### Statistics Dashboard
- Bar chart in the popup showing daily time
- Metric selector: switch the chart between **On Fabasoft** (total) and **Wasted**
- Hover over a bar to see the exact time for that day
- Timespan selector: Last 7 days, 14 days, 30 days, Last year, All time
- Today's bar is highlighted in orange

### Leaderboard (optional, self-hosted)
- Disabled by default. There is no public server, so enable it in Settings and point it at your own instance.
- When enabled with a server and a display name, it shows a global ranking by total wasted time and uploads your stats.
- Self-hostable, see [Server](#server) below.

### Settings
- **Language** — English or German (defaults to the browser language)
- **Sound notifications** — play a custom MP3 when the loading spinner appears
- **Detection** — the CSS selector(s) for the loading spinner (Firefox also lets you set custom URLs)
- **Leaderboard** — enable/disable, set your display name, configure your server URL
- **Data management** — export and import all data (including daily stats) as JSON, reset all data

## Install (unpacked)

No store listing yet, so load it unpacked:

- **Chrome / Edge**: open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `Chrome/` folder.
- **Firefox**: open `about:debugging` → **This Firefox** → **Load Temporary Add-on**, and select any file inside the `Firefox/` folder (e.g. `manifest.json`).

## Usage

1. Open any `*.fabasoft.com` page
2. The **Time on Fabasoft** counter runs while the tab is in the foreground; the **Wasted Time** counter runs while a configured loading spinner is visible
3. Click the extension icon to see your stats, the daily chart, and (if enabled) the leaderboard
4. Open **⚙️ Settings** to set the detection selector, sound notifications, or data management

## Server

The leaderboard requires a backend server. A self-hostable server is included in the `server/` folder.

### Running with Docker Compose

```bash
cd server
docker compose up -d
```

The server runs on port `3000` by default. SQLite data is persisted in `./server/data/`.

### API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/stats` | Submit a user's stats |
| `DELETE` | `/api/user/:username` | Remove a user (sent when the display name changes) |
| `GET` | `/api/leaderboard` | Get top 100 users ranked by total time |
| `GET` | `/health` | Health check |

Point the extension to your instance in **Settings → Leaderboard → Server URL**.

## Detection

The extension checks every second whether a configured loading spinner is rendered. The default list is empty, set it under **Settings → Detection**. On Firefox you can also set custom URLs; on Chrome the tracked URLs are fixed to `*.fabasoft.com` by the manifest.
