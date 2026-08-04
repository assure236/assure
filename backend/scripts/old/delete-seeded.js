const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/assure_chitfunds').then(async () => {
  const r = await mongoose.connection.collection('chitgroups').deleteMany({
    group_number: { $regex: '^ACF-202[56]' }
  });
  console.log('Deleted:', r.deletedCount, 'chit groups');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
