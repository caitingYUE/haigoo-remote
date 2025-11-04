// Vercel Serverless Function: return processed jobs placeholder data
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      page = '1',
      limit = '20',
      source,
      category,
      status,
      dateFrom,
      dateTo,
      company,
      isRemote,
      search,
      location,
      type
    } = req.query || {};

    const pageNum = Number(page) || 1;
    const pageSize = Number(limit) || 20;

    // Placeholder response; real aggregation can be added later
    const payload = {
      jobs: [],
      total: 0,
      page: pageNum,
      pageSize: pageSize,
      totalPages: 0,
      filters: {
        source,
        category,
        status,
        dateFrom,
        dateTo,
        company,
        isRemote: typeof isRemote !== 'undefined' ? isRemote === 'true' : undefined,
        search,
        location,
        type
      }
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(JSON.stringify(payload));
  } catch (error) {
    console.error('processed-jobs API error:', error);
    return res.status(500).json({ error: 'Failed to fetch processed jobs', message: error?.message || String(error) });
  }
}