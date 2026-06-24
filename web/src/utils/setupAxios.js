import axios from 'axios';
import { getActiveMemberId, shouldAttachActiveMember } from '../context/ActiveMemberContext';

export const setupAxiosInterceptors = () => {
  axios.interceptors.request.use((config) => {
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
