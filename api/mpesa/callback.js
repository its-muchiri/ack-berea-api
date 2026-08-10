const json = (res, status, data) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.statusCode = status;
  res.end(JSON.stringify(data));
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

  const body = req.body || JSON.parse(await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
  }));
  const callback = body.Body && body.Body.stkCallback;

  if (!callback) {
    return json(res, 200, { ResultCode: 0, ResultDesc: 'No callback data' });
  }

  const { ResultCode, ResultDesc, CallbackMetadata } = callback;

  if (ResultCode === 0) {
    const items = (CallbackMetadata && CallbackMetadata.Item) || [];
    const mpesaReceipt = items.find(function (i) { return i.Name === 'MpesaReceiptNumber'; });
    const amount = items.find(function (i) { return i.Name === 'Amount'; });
    const phoneNumber = items.find(function (i) { return i.Name === 'PhoneNumber'; });
    console.log('Payment received:', {
      mpesaReceipt: mpesaReceipt && mpesaReceipt.Value,
      amount: amount && amount.Value,
      phoneNumber: phoneNumber && phoneNumber.Value,
    });
  } else {
    console.log('Payment failed:', { ResultCode: ResultCode, ResultDesc: ResultDesc });
  }

  json(res, 200, { ResultCode: 0, ResultDesc: 'Success' });
};
