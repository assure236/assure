const axios = require('axios');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
  console.error('Missing CASHFREE_APP_ID/CASHFREE_SECRET_KEY. Set them in environment or backend/.env on your machine.');
  process.exit(1);
}

const cf = {
  baseUrl: 'https://api.cashfree.com/pg',
  headers: {
    'x-api-version': '2023-08-01',
    'x-client-id': process.env.CASHFREE_APP_ID,
    'x-client-secret': process.env.CASHFREE_SECRET_KEY,
    'Content-Type': 'application/json'
  }
};

const orderId = 'TEST-' + Date.now();
console.log('Creating order:', orderId);

axios.post(cf.baseUrl + '/orders', {
  order_id: orderId,
  order_amount: 100,
  order_currency: 'INR',
  customer_details: {
    customer_id: 'test123',
    customer_name: 'Test User',
    customer_email: 'test@test.com',
    customer_phone: '6305846093'
  }
}, { headers: cf.headers }).then(r => {
  console.log('STATUS:', r.status);
  console.log('SESSION_ID:', r.data.payment_session_id);
  console.log('SESSION_ID_LENGTH:', r.data.payment_session_id?.length);
  console.log('ORDER_STATUS:', r.data.order_status);
  console.log('HOSTED_URL: https://payments.cashfree.com/order/#' + r.data.payment_session_id);
  console.log('FULL RESPONSE:', JSON.stringify(r.data, null, 2));
}).catch(e => {
  console.log('ERROR STATUS:', e.response?.status);
  console.log('ERROR DATA:', JSON.stringify(e.response?.data, null, 2));
});
