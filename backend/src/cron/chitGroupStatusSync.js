const cron = require('node-cron');
const { syncChitGroupStatuses } = require('../utils/chitGroupStatusSync');
const logger = require('../utils/logger');

cron.schedule('*/5 * * * *', async () => {
  try {
    const result = await syncChitGroupStatuses();
    if ((result.updated || 0) > 0) {
      logger.info(`[Cron] Chit status sync updated ${result.updated} group(s)`);
    }
  } catch (err) {
    logger.error('[Cron] Chit status sync failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

logger.info('[Cron] Chit group status sync registered (every 5 minutes)');
