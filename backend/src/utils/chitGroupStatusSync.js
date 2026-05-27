const ChitGroup = require('../models/ChitGroup');
const ChitMember = require('../models/ChitMember');

const TERMINAL_STATUSES = new Set(['closed', 'suspended', 'completed']);

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calculateDesiredStatus(group, activeMemberCount, now = new Date()) {
  const totalMembers = Number(group.total_members || 0);
  const hasReachedFull = totalMembers > 0 && activeMemberCount >= totalMembers;
  const wasFull = Boolean(group.was_full) || hasReachedFull;

  if (TERMINAL_STATUSES.has(group.status)) {
    return {
      status: group.status,
      was_full: wasFull,
    };
  }

  const startDate = group.commencement_date ? new Date(group.commencement_date) : null;
  const hasStartedByDate = startDate
    ? startOfDay(startDate) <= startOfDay(now)
    : true;

  let status = 'not_started';

  if (!hasStartedByDate) {
    // Respect manual activation before the start date.
    status = group.status === 'active' ? 'active' : 'not_started';
  } else if (hasReachedFull) {
    status = 'active';
  } else if (wasFull) {
    // Seats reopened after being full.
    status = 'vacant';
  } else {
    // Started by date but still has seats.
    status = 'active';
  }

  return {
    status,
    was_full: wasFull,
  };
}

async function syncChitGroupStatuses({ groupIds } = {}) {
  const filter = {};
  if (Array.isArray(groupIds) && groupIds.length > 0) {
    filter._id = { $in: groupIds };
  }

  const groups = await ChitGroup.find(filter).select(
    '_id status total_members commencement_date was_full'
  );

  if (!groups.length) {
    return { updated: 0, statusMap: new Map() };
  }

  const ids = groups.map((g) => g._id);
  const memberCounts = await ChitMember.aggregate([
    { $match: { chit_group_id: { $in: ids }, is_active: true } },
    { $group: { _id: '$chit_group_id', count: { $sum: 1 } } },
  ]);

  const countMap = new Map();
  for (const row of memberCounts) {
    countMap.set(String(row._id), row.count);
  }

  const now = new Date();
  const statusMap = new Map();
  const bulkOps = [];

  for (const group of groups) {
    const activeMemberCount = countMap.get(String(group._id)) || 0;
    const desired = calculateDesiredStatus(group, activeMemberCount, now);

    statusMap.set(String(group._id), {
      status: desired.status,
      was_full: desired.was_full,
      active_member_count: activeMemberCount,
    });

    const needsStatusUpdate = group.status !== desired.status;
    const needsWasFullUpdate = Boolean(group.was_full) !== desired.was_full;
    if (!needsStatusUpdate && !needsWasFullUpdate) continue;

    const set = {};
    if (needsStatusUpdate) set.status = desired.status;
    if (needsWasFullUpdate) set.was_full = desired.was_full;

    bulkOps.push({
      updateOne: {
        filter: { _id: group._id },
        update: { $set: set },
      },
    });
  }

  if (bulkOps.length) {
    await ChitGroup.bulkWrite(bulkOps, { ordered: false });
  }

  return { updated: bulkOps.length, statusMap };
}

module.exports = {
  calculateDesiredStatus,
  syncChitGroupStatuses,
};
