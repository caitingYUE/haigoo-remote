import { getRSSSources, fetchAndParseFeed } from '../services/rss-fetcher.js';
import { saveRawItems } from '../api-handlers/raw-rss.js';

export default async function handler(req, res) {
  // Check for authentication if needed (Vercel cron sends a header)
  // const authHeader = req.headers.authorization;
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }

  // Set SSE headers for Edge Runtime compatibility
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

  try {
    console.log('[Cron:FetchRSS] Starting...');
    
    // Send start message immediately using SSE format
    res.write(`event: start\ndata: ${JSON.stringify({
      type: 'start',
      message: 'RSS抓取任务开始执行 (流式处理模式)',
      timestamp: new Date().toISOString()
    })}\n\n`);

    // 1. Get Sources
    const sources = await getRSSSources();
    if (!sources || sources.length === 0) {
        console.log('[Cron:FetchRSS] No active sources found.');
        res.write(`event: complete\ndata: ${JSON.stringify({
            type: 'complete',
            message: '未找到活跃的RSS源',
            fetched: 0,
            saved: 0,
            timestamp: new Date().toISOString()
        })}\n\n`);
        res.end();
        return;
    }

    console.log(`[Cron:FetchRSS] Found ${sources.length} sources.`);
    res.write(`event: fetch_start\ndata: ${JSON.stringify({
        type: 'fetch_start',
        message: `开始抓取 ${sources.length} 个RSS源`,
        timestamp: new Date().toISOString()
    })}\n\n`);

    // 2. Fetch and Save in Chunks
    let totalFetched = 0;
    let totalSaved = 0;
    const chunkSize = 3;

    for (let i = 0; i < sources.length; i += chunkSize) {
        const chunk = sources.slice(i, i + chunkSize);
        const chunkNumber = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(sources.length / chunkSize);

        res.write(`event: chunk_start\ndata: ${JSON.stringify({
            type: 'chunk_start',
            message: `正在抓取第 ${chunkNumber}/${totalChunks} 批次...`,
            timestamp: new Date().toISOString()
        })}\n\n`);

        try {
            // Fetch chunk
            const results = await Promise.all(chunk.map(source => fetchAndParseFeed(source)));
            const chunkItems = results.flat();
            totalFetched += chunkItems.length;

            if (chunkItems.length > 0) {
                // Save chunk immediately
                const saved = await saveRawItems(chunkItems, 'append');
                totalSaved += saved.length;
                console.log(`[Cron:FetchRSS] Chunk ${chunkNumber}: Fetched ${chunkItems.length}, Saved ${saved.length}`);
                
                res.write(`event: chunk_complete\ndata: ${JSON.stringify({
                    type: 'chunk_complete',
                    message: `批次 ${chunkNumber} 完成: 获取 ${chunkItems.length} 条, 入库 ${saved.length} 条`,
                    fetched: chunkItems.length,
                    saved: saved.length,
                    timestamp: new Date().toISOString()
                })}\n\n`);
            } else {
                console.log(`[Cron:FetchRSS] Chunk ${chunkNumber}: No items found.`);
                res.write(`event: chunk_complete\ndata: ${JSON.stringify({
                    type: 'chunk_complete',
                    message: `批次 ${chunkNumber} 完成: 无新数据`,
                    fetched: 0,
                    saved: 0,
                    timestamp: new Date().toISOString()
                })}\n\n`);
            }

        } catch (chunkError) {
            console.error(`[Cron:FetchRSS] Error in chunk ${chunkNumber}:`, chunkError);
            res.write(`event: chunk_error\ndata: ${JSON.stringify({
                type: 'chunk_error',
                message: `批次 ${chunkNumber} 发生错误: ${chunkError.message}`,
                timestamp: new Date().toISOString()
            })}\n\n`);
            // Continue to next chunk instead of aborting
        }
    }

    console.log('[Cron:FetchRSS] Completed successfully.');

    // Send final completion message
    res.write(`event: complete\ndata: ${JSON.stringify({
      type: 'complete',
      message: 'RSS抓取任务完成',
      stats: {
        fetched: totalFetched,
        saved: totalSaved
      },
      timestamp: new Date().toISOString()
    })}\n\n`);
    res.end();

  } catch (error) {
    console.error('[Cron:FetchRSS] Error with unexpected exception:', error);
    res.write(`event: error\ndata: ${JSON.stringify({
      type: 'error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })}\n\n`);
    res.end();
  }
}
