require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Email Transporter ───
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (subject, htmlBody) => {
  await emailTransporter.sendMail({
    from: `"ACK Berea Website" <${process.env.SMTP_USER}>`,
    to: process.env.EMAIL_TO || 'ackberea.org@gmail.com',
    subject,
    html: htmlBody,
  });
};

const baseURL = process.env.ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// ─── Token Cache ───
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
    expiresAt: Date.now() + 3500 * 1000, // ~58 minutes
  };

  return tokenCache.value;
};

// ─── Helpers ───
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

// ─── STK Push Endpoint ───
app.post('/api/mpesa/stkpush', async (req, res) => {
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
});

// ─── M-Pesa Callback Endpoint ───
app.post('/api/mpesa/callback', (req, res) => {
  const callback = req.body.Body?.stkCallback;

  if (!callback) {
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'No callback data' });
  }

  const { ResultCode, ResultDesc, CallbackMetadata } = callback;

  if (ResultCode === 0) {
    const items = CallbackMetadata?.Item || [];
    const mpesaReceipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
    const amount = items.find(i => i.Name === 'Amount')?.Value;
    const phoneNumber = items.find(i => i.Name === 'PhoneNumber')?.Value;

    console.log('✅ Payment received:', { mpesaReceipt, amount, phoneNumber });
    // TODO: Save to database, send confirmation email/SMS
  } else {
    console.log('❌ Payment failed:', { ResultCode, ResultDesc });
  }

  res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
});

// ─── Query Transaction Status ───
app.get('/api/mpesa/query/:checkoutRequestId', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { password, timestamp } = generatePassword(
      process.env.SHORTCODE,
      process.env.PASSKEY
    );

    const result = await axios.post(
      `${baseURL}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: process.env.SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: req.params.checkoutRequestId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json(result.data);
  } catch (error) {
    console.error('Query error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Query failed' });
  }
});

// ─── Send Email Endpoint ───
app.post('/api/send-email', async (req, res) => {
  try {
    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Type and data are required' });
    }

    let subject = '';
    let htmlBody = '';

    switch (type) {
      case 'newsletter':
        subject = 'New Newsletter Subscription — ACK Berea';
        htmlBody = `
          <h2>New Newsletter Subscription</h2>
          <p><strong>Email:</strong> ${data.email}</p>
          <p>Subscribed from the ACK Berea Church website.</p>
        `;
        break;

      case 'volunteer':
        subject = 'New Volunteer Sign-Up — ACK Berea';
        htmlBody = `
          <h2>New Volunteer Sign-Up</h2>
          <p><strong>Name:</strong> ${data.name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Area of Service:</strong> ${data.area}</p>
          <p><strong>Availability:</strong> ${data.availability}</p>
        `;
        break;

      case 'prayer-request':
        subject = 'New Prayer Request — ACK Berea';
        htmlBody = `
          <h2>New Prayer Request</h2>
          <p><strong>Name:</strong> ${data.name || 'Anonymous'}</p>
          <p><strong>Request:</strong></p>
          <p>${data.request}</p>
          <p><strong>Privacy:</strong> ${data.isPrivate ? 'Keep private (clergy only)' : 'Share with prayer team'}</p>
        `;
        break;

      case 'contact':
        subject = `Contact Form: ${data.subject} — ACK Berea`;
        htmlBody = `
          <h2>New Contact Message</h2>
          <p><strong>Name:</strong> ${data.name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Subject:</strong> ${data.subject}</p>
          <p><strong>Message:</strong></p>
          <p>${data.message}</p>
        `;
        break;

      case 'live-chat':
        subject = 'Live Chat Message — ACK Berea';
        htmlBody = `
          <h2>Live Chat Message</h2>
          <p><strong>Message:</strong> ${data.message}</p>
          <p>Sent from the live stream page.</p>
        `;
        break;

      default:
        return res.status(400).json({ error: 'Unknown email type' });
    }

    await sendEmail(subject, htmlBody);
    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email error:', error.message);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

// ─── Health Check ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.ENV });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ACK Berea API running on port ${PORT}`));
