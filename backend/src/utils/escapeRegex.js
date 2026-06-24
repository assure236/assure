// SECURITY FIX: escape user-supplied regex input to prevent ReDoS patterns.
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { escapeRegex };
