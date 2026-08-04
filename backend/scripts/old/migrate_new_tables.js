require('dotenv').config();
const { sequelize } = require('./src/config/database');
const AppSetting = require('./src/models/AppSetting');
const Branch = require('./src/models/Branch');
const CommunicationLog = require('./src/models/CommunicationLog');
const SupportTicket = require('./src/models/SupportTicket');

async function createTables() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    await AppSetting.sync({ force: false });
    console.log('app_settings table ready');
    await Branch.sync({ force: false });
    console.log('branches table ready');
    await CommunicationLog.sync({ force: false });
    console.log('communication_logs table ready');
    await SupportTicket.sync({ force: false });
    console.log('support_tickets table ready');
    // Add transaction_reference to auction if not exists
    await sequelize.query('ALTER TABLE "auction" ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100)');
    console.log('auction.transaction_reference column ready');
    console.log('All new tables/columns created successfully');
    process.exit(0);
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
createTables();
