import React, {
  createContext, useContext, useState, useCallback, useEffect,
} from 'react';
import axios from 'axios';

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
  const [effectiveProfile, setEffectiveProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const reloadEffectiveProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await axios.get('/users/profile');
      if (res.data.success) {
        setEffectiveProfile(res.data.data);
      }
    } catch {
      setEffectiveProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

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

  useEffect(() => {
    reloadEffectiveProfile();
  }, [refreshKey, reloadEffectiveProfile]);

  const isSwitched = !!activeMemberId;

  return (
    <ActiveMemberContext.Provider
      value={{
        activeMemberId,
        setActiveMemberId,
        refreshKey,
        bumpRefresh,
        effectiveProfile,
        profileLoading,
        reloadEffectiveProfile,
        isSwitched,
      }}
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
