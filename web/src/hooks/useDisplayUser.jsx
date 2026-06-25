import { useAuth } from '../context/AuthContext';
import { useActiveMember } from '../context/ActiveMemberContext';

/** Resolved member profile for UI — selected family member or primary account. */
export const useDisplayUser = () => {
  const { user: authUser } = useAuth();
  const { effectiveProfile, isSwitched } = useActiveMember();
  if (isSwitched) return effectiveProfile;
  return authUser;
};
