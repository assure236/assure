const mongoose = require('mongoose');
const { User } = require('./src/models');

async function resetToStep2() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/assure_chitfunds');
    console.log('Connected to MongoDB');
    
    // Using phone number instead of email
    const user = await User.findOne({ mobile: '6305846093' });
    if (!user) {
      console.log('User with mobile 6305846093 not found');
      process.exit(1);
    }
    
    console.log('Found user:', user.full_name, '(Email:', user.email + ')');
    
    await User.updateOne(
      { _id: user._id },
      {
        // Clear identity fields to prevent auto-completion of Step 1
        'digilocker_id': null,
        'pan_number': null,
        'aadhaar_number': null,
        // Reset to Step 1 (DigiLocker)
        'onboarding.digilocker.status': 'pending',
        'onboarding.digilocker.completed_at': null,
        // Reset face_match to pending
        'onboarding.face_match.status': 'pending',
        'onboarding.face_match.score': null,
        'onboarding.face_match.completed_at': null,
        // Clear all subsequent steps
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
    
    console.log('\n✅ Onboarding reset to Step 1 (DigiLocker) and cleared KYC identity for mobile 6305846093');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

resetToStep2();
