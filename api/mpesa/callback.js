module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || JSON.parse(await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
  }));
  const callback = body.Body?.stkCallback;

  if (!callback) {
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'No callback data' });
  }

  const { ResultCode, ResultDesc, CallbackMetadata } = callback;

  if (ResultCode === 0) {
    const items = CallbackMetadata?.Item || [];
    const mpesaReceipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
    const amount = items.find(i => i.Name === 'Amount')?.Value;
    const phoneNumber = items.find(i => i.Name === 'PhoneNumber')?.Value;

    console.log('Payment received:', { mpesaReceipt, amount, phoneNumber });
  } else {
    console.log('Payment failed:', { ResultCode, ResultDesc });
  }

  res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
};
