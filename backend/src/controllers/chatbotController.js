const { ChitGroup, User, Payment, AppSetting, Wallet, WalletTransaction, Referral, Notification, SupportTicket } = require('../models');

// Keyword patterns for intent detection
const INTENTS = {
  greeting: /^(?:hi|hello|hey|good\s*(?:morning|afternoon|evening)|namaste|yo|sup)/i,
  search_chit: /(?:want|need|looking|search|find|show|get|chit|group).*?(\d+)\s*(?:month|months|mon|lakh|lakhs|lac|k|thousand)/i,
  search_value: /(?:chit|group|plan).*?(?:₹|rs\.?|inr)?\s*(\d[\d,]*)/i,
  list_chits: /(?:all|available|list|show|active)\s*(?:chits?|groups?|plans?)/i,
  my_chits: /(?:my|enrolled|joined)\s*(?:chits?|groups?)/i,
  payment_info: /(?:payment|pay|due|upcoming|pending|installment|emi)/i,
  auction_info: /(?:auction|bid|bidding|next auction|live auction)/i,
  profile_info: /(?:my\s*profile|my\s*account|my\s*details|member\s*id|account\s*info)/i,
  kyc_info: /(?:kyc|verification|verify|document|identity|id\s*proof|aadhaar|pan)/i,
  wallet_info: /(?:wallet|balance|money|funds|available\s*balance|wallet\s*balance)/i,
  referral_info: /(?:referr|invite|share|bonus|earn.*friend|friend.*earn|my\s*referral)/i,
  support_info: /(?:support|ticket|complaint|issue|problem|contact|help\s*desk|raise)/i,
  notification_info: /(?:notification|alert|message|inbox|unread)/i,
  dividend_info: /(?:dividend|winning|prize|pot|pool|distribution)/i,
  calculator: /(?:calcul|emi|how\s*much|monthly.*(?:pay|amount)|what.*(?:pay|cost))/i,
  documents_info: /(?:document|certificate|statement|report|download)/i,
  how_chit_works: /(?:how\s*(?:does|do)?\s*chit|chit\s*fund\s*work|what\s*is\s*chit|explain\s*chit)/i,
  help: /(?:^help$|what\s*can\s*you\s*do|features|menu|options|commands)/i,
};

function detectIntent(message) {
  const msg = message.trim();
  // Exact regex match first
  for (const [intent, pattern] of Object.entries(INTENTS)) {
    const match = msg.match(pattern);
    if (match) return { intent, match };
  }
  // Fuzzy keyword matching as fallback
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
    list_chits: ['available', 'list', 'all chit', 'all group', 'show chit'],
    help: ['help', 'menu', 'options', 'what can'],
  };
  for (const [intent, keywords] of Object.entries(fuzzyMap)) {
    if (keywords.some(k => lower.includes(k))) {
      return { intent, match: null };
    }
  }
  return { intent: 'unknown', match: null };
}

function extractNumber(str) {
  if (!str) return null;
  const cleaned = str.replace(/,/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

exports.chat = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const userId = req.user._id || req.user.id;
    const { intent, match } = detectIntent(message);
    let reply = '';
    let chitGroups = [];
    let actionType = null;

    switch (intent) {
      case 'greeting': {
        const user = await User.findById(userId).select('full_name');
        const name = user?.full_name?.split(' ')[0] || 'there';
        const hour = new Date().getHours();
        const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        reply = `${greet}, ${name}! 😊 Welcome to Assure ChitFunds.\nI'm here to assist you with anything you need.\n\nHere's what I can help with:\n• 🔍 Find chit groups — "Show chits for 20 months"\n• 💰 Payments — "My payments" or "Pending dues"\n• 🔨 Auctions — "Next auction" or "Live auctions"\n• 👤 Account — "My profile" or "KYC status"\n• 🎁 Referrals — "My referral code"\n• 📋 "Help" for the full list\n\nJust type what you need!`;
        break;
      }

      case 'search_chit': {
        const num = extractNumber(match[1]);
        const msgLower = message.toLowerCase();
        let filter = { status: 'active' };

        if (msgLower.includes('month')) {
          filter.duration_months = num;
        } else if (msgLower.includes('lakh') || msgLower.includes('lac')) {
          filter.chit_value = { $gte: num * 100000 - 50000, $lte: num * 100000 + 50000 };
        } else if (msgLower.includes('k') || msgLower.includes('thousand')) {
          filter.chit_value = { $gte: num * 1000 - 5000, $lte: num * 1000 + 5000 };
        } else {
          filter.duration_months = num;
        }

        chitGroups = await ChitGroup.find(filter)
          .select('_id group_name group_number chit_value monthly_installment duration_months status total_members')
          .sort({ chit_value: 1 }).limit(10);

        if (chitGroups.length > 0) {
          reply = `I found ${chitGroups.length} chit group(s) matching your search:`;
          actionType = 'chit_list';
        } else {
          reply = `Sorry, I couldn't find any active chit groups matching "${message}". Try searching with different criteria.`;
          // Show all active as suggestions
          chitGroups = await ChitGroup.find({ status: 'active' })
            .select('_id group_name group_number chit_value monthly_installment duration_months status total_members')
            .sort({ chit_value: 1 }).limit(5);
          if (chitGroups.length > 0) {
            reply += '\n\nHere are some available groups:';
            actionType = 'chit_list';
          }
        }
        break;
      }

      case 'search_value': {
        const num = extractNumber(match[1]);
        if (num) {
          const range = num > 10000 ? num * 0.2 : 50000;
          chitGroups = await ChitGroup.find({
            status: 'active',
            chit_value: { $gte: num - range, $lte: num + range }
          })
            .select('_id group_name group_number chit_value monthly_installment duration_months status total_members')
            .sort({ chit_value: 1 }).limit(10);

          if (chitGroups.length > 0) {
            reply = `Found ${chitGroups.length} chit group(s) near ₹${Number(num).toLocaleString('en-IN')}:`;
            actionType = 'chit_list';
          } else {
            reply = `No active chit groups found near ₹${Number(num).toLocaleString('en-IN')}.`;
          }
        }
        break;
      }

      case 'list_chits': {
        chitGroups = await ChitGroup.find({ status: 'active' })
          .select('_id group_name group_number chit_value monthly_installment duration_months status total_members')
          .sort({ chit_value: 1 }).limit(10);

        reply = chitGroups.length > 0
          ? `Here are the ${chitGroups.length} active chit groups:`
          : 'No active chit groups available right now.';
        if (chitGroups.length > 0) actionType = 'chit_list';
        break;
      }

      case 'my_chits': {
        const ChitMember = require('../models').ChitMember;
        const memberships = await ChitMember.find({ user_id: userId, is_active: true })
          .populate('chit_group_id', '_id group_name group_number chit_value monthly_installment duration_months status total_members');

        chitGroups = memberships
          .filter(m => m.chit_group_id)
          .map(m => m.chit_group_id);

        reply = chitGroups.length > 0
          ? `You're enrolled in ${chitGroups.length} chit group(s):`
          : "You haven't joined any chit groups yet. Would you like to see available groups?";
        if (chitGroups.length > 0) actionType = 'chit_list';
        break;
      }

      case 'payment_info': {
        const payments = await Payment.find({
          user_id: userId,
          payment_status: { $in: ['pending', 'overdue'] }
        }).populate('chit_group_id', 'group_name').sort({ due_date: 1 }).limit(5);

        if (payments.length > 0) {
          reply = `You have ${payments.length} pending payment(s):\n`;
          payments.forEach((p, i) => {
            reply += `\n${i + 1}. ${p.chit_group_id?.group_name || 'Group'} — Month ${p.month_number} — ₹${Number(p.total_amount || p.amount).toLocaleString('en-IN')}`;
            if (p.due_date) reply += ` (Due: ${new Date(p.due_date).toLocaleDateString('en-IN')})`;
          });
          actionType = 'navigate';
          reply += '\n\nGo to Payments to pay now.';
        } else {
          reply = '✅ All caught up! No pending payments.';
        }
        break;
      }

      case 'auction_info': {
        const Auction = require('../models').Auction;
        const auctions = await Auction.find({ status: { $in: ['scheduled', 'in_progress'] } })
          .populate('chit_group_id', 'group_name').sort({ auction_date: 1 }).limit(5);

        if (auctions.length > 0) {
          reply = `Upcoming auctions:\n`;
          auctions.forEach((a, i) => {
            const status = a.status === 'in_progress' ? '🔴 LIVE' : '📅 Scheduled';
            reply += `\n${i + 1}. ${a.chit_group_id?.group_name || 'Group'} — Month ${a.month_number} — ${status}`;
          });
          actionType = 'navigate';
        } else {
          reply = 'No upcoming auctions scheduled right now.';
        }
        break;
      }

      case 'profile_info': {
        const user = await User.findById(userId).select('full_name email mobile member_id kyc_status referral_code created_at');
        if (user) {
          reply = `👤 **Your Profile**\n\n`
            + `📛 Name: ${user.full_name}\n`
            + `📱 Mobile: ${user.mobile}\n`
            + `📧 Email: ${user.email}\n`
            + `🆔 Member ID: ${user.member_id || 'N/A'}\n`
            + `✅ KYC Status: ${(user.kyc_status || 'pending').toUpperCase()}\n`
            + `🎁 Referral Code: ${user.referral_code || 'N/A'}\n`
            + `📅 Member Since: ${new Date(user.created_at).toLocaleDateString('en-IN')}`;
          actionType = 'navigate';
        } else {
          reply = 'Could not fetch your profile. Please try again.';
        }
        break;
      }

      case 'kyc_info': {
        const user = await User.findById(userId).select('kyc_status');
        const status = (user?.kyc_status || 'pending').toLowerCase();
        const statusEmojis = { verified: '✅', pending: '⏳', rejected: '❌', submitted: '📤' };
        reply = `**KYC Status: ${statusEmojis[status] || '⏳'} ${status.toUpperCase()}**\n\n`;
        if (status === 'verified') {
          reply += 'Your KYC is verified! You have full access to all features.';
        } else if (status === 'submitted') {
          reply += 'Your documents are under review. This usually takes 24-48 hours.';
        } else if (status === 'rejected') {
          reply += 'Your KYC was rejected. Please re-upload correct documents from the Documents section.';
          actionType = 'navigate';
        } else {
          reply += 'Please complete your KYC to access all features:\n1. Go to Documents section\n2. Upload Aadhaar and PAN\n3. Wait for admin verification';
          actionType = 'navigate';
        }
        break;
      }

      case 'wallet_info': {
        const wallet = await Wallet.findOne({ user_id: userId });
        const balance = wallet?.balance || 0;
        const locked = wallet?.locked_balance || 0;
        const recentTxns = await WalletTransaction.find({ user_id: userId })
          .sort({ created_at: -1 }).limit(5);

        reply = `💰 **Your Wallet**\n\n`
          + `Available Balance: ₹${balance.toLocaleString('en-IN')}\n`
          + `Locked (Bids): ₹${locked.toLocaleString('en-IN')}\n`;

        if (recentTxns.length > 0) {
          reply += `\n📜 Recent Transactions:\n`;
          recentTxns.forEach((t, i) => {
            const sign = ['deposit', 'refund', 'reward', 'dividend', 'bid_unlock'].includes(t.type) ? '+' : '-';
            reply += `${i + 1}. ${sign}₹${Math.abs(t.amount).toLocaleString('en-IN')} — ${t.type.replace(/_/g, ' ')}${t.description ? ` (${t.description})` : ''}\n`;
          });
        }
        actionType = 'navigate';
        break;
      }

      case 'referral_info': {
        const user = await User.findById(userId).select('referral_code');
        const referrals = await Referral.find({ referrer_id: userId });
        const total = referrals.length;
        const credited = referrals.filter(r => r.status === 'credited');
        const earnings = credited.reduce((s, r) => s + (r.bonus_amount || 0), 0);
        const bonusAmount = parseInt(process.env.REFERRAL_BONUS_AMOUNT) || 500;

        reply = `🎁 **Your Referrals**\n\n`
          + `📋 Referral Code: **${user?.referral_code || 'N/A'}**\n`
          + `👥 Total Referred: ${total}\n`
          + `✅ Successful: ${credited.length}\n`
          + `💰 Total Earnings: ₹${earnings.toLocaleString('en-IN')}\n\n`
          + `Share your code with friends! You earn ₹${bonusAmount} for each successful referral.\n`
          + `Go to Referrals section to copy and share your code.`;
        actionType = 'navigate';
        break;
      }

      case 'support_info': {
        const tickets = await SupportTicket.find({ user_id: userId }).sort({ created_at: -1 }).limit(5);
        const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

        if (tickets.length > 0) {
          reply = `🎫 **Your Support Tickets**\n\n`
            + `Open: ${openCount} | Total: ${tickets.length}\n\n`;
          tickets.forEach((t, i) => {
            const statusIcon = { open: '🟡', in_progress: '🔵', resolved: '✅', closed: '⚫' };
            reply += `${i + 1}. ${statusIcon[t.status] || '🟡'} ${t.subject || 'Ticket'} — ${(t.status || 'open').replace(/_/g, ' ')}\n`;
          });
          reply += '\nNeed more help? Go to Support to raise a new ticket.';
        } else {
          reply = '🎫 No support tickets found.\n\nIf you have any issues, go to the Support section to raise a ticket.';
        }
        actionType = 'navigate';
        break;
      }

      case 'notification_info': {
        const notifications = await Notification.find({ user_id: userId, is_read: false })
          .sort({ created_at: -1 }).limit(5);
        const totalUnread = await Notification.countDocuments({ user_id: userId, is_read: false });

        if (notifications.length > 0) {
          reply = `🔔 **Unread Notifications (${totalUnread})**\n\n`;
          notifications.forEach((n, i) => {
            reply += `${i + 1}. ${n.title || n.type} — ${n.message?.substring(0, 60) || ''}\n`;
          });
          if (totalUnread > 5) reply += `\n...and ${totalUnread - 5} more. Check your notifications.`;
        } else {
          reply = '🔔 No unread notifications. You\'re all caught up!';
        }
        actionType = 'navigate';
        break;
      }

      case 'dividend_info': {
        const ChitMember = require('../models').ChitMember;
        const memberships = await ChitMember.find({ user_id: userId, is_active: true })
          .populate('chit_group_id', 'group_name chit_value total_members foreman_commission_percentage');

        if (memberships.length > 0) {
          reply = `📊 **Dividend Information**\n\n`;
          memberships.forEach((m, i) => {
            const g = m.chit_group_id;
            if (!g) return;
            const commPct = g.foreman_commission_percentage || 5;
            const pool = g.chit_value - Math.round(g.chit_value * (commPct / 100));
            const maxDiv = Math.round((pool * 0.30) / g.total_members);
            reply += `${i + 1}. ${g.group_name}\n   Chit Value: ₹${g.chit_value?.toLocaleString('en-IN')}\n   Max Possible Dividend: ₹${maxDiv.toLocaleString('en-IN')}/member\n\n`;
          });
          reply += 'Dividend depends on the winning bid amount in each month\'s auction.';
        } else {
          reply = 'You\'re not enrolled in any chit groups yet. Join a group to start earning dividends!';
        }
        break;
      }

      case 'calculator': {
        const numMatch = message.match(/(\d[\d,]*)/);
        const num = numMatch ? parseInt(numMatch[1].replace(/,/g, ''), 10) : null;

        if (num && num > 0) {
          // Find closest chit group
          const groups = await ChitGroup.find({ status: 'active' }).select('group_name chit_value monthly_installment duration_months total_members');
          reply = `🧮 **EMI Calculator**\n\nFor ₹${num.toLocaleString('en-IN')}:\n`;

          const closeGroups = groups.filter(g => Math.abs(g.chit_value - num) <= num * 0.3);
          if (closeGroups.length > 0) {
            closeGroups.forEach((g, i) => {
              reply += `\n${i + 1}. ${g.group_name}\n   Chit Value: ₹${g.chit_value?.toLocaleString('en-IN')}\n   Monthly EMI: ₹${g.monthly_installment?.toLocaleString('en-IN')}\n   Duration: ${g.duration_months} months\n`;
            });
            chitGroups = closeGroups;
            actionType = 'chit_list';
          } else {
            reply += '\nNo matching chit groups found for this amount. Here are available options:';
            chitGroups = groups.slice(0, 5);
            if (chitGroups.length > 0) actionType = 'chit_list';
          }
        } else {
          reply = '🧮 **EMI Calculator**\n\nTell me the amount you need! Try:\n• "Calculate EMI for 5 lakh"\n• "How much to pay for 2 lakh chit?"\n• "Monthly payment for 10 lakh"';
        }
        break;
      }

      case 'documents_info': {
        const user = await User.findById(userId).select('kyc_status');
        reply = `📄 **Documents & Certificates**\n\n`
          + `You can access the following from the Documents section:\n`
          + `• 📋 KYC Documents (Aadhaar, PAN)\n`
          + `• 📜 Membership Certificate\n`
          + `• 📊 Payment Statements\n`
          + `• 🧾 Group Subscription Details\n\n`
          + `KYC Status: ${(user?.kyc_status || 'pending').toUpperCase()}\n`
          + `Go to Documents section to view or download.`;
        actionType = 'navigate';
        break;
      }

      case 'how_chit_works': {
        reply = `🎓 **How Chit Funds Work**\n\n`
          + `A chit fund is a savings and borrowing scheme:\n\n`
          + `1️⃣ **Join a Group** — Members join a group with a fixed chit value (e.g., ₹5,00,000)\n\n`
          + `2️⃣ **Monthly Payment** — Each member pays a fixed monthly installment\n\n`
          + `3️⃣ **Monthly Auction** — Every month, an auction is held. Members bid to win the prize amount\n\n`
          + `4️⃣ **Winning Bid** — The highest bidder wins the pot. The bid amount is distributed as dividend to all members\n\n`
          + `5️⃣ **Dividend** — All members (except the winner) receive a share of the winning bid, reducing their effective EMI\n\n`
          + `📌 Example: 20-member group, ₹5L chit value\n`
          + `• Monthly EMI: ₹25,000\n`
          + `• If winning bid: ₹1,50,000\n`
          + `• Dividend: ₹7,500/member\n`
          + `• Effective EMI: ₹17,500\n\n`
          + `It's a great way to save AND access funds when you need them!`;
        break;
      }

      case 'help': {
        reply = `Here's everything I can help you with:\n\n`
          + `🔍 **Search Chits** — "Show chits for 20 months" or "5 lakh chit groups"\n`
          + `📋 **List Groups** — "Show all active chits"\n`
          + `👤 **My Groups** — "Show my chits"\n`
          + `💰 **Payments** — "My pending payments"\n`
          + `🔨 **Auctions** — "Next auction" or "Live auctions"\n`
          + `👤 **Profile** — "My profile" or "My account details"\n`
          + `✅ **KYC** — "KYC status" or "How to verify"\n`
          + `💳 **Wallet** — "My wallet balance"\n`
          + `🎁 **Referrals** — "My referral code" or "Referral bonus"\n`
          + `🎫 **Support** — "My tickets" or "Raise a complaint"\n`
          + `🔔 **Notifications** — "My notifications"\n`
          + `📊 **Dividends** — "My dividend info"\n`
          + `🧮 **Calculator** — "Calculate EMI for 5 lakh"\n`
          + `📄 **Documents** — "My documents"\n`
          + `🎓 **Learn** — "How do chit funds work?"\n\n`
          + `Just type your question and I'll help!`;
        break;
      }

      default: {
        // Try to find chit groups by matching any numbers in the message
        const numMatch = message.match(/(\d+)/);
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          chitGroups = await ChitGroup.find({
            status: 'active',
            $or: [
              { duration_months: num },
              { chit_value: { $gte: num * 0.9, $lte: num * 1.1 } },
            ]
          }).select('_id group_name group_number chit_value monthly_installment duration_months status total_members')
            .sort({ chit_value: 1 }).limit(5);

          if (chitGroups.length > 0) {
            reply = `Here are some results that might match:`;
            actionType = 'chit_list';
          }
        }

        if (!reply) {
          reply = `I'm not sure I understood that. Here are some things you can try:\n• "Show chits for 20 months"\n• "My pending payments"\n• "Next auction"\n\n💬 If you need help from a real person, type **"raise ticket"** or go to **Support Chat** and our team will assist you within 24 hours.`;
        }
        break;
      }
    }

    res.json({
      success: true,
      data: {
        reply,
        chitGroups: chitGroups.map(g => ({
          _id: g._id,
          group_name: g.group_name,
          group_number: g.group_number,
          chit_value: g.chit_value,
          monthly_installment: g.monthly_installment,
          duration_months: g.duration_months,
          total_members: g.total_members,
          status: g.status,
        })),
        actionType,
      }
    });
  } catch (err) { next(err); }
};
