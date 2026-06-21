const mongoose = require('mongoose');
const { User } = require('../src/models');

async function resetToStep2() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/assure_chitfunds');
    console.log('Connected to MongoDB');
    
    const user = await User.findOne({ email: 'padarthidhanush0@gmail.com' });
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }
    
    console.log('Found user:', user.full_name);
    console.log('Current onboarding:', JSON.stringify(user.onboarding, null, 2));
    
    // Reset to step 2 (face_match pending, digilocker must be done first)
    await User.updateOne(
      { _id: user._id },
      {
        // Ensure digilocker step is completed (required to proceed to step 2)
        'onboarding.digilocker.status': 'completed',
        'onboarding.digilocker.completed_at': new Date(),
        // Reset face_match to pending
        'onboarding.face_match.status': 'pending',
        'onboarding.face_match.score': null,
        'onboarding.face_match.completed_at': null,
        // Clear subsequent steps
        'onboarding.bank.status': 'pending',
        'onboarding.bank.account_holder_name': null,
        'onboarding.bank.name_match_score': null,
        'onboarding.bank.rejection_reason': null,
        'onboarding.bank.completed_at': null,
        'onboarding.cheque.status': 'pending',
        'onboarding.cheque.completed_at': null,
        'onboarding.address.status': 'pending',
        'onboarding.address.completed_at': null,
        'onboarding.completed_at': null,
      }
    );
    
    console.log('\n✅ Onboarding reset to Step 2 (Face Verification)');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

resetToStep2();