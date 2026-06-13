const mongoose = require('mongoose');
const User = require('./src/models/User');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/assure_chitfunds');
    console.log('Connected to MongoDB');

    const result = await User.updateMany(
      { full_name: { $regex: /dhanush/i } },
      {
        $set: {
          kyc_status: 'verified',
          profile_edit_status: 'approved',
          'onboarding.kyc_verified': true,
          'onboarding.bank_verified': true,
          'onboarding.digilocker_connected': true,
          'onboarding.selfie_verified': true,
          'onboarding.completed': true
        }
      }
    );

    console.log('Update successful:', result);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
