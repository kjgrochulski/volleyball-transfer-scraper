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
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    await page.goto('https://volleybox.net/transfers/2026-27/ALL/1', {
        waitUntil: 'networkidle2',
        timeout:   30000,
    });

    const title = await page.title();
    if (title.toLowerCase().includes('cloudflare') || title.toLowerCase().includes('moment')) {
        console.error('✗ Cloudflare block detected — try again in a moment');
        await browser.close();
        process.exit(1);
    }

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