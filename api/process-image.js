import sharp from 'sharp'

export default async function handler(req, res) {
    // CORS
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        return res.status(200).json({})
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { image } = req.body

        if (!image) {
            return res.status(400).json({ error: 'Image data is required' })
        }

        // Remove data URL prefix if present
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')

        // Process image: Resize to 1200x675 (16:9), cover fit, convert to WebP
        const processedBuffer = await sharp(buffer)
            .resize(1200, 675, {
                fit: 'cover',
                position: 'center' // Crop from center
            })
            .toFormat('webp', { quality: 80 }) // Compress to reduce size
            .toBuffer()

        // Convert back to Base64
        const processedBase64 = `data:image/webp;base64,${processedBuffer.toString('base64')}`

        return res.status(200).json({
            success: true,
            image: processedBase64
        })

    } catch (error) {
        console.error('Image processing failed:', error)
        return res.status(500).json({ error: 'Image processing failed: ' + error.message })
    }
}
