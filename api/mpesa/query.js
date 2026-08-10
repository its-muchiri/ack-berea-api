const axios = require('axios');

const json = (res, status, data) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.statusCode = status;
  res.end(JSON.stringify(data));
};

const baseURL = process.env.ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

let tokenCache = { value: null, expiresAt: 0 };

const getAccessToken = async () => {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt) {
    return tokenCache.value;
  }
  const auth = Buffer.from(
    process.env.CONSUMER_KEY + ':' + process.env.CONSUMER_SECRET
  ).toString('base64');
  const r = await axios.get(
    baseURL + '/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: 'Basic ' + auth } }
  );
  tokenCache = { value: r.data.access_token, expiresAt: Date.now() + 3500000 };
  return tokenCache.value;
};

const generatePassword = (shortcode, passkey) => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = '' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  const raw = shortcode + passkey + timestamp;
  const password = Buffer.from(raw).toString('base64');
  return { password: password, timestamp: timestamp };
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }
  try {
    const id = req.query && req.query.id;
    const token = await getAccessToken();
    const creds = generatePassword(process.env.SHORTCODE, process.env.PASSKEY);
    const result = await axios.post(
      baseURL + '/mpesa/stkpushquery/v1/query',
      {
        BusinessShortCode: process.env.SHORTCODE,
        Password: creds.password,
        Timestamp: creds.timestamp,
        CheckoutRequestID: id,
      },
      { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }
    );
    json(res, 200, result.data);
  } catch (error) {
    console.error('Query error:', (error.response && error.response.data) || error.message);
    json(res, 500, { error: 'Query failed' });
  }
};
