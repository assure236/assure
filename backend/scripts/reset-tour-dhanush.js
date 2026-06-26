/**
 * Reset dashboard tour for Dhanush test account so "Take a tour" can be tested again.
 * Usage: node scripts/reset-tour-dhanush.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { User } = require('../src/models');

const TEST_EMAIL = 'padarthidhanush0@gmail.com';

async function resetTour() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/assure_chitfunds');
    console.log('Connected to MongoDB');

    const user = await User.findOne({
      $or: [
        { email: TEST_EMAIL },
        { full_name: { $regex: /dhanush/i } },
      ],
    });

    if (!user) {
      console.log('User not found (tried email and name dhanush)');
      process.exit(1);
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { 'onboarding.tour_completed': false } },
    );

    console.log('Tour reset for:', user.full_name, `(${user.email})`);
    console.log('onboarding.tour_completed = false');
    console.log('\nOn mobile: open app → unlock → dashboard tour should appear after sync.');
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

resetTour();
