const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')

puppeteer.use(StealthPlugin())
const { executablePath } = require('puppeteer')

// Websites
const website = 'https://ca.indeed.com'

// Keywords
const keywords = [
    'Developer',
    'Full-Stack Developer',
    'Web Developer',
    'Backend Developer',
    'Software Engineer',
    'Entry-Level Developer',
    'Entry-Level Engineer',
    'Full-Stack Intern',
    'Intern Developer'
]

// Scraper Function
const extract = async (url, title, location, datePosted, limit) => {
    // Launch puppeteer and go to website to scrape
    const browser = await puppeteer.launch({ headless: 'new', executablePath: executablePath() })
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage()
    await page.goto(`${url}/jobs?q=${title}&l=${location}`)

    // Handle search filters / forms
    await runFilter(page, datePosted)

    // Scrape data by retrieving titles from the cards first, then using those titles to click on each card to scrape the right panel that appears
    const jobs = await scrape(page, url, limit)

    await browser.close()
    return jobs
}

// Filters
const runFilter = async (page, datePosted) => {
    const datePostedButton = await page.$('#filter-dateposted');
    if (datePostedButton) {
        await page.click('#filter-dateposted')
        const element = (await page.$x(`//a[contains(text(), "Last ${datePosted}")]`))[0]
        await page.waitForTimeout(500);

        await page.evaluate((element) => {
            element.click()
        }, element);
    }
    await page.waitForTimeout(1500);
}

const scrape = async (page, url, limit) => {
    const jobs = []

    const extractedData = await page.evaluate(async () => {
        const data = Array.from(document.querySelectorAll('.jcs-JobTitle'))
        return data.map((item) => ({
            title: item.querySelector('span').innerText,
            link: item.getAttribute('href')
        }))
    })

    while (jobs.length < limit) {
        for (const data of extractedData) {
            if (jobs.length < limit) {
                const element = (await page.$x(`//span[contains(text(), "${data.title}")]`))[0]

                if (element) {
                    await page.evaluate((element) => {
                        element.click()
                    }, element);

                    await page.waitForTimeout(1500)

                    const jobObject = await page.evaluate(async (data, url) => {
                        const job = document.querySelector('.fastviewjob')
                        const jobObject = {
                            title: data.title,
                            company: job.querySelector('.css-1f8zkg3.e19afand0').innerText,
                            location: job.querySelector('div[data-testid="inlineHeader-companyLocation"] div').innerText,
                            description: job.querySelector('#jobDescriptionText').innerText,
                            link: url + data.link
                        }

                        return jobObject
                    }, data, url)

                    jobs.push(jobObject)
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        // Pagination
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });

        const nextButton = await page.$('a[data-testid="pagination-page-next"]');
        if (nextButton && (jobs.length < limit)) {
            await page.click('a[data-testid="pagination-page-next"]');
        } else {
            break;
        }
    }

    return jobs
}

module.exports = {
    website,
    keywords,
    extract
}