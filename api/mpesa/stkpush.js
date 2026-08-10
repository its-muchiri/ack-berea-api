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

const formatPhone = (phone) => {
  if (phone.startsWith('0')) return '254' + phone.slice(1);
  if (phone.startsWith('+')) return phone.slice(1);
  return phone;
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = req.body || JSON.parse(await new Promise((resolve) => {
      let d = '';
      req.on('data', (c) => { d += c; });
      req.on('end', () => resolve(d));
    }));
    const phone = body.phone;
    const amount = body.amount;
    const accountReference = body.accountReference;
    const description = body.description;

    if (!phone || !amount) {
      return json(res, 400, { error: 'Phone and amount are required' });
    }

    if (amount < 1) {
      return json(res, 400, { error: 'Amount must be at least KES 1' });
    }

    const token = await getAccessToken();
    const creds = generatePassword(process.env.SHORTCODE, process.env.PASSKEY);

    const result = await axios.post(
      baseURL + '/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: process.env.SHORTCODE,
        Password: creds.password,
        Timestamp: creds.timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: formatPhone(phone),
        PartyB: process.env.SHORTCODE,
        PhoneNumber: formatPhone(phone),
        CallBackURL: process.env.CALLBACK_URL,
        AccountReference: accountReference || 'ACK Berea Donation',
        TransactionDesc: description || 'Church Donation',
      },
      { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }
    );

    json(res, 200, {
      message: 'STK Push sent. Check your phone for the M-Pesa prompt.',
      CheckoutRequestID: result.data.CheckoutRequestID,
      MerchantRequestID: result.data.MerchantRequestID,
      ResponseCode: result.data.ResponseCode,
    });
  } catch (error) {
    console.error('STK Push error:', (error.response && error.response.data) || error.message);
    json(res, 500, {
      error: 'Failed to initiate payment',
      details: error.response && error.response.data && error.response.data.errorMessage || error.message,
    });
  }
};
