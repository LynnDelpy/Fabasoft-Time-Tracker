# Fabasoft Time Tracker

A browser extension that tracks your total time in Fabasoft Cloud ("the Fabasphere"), and separately the time wasted waiting for the loading spinner.

It runs on all `*.fabasoft.com` systems (for example `at.cloud.fabasoft.com`, `de.cloud.fabasoft.com`).

This is a fork of the [SAP Time Tracker](https://github.com/LynnDelpy/SAP-Time-Tracker) adapted for Fabasoft.

## How it detects things

**On Fabasoft and in focus.** Time only counts in the tab you are actually using: a `*.fabasoft.com` page that is the active tab of the focused browser window. Switching to another tab, another window or another app pauses both counters. Opening the extension popup does not, so you can watch the numbers move; the popup shows whether it is counting right now (`On Fabasoft · counting` / `paused`).

Because the window focus Chrome reports isn't reliable on every Linux desktop, a Fabasoft tab also counts as focused when the page itself has focus or when the popup is open in its window.

**Loading.** Fabasoft keeps its loading overlay container (`<div class="FscBusy" role="status">`) in the page even when nothing is loading, so the container alone means nothing. Wasted time only counts while that container holds a visible `<div>` with the loading text:

- `Laden ...` in the German UI
- `Loading ...` in the English UI

A text div that is present but hidden (`display:none`, `visibility:hidden`, fully transparent) does not count. `FscBusy` and `aria-busy="true"` on `<body>` are ignored, they are not reliable signals.

If your instance uses a different overlay container, set its CSS selector under **Settings → Detection** (one per line, empty = default). The loading text check still applies. Entries that aren't valid CSS selectors are refused.

## Features

### Time Tracking
Two independent counters run while you are on a Fabasoft page:

- **Time on Fabasoft** — counts every second a Fabasoft tab is the focused tab. This is your total time spent in the system.
- **Wasted Time** — counts the seconds the loading text is on screen in that tab, i.e. the time you spend waiting. It is always part of your total time.

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

## Detection settings

The default overlay container is `.FscBusy[role="status"]`; override it under **Settings → Detection**. On Firefox you can also set custom URLs; on Chrome the tracked URLs are fixed to `*.fabasoft.com` by the manifest.

## Icon

The icon sources are in `assets/`: `icon.svg` for 48 and 128 px, and `icon-16.svg`, a simplified version drawn on the pixel grid for the toolbar.

## Changelog

### v1.3
- Fix: Fabasoft tabs stayed "Not on Fabasoft" after updating or reloading the extension. Fabasoft's hidden push iframe keeps a tab "loading" forever, and v1.2 only re-attached to fully loaded tabs. The extension now re-attaches to every open Fabasoft tab, and repairs the focused tab on the fly whenever it stops answering
- Fix: an invalid entry in **Settings → Detection** (e.g. `<div>Laden ...</div>` instead of a CSS selector) made the tab stop answering entirely. Invalid entries are skipped (the default is used if none are left) and the settings page refuses to save them
- The popup no longer claims "Not on Fabasoft" on a Fabasoft tab it can't reach; it says `not connected, reload the tab`

### v1.2
- Fix: after updating or reloading the extension, Fabasoft tabs that were already open stopped counting until you reloaded them (Chrome leaves them with an orphaned content script). The extension now re-attaches to open Fabasoft tabs on its own
- Fix: counting no longer depends only on the window focus Chrome reports, which can be wrong on some Linux desktops, especially while the popup is open; page focus and an open popup count too
- The popup status shows `counting` or `paused`

### v1.1
- Wasted time requires the visible `Laden ...` / `Loading ...` text inside the loading overlay (the empty container used to count as loading all the time)
- English Fabasoft UI supported
- Both counters only run in the focused Fabasoft tab (active tab of the focused window)
- New hourglass icon

### v1.0
- First version, forked from the SAP Time Tracker
