require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  tls: { rejectUnauthorized: false }
});

transporter.verify((err, ok) => {
  if (err) { console.error('SMTP VERIFY FAILED:', err.message); return; }
  console.log('SMTP connection OK - sending test email...');
  transporter.sendMail({
    from: '"Assure ChitFunds" <' + process.env.SMTP_USER + '>',
    to: process.env.SMTP_USER,
    subject: 'OTP Test from Assure ChitFunds',
    html: '<p>Your OTP is: <b style="font-size:20px">123456</b>. Valid for 10 minutes.</p>'
  }, (e, info) => {
    if (e) return console.error('SEND FAILED:', e.message);
    console.log('Email sent! MessageId:', info.messageId);
  });
});
