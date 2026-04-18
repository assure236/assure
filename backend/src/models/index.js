const { mongoose } = require('../config/database');
const User = require('./User');
const ChitGroup = require('./ChitGroup');
const ChitMember = require('./ChitMember');
const Auction = require('./Auction');
const Bid = require('./Bid');
const Payment = require('./Payment');
const Document = require('./Document');
const Referral = require('./Referral');
const Notification = require('./Notification');
const AppSetting = require('./AppSetting');
const Branch = require('./Branch');
const CommunicationLog = require('./CommunicationLog');
const SupportTicket = require('./SupportTicket');
const Wallet = require('./Wallet');
const WalletTransaction = require('./WalletTransaction');
const Account = require('./Account');
const JournalEntry = require('./JournalEntry');
const FiscalYear = require('./FiscalYear');
const DefaulterAction = require('./DefaulterAction');
const Loan = require('./Loan');
const FamilyMember = require('./FamilyMember');
const Goal = require('./Goal');
const AuditLog = require('./AuditLog');

module.exports = {
  mongoose,
  User, ChitGroup, ChitMember, Auction, Bid, Payment,
  Document, Referral, Notification, AppSetting, Branch,
  CommunicationLog, SupportTicket, Wallet, WalletTransaction,
  Account, JournalEntry, FiscalYear, DefaulterAction, Loan,
  FamilyMember, Goal, AuditLog,
};
