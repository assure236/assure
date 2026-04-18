'use strict';
/**
 * Accounting Service — Double-Entry Bookkeeping (ERPNext-style)
 *
 * Provides Chart of Accounts, Journal Entries, auto-posting hooks,
 * and all financial reports: P&L, Balance Sheet, Trial Balance,
 * General Ledger, Cash Flow, Accounts Receivable, Group-wise P&L.
 */

const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const FiscalYear = require('../models/FiscalYear');
const logger = require('../utils/logger');

// ──────────────────────────────────────────────────────────────────────────────
// CHART OF ACCOUNTS — Default Seed (ERPNext-inspired for Chit Funds)
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_ACCOUNTS = [
  // ─── ASSETS ─────────────────────────────────────────────
  { name: 'Assets', root_type: 'Asset', is_group: true, account_number: '1000' },
  { name: 'Current Assets', parent_account: 'Assets', root_type: 'Asset', is_group: true, account_number: '1100' },
  { name: 'Bank Account', parent_account: 'Current Assets', root_type: 'Asset', account_type: 'Bank', account_number: '1101' },
  { name: 'Cash', parent_account: 'Current Assets', root_type: 'Asset', account_type: 'Cash', account_number: '1102' },
  { name: 'Cashfree Gateway', parent_account: 'Current Assets', root_type: 'Asset', account_type: 'Bank', account_number: '1103' },
  { name: 'Accounts Receivable - Members', parent_account: 'Current Assets', root_type: 'Asset', account_type: 'Receivable', account_number: '1200' },
  { name: 'Advance to Members', parent_account: 'Current Assets', root_type: 'Asset', account_type: 'Receivable', account_number: '1201' },
  { name: 'TDS Receivable', parent_account: 'Current Assets', root_type: 'Asset', account_number: '1300' },
  { name: 'Fixed Assets', parent_account: 'Assets', root_type: 'Asset', is_group: true, account_number: '1400' },
  { name: 'Office Equipment', parent_account: 'Fixed Assets', root_type: 'Asset', account_type: 'Fixed Asset', account_number: '1401' },

  // ─── LIABILITIES ────────────────────────────────────────
  { name: 'Liabilities', root_type: 'Liability', is_group: true, account_number: '2000' },
  { name: 'Current Liabilities', parent_account: 'Liabilities', root_type: 'Liability', is_group: true, account_number: '2100' },
  { name: 'Chit Fund Pool - Payable', parent_account: 'Current Liabilities', root_type: 'Liability', account_type: 'Payable', account_number: '2101' },
  { name: 'Prize Money Payable', parent_account: 'Current Liabilities', root_type: 'Liability', account_type: 'Payable', account_number: '2102' },
  { name: 'Dividend Payable', parent_account: 'Current Liabilities', root_type: 'Liability', account_type: 'Payable', account_number: '2103' },
  { name: 'Security Deposits', parent_account: 'Current Liabilities', root_type: 'Liability', account_number: '2104' },
  { name: 'TDS Payable', parent_account: 'Current Liabilities', root_type: 'Liability', account_type: 'Tax', account_number: '2200' },
  { name: 'GST Payable', parent_account: 'Current Liabilities', root_type: 'Liability', account_type: 'Tax', account_number: '2201' },

  // ─── INCOME ─────────────────────────────────────────────
  { name: 'Income', root_type: 'Income', is_group: true, account_number: '3000' },
  { name: 'Chit Fund Collections', parent_account: 'Income', root_type: 'Income', account_type: 'Income Account', account_number: '3100' },
  { name: 'Foreman Commission', parent_account: 'Income', root_type: 'Income', account_type: 'Commission', account_number: '3200' },
  { name: 'Late Fee Income', parent_account: 'Income', root_type: 'Income', account_type: 'Income Account', account_number: '3300' },
  { name: 'Penalty Income', parent_account: 'Income', root_type: 'Income', account_type: 'Income Account', account_number: '3301' },
  { name: 'Registration Fee', parent_account: 'Income', root_type: 'Income', account_type: 'Income Account', account_number: '3400' },
  { name: 'Interest Income', parent_account: 'Income', root_type: 'Income', account_type: 'Income Account', account_number: '3500' },
  { name: 'Other Income', parent_account: 'Income', root_type: 'Income', account_type: 'Income Account', account_number: '3900' },

  // ─── EXPENSES ───────────────────────────────────────────
  { name: 'Expenses', root_type: 'Expense', is_group: true, account_number: '4000' },
  { name: 'Operating Expenses', parent_account: 'Expenses', root_type: 'Expense', is_group: true, account_number: '4100' },
  { name: 'Prize Disbursement', parent_account: 'Operating Expenses', root_type: 'Expense', account_type: 'Expense Account', account_number: '4101' },
  { name: 'Dividend Distribution', parent_account: 'Operating Expenses', root_type: 'Expense', account_type: 'Expense Account', account_number: '4102' },
  { name: 'Salary & Wages', parent_account: 'Operating Expenses', root_type: 'Expense', account_type: 'Expense Account', account_number: '4200' },
  { name: 'Office Rent', parent_account: 'Operating Expenses', root_type: 'Expense', account_type: 'Expense Account', account_number: '4201' },
  { name: 'Software & IT', parent_account: 'Operating Expenses', root_type: 'Expense', account_type: 'Expense Account', account_number: '4202' },
  { name: 'Marketing & Advertising', parent_account: 'Operating Expenses', root_type: 'Expense', account_type: 'Expense Account', account_number: '4203' },
  { name: 'Payment Gateway Charges', parent_account: 'Operating Expenses', root_type: 'Expense', account_type: 'Expense Account', account_number: '4204' },
  { name: 'Legal & Professional', parent_account: 'Operating Expenses', root_type: 'Expense', account_type: 'Expense Account', account_number: '4205' },
  { name: 'Printing & Stationery', parent_account: 'Operating Expenses', root_type: 'Expense', account_type: 'Expense Account', account_number: '4206' },
  { name: 'Depreciation', parent_account: 'Operating Expenses', root_type: 'Expense', account_type: 'Depreciation', account_number: '4300' },
  { name: 'Bank Charges', parent_account: 'Operating Expenses', root_type: 'Expense', account_type: 'Expense Account', account_number: '4400' },
  { name: 'Miscellaneous Expenses', parent_account: 'Operating Expenses', root_type: 'Expense', account_type: 'Expense Account', account_number: '4900' },

  // ─── EQUITY ─────────────────────────────────────────────
  { name: 'Equity', root_type: 'Equity', is_group: true, account_number: '5000' },
  { name: 'Share Capital', parent_account: 'Equity', root_type: 'Equity', account_type: 'Capital', account_number: '5100' },
  { name: 'Retained Earnings', parent_account: 'Equity', root_type: 'Equity', account_type: 'Retained Earnings', account_number: '5200' },
  { name: 'Opening Balance Equity', parent_account: 'Equity', root_type: 'Equity', account_number: '5300' },
];

// ──────────────────────────────────────────────────────────────────────────────
// SEED Chart of Accounts
// ──────────────────────────────────────────────────────────────────────────────

async function seedChartOfAccounts() {
  const existing = await Account.countDocuments();
  if (existing > 0) return { seeded: false, count: existing };
  const created = [];
  for (const acc of DEFAULT_ACCOUNTS) {
    try {
      const doc = await Account.create(acc);
      created.push(doc.name);
    } catch (err) {
      logger.warn(`Account seed skip "${acc.name}": ${err.message}`);
    }
  }
  // Seed current fiscal year
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? new Date(now.getFullYear(), 3, 1) : new Date(now.getFullYear() - 1, 3, 1);
  const fyEnd = now.getMonth() >= 3 ? new Date(now.getFullYear() + 1, 2, 31) : new Date(now.getFullYear(), 2, 31);
  const fyName = `${fyStart.getFullYear()}-${String(fyEnd.getFullYear()).slice(2)}`;
  await FiscalYear.findOneAndUpdate({ name: fyName }, { name: fyName, start_date: fyStart, end_date: fyEnd }, { upsert: true });
  logger.info(`Accounting: Seeded ${created.length} accounts + FY ${fyName}`);
  return { seeded: true, count: created.length };
}

// ──────────────────────────────────────────────────────────────────────────────
// VOUCHER NUMBER GENERATOR
// ──────────────────────────────────────────────────────────────────────────────

async function nextVoucherNumber(prefix = 'JV') {
  const today = new Date();
  const ym = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
  const pattern = `${prefix}-${ym}-`;
  const last = await JournalEntry.findOne({ voucher_number: { $regex: `^${pattern}` } }).sort({ voucher_number: -1 });
  const seq = last ? parseInt(last.voucher_number.split('-').pop()) + 1 : 1;
  return `${pattern}${String(seq).padStart(5, '0')}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// CREATE JOURNAL ENTRY (core double-entry function)
// ──────────────────────────────────────────────────────────────────────────────

async function createJournalEntry({
  voucher_type = 'Journal Entry',
  posting_date,
  items,              // [{ account, debit, credit, party_type, party, description, cost_center }]
  reference_type,
  reference_id,
  reference_number,
  chit_group_id,
  user_remark = '',
  title = '',
  posted_by,
}) {
  // Validate double-entry: total debits must equal total credits
  const totalDebit = items.reduce((s, i) => s + (i.debit || 0), 0);
  const totalCredit = items.reduce((s, i) => s + (i.credit || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  if (diff > 0.01) {
    throw new Error(`Journal Entry unbalanced: Debit ₹${totalDebit.toFixed(2)} ≠ Credit ₹${totalCredit.toFixed(2)} (diff: ₹${diff.toFixed(2)})`);
  }

  // Validate all accounts exist
  const accountNames = [...new Set(items.map(i => i.account))];
  const accounts = await Account.find({ name: { $in: accountNames }, is_active: true });
  const foundNames = new Set(accounts.map(a => a.name));
  const missing = accountNames.filter(n => !foundNames.has(n));
  if (missing.length) {
    throw new Error(`Accounts not found: ${missing.join(', ')}`);
  }

  // Check no posting to group accounts
  const groupAccounts = accounts.filter(a => a.is_group);
  if (groupAccounts.length) {
    throw new Error(`Cannot post to group accounts: ${groupAccounts.map(a => a.name).join(', ')}`);
  }

  // Check for duplicate reference
  if (reference_type && reference_id) {
    const exists = await JournalEntry.findOne({ reference_type, reference_id, is_cancelled: false });
    if (exists) return exists; // Idempotent: return existing entry
  }

  const prefix = voucher_type === 'Payment Entry' ? 'PE' :
    voucher_type === 'Disbursement Entry' ? 'DE' :
    voucher_type === 'Commission Entry' ? 'CE' :
    voucher_type === 'Late Fee Entry' ? 'LF' :
    voucher_type === 'Refund Entry' ? 'RF' : 'JV';

  const voucher_number = await nextVoucherNumber(prefix);

  const entry = await JournalEntry.create({
    voucher_number,
    voucher_type,
    posting_date: posting_date || new Date(),
    items,
    total_debit: Math.round(totalDebit * 100) / 100,
    total_credit: Math.round(totalCredit * 100) / 100,
    difference: 0,
    reference_type,
    reference_id,
    reference_number,
    chit_group_id,
    user_remark,
    title,
    posted_by,
  });

  // Update account balances
  for (const item of items) {
    const acc = accounts.find(a => a.name === item.account);
    const isDebitNature = ['Asset', 'Expense'].includes(acc.root_type);
    const balanceChange = isDebitNature
      ? (item.debit || 0) - (item.credit || 0)
      : (item.credit || 0) - (item.debit || 0);
    await Account.findOneAndUpdate({ name: item.account }, { $inc: { balance: balanceChange } });
  }

  return entry;
}

// ──────────────────────────────────────────────────────────────────────────────
// AUTO-POSTING HOOKS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Post a payment as a Journal Entry
 * Dr. Cashfree Gateway / Bank Account   →   Cr. Chit Fund Collections
 * If late_fee > 0: Dr. Bank → Cr. Late Fee Income
 */
async function postPayment(payment, options = {}) {
  const memberName = payment.user_id?.full_name || payment.user_id?.member_id || 'Unknown';
  const groupName = payment.chit_group_id?.group_name || 'Unknown Group';
  const bankAccount = payment.payment_method === 'cash' ? 'Cash' : 'Cashfree Gateway';
  const items = [];

  // Main installment
  const baseAmount = payment.amount || payment.total_amount || 0;
  const lateFee = payment.late_fee || 0;

  if (baseAmount > 0) {
    items.push(
      { account: bankAccount, debit: baseAmount, credit: 0, party_type: 'Member', party: memberName, description: `Installment - ${groupName} Month ${payment.month_number || ''}` },
      { account: 'Chit Fund Collections', debit: 0, credit: baseAmount, party_type: 'Member', party: memberName, cost_center: groupName }
    );
  }

  // Late fee as separate line
  if (lateFee > 0) {
    items.push(
      { account: bankAccount, debit: lateFee, credit: 0, party_type: 'Member', party: memberName, description: 'Late Fee' },
      { account: 'Late Fee Income', debit: 0, credit: lateFee, party_type: 'Member', party: memberName }
    );
  }

  if (items.length === 0) return null;

  return createJournalEntry({
    voucher_type: 'Payment Entry',
    posting_date: payment.payment_date || new Date(),
    items,
    reference_type: 'Payment',
    reference_id: payment._id,
    reference_number: payment.payment_number,
    chit_group_id: payment.chit_group_id?._id || payment.chit_group_id,
    user_remark: `${payment.payment_type || 'installment'} from ${memberName} for ${groupName}`,
    title: `Payment - ${memberName}`,
    posted_by: options.posted_by,
  });
}

/**
 * Post foreman commission from an auction
 * Dr. Chit Fund Collections → Cr. Foreman Commission
 */
async function postCommission(auction, options = {}) {
  const amount = auction.commission_amount || 0;
  if (amount <= 0) return null;
  const groupName = auction.chit_group_id?.group_name || 'Unknown Group';

  return createJournalEntry({
    voucher_type: 'Commission Entry',
    posting_date: auction.auction_date || new Date(),
    items: [
      { account: 'Chit Fund Collections', debit: amount, credit: 0, cost_center: groupName, description: `Commission deducted - Month ${auction.month_number}` },
      { account: 'Foreman Commission', debit: 0, credit: amount, cost_center: groupName, description: `5% commission - ${groupName}` },
    ],
    reference_type: 'Auction',
    reference_id: auction._id,
    chit_group_id: auction.chit_group_id?._id || auction.chit_group_id,
    user_remark: `Foreman commission for ${groupName} Month ${auction.month_number}`,
    title: `Commission - ${groupName}`,
    posted_by: options.posted_by,
  });
}

/**
 * Post prize disbursement
 * Dr. Prize Disbursement → Cr. Bank Account / Cashfree Gateway
 */
async function postDisbursement(auction, options = {}) {
  const amount = auction.disbursement_amount || 0;
  if (amount <= 0) return null;
  const winnerName = auction.winner_id?.full_name || 'Unknown';
  const groupName = auction.chit_group_id?.group_name || 'Unknown Group';

  return createJournalEntry({
    voucher_type: 'Disbursement Entry',
    posting_date: auction.disbursement_date || new Date(),
    items: [
      { account: 'Prize Disbursement', debit: amount, credit: 0, party_type: 'Member', party: winnerName, cost_center: groupName, description: `Prize to ${winnerName} - Month ${auction.month_number}` },
      { account: 'Bank Account', debit: 0, credit: amount, party_type: 'Member', party: winnerName, description: `Disbursement - ${auction.utr_number || 'N/A'}` },
    ],
    reference_type: 'Disbursement',
    reference_id: auction._id,
    reference_number: auction.utr_number,
    chit_group_id: auction.chit_group_id?._id || auction.chit_group_id,
    user_remark: `Prize ₹${amount} disbursed to ${winnerName} for ${groupName}`,
    title: `Disbursement - ${winnerName}`,
    posted_by: options.posted_by,
  });
}

/**
 * Post dividend distribution
 * Dr. Dividend Distribution → Cr. Dividend Payable
 */
async function postDividend(auction, options = {}) {
  const totalDividend = (auction.dividend_per_member || 0) * (auction.total_members || 0);
  if (totalDividend <= 0) return null;
  const groupName = auction.chit_group_id?.group_name || 'Unknown Group';

  return createJournalEntry({
    voucher_type: 'Journal Entry',
    posting_date: auction.auction_date || new Date(),
    items: [
      { account: 'Dividend Distribution', debit: totalDividend, credit: 0, cost_center: groupName, description: `Dividend Month ${auction.month_number}` },
      { account: 'Dividend Payable', debit: 0, credit: totalDividend, cost_center: groupName, description: `₹${auction.dividend_per_member}/member x ${auction.total_members}` },
    ],
    reference_type: 'Auction',
    reference_id: auction._id,
    chit_group_id: auction.chit_group_id?._id || auction.chit_group_id,
    user_remark: `Dividend for ${groupName} Month ${auction.month_number}`,
    title: `Dividend - ${groupName}`,
    posted_by: options.posted_by,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// FINANCIAL REPORTS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * General Ledger — All journal entry items for an account or date range
 */
async function getGeneralLedger({ from_date, to_date, account, party, page = 1, limit = 100 }) {
  const match = { is_cancelled: false };
  if (from_date || to_date) {
    match.posting_date = {};
    if (from_date) match.posting_date.$gte = new Date(from_date);
    if (to_date) match.posting_date.$lte = new Date(to_date + 'T23:59:59');
  }

  const pipeline = [
    { $match: match },
    { $unwind: '$items' },
  ];

  if (account) pipeline.push({ $match: { 'items.account': account } });
  if (party) pipeline.push({ $match: { 'items.party': { $regex: party, $options: 'i' } } });

  // Count total
  const countPipeline = [...pipeline, { $count: 'total' }];
  const countResult = await JournalEntry.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  // Get data
  pipeline.push(
    { $sort: { posting_date: -1, created_at: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $project: {
        posting_date: 1, voucher_number: 1, voucher_type: 1,
        account: '$items.account', party: '$items.party', party_type: '$items.party_type',
        debit: '$items.debit', credit: '$items.credit',
        description: '$items.description', cost_center: '$items.cost_center',
        reference_number: 1, user_remark: 1,
      }
    }
  );

  const data = await JournalEntry.aggregate(pipeline);

  // Running totals
  const totals = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: '$items' },
    ...(account ? [{ $match: { 'items.account': account } }] : []),
    ...(party ? [{ $match: { 'items.party': { $regex: party, $options: 'i' } } }] : []),
    { $group: { _id: null, total_debit: { $sum: '$items.debit' }, total_credit: { $sum: '$items.credit' } } },
  ]);

  return {
    entries: data,
    total,
    total_debit: totals[0]?.total_debit || 0,
    total_credit: totals[0]?.total_credit || 0,
    net: (totals[0]?.total_debit || 0) - (totals[0]?.total_credit || 0),
  };
}

/**
 * Trial Balance — All accounts with their debit/credit totals
 */
async function getTrialBalance({ from_date, to_date } = {}) {
  const match = { is_cancelled: false };
  if (from_date || to_date) {
    match.posting_date = {};
    if (from_date) match.posting_date.$gte = new Date(from_date);
    if (to_date) match.posting_date.$lte = new Date(to_date + 'T23:59:59');
  }

  const result = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.account',
        total_debit: { $sum: '$items.debit' },
        total_credit: { $sum: '$items.credit' },
      }
    },
    { $sort: { _id: 1 } },
  ]);

  // Enrich with account info
  const accounts = await Account.find({ is_active: true }).lean();
  const accountMap = {};
  accounts.forEach(a => { accountMap[a.name] = a; });

  const entries = result.map(r => ({
    account: r._id,
    account_number: accountMap[r._id]?.account_number || '',
    root_type: accountMap[r._id]?.root_type || '',
    total_debit: r.total_debit,
    total_credit: r.total_credit,
    balance: r.total_debit - r.total_credit,
  }));

  const totalDebit = entries.reduce((s, e) => s + e.total_debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.total_credit, 0);

  return { entries, total_debit: totalDebit, total_credit: totalCredit, difference: totalDebit - totalCredit };
}

/**
 * Profit & Loss Statement
 */
async function getProfitAndLoss({ from_date, to_date, group_id } = {}) {
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? new Date(now.getFullYear(), 3, 1) : new Date(now.getFullYear() - 1, 3, 1);
  const startDate = from_date ? new Date(from_date) : fyStart;
  const endDate = to_date ? new Date(to_date + 'T23:59:59') : now;

  const match = { is_cancelled: false, posting_date: { $gte: startDate, $lte: endDate } };

  const pipeline = [
    { $match: match },
    { $unwind: '$items' },
  ];

  if (group_id) {
    const mongoose = require('mongoose');
    pipeline.splice(1, 0, { $match: { chit_group_id: new mongoose.Types.ObjectId(group_id) } });
  }

  pipeline.push({
    $group: {
      _id: '$items.account',
      total_debit: { $sum: '$items.debit' },
      total_credit: { $sum: '$items.credit' },
    }
  });

  const result = await JournalEntry.aggregate(pipeline);
  const accounts = await Account.find({ root_type: { $in: ['Income', 'Expense'] }, is_active: true }).lean();
  const accountMap = {};
  accounts.forEach(a => { accountMap[a.name] = a; });

  const income = [];
  const expenses = [];
  let totalIncome = 0;
  let totalExpenses = 0;

  result.forEach(r => {
    const acc = accountMap[r._id];
    if (!acc) return;
    if (acc.root_type === 'Income') {
      const amount = r.total_credit - r.total_debit;
      income.push({ account: r._id, account_number: acc.account_number, amount });
      totalIncome += amount;
    } else if (acc.root_type === 'Expense') {
      const amount = r.total_debit - r.total_credit;
      expenses.push({ account: r._id, account_number: acc.account_number, amount });
      totalExpenses += amount;
    }
  });

  // Monthly breakdown
  const monthlyPipeline = [
    { $match: match },
    { $unwind: '$items' },
  ];
  if (group_id) {
    const mongoose = require('mongoose');
    monthlyPipeline.splice(1, 0, { $match: { chit_group_id: new mongoose.Types.ObjectId(group_id) } });
  }
  monthlyPipeline.push(
    {
      $lookup: {
        from: 'accounts', localField: 'items.account', foreignField: 'name', as: 'acc_info',
      }
    },
    { $unwind: { path: '$acc_info', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: '%Y-%m', date: '$posting_date' } },
          root_type: '$acc_info.root_type',
        },
        total_debit: { $sum: '$items.debit' },
        total_credit: { $sum: '$items.credit' },
      }
    },
    { $sort: { '_id.month': 1 } }
  );

  const monthlyResult = await JournalEntry.aggregate(monthlyPipeline);
  const monthlyMap = {};
  monthlyResult.forEach(r => {
    const key = r._id.month;
    if (!monthlyMap[key]) monthlyMap[key] = { month: key, income: 0, expense: 0, profit: 0 };
    if (r._id.root_type === 'Income') monthlyMap[key].income += (r.total_credit - r.total_debit);
    if (r._id.root_type === 'Expense') monthlyMap[key].expense += (r.total_debit - r.total_credit);
  });
  Object.values(monthlyMap).forEach(m => { m.profit = m.income - m.expense; });

  return {
    income: income.sort((a, b) => b.amount - a.amount),
    expenses: expenses.sort((a, b) => b.amount - a.amount),
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_profit: totalIncome - totalExpenses,
    from_date: startDate,
    to_date: endDate,
    monthly: Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)),
  };
}

/**
 * Balance Sheet
 */
async function getBalanceSheet({ as_of_date } = {}) {
  const endDate = as_of_date ? new Date(as_of_date + 'T23:59:59') : new Date();

  const result = await JournalEntry.aggregate([
    { $match: { is_cancelled: false, posting_date: { $lte: endDate } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.account',
        total_debit: { $sum: '$items.debit' },
        total_credit: { $sum: '$items.credit' },
      }
    },
  ]);

  const accounts = await Account.find({ is_active: true }).lean();
  const accountMap = {};
  accounts.forEach(a => { accountMap[a.name] = a; });

  const assets = [];
  const liabilities = [];
  const equity = [];
  let totalAssets = 0, totalLiabilities = 0, totalEquity = 0;

  // Get P&L net profit for retained earnings
  const plResult = await getProfitAndLoss({ to_date: as_of_date });
  const retainedEarnings = plResult.net_profit;

  result.forEach(r => {
    const acc = accountMap[r._id];
    if (!acc || acc.is_group) return;
    const rt = acc.root_type;

    if (rt === 'Asset') {
      const balance = r.total_debit - r.total_credit;
      assets.push({ account: r._id, account_number: acc.account_number, balance });
      totalAssets += balance;
    } else if (rt === 'Liability') {
      const balance = r.total_credit - r.total_debit;
      liabilities.push({ account: r._id, account_number: acc.account_number, balance });
      totalLiabilities += balance;
    } else if (rt === 'Equity') {
      const balance = r.total_credit - r.total_debit;
      equity.push({ account: r._id, account_number: acc.account_number, balance });
      totalEquity += balance;
    }
  });

  // Add retained earnings to equity
  equity.push({ account: 'Current Year Profit/(Loss)', account_number: '', balance: retainedEarnings });
  totalEquity += retainedEarnings;

  return {
    assets: assets.filter(a => Math.abs(a.balance) > 0.01).sort((a, b) => b.balance - a.balance),
    liabilities: liabilities.filter(l => Math.abs(l.balance) > 0.01).sort((a, b) => b.balance - a.balance),
    equity: equity.filter(e => Math.abs(e.balance) > 0.01).sort((a, b) => b.balance - a.balance),
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    total_equity: totalEquity,
    total_liabilities_and_equity: totalLiabilities + totalEquity,
    as_of_date: endDate,
    is_balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
  };
}

/**
 * Cash Flow Statement
 */
async function getCashFlow({ from_date, to_date } = {}) {
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? new Date(now.getFullYear(), 3, 1) : new Date(now.getFullYear() - 1, 3, 1);
  const startDate = from_date ? new Date(from_date) : fyStart;
  const endDate = to_date ? new Date(to_date + 'T23:59:59') : now;

  const cashAccounts = ['Bank Account', 'Cash', 'Cashfree Gateway'];

  // Cash inflows (credits to non-cash accounts that pair with debits to cash accounts)
  const entries = await JournalEntry.find({
    is_cancelled: false,
    posting_date: { $gte: startDate, $lte: endDate },
    'items.account': { $in: cashAccounts },
  }).lean();

  let operatingInflow = 0, operatingOutflow = 0;
  const flowByType = {};

  entries.forEach(entry => {
    entry.items.forEach(item => {
      if (cashAccounts.includes(item.account)) {
        const vType = entry.voucher_type || 'Other';
        if (!flowByType[vType]) flowByType[vType] = { inflow: 0, outflow: 0 };
        flowByType[vType].inflow += item.debit || 0;
        flowByType[vType].outflow += item.credit || 0;
        operatingInflow += item.debit || 0;
        operatingOutflow += item.credit || 0;
      }
    });
  });

  return {
    operating: {
      inflow: operatingInflow,
      outflow: operatingOutflow,
      net: operatingInflow - operatingOutflow,
    },
    by_type: Object.entries(flowByType).map(([type, data]) => ({
      type, inflow: data.inflow, outflow: data.outflow, net: data.inflow - data.outflow,
    })),
    net_cash_flow: operatingInflow - operatingOutflow,
    from_date: startDate,
    to_date: endDate,
  };
}

/**
 * Accounts Receivable — Members with outstanding dues
 */
async function getAccountsReceivable() {
  const result = await JournalEntry.aggregate([
    { $match: { is_cancelled: false } },
    { $unwind: '$items' },
    { $match: { 'items.account': 'Accounts Receivable - Members' } },
    {
      $group: {
        _id: '$items.party',
        total_debit: { $sum: '$items.debit' },
        total_credit: { $sum: '$items.credit' },
      }
    },
    { $project: { party: '$_id', outstanding: { $subtract: ['$total_debit', '$total_credit'] } } },
    { $match: { outstanding: { $gt: 0.01 } } },
    { $sort: { outstanding: -1 } },
  ]);

  const totalOutstanding = result.reduce((s, r) => s + r.outstanding, 0);
  return { entries: result, total_outstanding: totalOutstanding };
}

/**
 * Group-wise Profit & Loss
 */
async function getGroupWisePL({ from_date, to_date } = {}) {
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? new Date(now.getFullYear(), 3, 1) : new Date(now.getFullYear() - 1, 3, 1);
  const startDate = from_date ? new Date(from_date) : fyStart;
  const endDate = to_date ? new Date(to_date + 'T23:59:59') : now;

  const result = await JournalEntry.aggregate([
    { $match: { is_cancelled: false, posting_date: { $gte: startDate, $lte: endDate }, chit_group_id: { $ne: null } } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'accounts', localField: 'items.account', foreignField: 'name', as: 'acc_info',
      }
    },
    { $unwind: { path: '$acc_info', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { group: '$chit_group_id', root_type: '$acc_info.root_type' },
        total_debit: { $sum: '$items.debit' },
        total_credit: { $sum: '$items.credit' },
      }
    },
  ]);

  const ChitGroup = require('../models/ChitGroup');
  const groupIds = [...new Set(result.map(r => r._id.group?.toString()).filter(Boolean))];
  const groups = await ChitGroup.find({ _id: { $in: groupIds } }).select('group_name group_number chit_value').lean();
  const groupMap = {};
  groups.forEach(g => { groupMap[g._id.toString()] = g; });

  const groupPL = {};
  result.forEach(r => {
    const gId = r._id.group?.toString();
    if (!gId) return;
    if (!groupPL[gId]) groupPL[gId] = { group: groupMap[gId] || { group_name: 'Unknown' }, income: 0, expense: 0, profit: 0 };
    if (r._id.root_type === 'Income') groupPL[gId].income += (r.total_credit - r.total_debit);
    if (r._id.root_type === 'Expense') groupPL[gId].expense += (r.total_debit - r.total_credit);
  });
  Object.values(groupPL).forEach(g => { g.profit = g.income - g.expense; });

  return Object.values(groupPL).sort((a, b) => b.profit - a.profit);
}

/**
 * Bulk-post all historical payments that don't have journal entries yet
 */
async function bulkPostHistoricalPayments() {
  const Payment = require('../models/Payment');
  const payments = await Payment.find({ payment_status: 'success' })
    .populate('user_id', 'full_name member_id')
    .populate('chit_group_id', 'group_name')
    .lean();

  let posted = 0, skipped = 0, failed = 0;
  const errors = [];

  for (const payment of payments) {
    try {
      const existing = await JournalEntry.findOne({ reference_type: 'Payment', reference_id: payment._id, is_cancelled: false });
      if (existing) { skipped++; continue; }
      await postPayment(payment);
      posted++;
    } catch (err) {
      failed++;
      errors.push({ id: payment.payment_number, error: err.message });
    }
  }

  return { posted, skipped, failed, errors: errors.slice(0, 20), total: payments.length };
}

/**
 * Dashboard summary for accounting
 */
async function getAccountingSummary() {
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? new Date(now.getFullYear(), 3, 1) : new Date(now.getFullYear() - 1, 3, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalEntries, totalAccounts,
    fyIncome, fyExpense,
    monthIncome, monthExpense,
    cashBalance,
    receivableBalance,
  ] = await Promise.all([
    JournalEntry.countDocuments({ is_cancelled: false }),
    Account.countDocuments({ is_active: true, is_group: false }),
    // FY income
    JournalEntry.aggregate([
      { $match: { is_cancelled: false, posting_date: { $gte: fyStart } } },
      { $unwind: '$items' },
      { $lookup: { from: 'accounts', localField: 'items.account', foreignField: 'name', as: 'a' } },
      { $unwind: { path: '$a', preserveNullAndEmptyArrays: true } },
      { $match: { 'a.root_type': 'Income' } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$items.credit', '$items.debit'] } } } },
    ]),
    // FY expense
    JournalEntry.aggregate([
      { $match: { is_cancelled: false, posting_date: { $gte: fyStart } } },
      { $unwind: '$items' },
      { $lookup: { from: 'accounts', localField: 'items.account', foreignField: 'name', as: 'a' } },
      { $unwind: { path: '$a', preserveNullAndEmptyArrays: true } },
      { $match: { 'a.root_type': 'Expense' } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$items.debit', '$items.credit'] } } } },
    ]),
    // Month income
    JournalEntry.aggregate([
      { $match: { is_cancelled: false, posting_date: { $gte: startOfMonth } } },
      { $unwind: '$items' },
      { $lookup: { from: 'accounts', localField: 'items.account', foreignField: 'name', as: 'a' } },
      { $unwind: { path: '$a', preserveNullAndEmptyArrays: true } },
      { $match: { 'a.root_type': 'Income' } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$items.credit', '$items.debit'] } } } },
    ]),
    // Month expense
    JournalEntry.aggregate([
      { $match: { is_cancelled: false, posting_date: { $gte: startOfMonth } } },
      { $unwind: '$items' },
      { $lookup: { from: 'accounts', localField: 'items.account', foreignField: 'name', as: 'a' } },
      { $unwind: { path: '$a', preserveNullAndEmptyArrays: true } },
      { $match: { 'a.root_type': 'Expense' } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$items.debit', '$items.credit'] } } } },
    ]),
    // Cash + Bank balance
    Account.aggregate([
      { $match: { account_type: { $in: ['Bank', 'Cash'] }, is_active: true } },
      { $group: { _id: null, total: { $sum: '$balance' } } },
    ]),
    // Receivable balance
    Account.aggregate([
      { $match: { account_type: 'Receivable', is_active: true } },
      { $group: { _id: null, total: { $sum: '$balance' } } },
    ]),
  ]);

  const fyIncomeAmt = fyIncome[0]?.total || 0;
  const fyExpenseAmt = fyExpense[0]?.total || 0;
  const monthIncomeAmt = monthIncome[0]?.total || 0;
  const monthExpenseAmt = monthExpense[0]?.total || 0;

  return {
    total_entries: totalEntries,
    total_accounts: totalAccounts,
    fy_income: fyIncomeAmt,
    fy_expense: fyExpenseAmt,
    fy_profit: fyIncomeAmt - fyExpenseAmt,
    month_income: monthIncomeAmt,
    month_expense: monthExpenseAmt,
    month_profit: monthIncomeAmt - monthExpenseAmt,
    cash_balance: cashBalance[0]?.total || 0,
    receivable_balance: receivableBalance[0]?.total || 0,
  };
}

// ──── Live Sync State ────────────────────────────────────────────────────
let _syncState = {
  status: 'idle',        // 'idle' | 'syncing' | 'error'
  lastSyncAt: null,
  lastResult: null,
  error: null,
  intervalId: null,
};

function getSyncStatus() {
  return {
    status: _syncState.status,
    lastSyncAt: _syncState.lastSyncAt,
    lastResult: _syncState.lastResult,
    error: _syncState.error,
  };
}

async function runAutoSync() {
  if (_syncState.status === 'syncing') return; // already running
  _syncState.status = 'syncing';
  _syncState.error = null;
  try {
    const result = await bulkPostHistoricalPayments();
    _syncState.lastResult = result;
    _syncState.lastSyncAt = new Date();
    _syncState.status = 'idle';
  } catch (err) {
    _syncState.status = 'error';
    _syncState.error = err.message;
  }
}

function startAutoSync(intervalMs = 60000) {
  if (_syncState.intervalId) return; // already started
  // Run once immediately
  runAutoSync();
  _syncState.intervalId = setInterval(runAutoSync, intervalMs);
}

function stopAutoSync() {
  if (_syncState.intervalId) {
    clearInterval(_syncState.intervalId);
    _syncState.intervalId = null;
  }
}

module.exports = {
  seedChartOfAccounts,
  createJournalEntry,
  postPayment,
  postCommission,
  postDisbursement,
  postDividend,
  getGeneralLedger,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getCashFlow,
  getAccountsReceivable,
  getGroupWisePL,
  bulkPostHistoricalPayments,
  getAccountingSummary,
  getSyncStatus,
  runAutoSync,
  startAutoSync,
  stopAutoSync,
};
