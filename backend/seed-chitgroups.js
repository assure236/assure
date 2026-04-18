// Run: node seed-chitgroups.js
// Seeds sample chit groups into MongoDB for testing
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/assure_chitfunds';

const ChitGroup = require('./src/models/ChitGroup');

const chitGroupsToSeed = [
  {
    group_number: 'ACF-2026-001',
    group_name: 'Lakshmi Gold 5L',
    total_members: 20,
    chit_value: 500000,
    monthly_installment: 25000,
    duration_months: 20,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2026-01-01'),
    auction_day: 15,
    auction_time: '10:00:00',
    status: 'active',
    description: '₹5 Lakh chit group — 20 members, 20 months duration.',
  },
  {
    group_number: 'ACF-2026-002',
    group_name: 'Sree Padma 10L',
    total_members: 25,
    chit_value: 1000000,
    monthly_installment: 40000,
    duration_months: 25,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2026-02-01'),
    auction_day: 10,
    auction_time: '11:00:00',
    status: 'active',
    description: '₹10 Lakh chit group — 25 members, 25 months duration.',
  },
  {
    group_number: 'ACF-2026-003',
    group_name: 'Assure Mini 1L',
    total_members: 10,
    chit_value: 100000,
    monthly_installment: 10000,
    duration_months: 10,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2026-03-01'),
    auction_day: 5,
    auction_time: '10:00:00',
    status: 'active',
    description: '₹1 Lakh starter chit group — 10 members, 10 months duration.',
  },
  {
    group_number: 'ACF-2026-004',
    group_name: 'Assure Premium 25L',
    total_members: 25,
    chit_value: 2500000,
    monthly_installment: 100000,
    duration_months: 25,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2026-04-01'),
    auction_day: 20,
    auction_time: '14:00:00',
    status: 'active',
    description: '₹25 Lakh premium chit group — 25 members, 25 months duration.',
  },
  {
    group_number: 'ACF-2025-099',
    group_name: 'Completed 2L Demo',
    total_members: 10,
    chit_value: 200000,
    monthly_installment: 20000,
    duration_months: 10,
    prized_subscriber_offer: 0,
    foreman_commission_percentage: 5.0,
    fdr_percentage: 10.0,
    commencement_date: new Date('2025-01-01'),
    closure_date: new Date('2025-10-31'),
    auction_day: 1,
    auction_time: '10:00:00',
    status: 'completed',
    description: 'Completed ₹2 Lakh chit group — for demo/history purposes.',
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
    console.log(`CREATE ${cg.group_number} "${cg.group_name}" — ₹${(cg.chit_value / 100000).toFixed(0)}L, ${cg.total_members} members, ${cg.status}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

seed().catch(e => { console.error(e.message); process.exit(1); });
