const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/assure_chitfunds';

  // ─── Connection pooling for 50K concurrent users ───────────────────────
  await mongoose.connect(uri, {
    maxPoolSize: 50,
    minPoolSize: 10,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000,
  });

  // Log pool events for monitoring
  mongoose.connection.on('connected', () => logger.info('MongoDB connected (pool: 10-50)'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected — attempting reconnect'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error:', err.message));

  logger.info('MongoDB connected successfully');
};

module.exports = { connectDB, mongoose };
