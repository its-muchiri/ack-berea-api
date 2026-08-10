const nodemailer = require('nodemailer');

const json = (res, status, data) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.statusCode = status;
  res.end(JSON.stringify(data, null, 2));
};

module.exports = async (req, res) => {
  const out = { started: new Date().toISOString() };
  try {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const emailTo = process.env.EMAIL_TO;
    out.smtpUser = smtpUser ? smtpUser.replace(/^(.{2}).*/, '$1***') : null;
    out.emailTo = emailTo;
    out.hasPass = !!smtpPass;

    if (!smtpUser || !smtpPass) {
      json(res, 500, Object.assign(out, { error: 'Missing SMTP credentials' }));
      return;
    }

    out.beforeSend = new Date().toISOString();
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass.replace(/\s/g, '') },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });

    await transporter.verify();
    out.verify = new Date().toISOString();

    const info = await transporter.sendMail({
      from: '"ACK Berea Debug" <' + smtpUser + '>',
      to: emailTo || 'ackberea.org@gmail.com',
      subject: 'ACK Berea Vercel debug test ' + new Date().toISOString(),
      html: '<p>If you received this, the Vercel serverless send chain works end-to-end.</p>',
    });
    out.afterSend = new Date().toISOString();
    out.messageId = info.messageId;
    out.accepted = info.accepted;
    json(res, 200, out);
  } catch (error) {
    out.error = error.message;
    out.errorCode = error.code;
    out.errorCommand = error.command;
    out.errorResponse = error.response;
    out.errorStack = error.stack;
    out.afterError = new Date().toISOString();
    json(res, 500, out);
  }
};
