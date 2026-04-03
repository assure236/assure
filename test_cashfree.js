const axios = require('axios');
const cf = {
  baseUrl: 'https://api.cashfree.com/pg',
  headers: {
    'x-api-version': '2023-08-01',
    'x-client-id': '1238159f5d7bcf5587d7d72fbd29518321',
    'x-client-secret': 'cfsk_ma_prod_609a7e6a3eb94b73202856f22547189b_1bc50651',
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
