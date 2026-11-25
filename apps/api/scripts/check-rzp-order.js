require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const orderId = process.argv[2] || 'order_U3yVII3NuX8xt5';
const key = process.env.RAZORPAY_KEY_ID;
const secret = process.env.RAZORPAY_KEY_SECRET;
const auth = Buffer.from(`${key}:${secret}`).toString('base64');

(async () => {
  const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  console.log('order', orderRes.status, await orderRes.text());
  const payRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  console.log('payments', payRes.status, await payRes.text());
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
