/**
 * Migrate existing member/agent Member IDs to:
 *   VA{signupYear}{5-digit-seq}  e.g. VA202600001
 *
 * Year comes from each user's created_at (signup year).
 * Sequence restarts at 00001 for each year (ordered by created_at ASC).
 *
 * Also updates FamilyMember.member_id copies that pointed at old IDs.
 *
 * Usage (from backend folder):
 *   node scripts/migrate-member-ids-to-va.js           # dry-run preview
 *   node scripts/migrate-member-ids-to-va.js --apply   # write changes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { User, FamilyMember } = require('../src/models');

const APPLY = process.argv.includes('--apply');

function yearOf(user) {
  const d = user.created_at ? new Date(user.created_at) : new Date();
  const y = d.getFullYear();
  return Number.isFinite(y) && y >= 2000 ? y : new Date().getFullYear();
}

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/assure_chitfunds';
  await mongoose.connect(uri);
  console.log(`Connected. Mode: ${APPLY ? 'APPLY (writing)' : 'DRY-RUN (no writes)'}`);

  const users = await User.find({ role: { $in: ['member', 'agent'] } })
    .select('_id full_name email mobile member_id role created_at')
    .sort({ created_at: 1 })
    .lean();

  console.log(`Found ${users.length} member/agent users`);

  /** @type {Map<number, typeof users>} */
  const byYear = new Map();
  for (const u of users) {
    const y = yearOf(u);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(u);
  }

  const plan = [];
  for (const [year, list] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return String(a._id).localeCompare(String(b._id));
    });
    list.forEach((u, idx) => {
      const newId = `VA${year}${String(idx + 1).padStart(5, '0')}`;
      plan.push({
        _id: u._id,
        name: u.full_name,
        email: u.email,
        role: u.role,
        old: u.member_id || null,
        next: newId,
        year,
        changed: (u.member_id || '') !== newId,
      });
    });
  }

  const changes = plan.filter((p) => p.changed);
  console.log(`\nWill update ${changes.length} / ${plan.length} users:\n`);
  for (const row of plan) {
    const mark = row.changed ? '→' : '=';
    console.log(`  ${row.old || '(none)'} ${mark} ${row.next}  | ${row.name} (${row.role})`);
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to write changes.');
    await mongoose.disconnect();
    return;
  }

  // Phase 1: move to temporary unique IDs to avoid unique-index collisions
  for (const row of changes) {
    await User.updateOne(
      { _id: row._id },
      { $set: { member_id: `TMP_${row._id}` } },
    );
  }

  // Phase 2: assign final VA IDs
  for (const row of changes) {
    await User.updateOne(
      { _id: row._id },
      { $set: { member_id: row.next } },
    );
  }

  // Phase 3: sync FamilyMember denormalized member_id (by linked user or old string)
  let familyUpdated = 0;
  for (const row of changes) {
    if (row.old) {
      const r1 = await FamilyMember.updateMany(
        { member_id: row.old },
        { $set: { member_id: row.next } },
      );
      familyUpdated += r1.modifiedCount || 0;
    }
    const r2 = await FamilyMember.updateMany(
      { linked_user_id: row._id },
      { $set: { member_id: row.next } },
    );
    familyUpdated += r2.modifiedCount || 0;
  }

  console.log(`\nDone. Updated ${changes.length} users, ${familyUpdated} family-member rows.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
