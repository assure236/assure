const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/assure_chitfunds';
  await mongoose.connect(uri);
  logger.info('MongoDB connected successfully');
};

module.exports = { connectDB, mongoose };
