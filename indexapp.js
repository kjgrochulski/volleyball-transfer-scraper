const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs   = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const ROWS_TARGET = 60;
const SEASON_ID   = 127;
const GENDER      = 'M';
const OUTPUT_DIR  = path.join(__dirname, 'output');
const JSON_OUT    = path.join(OUTPUT_DIR, 'transfers.json');
// Persistent browser profile so Cloudflare's clearance cookie survives between runs
const PROFILE_DIR = path.join(__dirname, '.chrome-profile');
const HEADLESS    = process.env.HEADLESS === '1';
// Headful runs get longer so there's time to click a Cloudflare checkbox by hand
const CF_WAIT_MS  = HEADLESS ? 30000 : 120000;
// Prefer the installed Google Chrome over puppeteer's bundled Chrome for Testing
const SYSTEM_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';


const STATUSES = [
    { label: 'Done Deal', type: ''  },
    { label: 'Rumor',     type: 'R' },
];



if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function makeTimestamp() {
    const now  = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 5);
    return `${date}_${time}`;
}

function parseRows(html, statusLabel) {
    const $    = cheerio.load(html);
    const rows = [];

    $('.transfer_row').each(function () {
        const row        = $(this);
        const playerEl   = row.find('.player .text_link').first();
        const player     = playerEl.text().trim();
        const playerHref = playerEl.attr('href') || '';
        const playerUrl  = playerHref
            ? (playerHref.startsWith('http') ? playerHref : 'https://volleybox.net' + playerHref)
            : '';
        const team_from = row.attr('data-club-from-name') || 'Unknown';
        const team_to   = row.attr('data-club-to-name')   || 'Unknown';
        const details   = row.find('.player .desc').first().text().trim();
        const league    = $(row.find('span.desc.dBlock').get(1)).text().trim() || '—';

        if (player) {
            rows.push({ Player: player, PlayerUrl: playerUrl, Team_from: team_from, Team_to: team_to, League: league, Status: statusLabel, Details: details });
        }
    });

    return rows;
}


// "Just a moment..." is Cloudflare's JS challenge, which usually clears itself
// after a few seconds and reloads the page. Poll the title instead of giving up.
// If it shows a "Verify you are human" checkbox instead, click it yourself in
// the Chrome window: the clearance cookie is saved in PROFILE_DIR for later runs.
async function waitForCloudflare(page) {
    const start    = Date.now();
    const deadline = start + CF_WAIT_MS;
    let   hinted   = false;
    while (Date.now() < deadline) {
        const title = (await page.title().catch(() => '')).toLowerCase();
        if (title && !title.includes('cloudflare') && !title.includes('moment')) return true;
        if (!HEADLESS && !hinted && Date.now() - start > 10000) {
            console.log('  Still on Cloudflare — if a "Verify you are human" checkbox is showing, click it in the Chrome window');
            hinted = true;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}

async function fetchPageInBrowser(page, pageNum, type) {
    const html = await page.evaluate(async (pageNum, seasonId, gender, type) => {
        const body = new URLSearchParams({
            gender,
            season_id:      seasonId,
            search:         '',
            accepted:       '1',
            country:        '0',
            player_country: '0',
            view_type:      'players',
            type,
        });

        const res = await fetch(`/ajax/get_transfers/${pageNum}`, {
            method:  'POST',
            headers: {
                'Content-Type':     'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: body.toString(),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
    }, pageNum, SEASON_ID, GENDER, type);

    return html;
}

async function scrapeStatus(page, status) {
    const rows    = [];
    let   pageNum = 1;

    while (rows.length < ROWS_TARGET) {
        console.log(`  [${status.label}] page ${pageNum}`);

        try {
            const html     = await fetchPageInBrowser(page, pageNum, status.type);
            const pageRows = parseRows(html, status.label);

            if (pageRows.length === 0) {
                console.log(`  [${status.label}] no rows — done`);
                break;
            }

            const needed = ROWS_TARGET - rows.length;
            rows.push(...pageRows.slice(0, needed));
            console.log(`  [${status.label}] ${rows.length}/${ROWS_TARGET} rows`);

            if (rows.length >= ROWS_TARGET || pageRows.length < 10) break;

            pageNum++;
            await new Promise(r => setTimeout(r, 800 + Math.random() * 500));

        } catch (err) {
            console.error(`  [${status.label}] page ${pageNum} error: ${err.message}`);
            break;
        }
    }

    return rows;
}

(async () => {
    const timestamp = makeTimestamp();
    const csvPath   = path.join(OUTPUT_DIR, 'transfers.csv');

    const csvWriter = createCsvWriter({
        path: csvPath,
        header: [
            { id: 'Player',    title: 'Player Name'          },
            { id: 'Team_from', title: 'Transfer Origin'      },
            { id: 'Team_to',   title: 'Transfer Destination' },
            { id: 'League',    title: 'League'               },
            { id: 'Status',    title: 'Status'               },
            { id: 'Details',   title: 'Details'              },
        ]
    });

    console.log('Launching browser to establish session...');
    // Cloudflare blocks headless Chrome outright, so run a real (headful) window.
    // Set HEADLESS=1 to go back to headless.
    const browser = await puppeteer.launch({
        headless: HEADLESS ? 'new' : false,
        executablePath: fs.existsSync(SYSTEM_CHROME) ? SYSTEM_CHROME : undefined,
        userDataDir: PROFILE_DIR,
        // Drops the "controlled by automated test software" banner/flag
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
            // --no-sandbox is only needed on Linux and shows a warning banner on macOS
            ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
            ...(HEADLESS ? [] : ['--window-size=1280,900']),
        ],
    });
    // No setUserAgent here: the stealth plugin already strips "HeadlessChrome"
    // and keeps the UA consistent with the real browser version and platform.
    const page = await browser.newPage();

    let cleared = false;
    for (let attempt = 1; attempt <= 3 && !cleared; attempt++) {
        try {
            await page.goto('https://volleybox.net/transfers/2026-27/ALL/1', {
                waitUntil: 'networkidle2',
                timeout:   30000,
            });
        } catch (err) {
            // e.g. ERR_INTERNET_DISCONNECTED right after the Mac wakes from sleep
            console.error(`  goto attempt ${attempt}: ${err.message}`);
            if (/ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NETWORK_CHANGED/.test(err.message)) {
                await new Promise(r => setTimeout(r, 20000));
                continue;
            }
        }

        cleared = await waitForCloudflare(page);
        if (!cleared) console.log(`  Cloudflare challenge still showing (attempt ${attempt})`);
    }

    if (!cleared) {
        console.error('✗ Cloudflare block detected — try again in a moment');
        await browser.close();
        process.exit(1);
    }

    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});

    console.log('Session established\n');


    const allRows = [];

    for (const status of STATUSES) {
        console.log(`>  ${status.label}`);
        const rows = await scrapeStatus(page, status);
        console.log(`   ✓ ${rows.length} rows`);
        allRows.push(...rows);
    }

    await browser.close();

    if (allRows.length === 0) {
        console.error('\n No data collected.');
        process.exit(1);
    }


    const seen    = new Set();
    const deduped = allRows.filter(r => {
        const key = `${r.Player}|${r.Team_from}|${r.Team_to}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    await csvWriter.writeRecords(deduped);
    console.log(`\nCSV  -> ${csvPath}  (${deduped.length} unique rows)`);

    const jsonPayload = {
        updated:   new Date().toISOString(),
        timestamp,
        count:     deduped.length,
        transfers: deduped,
    };
    fs.writeFileSync(JSON_OUT, JSON.stringify(jsonPayload, null, 2));
    console.log(`JSON -> ${JSON_OUT}`);
    console.log(`\nDone -> ${deduped.length} transfers saved.`);
})();