module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const origin = req.headers.origin || req.headers.referer || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const forwarded = req.headers['x-forwarded-for'] || 'unknown';

  console.log('[test-origin] Origin:', origin);
  console.log('[test-origin] User-Agent:', userAgent);
  console.log('[test-origin] IP:', forwarded);
  console.log('[test-origin] Method:', req.method);
  console.log('[test-origin] Headers:', JSON.stringify(req.headers));

  res.json({
    received: true,
    origin,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
};
