// Run: node seed-vacant-new.js
// Seeds 5 vacant + 5 new chit groups for the mobile app tabs
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/assure_chitfunds';
const ChitGroup = require('./src/models/ChitGroup');

const chitGroupsToSeed = [
  // ─── 5 VACANT chit groups (already started, seats still open) ───
  {
    group_number: 'ACF-2025-V01',
    group_name: 'Lakshmi Savings 3L',
    total_members: 20,
    chit_value: 300000,
    monthly_installment: 15000,
    duration_months: 20,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2025-03-01'),
    auction_day: 10,
    auction_time: '10:00:00',
    status: 'vacant',
    description: '₹3 Lakh chit group — started March 2025, seats still available.',
  },
  {
    group_number: 'ACF-2025-V02',
    group_name: 'Padma Gold 5L',
    total_members: 25,
    chit_value: 500000,
    monthly_installment: 20000,
    duration_months: 25,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2025-03-15'),
    auction_day: 15,
    auction_time: '11:00:00',
    status: 'vacant',
    description: '₹5 Lakh gold chit group — started mid-March 2025, limited seats.',
  },
  {
    group_number: 'ACF-2025-V03',
    group_name: 'Assure Silver 2L',
    total_members: 15,
    chit_value: 200000,
    monthly_installment: 13400,
    duration_months: 15,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2025-04-01'),
    auction_day: 5,
    auction_time: '10:00:00',
    status: 'vacant',
    description: '₹2 Lakh silver plan — started April 2025, a few seats open.',
  },
  {
    group_number: 'ACF-2025-V04',
    group_name: 'Sree Wealth 10L',
    total_members: 25,
    chit_value: 1000000,
    monthly_installment: 40000,
    duration_months: 25,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2025-04-01'),
    auction_day: 20,
    auction_time: '14:00:00',
    status: 'vacant',
    description: '₹10 Lakh premium group — started April 2025, seats available.',
  },
  {
    group_number: 'ACF-2025-V05',
    group_name: 'Mini Starter 1L',
    total_members: 10,
    chit_value: 100000,
    monthly_installment: 10000,
    duration_months: 10,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2025-04-15'),
    auction_day: 15,
    auction_time: '09:30:00',
    status: 'vacant',
    description: '₹1 Lakh starter group — started April 2025, entry level.',
  },

  // ─── 5 NEW chit groups (upcoming, not yet started) ───
  {
    group_number: 'ACF-2026-N01',
    group_name: 'Assure Premier 25L',
    total_members: 25,
    chit_value: 2500000,
    monthly_installment: 100000,
    duration_months: 25,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2026-06-01'),
    auction_day: 5,
    auction_time: '10:00:00',
    status: 'not_started',
    description: '₹25 Lakh premium upcoming group — launching June 2026.',
  },
  {
    group_number: 'ACF-2026-N02',
    group_name: 'Golden Future 8L',
    total_members: 20,
    chit_value: 800000,
    monthly_installment: 40000,
    duration_months: 20,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2026-06-15'),
    auction_day: 15,
    auction_time: '11:00:00',
    status: 'not_started',
    description: '₹8 Lakh upcoming group — launching mid-June 2026.',
  },
  {
    group_number: 'ACF-2026-N03',
    group_name: 'Family Savings 4L',
    total_members: 20,
    chit_value: 400000,
    monthly_installment: 20000,
    duration_months: 20,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2026-07-01'),
    auction_day: 10,
    auction_time: '10:00:00',
    status: 'not_started',
    description: '₹4 Lakh family savings plan — launching July 2026.',
  },
  {
    group_number: 'ACF-2026-N04',
    group_name: 'Young Savers 50K',
    total_members: 10,
    chit_value: 50000,
    monthly_installment: 5000,
    duration_months: 10,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2026-07-01'),
    auction_day: 1,
    auction_time: '09:00:00',
    status: 'not_started',
    description: '₹50K starter plan for young savers — launching July 2026.',
  },
  {
    group_number: 'ACF-2026-N05',
    group_name: 'Sree Prosperity 15L',
    total_members: 25,
    chit_value: 1500000,
    monthly_installment: 60000,
    duration_months: 25,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2026-07-15'),
    auction_day: 15,
    auction_time: '14:00:00',
    status: 'not_started',
    description: '₹15 Lakh prosperity group — launching mid-July 2026.',
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', MONGO_URI);

  let created = 0, skipped = 0;

  for (const cg of chitGroupsToSeed) {
    const existing = await ChitGroup.findOne({ group_number: cg.group_number });
    if (existing) {
      console.log(`SKIP  ${cg.group_number} "${cg.group_name}" — already exists`);
      skipped++;
      continue;
    }
    await ChitGroup.create(cg);
    console.log(`CREATE ${cg.group_number} "${cg.group_name}" — ₹${(cg.chit_value / 100000).toFixed(1)}L, ${cg.total_members} members, ${cg.status}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

seed().catch(e => { console.error(e.message); process.exit(1); });
