const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
  // Reset user KYC status
  const r = await mongoose.connection.db.collection('users').updateOne(
    { email: 'padarthidhanush0@gmail.com' },
    { $set: { kyc_status: 'not_verified' }, $unset: { digilocker_id: '', pan_number: '', aadhaar_number: '', kyc_verified_at: '', pan_verified: '' } }
  );
  console.log('User reset:', r.modifiedCount);

  // Delete all documents for this user
  const user = await mongoose.connection.db.collection('users').findOne({ email: 'padarthidhanush0@gmail.com' });
  if (user) {
    const d = await mongoose.connection.db.collection('documents').deleteMany({ user_id: user._id });
    console.log('Documents deleted:', d.deletedCount);
  }

  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
