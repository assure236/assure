import axios from 'axios';
import { getActiveMemberId, shouldAttachActiveMember } from '../context/ActiveMemberContext';
import { getAccessToken } from '../context/AuthContext';

export const setupAxiosInterceptors = () => {
  axios.interceptors.request.use((config) => {
    // SECURITY FIX: include HttpOnly cookie credentials on every API request.
    config.withCredentials = true;
    // SECURITY FIX: attach in-memory access token at request time.
    const accessToken = getAccessToken();
    if (accessToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (config.skipActiveMember) return config;

    const requestUrl = `${config.baseURL || ''}${config.url || ''}`;
    if (!shouldAttachActiveMember(requestUrl)) return config;

    const activeMemberId = getActiveMemberId();
    if (!activeMemberId) return config;

    config.headers = config.headers || {};
    config.headers['X-Active-Member-Id'] = activeMemberId;
    config.params = { ...(config.params || {}), active_member_id: activeMemberId };
    return config;
  });
};
