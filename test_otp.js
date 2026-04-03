const http = require('http');
const data = JSON.stringify({ mobile: '9390583208' });
const req = http.request({
  hostname: 'localhost', port: 5000,
  path: '/api/v1/auth/resend-otp',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => { console.log(res.statusCode, body); process.exit(0); });
});
req.on('error', e => { console.error('Error:', e.message); process.exit(1); });
req.write(data);
req.end();
