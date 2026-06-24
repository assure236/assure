/**
 * Shape user documents for API responses — never expose session internals or password_hash.
 */

const INTERNAL_FIELDS = [
  'password_hash',
  'token_version',
  'web_token_version',
  'fcm_token',
  'digilocker_id',
  'profile_edit_reviewed_by',
  'pending_profile_changes',
  '__v',
];

const toPlain = (user) => {
  if (!user) return null;
  if (typeof user.toObject === 'function') return user.toObject();
  return { ...user };
};

const pick = (obj, keys) => {
  const out = {};
  for (const key of keys) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
};

/** Minimal user for login / refresh / session bootstrap */
const toSessionUser = (user) => {
  const u = toPlain(user);
  if (!u) return null;
  return {
    id: String(u._id || u.id),
    _id: String(u._id || u.id),
    full_name: u.full_name,
    email: u.email,
    mobile: u.mobile,
    role: u.role,
    kyc_status: u.kyc_status,
    member_id: u.member_id,
    profile_image_url: u.profile_image_url || null,
  };
};

/** Admin portal header / auth */
const toAdminSessionUser = (user) => {
  const u = toPlain(user);
  if (!u) return null;
  return {
    id: String(u._id || u.id),
    _id: String(u._id || u.id),
    full_name: u.full_name,
    email: u.email,
    role: u.role,
  };
};

const stripInternalFields = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const field of INTERNAL_FIELDS) {
    delete out[field];
  }
  if (out._id) {
    out.id = String(out._id);
  }
  return out;
};

/** Member self-service profile — full own data minus server-only fields */
const toMemberProfileUser = (userObj) => {
  const cleaned = stripInternalFields(userObj);
  return cleaned;
};

/** Admin user list row */
const toAdminUserListItem = (user) => {
  const u = toPlain(user);
  if (!u) return null;
  return {
    id: String(u._id || u.id),
    _id: String(u._id || u.id),
    member_id: u.member_id,
    full_name: u.full_name,
    email: u.email,
    mobile: u.mobile,
    role: u.role,
    kyc_status: u.kyc_status,
    credit_score: u.credit_score,
    is_active: u.is_active,
    profile_image_url: u.profile_image_url || null,
    profile_edit_status: u.profile_edit_status,
    created_at: u.created_at,
  };
};

/** Admin autocomplete / communications picker */
const toAdminUserLookupItem = (user) => {
  const u = toPlain(user);
  if (!u) return null;
  return {
    id: String(u._id || u.id),
    _id: String(u._id || u.id),
    member_id: u.member_id,
    full_name: u.full_name,
    email: u.email,
    mobile: u.mobile,
    kyc_status: u.kyc_status,
    has_fcm_token: Boolean(u.fcm_token),
  };
};

/** Admin user detail — keep KYC fields but strip session/device internals */
const toAdminUserDetail = (userObj) => stripInternalFields(userObj);

const sessionUserForRole = (user) => {
  const role = user?.role;
  if (role === 'admin' || role === 'super_admin' || role === 'manager') {
    return toAdminSessionUser(user);
  }
  return toSessionUser(user);
};

module.exports = {
  toSessionUser,
  toAdminSessionUser,
  toMemberProfileUser,
  toAdminUserListItem,
  toAdminUserLookupItem,
  toAdminUserDetail,
  stripInternalFields,
  sessionUserForRole,
};
