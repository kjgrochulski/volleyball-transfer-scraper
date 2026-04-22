const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const csvWriter = createCsvWriter({
    path: 'transfers_2026.csv',
    header: [
        { id: 'Player', title: 'Player Name' },
        { id: 'Team_from', title: 'Transfer Origin' },
        { id: 'Team_to', title: 'Transfer Destination' },
        { id: 'Details', title: 'Details' }
    ]
});

(async () => {
    const browser = await puppeteer.launch({ 
        headless: "new"
    });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    console.log('Navigating to Volleybox...');
    try {
        await page.goto('https://volleybox.net/transfers/2026-27/ALL/1', {
            waitUntil: 'networkidle2',
        });

        const content = await page.content();
        const $ = cheerio.load(content);
        const scrapedData = [];

        console.log('Parsing data...');

        $('.transfer_row').each(function () {
            const row = $(this);
            const player = row.find('.player .text_link').text().trim();
            const team_from = row.attr('data-club-from-name') || 'Unknown';
            const team_to = row.attr('data-club-to-name') || 'Unknown';
            const details = row.find('.player .desc').text().trim();

            if (player) {
                scrapedData.push({
                    Player: player,
                    Team_from: team_from,
                    Team_to: team_to,
                    Details: details
                });
            }
        });

        if (scrapedData.length > 0) {
            await csvWriter.writeRecords(scrapedData);
            console.log(`Successfully saved ${scrapedData.length} records!`);
        } else {
            console.log('No data found. Check if selectors changed.');
        }

    } catch (error) {
        console.error('Error during scraping:', error.message);
    } finally {
        await browser.close();
    }
})();