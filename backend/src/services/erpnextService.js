const axios = require('axios');

const ERPNEXT_URL = process.env.ERPNEXT_URL;
const ERPNEXT_API_KEY = process.env.ERPNEXT_API_KEY;
const ERPNEXT_API_SECRET = process.env.ERPNEXT_API_SECRET;

/**
 * Check if ERPNext integration is configured
 */
const isConfigured = () => {
  return (
    ERPNEXT_URL &&
    !ERPNEXT_URL.startsWith('https://your') &&
    ERPNEXT_API_KEY &&
    !ERPNEXT_API_KEY.startsWith('your_') &&
    ERPNEXT_API_SECRET &&
    !ERPNEXT_API_SECRET.startsWith('your_')
  );
};

/**
 * Create an authenticated axios instance for ERPNext API
 */
const getClient = () => {
  if (!isConfigured()) {
    throw new Error('ERPNext integration is not configured. Update .env with valid credentials.');
  }
  return axios.create({
    baseURL: ERPNEXT_URL,
    headers: {
      Authorization: `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
};

/**
 * Test ERPNext connection
 */
const testConnection = async () => {
  const client = getClient();
  const res = await client.get('/api/method/frappe.auth.get_logged_user');
  return { connected: true, user: res.data?.message };
};

// ──── CUSTOMER (Member) Sync ────────────────────────────────────────────

/**
 * Sync a member to ERPNext as a Customer
 */
const syncCustomer = async (member) => {
  const client = getClient();
  const customerName = `ASSURE-${member.member_id || member._id}`;

  // Check if customer already exists
  try {
    await client.get(`/api/resource/Customer/${encodeURIComponent(customerName)}`);
    // Update existing
    const res = await client.put(`/api/resource/Customer/${encodeURIComponent(customerName)}`, {
      customer_name: member.full_name,
      mobile_no: member.mobile,
      email_id: member.email || undefined,
      customer_group: 'Chit Fund Members',
      territory: member.branch || 'All Territories',
    });
    return { action: 'updated', data: res.data?.data };
  } catch (err) {
    if (err.response?.status === 404) {
      // Create new
      const res = await client.post('/api/resource/Customer', {
        name: customerName,
        customer_name: member.full_name,
        customer_type: 'Individual',
        customer_group: 'Chit Fund Members',
        territory: member.branch || 'All Territories',
        mobile_no: member.mobile,
        email_id: member.email || undefined,
      });
      return { action: 'created', data: res.data?.data };
    }
    throw err;
  }
};

/**
 * Bulk sync all members to ERPNext
 */
const syncAllCustomers = async (members) => {
  const results = { synced: 0, failed: 0, errors: [] };
  for (const member of members) {
    try {
      await syncCustomer(member);
      results.synced++;
    } catch (err) {
      results.failed++;
      results.errors.push({ member_id: member.member_id, error: err.message });
    }
  }
  return results;
};

// ──── PAYMENT / JOURNAL ENTRY Sync ──────────────────────────────────────

/**
 * Sync a payment as a Journal Entry in ERPNext
 */
const syncPaymentEntry = async (payment) => {
  const client = getClient();
  const customerName = `ASSURE-${payment.user_id?.member_id || payment.user_id}`;
  const groupName = payment.chit_group_id?.group_name || 'Unknown Group';
  const refId = `PAY-${payment.payment_number || payment._id}`;

  const res = await client.post('/api/resource/Journal Entry', {
    title: `Chit Payment - ${customerName}`,
    voucher_type: 'Journal Entry',
    posting_date: payment.payment_date
      ? new Date(payment.payment_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    company: process.env.ERPNEXT_COMPANY || 'Assure Chit Funds',
    user_remark: `${payment.payment_type} for ${groupName} | Month ${payment.month_number} | Ref: ${payment.transaction_id || 'N/A'}`,
    cheque_no: refId,
    cheque_date: payment.payment_date
      ? new Date(payment.payment_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    accounts: [
      {
        account: process.env.ERPNEXT_BANK_ACCOUNT || 'Bank Account - AC',
        debit_in_account_currency: payment.total_amount || payment.amount,
        credit_in_account_currency: 0,
        party_type: 'Customer',
        party: customerName,
      },
      {
        account: process.env.ERPNEXT_CHIT_INCOME_ACCOUNT || 'Chit Fund Collections - AC',
        debit_in_account_currency: 0,
        credit_in_account_currency: payment.total_amount || payment.amount,
      },
    ],
  });
  return { action: 'created', ref: refId, data: res.data?.data };
};

/**
 * Bulk sync payments to ERPNext
 */
const syncAllPayments = async (payments) => {
  const results = { synced: 0, failed: 0, errors: [] };
  for (const payment of payments) {
    try {
      await syncPaymentEntry(payment);
      results.synced++;
    } catch (err) {
      results.failed++;
      results.errors.push({ payment_number: payment.payment_number, error: err.message });
    }
  }
  return results;
};

// ──── CHIT GROUP Sync ───────────────────────────────────────────────────

/**
 * Sync a chit group as a Cost Center or Project in ERPNext
 */
const syncChitGroup = async (group) => {
  const client = getClient();
  const projectName = `CHIT-${group.group_number || group._id}`;

  try {
    await client.get(`/api/resource/Project/${encodeURIComponent(projectName)}`);
    const res = await client.put(`/api/resource/Project/${encodeURIComponent(projectName)}`, {
      project_name: group.group_name,
      status: group.status === 'active' ? 'Open' : group.status === 'completed' ? 'Completed' : 'Open',
      expected_start_date: group.commencement_date
        ? new Date(group.commencement_date).toISOString().split('T')[0]
        : undefined,
    });
    return { action: 'updated', data: res.data?.data };
  } catch (err) {
    if (err.response?.status === 404) {
      const res = await client.post('/api/resource/Project', {
        name: projectName,
        project_name: group.group_name,
        company: process.env.ERPNEXT_COMPANY || 'Assure Chit Funds',
        status: 'Open',
        expected_start_date: group.commencement_date
          ? new Date(group.commencement_date).toISOString().split('T')[0]
          : undefined,
        notes: `Chit Value: ₹${group.chit_value} | Duration: ${group.duration_months} months | Members: ${group.total_members}`,
      });
      return { action: 'created', data: res.data?.data };
    }
    throw err;
  }
};

// ──── FINANCIAL REPORTS from ERPNext ────────────────────────────────────

/**
 * Fetch Profit & Loss from ERPNext
 */
const fetchProfitAndLoss = async (filters = {}) => {
  const client = getClient();
  const company = process.env.ERPNEXT_COMPANY || 'Assure Chit Funds';
  const now = new Date();
  const fromDate = filters.from_date || `${now.getFullYear()}-01-01`;
  const toDate = filters.to_date || now.toISOString().split('T')[0];

  const res = await client.get('/api/method/erpnext.accounts.report.profit_and_loss_statement.profit_and_loss_statement.execute', {
    params: {
      filters: JSON.stringify({
        company,
        from_fiscal_year: now.getFullYear().toString(),
        to_fiscal_year: now.getFullYear().toString(),
        period_start_date: fromDate,
        period_end_date: toDate,
        periodicity: filters.periodicity || 'Monthly',
      }),
    },
  });
  return res.data?.message;
};

/**
 * Fetch Balance Sheet from ERPNext
 */
const fetchBalanceSheet = async (filters = {}) => {
  const client = getClient();
  const company = process.env.ERPNEXT_COMPANY || 'Assure Chit Funds';
  const now = new Date();

  const res = await client.get('/api/method/erpnext.accounts.report.balance_sheet.balance_sheet.execute', {
    params: {
      filters: JSON.stringify({
        company,
        from_fiscal_year: now.getFullYear().toString(),
        to_fiscal_year: now.getFullYear().toString(),
        period_end_date: filters.to_date || now.toISOString().split('T')[0],
        periodicity: filters.periodicity || 'Monthly',
      }),
    },
  });
  return res.data?.message;
};

/**
 * Fetch General Ledger from ERPNext
 */
const fetchGeneralLedger = async (filters = {}) => {
  const client = getClient();
  const company = process.env.ERPNEXT_COMPANY || 'Assure Chit Funds';
  const now = new Date();

  const res = await client.get('/api/method/erpnext.accounts.report.general_ledger.general_ledger.execute', {
    params: {
      filters: JSON.stringify({
        company,
        from_date: filters.from_date || `${now.getFullYear()}-01-01`,
        to_date: filters.to_date || now.toISOString().split('T')[0],
        party_type: filters.party_type || undefined,
        party: filters.party || undefined,
        account: filters.account || undefined,
        group_by: filters.group_by || 'Group by Voucher (Consolidated)',
      }),
    },
  });
  return res.data?.message;
};

/**
 * Fetch Trial Balance from ERPNext
 */
const fetchTrialBalance = async (filters = {}) => {
  const client = getClient();
  const company = process.env.ERPNEXT_COMPANY || 'Assure Chit Funds';
  const now = new Date();

  const res = await client.get('/api/method/erpnext.accounts.report.trial_balance.trial_balance.execute', {
    params: {
      filters: JSON.stringify({
        company,
        from_date: filters.from_date || `${now.getFullYear()}-01-01`,
        to_date: filters.to_date || now.toISOString().split('T')[0],
      }),
    },
  });
  return res.data?.message;
};

/**
 * Fetch Accounts Receivable from ERPNext
 */
const fetchAccountsReceivable = async (filters = {}) => {
  const client = getClient();
  const company = process.env.ERPNEXT_COMPANY || 'Assure Chit Funds';

  const res = await client.get('/api/method/erpnext.accounts.report.accounts_receivable.accounts_receivable.execute', {
    params: {
      filters: JSON.stringify({
        company,
        party_type: 'Customer',
        customer_group: 'Chit Fund Members',
        ...filters,
      }),
    },
  });
  return res.data?.message;
};

// ──── DASHBOARD SUMMARY ─────────────────────────────────────────────────

/**
 * Get ERPNext sync summary / dashboard data
 */
const getSyncSummary = async () => {
  const client = getClient();
  const company = process.env.ERPNEXT_COMPANY || 'Assure Chit Funds';

  const [customers, journalEntries, projects] = await Promise.all([
    client.get('/api/resource/Customer', {
      params: { filters: JSON.stringify([['customer_group', '=', 'Chit Fund Members']]), limit_page_length: 0, fields: '["name"]' },
    }),
    client.get('/api/resource/Journal Entry', {
      params: { filters: JSON.stringify([['company', '=', company]]), limit_page_length: 0, fields: '["name","posting_date","total_debit"]' },
    }),
    client.get('/api/resource/Project', {
      params: { filters: JSON.stringify([['company', '=', company]]), limit_page_length: 0, fields: '["name","status"]' },
    }),
  ]);

  return {
    customers_synced: customers.data?.data?.length || 0,
    journal_entries: journalEntries.data?.data?.length || 0,
    projects_synced: projects.data?.data?.length || 0,
    total_debits: (journalEntries.data?.data || []).reduce((s, j) => s + (j.total_debit || 0), 0),
  };
};

module.exports = {
  isConfigured,
  testConnection,
  syncCustomer,
  syncAllCustomers,
  syncPaymentEntry,
  syncAllPayments,
  syncChitGroup,
  fetchProfitAndLoss,
  fetchBalanceSheet,
  fetchGeneralLedger,
  fetchTrialBalance,
  fetchAccountsReceivable,
  getSyncSummary,
};
