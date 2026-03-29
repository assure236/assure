require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIO = require('socket.io');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { connectDB } = require('./config/database');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const socketHandler = require('./sockets/socketHandler');
const timerManager = require('./services/auctionTimerManager');

require('./cron/reminders');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: [process.env.WEB_CLIENT_URL, process.env.ADMIN_CLIENT_URL, process.env.MOBILE_CLIENT_URL || '*'], credentials: true }
});

app.use(helmet());
app.use(cors({ origin: [process.env.WEB_CLIENT_URL, process.env.ADMIN_CLIENT_URL], credentials: true }));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  message: 'Too many requests from this IP, please try again later.',
  skip: () => process.env.NODE_ENV === 'development'
});
app.use('/api', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

const pathModule = require('path');
app.use('/uploads', express.static(pathModule.join(__dirname, '../uploads')));
app.use('/api/' + process.env.API_VERSION, routes);

socketHandler(io);
app.set('io', io);

// Initialize timer manager with auto-end callback
const { endAuctionById } = require('./controllers/auctionController');
timerManager.init(io, async (auctionId) => {
  try {
    await endAuctionById(auctionId, io);
  } catch (err) {
    logger.error(`Auto-end auction ${auctionId} failed:`, err.message);
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  server.listen(PORT, () => {
    logger.info('Server running on port ' + PORT + ' in ' + process.env.NODE_ENV + ' mode');
    logger.info('API at http://localhost:' + PORT + '/api/' + process.env.API_VERSION);
  });
  try {
    await connectDB();
    // Restore timers for any in-progress auctions after DB connects
    try {
      const Auction = require('./models').Auction;
      const liveAuctions = await Auction.find({ status: 'in_progress', end_time: { $gt: new Date() } });
      for (const a of liveAuctions) {
        const remaining = Math.max(0, Math.floor((new Date(a.end_time) - Date.now()) / 1000));
        if (remaining > 0) {
          timerManager.startTimer(a._id, new Date(a.end_time), a.anti_snipe_seconds || 15, a.anti_snipe_extension || 30);
          logger.info(`Restored timer for auction ${a._id} — ${remaining}s remaining`);
        }
      }
      if (liveAuctions.length > 0) logger.info(`Restored ${liveAuctions.length} active auction timer(s)`);
    } catch (err) {
      logger.warn('Could not restore auction timers:', err.message);
    }
  } catch (error) {
    logger.error('MongoDB connection failed:', error.message);
    logger.warn('Set MONGO_URI in backend/.env to enable database features');
  }
};

process.on('SIGTERM', () => {
  server.close(() => { process.exit(0); });
});

startServer();
