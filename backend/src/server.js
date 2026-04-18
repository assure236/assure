require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIO = require('socket.io');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const logger = require('./utils/logger');
const { connectDB } = require('./config/database');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const socketHandler = require('./sockets/socketHandler');
const timerManager = require('./services/auctionTimerManager');

require('./cron/reminders');
require('./cron/pushAutomation');
const { initFirebase } = require('./config/firebase');

// Initialize Firebase Admin SDK for push notifications
initFirebase();

const app = express();
app.set('trust proxy', 1);

// ─── Performance: Gzip compression (70%+ smaller responses) ─────────────────
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

const server = http.createServer(app);

// ─── Performance: Socket.IO with optimized settings ─────────────────────────
const io = socketIO(server, {
  cors: { origin: [process.env.WEB_CLIENT_URL, process.env.ADMIN_CLIENT_URL, process.env.MOBILE_CLIENT_URL || '*'], credentials: true },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  perMessageDeflate: { threshold: 2048 },
  transports: ['websocket', 'polling'],
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: [process.env.WEB_CLIENT_URL, process.env.ADMIN_CLIENT_URL, 'https://www.assure.fund', 'https://assure.fund'].filter(Boolean), credentials: true }));

// ─── Rate Limiting: scaled for 50K concurrent users ─────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5000,
  message: { success: false, message: 'Too many requests, please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, message: 'Too many login attempts, please try after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/send-otp', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging: Skip health checks, reduce noise in production ────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.url === '/health'
}));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime(), pid: process.pid });
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

// ─── Performance: Increase Node.js event loop limits ────────────────────────
server.maxConnections = 0; // unlimited
server.keepAliveTimeout = 65000; // slightly above nginx's 60s
server.headersTimeout = 66000;

const startServer = async () => {
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode (PID: ${process.pid})`);
    logger.info('API at http://localhost:' + PORT + '/api/' + process.env.API_VERSION);
  });
  try {
    await connectDB();
    // Start accounting auto-sync (every 60 seconds)
    try {
      const accountingService = require('./services/accountingService');
      accountingService.startAutoSync(5000, io);
      logger.info('Accounting auto-sync started (5s interval)');
    } catch (err) {
      logger.warn('Could not start accounting auto-sync:', err.message);
    }
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
