const nodemailer = require('nodemailer');

const json = (res, status, data) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.statusCode = status;
  res.end(JSON.stringify(data));
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const emailTo = process.env.EMAIL_TO;

  if (!smtpUser || !smtpPass) {
    console.error('[send-email] Missing SMTP credentials');
    return json(res, 500, { error: 'Email configuration missing' });
  }

  try {
    const body = req.body || JSON.parse(await new Promise((resolve) => {
      let d = '';
      req.on('data', (c) => { d += c; });
      req.on('end', () => resolve(d));
    }));
    const { type, data } = body;

    if (!type || !data) {
      return json(res, 400, { error: 'Type and data are required' });
    }

    let subject = '';
    let htmlBody = '';

    switch (type) {
      case 'newsletter':
        subject = 'New Newsletter Subscription - ACK Berea';
        htmlBody = '<h2>New Newsletter Subscription</h2><p><strong>Email:</strong> ' + data.email + '</p>';
        break;
      case 'volunteer':
        subject = 'New Volunteer Sign-Up - ACK Berea';
        htmlBody = '<h2>New Volunteer Sign-Up</h2><p><strong>Name:</strong> ' + data.name + '</p><p><strong>Email:</strong> ' + data.email + '</p><p><strong>Area of Service:</strong> ' + data.area + '</p><p><strong>Availability:</strong> ' + data.availability + '</p>';
        break;
      case 'prayer-request':
        subject = 'New Prayer Request - ACK Berea';
        htmlBody = '<h2>New Prayer Request</h2><p><strong>Name:</strong> ' + (data.name || 'Anonymous') + '</p><p><strong>Request:</strong></p><p>' + data.request + '</p>';
        break;
      case 'contact':
        subject = 'Contact Form: ' + (data.subject || 'No Subject') + ' - ACK Berea';
        htmlBody = '<h2>New Contact Message</h2><p><strong>Name:</strong> ' + data.name + '</p><p><strong>Email:</strong> ' + data.email + '</p><p><strong>Subject:</strong> ' + data.subject + '</p><p><strong>Message:</strong></p><p>' + data.message + '</p>';
        break;
      case 'live-chat':
        subject = 'Live Chat Message - ACK Berea';
        htmlBody = '<h2>Live Chat Message</h2><p><strong>Message:</strong> ' + data.message + '</p>';
        break;
      default:
        return json(res, 400, { error: 'Unknown email type' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass.replace(/\s/g, '') },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    await transporter.verify();

    const to = emailTo || 'ackberea.org@gmail.com';
    const info = await transporter.sendMail({
      from: '"ACK Berea Website" <' + smtpUser + '>',
      to: to,
      subject: subject,
      html: htmlBody,
    });

    console.log('[send-email] Sent:', info.messageId);
    json(res, 200, { message: 'Email sent successfully', messageId: info.messageId });
  } catch (error) {
    console.error('[send-email] FAILED:', error.message);
    json(res, 500, { error: 'Failed to send email', details: error.message });
  }
};
