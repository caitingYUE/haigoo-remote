
import * as cheerio from 'cheerio'
import axios from 'axios'

export const isYandexJobBoard = (url) => {
    return url.includes('yandex.com/jobs')
}

export const parseYandexJobs = async (html, baseUrl, companyId) => {
    // If we are on the landing page, fetch the vacancies page which has the data
    if (baseUrl.endsWith('/jobs') || baseUrl.endsWith('/jobs/')) {
        try {
            console.log('[Yandex Parser] Fetching vacancies page from /jobs/vacancies')
            const response = await axios.get('https://yandex.com/jobs/vacancies', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            })
            html = response.data
        } catch (e) {
            console.error('[Yandex Parser] Failed to fetch vacancies page:', e.message)
            // Continue with original HTML (fallback)
        }
    }

    const jobs = []
    const $ = cheerio.load(html)

    // Strategy 1: Extract from Redux State (Embedded JSON)
    // Format: self.__next_f.push([1,"32:[\"$\",\"$L4b\",null,{\"initialReduxState\": ... "])
    let reduxState = null

    $('script').each((i, el) => {
        if (reduxState) return
        const content = $(el).html()
        if (content && content.includes('initialReduxState')) {
            try {
                // The content is usually inside a string in a list: self.__next_f.push([1,"..."])
                // We want to extract the string part.
                // Simple approach: unescape the whole content if it looks escaped

                // Regex to find initialReduxState object
                // It is likely backslash-escaped in the view: \"initialReduxState\":{...}

                // Let's Find the start of the object
                // We rely on the fact that it starts with \"initialReduxState\" (escaped) or "initialReduxState" (unescaped)

                // First, lets see if we can parse the self.__next_f.push arguments
                // But that requires a full JS parser or lucky regex

                // Let's try to extract the specific JSON chunk by finding start and matching braces
                // But it's inside a string, so we need to handle escaped quotes.

                // Approach:
                // 1. Find substrings that look like key "vacancies"
                // 2. Extract enough context
                // 3. Try to unescape

                // Better Approach based on test script:
                // format found: \"vacancies\":{\"serverReqId\"...

                // Let's find the content after "initialReduxState":
                // It might be escaped: \"initialReduxState\":{...}

                // We can construct a specialized extraction.

                const startMarker = '\\"initialReduxState\\":'
                const startIdx = content.indexOf(startMarker)

                if (startIdx !== -1) {
                    // This creates a substring starting from the value
                    // We need to unescape the whole string first?
                    // Extracting just this part is hard because we don't know where it ends (braces balancing without parsing string)

                    // Let's UNESCAPE the content first if possible. 
                    // Javascript unescape is trickier on arbitrary partial strings.

                    // Let's simple-parse: replace \\" with " and \\\\ with \\
                    const unescaped = content.replace(/\\"/g, '"').replace(/\\\\/g, '\\')

                    const stateStart = unescaped.indexOf('"initialReduxState":')
                    if (stateStart !== -1) {
                        const jsonStart = unescaped.indexOf('{', stateStart) // Start of initialReduxState object value
                        if (jsonStart !== -1) {
                            // Now we need to find the matching closing brace
                            let braceCount = 0
                            let jsonEnd = -1
                            let inString = false

                            for (let j = jsonStart; j < unescaped.length; j++) {
                                const char = unescaped[j]
                                if (char === '"' && unescaped[j - 1] !== '\\') {
                                    inString = !inString
                                }
                                if (!inString) {
                                    if (char === '{') braceCount++
                                    if (char === '}') {
                                        braceCount--
                                        if (braceCount === 0) {
                                            jsonEnd = j + 1
                                            break
                                        }
                                    }
                                }
                            }

                            if (jsonEnd !== -1) {
                                const jsonStr = unescaped.substring(jsonStart, jsonEnd)
                                reduxState = JSON.parse(jsonStr)
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Error parsing Yandex Redux State:', e)
            }
        }
    })

    if (reduxState && reduxState.jobs && reduxState.jobs.vacancies) {
        // Access vacancies
        // Structure is likely: jobs.vacancies.serverReqId ... data? items?
        // Based on grep: "data":{"url":"...","results":[...]} or "items":[...]
        // We need to inspect stricture.
        // Assuming "data" has "results" or "items"
        // Let's assume the mapped jobs are in reduxState.jobs.vacancies.data.results
        // Or reduxState.jobs.vacancies.items

        let items = []
        const vacancies = reduxState.jobs.vacancies
        if (vacancies.data && Array.isArray(vacancies.data.results)) {
            items = vacancies.data.results
        } else if (Array.isArray(vacancies.items)) {
            items = vacancies.items
        } else if (vacancies.data && Array.isArray(vacancies.data.items)) {
            items = vacancies.data.items // Common pattern
        }

        // Also check if vacancies itself is an array
        if (Array.isArray(vacancies)) items = vacancies

        if (items.length > 0) {
            console.log(`[Yandex Parser] Found ${items.length} jobs in Redux State`)
            items.forEach(item => {
                jobs.push({
                    title: item.title,
                    url: item.url ? (item.url.startsWith('http') ? item.url : `https://yandex.com/jobs/vacancies/${item.slug || item.id}`) : '',
                    description: item.description || item.short_summary || '',
                    location: item.location ? item.location.name : '',
                    id: item.id ? String(item.id) : null,
                    publishedAt: item.publication_date, // Guessing key
                    type: item.employment_type // Guessing key
                })
            })
            return { jobs, company: { name: 'Yandex' } }
        }
    }

    // Strategy 2: Cheerio fallback
    // If Redux extraction fails, try parsing HTML
    console.log('[Yandex Parser] Redux extraction failed or empty, using HTML fallback')

    const cards = $('[class*="vacancy-card"]')
    cards.each((i, el) => {
        const card = $(el)

        // Check if header card (usually contains title)
        // Adjust selectors based on earlier findings
        // Title: .lc-styled-text__text
        const titleEl = card.find('.lc-styled-text__text').first()
        let title = titleEl.text().trim()

        // If empty, maybe it's not a job card or title is elsewhere
        if (!title) return

        // Skip things that look like tags "Market Do", "Office" (usually short, check context)
        // Tags usually have distinct classes like vacancy-card__tag
        if (card.attr('class') && card.attr('class').includes('__tag')) return

        let link = card.attr('href')
        if (!link) link = card.find('a').attr('href')
        if (!link) link = card.closest('a').attr('href')

        if (link && !link.startsWith('http')) {
            link = `https://yandex.com${link}`
        }

        // Description?
        // Usually not in list view, or just summary
        let description = ''

        // Add to jobs
        jobs.push({
            title,
            url: link,
            description,
            location: '', // Hard to extract from list without specific selectors
            id: link // Use URL as ID
        })
    })

    return { jobs, company: { name: 'Yandex' } }
}
