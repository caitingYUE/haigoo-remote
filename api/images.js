
import fetch from 'node-fetch';
import sharp from 'sharp';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action } = req.query;

    // === Proxy Image (GET) ===
    // Default to proxy behavior if method is GET or action is proxy
    if (req.method === 'GET' || (req.method === 'POST' && action === 'proxy')) {
        const url = req.query.url || req.body?.url;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                return res.status(response.status).send(`Failed to fetch image: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType) {
                res.setHeader('Content-Type', contentType);
            }

            // Forward the image data
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));

        } catch (error) {
            console.error('Proxy image error:', error);
            res.status(500).json({ error: 'Failed to proxy image' });
        }
        return;
    }

    // === Process Image (POST) ===
    if (req.method === 'POST') {
        // If action is not specified or is 'process'
        if (!action || action === 'process') {
            try {
                const { image } = req.body;

                if (!image) {
                    return res.status(400).json({ error: 'Image data is required' });
                }

                // Remove data URL prefix if present
                const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');

                // Process image: Resize to 1200x675 (16:9), cover fit, convert to WebP
                const processedBuffer = await sharp(buffer)
                    .resize(1200, 675, {
                        fit: 'cover',
                        position: 'center' // Crop from center
                    })
                    .toFormat('webp', { quality: 80 }) // Compress to reduce size
                    .toBuffer();

                // Convert back to Base64
                const processedBase64 = `data:image/webp;base64,${processedBuffer.toString('base64')}`;

                return res.status(200).json({
                    success: true,
                    image: processedBase64
                });

            } catch (error) {
                console.error('Image processing failed:', error);
                return res.status(500).json({ error: 'Image processing failed: ' + error.message });
            }
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
