const nodemailer = require('nodemailer');

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

  // ── LOG 1: Function entry ──
  console.log('[send-email] Function invoked at', new Date().toISOString());

  // ── LOG 2: Env var check ──
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const emailTo = process.env.EMAIL_TO;
  console.log('[send-email] SMTP_USER set:', !!smtpUser, '| length:', smtpUser?.length);
  console.log('[send-email] SMTP_PASS set:', !!smtpPass, '| length:', smtpPass?.length);
  console.log('[send-email] EMAIL_TO set:', !!emailTo, '| value:', emailTo);

  if (!smtpUser || !smtpPass) {
    console.error('[send-email] FATAL: Missing SMTP credentials');
    return res.status(500).json({
      error: 'Email configuration missing',
      details: 'SMTP_USER or SMTP_PASS not set in environment variables',
    });
  }

  try {
    const body = req.body || JSON.parse(await new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => resolve(data));
    }));
    const { type, data } = body;

    console.log('[send-email] Received type:', type);

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
        subject = `Contact Form: ${data.subject || 'No Subject'} — ACK Berea`;
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

    // ── LOG 3: Create transporter ──
    console.log('[send-email] Creating transporter...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass.replace(/\s/g, ''), // strip any spaces
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // ── LOG 4: Verify connection ──
    console.log('[send-email] Verifying SMTP connection...');
    try {
      await transporter.verify();
      console.log('[send-email] SMTP connection verified OK');
    } catch (verifyErr) {
      console.error('[send-email] SMTP verification FAILED:', {
        message: verifyErr.message,
        code: verifyErr.code,
        command: verifyErr.command,
        response: verifyErr.response,
      });
      return res.status(500).json({
        error: 'SMTP connection failed',
        details: verifyErr.message,
        code: verifyErr.code,
      });
    }

    // ── LOG 5: Send email ──
    const to = emailTo || 'ackberea.org@gmail.com';
    console.log('[send-email] Sending to:', to, '| from:', smtpUser, '| subject:', subject);
    const info = await transporter.sendMail({
      from: `"ACK Berea Website" <${smtpUser}>`,
      to,
      subject,
      html: htmlBody,
    });

    // ── LOG 6: Success ──
    console.log('[send-email] Email sent successfully:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });

    res.json({ message: 'Email sent successfully', messageId: info.messageId });
  } catch (error) {
    // ── LOG 7: Full error ──
    console.error('[send-email] FAILED:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
};
