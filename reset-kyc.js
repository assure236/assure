const mongoose = require('mongoose');
const User = require('./src/models/User');

async function resetKYC() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/assure_chitfunds');
    console.log('Connected to MongoDB');
    
    const user = await User.findOne({ email: 'padarthidhanush0@gmail.com' });
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }
    
    console.log('Found user:', user.full_name);
    console.log('Current KYC status:', user.kyc_status);
    console.log('Aadhar:', user.aadhar_number ? 'Present' : 'None');
    console.log('PAN:', user.pan_number ? 'Present' : 'None');
    
    await User.updateOne(
      { _id: user._id },
      { 
        kyc_status: 'not_verified',
        $unset: { 
          aadhar_number: '',
          pan_number: '',
          aadhar_front: '',
          aadhar_back: '',
          pan_card: ''
        }
      }
    );
    
    console.log('\n✅ KYC reset complete!');
    console.log('- Status: not_verified');
    console.log('- Aadhar removed');
    console.log('- PAN removed');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

resetKYC();
