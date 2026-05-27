const { Referral } = require('../models');
const logger = require('./logger');

async function migrateLegacyReferralDiscountState() {
  try {
    // Legacy behavior credited reward immediately at registration (often ₹500)
    // and should not be consumed again as new installment discount.
    const legacyFilter = {
      status: 'credited',
      bonus_credited: true,
      discount_applied: { $ne: true },
      $or: [
        { bonus_amount: { $gt: 100 } },
        { qualified_at: { $exists: false } },
        { qualified_at: null },
      ],
    };

    const result = await Referral.updateMany(legacyFilter, {
      $set: {
        discount_applied: true,
        discount_applied_at: new Date(),
      },
    });

    if ((result.modifiedCount || 0) > 0) {
      logger.info(`[Migration] Legacy referral discount state fixed for ${result.modifiedCount} record(s)`);
    } else {
      logger.info('[Migration] Legacy referral discount state already up to date');
    }
  } catch (err) {
    logger.warn(`[Migration] Legacy referral migration skipped: ${err.message}`);
  }
}

module.exports = {
  migrateLegacyReferralDiscountState,
};
