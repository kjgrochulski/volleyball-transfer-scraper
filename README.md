# Volleyball Transfer Tracker

A scraping pipeline that pulls professional volleyball player transfers from [Volleybox](https://volleybox.net/transfers) twice a day and renders them on the macOS desktop as a live, filterable Übersicht widget. Each player name links out to their Volleybox profile.

---

## What It Does

1. A scheduled `launchd` job runs the scraper at noon and 7pm Eastern. The scraper drives a headless Chromium instance through `puppeteer-extra` (with the Stealth plugin to get past Volleybox's Cloudflare gate), then POSTs directly to Volleybox's internal AJAX endpoint to paginate through both confirmed transfers ("Done Deals") and unconfirmed ones ("Rumors").

2. Results are deduplicated, normalized into a single record shape, and written to `output/transfers.csv` (for spreadsheet use) and `output/transfers.json` (for the widget).

3. The Übersicht widget reads `transfers.json` on a 5-minute refresh cycle and renders the list on the desktop with two filters — confirmed/rumor status and country — plus clickable player names that open Volleybox profiles in the default browser via `open`.

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

The scraper opens a real browser tab to establish a Volleybox session (cookies, anti-bot headers), then performs the actual data fetches from inside the page context using `page.evaluate(fetch(...))`. This bypasses the standard Cloudflare problem where a bare `axios` request gets a "Just a moment…" page instead of HTML.

Each transfer row is parsed for player name, origin team, destination team, league, status, and a "Details" string that includes position and nationality (e.g. "Setter from Italy"). The widget later parses the nationality back out of that string for the country filter.

**Note**

Volleybox returns roughly 20 rows per AJAX request. Scraping 60 of each category means three sequential POSTs per category, with an 800–1300ms randomized delay between pages to avoid hammering the server. If a category returns fewer rows than the target (e.g. early in the transfer season), the scraper stops at whatever's available rather than retrying.

---

## The Widget

<p>The widget is a stateful Übersicht <code>.jsx</code> file. Übersicht's stateful API uses <code>(state, dispatch)</code> in <code>render</code> rather than passing <code>output</code> as a direct argument, so the command result has to be captured inside <code>updateState</code> and stashed in state. The widget handles three user actions through <code>dispatch</code>:</p>

| Action | Result |
|---|---|
| `SET_STATUS` | Filter to All / Confirmed / Rumors |
| `SET_COUNTRY` | Filter by league of origin **or** player nationality |
| `TOGGLE_COUNTRY` | Open/close the custom country dropdown |

Native `<select>` elements don't work in Übersicht widgets — the window lives at the desktop level and can't become "key," so native popup menus never open. The status filter uses three pill buttons; the country filter uses a custom-rendered dropdown with state-tracked open/closed state.

Player names that have a Volleybox profile are rendered as `<a>` elements with an `onClick` that calls `run("open " + JSON.stringify(url))`, imported from `uebersicht`. This shells out to macOS `open`, which respects the user's default browser. Without `e.preventDefault()`, the embedded WebKit would try to navigate the widget itself.

---

## Automation

The scraper does not run inside Übersicht (which would tie it to the widget refresh cycle). Instead, a `launchd` LaunchAgent runs it as a standalone job at 12:00 and 19:00 local time. The plist points at a `run_scraper.sh` wrapper that:

- Sets `PATH` to include the nvm-managed Node binary (launchd doesn't source `.zshrc`)
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

The folder started life as a Wikipedia table scraper for [Messier objects](https://en.wikipedia.org/wiki/List_of_Messier_objects) — `axios` + `cheerio` writing a single CSV. The pivot to Volleybox happened in the middle of the project and exposed every layer of complexity that a static-HTML scrape doesn't have to think about. Each `index*.js` file in the repo is a checkpoint of that walk.

| File | What changed |
|---|---|
| `index2.js` | First Volleybox attempt. Plain `puppeteer`, single page, broad selectors. Worked locally but matched both player and club anchors in each row, producing garbage output. |
| `debug.js` | Diagnostic. Dumps the full rendered HTML to disk and counts occurrences of keywords like `cloudflare`, `transfer_row`. Used whenever a scrape returned zero rows. |
| `indexOLD.js` | Added `puppeteer-extra` + Stealth plugin to defeat Cloudflare's bot check. Added explicit `waitForSelector('.transfer_row')` before parsing — the prior version raced the AJAX render and parsed an empty table. Added a Cloudflare-detection branch that exits early instead of producing empty CSVs. |
| `indexstealth.js` | Timestamped output filenames so consecutive runs don't overwrite each other. |
| `index.js` | Cleaned-up single-page version with explicit `FIX 1/2/3` comments documenting each parsing trap (`.first()` to avoid club anchors, `.player .desc` scoping, etc.). |
| `indexapp.js` | **Current.** Drops the single-page model entirely. Opens one browser tab to bootstrap session cookies, then uses `page.evaluate` to POST directly to `/ajax/get_transfers/<page>` from inside the page context. Paginates through both `Done Deal` and `Rumor` categories until 60 rows are collected per category. Dedupes on `Player|Team_from|Team_to`. Writes both CSV and JSON, where the JSON payload includes an `updated` timestamp and a `count`. |

The widget side followed a similar arc. The first version was just `JSON.stringify(transfers)` dumped to the desktop in plain text — which is how the project got started. The current version is the third rewrite: pills + custom dropdown + clickable links + filter state persisted across data refreshes.

---

## Known Limitations

**Cloudflare drift.** Volleybox sits behind Cloudflare. The Stealth plugin defeats the current bot check, but Cloudflare updates its fingerprinting periodically. When a run fails with `title === "Just a moment…"` the scraper exits early. If this becomes a regular failure, the next layer would be `playwright` or `puppeteer-real-browser`.

**Selector fragility.** Field extraction depends on Volleybox's current DOM structure: `.transfer_row`, `.player .text_link`, `data-club-from-name`, `span.desc.dBlock`, etc. If Volleybox restructures the transfers page, parsing breaks silently and produces empty CSV/JSON. The widget would then display "No matches" with the previous `updated` timestamp untouched, so check the launchd logs rather than the widget when output looks stale.

**Destination country isn't captured.** The scraped `League` field reflects the origin team's league, not the destination's. The widget's country filter matches against `League` and player nationality (parsed from the `Details` string), which covers "where the player came from" but not "where they're going." Adding destination country would mean a second scrape against each destination team's page.

**Rumor accuracy.** "Rumor" entries are exactly what they sound like — they reflect what someone has reported, not what's signed. About a third of any given snapshot will resolve into different outcomes than the rumor suggested. The widget badges them in amber to keep this visually distinct from confirmed transfers.

**Schedule timezone.** The plist's `StartCalendarInterval` fires at the Mac's local hour 12 and 19. If the Mac timezone is set to Eastern, that's noon and 7pm ET as intended. Travelling with the laptop and changing timezones shifts the schedule with the Mac.

**Übersicht permissions.** First-run Übersicht installs sometimes need Full Disk Access granted in System Settings → Privacy & Security before the widget's `cat` command can read files under `~/Development/`. Symptoms: widget shows "No output from cat" or a blank loading state indefinitely.

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
├── transfers.jsx                     # Übersicht widget (symlinked into ~/Library/Application Support/Übersicht/widgets/)
├── run_scraper.sh                    # launchd wrapper (sets PATH, logs)
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

This writes `output/transfers.csv` and `output/transfers.json`. To install the schedule:

```bash
chmod +x run_scraper.sh
cp com.kgrochulski.scraper.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.kgrochulski.scraper.plist
```

To install the widget, symlink `transfers.jsx` into Übersicht's widgets folder so future edits hot-reload automatically:

```bash
ln -s "$(pwd)/transfers.jsx" ~/Library/Application\ Support/Übersicht/widgets/transfers.jsx
```

Then launch Übersicht. The widget appears top-right by default; adjust `top` / `right` / `width` in `transfers.jsx`'s `className` to taste.
