const nodemailer = require('nodemailer');

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

  try {
    const { type, data } = await getBody(req);

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
};
