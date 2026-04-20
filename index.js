const axios = require('axios')
const cheerio = require('cheerio')
const createCsvWriter = require('csv-writer').createObjectCsvWriter

const csvWriter = createCsvWriter({
    path: 'messier_data.csv',
    header: [
        { id: 'messierId', title: 'Messier Number' },
        { id: 'ngcId', title: 'NGC Number' },
        { id: 'objectType', title: 'Object Type' },
        { id: 'distance', title: 'Distance (kly)' },
        { id: 'magnitude', title: 'Apparent Magnitude' }
    ]
})

const url = 'https://en.wikipedia.org/wiki/List_of_Messier_objects'

axios.get(url, {
    headers: {
        'User-Agent': 'MessierProject'
    }
})
.then(response => {
    const html = response.data
    const $ = cheerio.load(html)
    const scrapedData = []

    //cleaner 
    const cleanText = (text) => text.replace(/\[.*?\]/g, '').replace(/\n/g, '').trim()

    $('table.wikitable tbody tr').each(function () {
        const columns = $(this).find('td')

        if (columns.length > 0) {
            
            const messierId = cleanText($(columns[0]).text())
            const ngcId = cleanText($(columns[1]).text())
            const objectType = cleanText($(columns[3]).text())
            const distance = cleanText($(columns[4]).text())
            const magnitude = cleanText($(columns[6]).text())

            scrapedData.push({
                messierId: messierId,
                ngcId: ngcId,
                objectType: objectType,
                distance: distance,
                magnitude: magnitude
            })
        }
    })

    console.log(`Successfully parsed ${scrapedData.length} rows of data.`)

    csvWriter.writeRecords(scrapedData)
        .then(() => {
            console.log('Success! Your messier_data.csv file has been created.')
        })
})
.catch(error => {
    console.error("Scraping error:", error.message)
})