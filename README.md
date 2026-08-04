# Volleyball Transfer Tracker

A scraping pipeline that pulls professional volleyball player transfers from [Volleybox](https://volleybox.net/transfers) twice a day and renders them on the macOS desktop as a live, filterable Übersicht widget. Each player name links to their Volleybox profile.

---

<p align="center">
  <img width="354" height="628" alt="Screenshot 2026-05-12 at 3 11 06 PM" src="https://github.com/user-attachments/assets/bd1762d8-93e3-4946-9236-177d54e5f1fd" />
</p>

## What It Does

1. A scheduled `launchd` job runs the scraper twice daily. The scraper drives a headless Chromium instance through `puppeteer-extra` with the Stealth plugin to bypass Volleybox's Cloudflare gate, then POSTs directly to Volleybox's internal AJAX endpoint to paginate through both confirmed transfers and rumors.

2. Results are deduplicated, normalized into a single record shape, and written to `output/transfers.csv` (for spreadsheet use) and `output/transfers.json` (for the widget).

3. The Übersicht widget reads `transfers.json` and renders the list on the desktop with two filters: confirmed/rumor status and country. Player names open to Volleybox profiles in the default browser via `open`.

---

## The Pipeline

| | |
|---|---|
| **Scraper** | `indexapp.js` — Node + puppeteer-extra-stealth + cheerio |
| **Source** | `https://volleybox.net/transfers/2026-27/ALL/` (with AJAX pagination via `POST /ajax/get_transfers/<page>`) |
| **Rows per category** | 60 Done Deals + 60 Rumors per run (configurable via `ROWS_TARGET`) |
| **Outputs** | `output/transfers.csv`, `output/transfers.json` |
| **Schedule** | macOS `launchd` (`com.kgrochulski.scraper.plist`), fires 12:00 and 19:00 local time |
| **Widget** | `transfers.jsx` — Übersicht stateful widget |

The scraper opens a real browser tab to establish a Volleybox session (cookies, anti-bot headers), then performs the actual data fetches from inside the page context using `page.evaluate(fetch(...))`.

Each transfer row is parsed for player name, origin team, destination team, league, status, and a "Details" string that includes position and nationalit. The widget later parses the nationality back out of that string for the country filter.

**Note**

Volleybox returns roughly 20 rows per AJAX request. Scraping 60 of each category means three sequential POSTs per category, with 800–1300ms randomized delay between pages. If a category returns fewer rows than the target (for early in the transfer season), the scraper stops at whatever's available.

---

## The Widget

<p>The widget is a stateful Übersicht <code>.jsx</code> file. Übersicht's stateful API uses <code>(state, dispatch)</code> in <code>render</code> rather than passing <code>output</code> as a direct argument, so the command result has to be captured inside <code>updateState</code> and stashed in state. The widget handles three user actions through <code>dispatch</code>:</p>

| Action | Result |
|---|---|
| `SET_STATUS` | Filter to All / Confirmed / Rumors |
| `SET_COUNTRY` | Filter by league of origin **or** player nationality |
| `TOGGLE_COUNTRY` | Open/close the custom country dropdown |

Player names with an associated Volleybox profile are rendered as `<a>` elements with an `onClick` that calls `run("open " + JSON.stringify(url))`. This shells out to macOS `open`, which uses the user's default browser. Without `e.preventDefault()`, the embedded WebKit would try to navigate the widget itself.

---

## Automation

The scraper does not run inside Übersicht (which would tie it to the widget refresh cycle). Instead, a `launchd` LaunchAgent runs it as a standalone job at 12:00 and 19:00 local time. The plist points at a `run_scraper.sh` wrapper that:

- Sets `PATH` to include the nvm-managed Node binary
- Changes into the project directory
- Pipes stdout/stderr into a timestamped log under `output/logs/`
- Keeps only the 20 most recent log files

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.kgrochulski.scraper.plist
launchctl kickstart -k gui/$(id -u)/com.kgrochulski.scraper  # trigger a run now
launchctl print gui/$(id -u)/com.kgrochulski.scraper          # check status
```

If the Mac is asleep at a scheduled fire time, `launchd` will run the job as soon as it wakes.

---

## Project Evolution

The project started as a simple Wikipedia table scraper, with `axios` + `cheerio` writing a single CSV. The change to Volleybox happened in the middle of the project and exposed a layer of complexity that a static-HTML scrape doesn't have to think about. Each file is an iteration of the final scraper:

| File | What changed |
|---|---|
|#1 `index2.js` | First Volleybox scrape attempt. Plain `puppeteer`, single page, broad selectors. Worked locally but matched both player and club anchors in each row, producing nonsense output. |
|#2 `index3.js` | Added `puppeteer-extra` + Stealth plugin to defeat Cloudflare's bot check. Added explicit `waitForSelector('.transfer_row')` before parsing — the prior version raced the AJAX render and parsed an empty table. Added a Cloudflare-detection branch that exits early instead of producing empty CSVs. |
|#3 `indexstealth.js` | Timestamped output filenames so consecutive runs don't overwrite each other. |
|#4 `indexstealth2.js` | Cleaned-up single-page version with explicit `FIX 1/2/3` comments documenting each parsing trap (`.first()` to avoid club anchors, `.player .desc` scoping, etc.). |
|#5 `indexapp.js` | **Current.** Drops the single-page model entirely. Opens one browser tab to bootstrap session cookies, then uses `page.evaluate` to POST directly to `/ajax/get_transfers/<page>` from inside the page context. Paginates through both `Done Deal` and `Rumor` categories until 60 rows are collected per category. Dedupes on `Player|Team_from|Team_to`. Writes both CSV and JSON, where the JSON payload includes an `updated` timestamp and a `count`. |

The widget side followed a similar arc. The first version was just `JSON.stringify(transfers)` dumped to the desktop in plain text. The current version is the third rewrite with pills + custom dropdown + clickable links + filter state persisted across data refreshes.

---

## Known Limitations

**Selector fragility.** Field extraction depends on Volleybox's current DOM structure: `.transfer_row`, `data-club-from-name`, etc. If Volleybox restructures the transfers page, parsing breaks silently and produces empty CSV/JSON.

**Destination country isn't captured.** The scraped `League` field reflects the origin team's league, but not the destination's. The widget's country filter matches against `League` and player nationality, which covers "where the player came from" but not "where they're going." Adding destination country would mean a second scrape against each destination team's page.

---

## Tech Stack

| Component | Technology |
|---|---|
| Scraper runtime | Node.js (nvm-managed) |
| Browser automation | `puppeteer-extra` + `puppeteer-extra-plugin-stealth` |
| HTML parsing | `cheerio` |
| Output | `csv-writer` (CSV), built-in `JSON.stringify` (JSON) |
| Scheduling | macOS `launchd` LaunchAgent |
| Widget | Übersicht stateful `.jsx` widget |
| Launching external links | `run("open ...")` imported from `uebersicht` |

---

## Repo Structure

```
├── indexapp.js                       # Current scraper
├── debug.js                          # HTML dump for diagnosing empty scrapes
├── Demo.mp4                          # Simple demonstration video showing user interactions with widget
├── transfers.jsx                     # Übersicht widget
├── run_scraper.sh                    # launchd wrapper
├── com.kgrochulski.scraper.plist     # LaunchAgent definition
├── output/
│   ├── transfers.csv                 # Latest scrape, CSV
│   ├── transfers.json                # Latest scrape, widget input
│   └── logs/                         # Per-run scraper logs (rolled at 20)
├── package.json
└── README.md
```

---

## Running Locally

Install dependencies and run the scraper once:

```bash
npm install
node indexapp.js
```

writes `output/transfers.csv` and `output/transfers.json`. To install the schedule:

```bash
chmod +x run_scraper.sh
cp com.kgrochulski.scraper.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.kgrochulski.scraper.plist
```

To install the widget, symlink `transfers.jsx` into Übersicht's widgets folder:

```bash
ln -s "$(pwd)/transfers.jsx" ~/Library/Application\ Support/Übersicht/widgets/transfers.jsx
```

Then launch Übersicht
