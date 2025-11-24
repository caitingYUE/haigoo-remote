import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js'

// Simple HTML parser using regex to avoid heavy dependencies like cheerio if not present
function extractMetadata(html) {
    const metadata = {
        title: '',
        description: '',
        image: '',
        icon: ''
    }

    // Helper to match meta tags
    const getMeta = (prop) => {
        const regex = new RegExp(`<meta\\s+(?:property|name)=["']${prop}["']\\s+content=["']([^"']*)["']`, 'i')
        const match = html.match(regex)
        return match ? match[1] : ''
    }

    // Title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    metadata.title = getMeta('og:title') || (titleMatch ? titleMatch[1] : '')

    // Description
    metadata.description = getMeta('og:description') || getMeta('description')

    // Image
    metadata.image = getMeta('og:image')

    // Icon (simple check)
    const iconMatch = html.match(/<link\\s+rel=["'](?:shortcut )?icon["']\\s+href=["']([^"']*)["']/i)
    metadata.icon = iconMatch ? iconMatch[1] : ''

    return metadata
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') return res.status(200).end()

    const token = extractToken(req)
    const payload = verifyToken(token)
    if (!payload) return res.status(401).json({ success: false, error: 'Unauthorized' })

    if (req.method === 'POST') {
        const { url } = req.body
        if (!url) return res.status(400).json({ success: false, error: 'URL is required' })

        try {
            console.log(`[crawler] Fetching metadata for: ${url}`)
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            })

            if (!response.ok) {
                throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
            }

            const html = await response.text()
            const metadata = extractMetadata(html)

            // Normalize URLs
            if (metadata.icon && !metadata.icon.startsWith('http')) {
                const urlObj = new URL(url)
                metadata.icon = new URL(metadata.icon, urlObj.origin).toString()
            }
            if (metadata.image && !metadata.image.startsWith('http')) {
                const urlObj = new URL(url)
                metadata.image = new URL(metadata.image, urlObj.origin).toString()
            }

            return res.status(200).json({ success: true, metadata })
        } catch (error) {
            console.error('[crawler] Error:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
}
