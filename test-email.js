require('dotenv').config({ path: 'C:/Users/KIMISH/Desktop/Ack-Berea/server/.env' });
const nodemailer = require('nodemailer');

const cleanPass = (process.env.SMTP_PASS || '').replace(/\s/g, '');
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS clean length:', cleanPass.length);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_USER, pass: cleanPass },
});

transporter.sendMail({
  from: `"ACK Berea Website" <${process.env.SMTP_USER}>`,
  to: process.env.EMAIL_TO || 'ackberea.org@gmail.com',
  subject: 'LOCAL TEST - ACK Berea',
  html: '<h2>Local Test</h2><p>This email was sent from local dev to verify SMTP works.</p>',
}).then(info => {
  console.log('SENT OK:', info.messageId, info.response);
  process.exit(0);
}).catch(e => {
  console.error('SEND FAILED:', e.message, e.code);
  process.exit(1);
});
