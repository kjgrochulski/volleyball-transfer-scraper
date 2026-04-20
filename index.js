const PORT = 8000
const express = require('express')
const axios = require('axios')
const cheerio = require('cheerio')

const app = express()

app.get('/', (reg,res) => { 
   res.json('Welcome to my Messier Object scraper') 
})

app.get('/Wiki', (req,res) => {
    axios.get('https://en.wikipedia.org/wiki/List_of_Messier_objects', {
        headers: {
            'User-Agent': 'MessierScraperProject/1.0 (learning to scrape)'
        }
    })
    .then((response) => {
        const html = response.data
        console.log('Successfully fetched the HTML')
        const $ = cheerio.load(html)

        $('a:contains("')

        res.json('Check terminal for HTML')
    
    })
    .catch((error) => {
        console.error("Scraping error:", error.message)
        res.status(500).json('Something went wrong')
    })
})

app.listen(PORT, () => console.log(`server running on PORT ${PORT}`))
