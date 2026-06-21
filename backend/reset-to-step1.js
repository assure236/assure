const mongoose = require('mongoose');
const User = require('./src/models/User');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/assure_chitfunds');
    console.log('Connected to MongoDB');

    const result = await User.updateOne(
      { mobile: '6305846093' },
      {
        'onboarding.digilocker.status': 'pending',
        'onboarding.next_step': 'digilocker',
        pan_number: null,
        aadhaar_number: null,
        digilocker_id: null
      }
    );

    console.log('Reset successful:', result);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
