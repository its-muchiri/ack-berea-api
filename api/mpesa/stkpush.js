const axios = require('axios');

const baseURL = process.env.ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

let tokenCache = { value: null, expiresAt: 0 };

const getAccessToken = async () => {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt) {
    return tokenCache.value;
  }

  const auth = Buffer.from(
    `${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`
  ).toString('base64');

  const res = await axios.get(
    `${baseURL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );

  tokenCache = {
    value: res.data.access_token,
    expiresAt: Date.now() + 3500 * 1000,
  };

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
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const raw = `${shortcode}${passkey}${timestamp}`;
  const password = Buffer.from(raw).toString('base64');
  return { password, timestamp };
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, amount, accountReference, description } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: 'Phone and amount are required' });
    }

    if (amount < 1) {
      return res.status(400).json({ error: 'Amount must be at least KES 1' });
    }

    const token = await getAccessToken();
    const { password, timestamp } = generatePassword(
      process.env.SHORTCODE,
      process.env.PASSKEY
    );

    const result = await axios.post(
      `${baseURL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: process.env.SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: formatPhone(phone),
        PartyB: process.env.SHORTCODE,
        PhoneNumber: formatPhone(phone),
        CallBackURL: process.env.CALLBACK_URL,
        AccountReference: accountReference || 'ACK Berea Donation',
        TransactionDesc: description || 'Church Donation',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      message: 'STK Push sent. Check your phone for the M-Pesa prompt.',
      CheckoutRequestID: result.data.CheckoutRequestID,
      MerchantRequestID: result.data.MerchantRequestID,
      ResponseCode: result.data.ResponseCode,
    });
  } catch (error) {
    console.error('STK Push error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to initiate payment',
      details: error.response?.data?.errorMessage || error.message,
    });
  }
};
