# Messier Object Scraper

A simple Node.js scraper that pulls data on Messier objects from the [Wikipedia Messier catalogue page](https://en.wikipedia.org/wiki/List_of_Messier_objects) and writes it to a CSV file.

---

## Overview

The Messier catalogue is a list of 110 astronomical objects — galaxies, nebulae, and star clusters — compiled by Charles Messier in the 18th century. This script scrapes the Wikipedia summary table for each object's identifier, type, distance, and apparent magnitude, and saves the results locally as `messier_data.csv`.

---

## Pipeline

1. **HTTP request** — `axios` fetches the raw HTML from the Wikipedia page.
2. **Parsing** — `cheerio` loads the HTML and selects rows from the main `wikitable`.
3. **Extraction** — For each row, five fields are pulled by column index: Messier number, NGC/IC identifier, object type, distance, and apparent magnitude. Footnote references (e.g. `[1]`) and stray newlines are stripped from each value.
4. **Output** — `csv-writer` writes the collected records to `messier_data.csv` in the project root.

---

## Requirements

- Node.js (v14 or later recommended)
- npm

---

## Installation

```bash
git clone https://github.com/kjgrochulski/scraper.git
cd scraper
npm install
```

---

## Usage

```bash
node index.js
```

Output is written to `messier_data.csv` in the project root. The console will confirm how many rows were parsed and whether the file was created successfully.

---

## Output Format

| Column | Description |
|---|---|
| Messier Number | M1–M110 designation |
| NGC Number | NGC or IC catalogue identifier |
| Object Type | e.g. Spiral galaxy, Globular cluster |
| Distance (kly) | Distance in kilolightyears |
| Apparent Magnitude | Brightness as observed from Earth |

---

## Known Limitations

- **Wikipedia dependency** — The scraper targets a specific table structure on a Wikipedia page. If that page's markup changes, column extraction will break silently and produce shifted or empty data.
- **Column index fragility** — Fields are selected by hard-coded index (`columns[0]`, `columns[1]`, etc.). There is currently a bug caused by this: the Messier number column in Wikipedia is rendered as a `<th>` element rather than `<td>`, so `find('td')` skips it and all subsequent columns are off by one. See [Known Bug](#known-bug) below.
- **No data validation** — Values are written as raw strings. Ranges (e.g. `4.9–8.1`), comma-formatted numbers, and em-dashes are preserved as-is rather than normalised.
- **No pagination or rate limiting** — This is a single-page scrape; no throttling logic is needed or implemented.
- **Static snapshot** — The output reflects the state of the Wikipedia page at the time of the run. It is not updated automatically.

---

## Known Bug

The Messier Number column on Wikipedia uses a `<th>` tag rather than `<td>`. Because the script selects only `td` elements, the first column is skipped and every subsequent index is off by one. As a result, the `Messier Number` output column actually contains NGC identifiers, and the `NGC Number` column contains common names.

**Fix:** change the column selector from:

```javascript
const columns = $(this).find('td')
```

to:

```javascript
const columns = $(this).find('td, th')
```

---

## Dependencies

| Package | Purpose |
|---|---|
| axios | HTTP requests |
| cheerio | HTML parsing and DOM traversal |
| csv-writer | CSV file output |

**Dev dependencies**

| Package | Purpose |
|---|---|
| nodemon | Auto-restarts the process on file changes during development |

---

## License

ISC