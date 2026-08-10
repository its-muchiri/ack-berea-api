const getBody = (req) => new Promise((resolve) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    try { resolve(JSON.parse(body)); } catch { resolve({}); }
  });
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = await getBody(req);
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
