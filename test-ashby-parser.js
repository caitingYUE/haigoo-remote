/**
 * Test script for Ashby parser
 * Tests the parser with EverAI careers page
 */

import { parseAshbyJobs, isAshbyJobBoard } from './lib/ashby-parser.js'

const EVERAI_CAREERS_URL = 'https://jobs.ashbyhq.com/everai'

async function testAshbyParser() {
    console.log('🧪 Testing Ashby Parser...\n')

    // Test 1: URL detection
    console.log('Test 1: URL Detection')
    const isAshby = isAshbyJobBoard(EVERAI_CAREERS_URL)
    console.log(`✓ isAshbyJobBoard('${EVERAI_CAREERS_URL}'): ${isAshby}`)
    console.log()

    // Test 2: Fetch and parse jobs
    console.log('Test 2: Fetching and Parsing Jobs')
    console.log(`Fetching: ${EVERAI_CAREERS_URL}`)

    try {
        const response = await fetch(EVERAI_CAREERS_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }

        const html = await response.text()
        console.log(`✓ Fetched HTML (${html.length} bytes)`)

        // Parse jobs
        const jobs = parseAshbyJobs(html, EVERAI_CAREERS_URL, 'everai')

        console.log(`\n✓ Parsed ${jobs.length} jobs\n`)

        // Display first 3 jobs
        if (jobs.length > 0) {
            console.log('Sample Jobs:')
            console.log('='.repeat(80))

            jobs.slice(0, 3).forEach((job, index) => {
                console.log(`\nJob ${index + 1}:`)
                console.log(`  Title: ${job.title}`)
                console.log(`  Location: ${job.location}`)
                console.log(`  Type: ${job.type}`)
                console.log(`  Category: ${job.category}`)
                console.log(`  Experience: ${job.experienceLevel}`)
                console.log(`  Remote: ${job.isRemote}`)
                console.log(`  URL: ${job.url}`)
                console.log(`  Tags: ${job.tags.join(', ')}`)
                if (job.ashbyData) {
                    console.log(`  Department: ${job.ashbyData.department}`)
                    console.log(`  Team: ${job.ashbyData.team}`)
                    console.log(`  Workplace: ${job.ashbyData.workplaceType}`)
                }
            })

            console.log('\n' + '='.repeat(80))
            console.log(`\nTotal: ${jobs.length} jobs found`)

            // Statistics
            const categories = {}
            const experienceLevels = {}
            const remoteCount = jobs.filter(j => j.isRemote).length

            jobs.forEach(job => {
                categories[job.category] = (categories[job.category] || 0) + 1
                experienceLevels[job.experienceLevel] = (experienceLevels[job.experienceLevel] || 0) + 1
            })

            console.log('\nStatistics:')
            console.log(`  Remote jobs: ${remoteCount}/${jobs.length}`)
            console.log(`  Categories:`, categories)
            console.log(`  Experience levels:`, experienceLevels)

        } else {
            console.log('⚠️  No jobs found')
        }

        console.log('\n✅ Test completed successfully!')

    } catch (error) {
        console.error('❌ Test failed:', error.message)
        console.error(error.stack)
        process.exit(1)
    }
}

// Run test
testAshbyParser()
