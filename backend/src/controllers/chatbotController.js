const { ChitGroup, User, Payment, AppSetting } = require('../models');

// Keyword patterns for intent detection
const INTENTS = {
  search_chit: /(?:want|need|looking|search|find|show|get|chit|group).*?(\d+)\s*(?:month|months|mon|lakh|lakhs|lac|k|thousand)/i,
  search_value: /(?:chit|group|plan).*?(?:₹|rs\.?|inr)?\s*(\d[\d,]*)/i,
  list_chits: /(?:all|available|list|show|active)\s*(?:chits?|groups?|plans?)/i,
  my_chits: /(?:my|enrolled|joined)\s*(?:chits?|groups?)/i,
  payment_info: /(?:payment|pay|due|upcoming|pending|installment)/i,
  auction_info: /(?:auction|bid|bidding|next auction)/i,
  help: /(?:help|how|what|guide|about|explain|faq)/i,
  greeting: /^(?:hi|hello|hey|good\s*(?:morning|afternoon|evening)|namaste)/i,
};

function detectIntent(message) {
  const msg = message.trim();
  for (const [intent, pattern] of Object.entries(INTENTS)) {
    const match = msg.match(pattern);
    if (match) return { intent, match };
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
        reply = `Hello ${user?.full_name || 'there'}! 👋 I'm Assure Bot. How can I help you today?\n\nYou can ask me:\n• "Show chits for 20 months"\n• "Chits worth 5 lakh"\n• "My payments"\n• "Next auction"\n• "Available chit groups"`;
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

      case 'help': {
        reply = `Here's what I can help you with:\n
🔍 **Search Chits** — "Show chits for 20 months" or "5 lakh chit groups"
📋 **List Groups** — "Show all active chits"
👤 **My Groups** — "Show my chits"
💰 **Payments** — "My pending payments"
🔨 **Auctions** — "Next auction"
📊 **General** — Ask anything about chit funds!

Just type your question and I'll help you find what you need.`;
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
          reply = `I'm not sure how to help with that. Try asking me:\n• "Show chits for 20 months"\n• "Available chit groups"\n• "My pending payments"\n• "Next auction"`;
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
