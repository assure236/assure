import React, { createContext, useContext, useState, useCallback } from 'react';

const ActiveMemberContext = createContext(null);
export const ACTIVE_MEMBER_STORAGE_KEY = 'active_member_id';

export const getActiveMemberId = () => {
  try {
    const value = localStorage.getItem(ACTIVE_MEMBER_STORAGE_KEY)?.trim();
    return value ? value.toUpperCase() : null;
  } catch {
    return null;
  }
};

export const shouldAttachActiveMember = (url = '') => {
  const path = url.toLowerCase();
  if (path.includes('/auth/') && !path.includes('/auth/qr-confirm')) return false;
  if (path.includes('/users/family-members')) return false;
  return true;
};

export const ActiveMemberProvider = ({ children }) => {
  const [activeMemberId, setActiveMemberIdState] = useState(getActiveMemberId);
  const [refreshKey, setRefreshKey] = useState(0);

  const setActiveMemberId = useCallback((memberId) => {
    const normalized = memberId && memberId !== 'me'
      ? String(memberId).trim().toUpperCase()
      : null;
    const next = normalized || null;
    setActiveMemberIdState(next);
    if (next) localStorage.setItem(ACTIVE_MEMBER_STORAGE_KEY, next);
    else localStorage.removeItem(ACTIVE_MEMBER_STORAGE_KEY);
    setRefreshKey((k) => k + 1);
  }, []);

  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <ActiveMemberContext.Provider
      value={{ activeMemberId, setActiveMemberId, refreshKey, bumpRefresh }}
    >
      {children}
    </ActiveMemberContext.Provider>
  );
};

export const useActiveMember = () => {
  const ctx = useContext(ActiveMemberContext);
  if (!ctx) throw new Error('useActiveMember must be used within ActiveMemberProvider');
  return ctx;
};
