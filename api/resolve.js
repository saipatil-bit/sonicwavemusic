const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function isMaliciousQuery(value) {
  if (typeof value !== 'string') return false;

  let normalized = value;
  for (let i = 0; i < 3; i += 1) {
    let decoded;
    try {
      decoded = decodeURIComponent(normalized);
    } catch {
      break;
    }
    if (decoded === normalized) break;
    normalized = decoded;
  }

  return /(?:\b(?:union\s+select|(?:or|and)\s+['"]?\w+['"]?\s*=\s*['"]?\w+|sleep\s*\(|waitfor\s+delay)|(?:--|#|\/\*))/i.test(normalized);
}

async function resolveYouTubeId(query) {
  const response = await fetch(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SonicWaveResolver/1.0)',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }
  );

  if (!response.ok) return null;
  const html = await response.text();
  const matches = html.match(/\/watch\?v=([A-Za-z0-9_-]{11})/g) || [];

  for (const match of matches) {
    const id = match.slice(-11);
    if (YOUTUBE_ID_PATTERN.test(id)) return id;
  }

  return null;
}

module.exports = async function handler(req, res) {
  const query = typeof req.query?.q === 'string' ? req.query.q.trim().slice(0, 120) : '';

  if (!query) {
    return res.status(400).json({ success: false, error: 'Query parameter q is required' });
  }

  if (isMaliciousQuery(query)) {
    return res.status(400).json({ success: false, error: 'Invalid parameter' });
  }

  try {
    const id = await resolveYouTubeId(query);
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return res.status(200).json({ success: Boolean(id), id, query });
  } catch (error) {
    console.error('YouTube resolver failed:', error);
    return res.status(502).json({ success: false, error: 'Unable to resolve the requested track' });
  }
};
