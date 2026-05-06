const Groq = require('groq-sdk');
const { ChitGroup, User, Payment, Wallet, WalletTransaction, Referral, Notification, SupportTicket, ChitMember, Auction } = require('../models');

// Groq AI Setup
const GROQ_API_KEY = process.env.GROQ_API_KEY;
let groq;
if (GROQ_API_KEY) {
  groq = new Groq({ apiKey: GROQ_API_KEY });
}

const SYSTEM_PROMPT = `You are "Assure Bot", the warm and friendly AI assistant for Assure ChitFunds — a registered chit fund company based in Telangana, India.

ABOUT CHIT FUNDS:
- A chit fund is a savings + borrowing scheme where members pay monthly installments
- Each month, an auction is held where members bid for the prize amount
- The highest bidder wins the pot, and the bid amount is distributed as dividend to all members
- This reduces the effective EMI for non-prized members
- Assure ChitFunds is registered and regulated under the Telangana Chit Funds Act

YOUR PERSONALITY:
- You are polite, patient, and always helpful — like a friendly financial advisor
- Always answer every question with kindness, even if it's not about chit funds
- For general questions (weather, jokes, greetings, etc.), respond naturally and warmly, then gently offer to help with chit fund queries
- Never refuse to answer or say "I can't help with that" — instead, answer helpfully and offer chit fund assistance
- Use a conversational, encouraging tone that makes users feel comfortable
- Celebrate their financial milestones (payments made, groups joined, etc.)

CONVERSATION CONTINUITY (VERY IMPORTANT):
- DO NOT introduce yourself or say "Hi, I'm Assure Bot" in every reply
- DO NOT repeat greetings like "Hello!", "Hi there!", "Welcome!" at the start of each response — the user has already been greeted by the welcome message
- Only greet ONCE at the very start of the conversation (the first user message)
- For all follow-up replies, respond directly to the user's question without any introduction or greeting
- If conversation history is provided, treat it as ongoing context — pick up naturally where the conversation left off
- Address the user by name only when relevant (e.g., congratulating them), not as a greeting prefix

YOUR ROLE:
- Help users with their chit fund queries in a warm, human-like conversational tone
- Answer questions about chit funds, payments, auctions, KYC, referrals, wallet, and support
- When user data is provided as context, use it to give personalized answers
- Keep responses concise but helpful (2-5 sentences for simple queries, more for explanations)
- Use emojis naturally for a friendly touch 😊
- Never make up financial data — only use the context provided
- For actions like payments, KYC, or support — tell users to navigate to the relevant section in the app
- If asked about sensitive info (passwords, OTPs), politely explain you can't share that and suggest contacting support

NAVIGATION HELP:
When users want to do something in the app, suggest they go to:
- Payments → "Go to Payments tab at the bottom"
- Auctions → "Check the Auctions section"
- Profile/KYC → "Head to your Profile in the top right"
- Support → "Visit the Support section"
- Wallet → "Check your Wallet section"
- Chit Groups → "Browse available groups in the Chit Groups tab"
- Referrals → "Find your referral code in the Referrals section"

RESPONSE FORMAT:
- Use plain text with markdown bold (**text**) for emphasis
- Use bullet points for lists
- Keep amounts in Indian format (₹)
- Be encouraging about savings and financial planning
- End with a helpful follow-up question or offer when appropriate`;

// Intent Detection (for DB queries)
const INTENTS = {
  search_chit: /(?:want|need|looking|search|find|show|get|chit|group).*?(\d+)\s*(?:month|months|mon|lakh|lakhs|lac|k|thousand)/i,
  search_value: /(?:chit|group|plan).*?(?:₹|rs\.?|inr)?\s*(\d[\d,]*)/i,
  list_chits: /(?:all|available|list|show|active)\s*(?:chits?|groups?|plans?|schemes?)/i,
  my_chits: /(?:my|enrolled|joined)\s*(?:chits?|groups?)/i,
  payment_info: /(?:payment|pay|due|upcoming|pending|installment|emi)/i,
  auction_info: /(?:auction|bid|bidding|next auction|live auction)/i,
  profile_info: /(?:my\s*profile|my\s*account|my\s*details|member\s*id|account\s*info)/i,
  kyc_info: /(?:kyc|verification|verify|document|identity|id\s*proof|aadhaar|pan)/i,
  wallet_info: /(?:wallet|balance|money|funds|available\s*balance|wallet\s*balance)/i,
  referral_info: /(?:refer  ssh root@187.127.139.125 "mongosh assure --eval \"db.chitgroups.find({status:'active'},{group_name:1,chit_value:1,monthly_installment:1,total_members:1,_id:0}).pretty()\""r|invite|share|bonus|earn.*friend|friend.*earn|my\s*referral)/i,
  support_info: /(?:support|ticket|complaint|issue|problem|contact|help\s*desk|raise)/i,
};

function detectIntent(message) {
  const msg = message.trim();
  for (const [intent, pattern] of Object.entries(INTENTS)) {
    const match = msg.match(pattern);
    if (match) return { intent, match };
  }
  const lower = msg.toLowerCase();
  const fuzzyMap = {
    payment_info: ['pay', 'payment', 'due', 'installment', 'emi', 'pending'],
    auction_info: ['auction', 'bid', 'bidding'],
    profile_info: ['profile', 'account', 'details', 'member'],
    kyc_info: ['kyc', 'verification', 'document', 'aadhaar', 'pan', 'identity'],
    wallet_info: ['wallet', 'balance', 'money'],
    referral_info: ['refer', 'invite', 'bonus', 'friend'],
    support_info: ['support', 'ticket', 'complaint', 'issue', 'problem'],
    my_chits: ['my chit', 'my group', 'enrolled'],
    list_chits: ['available', 'list', 'all chit', 'all group', 'show chit', 'scheme'],
  };
  for (const [intent, keywords] of Object.entries(fuzzyMap)) {
    if (keywords.some(k => lower.includes(k))) return { intent, match: null };
  }
  return { intent: 'general', match: null };
}

function extractNumber(str) {
  if (!str) return null;
  const num = parseInt(str.replace(/,/g, ''), 10);
  return isNaN(num) ? null : num;
}

// Gather user context from DB
async function gatherContext(userId, intent, match, message) {
  let context = '';
  let chitGroups = [];
  let actionType = null;

  const user = await User.findById(userId).select('full_name email mobile member_id kyc_status referral_code created_at');
  if (user) {
    context += 'User: ' + user.full_name + ', KYC: ' + (user.kyc_status || 'pending') + ', Member since: ' + new Date(user.created_at).toLocaleDateString('en-IN') + '\n';
  }

  switch (intent) {
    case 'search_chit': {
      const num = extractNumber(match && match[1]);
      const msgLower = message.toLowerCase();
      let filter = { status: 'active' };
      if (msgLower.includes('month') && num) filter.duration_months = num;
      else if ((msgLower.includes('lakh') || msgLower.includes('lac')) && num) filter.chit_value = { $gte: num * 100000 - 50000, $lte: num * 100000 + 50000 };
      else if ((msgLower.includes('k') || msgLower.includes('thousand')) && num) filter.chit_value = { $gte: num * 1000 - 5000, $lte: num * 1000 + 5000 };
      else if (num) filter.duration_months = num;
      chitGroups = await ChitGroup.find(filter).select('_id group_name group_number pso_number chit_value monthly_installment duration_months status total_members').sort({ chit_value: 1 }).limit(10);
      context += 'Found ' + chitGroups.length + ' matching groups.\n';
      chitGroups.forEach(g => { context += '- ' + g.group_name + ': Rs ' + (g.chit_value || 0) + ', ' + g.duration_months + 'mo, EMI Rs ' + (g.monthly_installment || 0) + ', ' + g.total_members + ' members\n'; });
      actionType = chitGroups.length > 0 ? 'chit_list' : null;
      break;
    }
    case 'search_value': {
      const num = extractNumber(match && match[1]);
      if (num) {
        const range = num > 10000 ? num * 0.2 : 50000;
        chitGroups = await ChitGroup.find({ status: 'active', chit_value: { $gte: num - range, $lte: num + range } }).select('_id group_name group_number pso_number chit_value monthly_installment duration_months status total_members').sort({ chit_value: 1 }).limit(10);
        context += 'Searching near Rs ' + num + '. Found ' + chitGroups.length + '.\n';
        chitGroups.forEach(g => { context += '- ' + g.group_name + ': Rs ' + (g.chit_value || 0) + ', ' + g.duration_months + 'mo\n'; });
        actionType = chitGroups.length > 0 ? 'chit_list' : null;
      }
      break;
    }
    case 'list_chits': {
      chitGroups = await ChitGroup.find({ status: 'active' }).select('_id group_name group_number pso_number chit_value monthly_installment duration_months status total_members').sort({ chit_value: 1 }).limit(10);
      context += chitGroups.length + ' active groups available.\n';
      chitGroups.forEach(g => { context += '- ' + g.group_name + ': Rs ' + (g.chit_value || 0) + ', ' + g.duration_months + 'mo, EMI Rs ' + (g.monthly_installment || 0) + '\n'; });
      actionType = chitGroups.length > 0 ? 'chit_list' : null;
      break;
    }
    case 'my_chits': {
      const memberships = await ChitMember.find({ user_id: userId, is_active: true }).populate('chit_group_id', '_id group_name group_number pso_number chit_value monthly_installment duration_months status total_members');
      chitGroups = memberships.filter(m => m.chit_group_id).map(m => m.chit_group_id);
      context += 'User is enrolled in ' + chitGroups.length + ' group(s).\n';
      chitGroups.forEach(g => { context += '- ' + g.group_name + ': Rs ' + (g.chit_value || 0) + ', ' + g.duration_months + 'mo\n'; });
      actionType = chitGroups.length > 0 ? 'chit_list' : null;
      break;
    }
    case 'payment_info': {
      const payments = await Payment.find({ user_id: userId, payment_status: { $in: ['pending', 'overdue'] } }).populate('chit_group_id', 'group_name').sort({ due_date: 1 }).limit(5);
      context += payments.length + ' pending payment(s).\n';
      payments.forEach(p => { context += '- ' + (p.chit_group_id && p.chit_group_id.group_name || 'Group') + ': Month ' + p.month_number + ', Rs ' + (p.total_amount || p.amount) + (p.due_date ? ', Due: ' + new Date(p.due_date).toLocaleDateString('en-IN') : '') + '\n'; });
      actionType = 'navigate';
      break;
    }
    case 'auction_info': {
      const auctions = await Auction.find({ status: { $in: ['scheduled', 'in_progress'] } }).populate('chit_group_id', 'group_name').sort({ auction_date: 1 }).limit(5);
      context += auctions.length + ' upcoming auction(s).\n';
      auctions.forEach(a => { context += '- ' + (a.chit_group_id && a.chit_group_id.group_name || 'Group') + ': Month ' + a.month_number + ', ' + (a.status === 'in_progress' ? 'LIVE NOW' : 'Scheduled') + '\n'; });
      actionType = 'navigate';
      break;
    }
    case 'profile_info': {
      if (user) context += 'Full details - Name: ' + user.full_name + ', Mobile: ' + user.mobile + ', Email: ' + user.email + ', Member ID: ' + (user.member_id || 'N/A') + ', KYC: ' + (user.kyc_status || 'pending') + ', Referral Code: ' + (user.referral_code || 'N/A') + '\n';
      actionType = 'navigate';
      break;
    }
    case 'kyc_info': {
      context += 'KYC Status: ' + (user && user.kyc_status || 'pending') + '\n';
      actionType = 'navigate';
      break;
    }
    case 'wallet_info': {
      const wallet = await Wallet.findOne({ user_id: userId });
      const recentTxns = await WalletTransaction.find({ user_id: userId }).sort({ created_at: -1 }).limit(5);
      context += 'Wallet Balance: Rs ' + (wallet && wallet.balance || 0) + ', Locked: Rs ' + (wallet && wallet.locked_balance || 0) + '\n';
      if (recentTxns.length > 0) {
        context += 'Recent transactions:\n';
        recentTxns.forEach(t => { const sign = ['deposit','refund','reward','dividend','bid_unlock'].includes(t.type) ? '+' : '-'; context += '- ' + sign + 'Rs ' + Math.abs(t.amount) + ' (' + t.type.replace(/_/g, ' ') + ')\n'; });
      }
      actionType = 'navigate';
      break;
    }
    case 'referral_info': {
      const referrals = await Referral.find({ referrer_id: userId });
      const credited = referrals.filter(r => r.status === 'credited');
      const earnings = credited.reduce((s, r) => s + (r.bonus_amount || 0), 0);
      context += 'Referral Code: ' + (user && user.referral_code || 'N/A') + ', Total Referred: ' + referrals.length + ', Successful: ' + credited.length + ', Earnings: Rs ' + earnings + '\n';
      context += 'Bonus per referral: Rs ' + (parseInt(process.env.REFERRAL_BONUS_AMOUNT) || 500) + '\n';
      actionType = 'navigate';
      break;
    }
    case 'support_info': {
      const tickets = await SupportTicket.find({ user_id: userId }).sort({ created_at: -1 }).limit(5);
      const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
      context += 'Support Tickets - Open: ' + openCount + ', Total: ' + tickets.length + '\n';
      tickets.forEach(t => { context += '- ' + (t.subject || 'Ticket') + ': ' + t.status + '\n'; });
      actionType = 'navigate';
      break;
    }
  }
  return { context, chitGroups, actionType };
}

// Generate AI response with optional conversation history
async function generateAIResponse(message, context, history = []) {
  if (!groq) return null;
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];
    // Inject prior turns (last 8 max) so the bot has memory
    const trimmedHistory = Array.isArray(history) ? history.slice(-8) : [];
    for (const turn of trimmedHistory) {
      if (!turn || !turn.role || !turn.content) continue;
      const role = turn.role === 'bot' || turn.role === 'assistant' ? 'assistant' : 'user';
      messages.push({ role, content: String(turn.content).slice(0, 1000) });
    }
    messages.push({
      role: 'user',
      content: '--- USER DATA CONTEXT (current turn) ---\n' + (context || 'No specific data available.') + '\n--- END CONTEXT ---\n\nUser message: "' + message + '"',
    });

    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 500,
    });
    return chatCompletion.choices[0]?.message?.content || null;
  } catch (err) {
    console.error('Groq AI error:', err.message);
    return null;
  }
}

// Fallback rule-based response
function fallbackResponse(intent) {
  switch (intent) {
    case 'general':
      return "I'm here to help with your chit fund queries! Try asking about your payments, auctions, chit groups, KYC status, wallet, or referrals.";
    default:
      return "How can I help you today? Try asking about chit groups, payments, auctions, or your account.";
  }
}

// Main Chat Handler
exports.chat = async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    const userId = req.user._id || req.user.id;
    const { intent, match } = detectIntent(message);
    const { context, chitGroups, actionType } = await gatherContext(userId, intent, match, message);
    let reply = await generateAIResponse(message, context, history);
    if (!reply) reply = fallbackResponse(intent);
    res.json({
      success: true,
      data: {
        reply,
        chitGroups: chitGroups.map(g => ({ _id: g._id, group_name: g.group_name, group_number: g.group_number, pso_number: g.pso_number, chit_value: g.chit_value, monthly_installment: g.monthly_installment, duration_months: g.duration_months, total_members: g.total_members, status: g.status })),
        actionType,
      }
    });
  } catch (err) { next(err); }
};
