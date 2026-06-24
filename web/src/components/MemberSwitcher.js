import React, { useEffect, useState } from 'react';
import {
  Box, FormControl, Select, MenuItem, Typography, CircularProgress
} from '@mui/material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useActiveMember } from '../context/ActiveMemberContext';

const MemberSwitcher = ({ compact = false, onSwitch }) => {
  const { user } = useAuth();
  const { activeMemberId, setActiveMemberId } = useActiveMember();
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const selfId = user?.member_id || 'ME';

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get('/users/family-members');
        if (res.data.success) {
          const members = (res.data.data || []).filter(
            (m) => ['approved', 'linked'].includes(m.status)
          );
          setFamilyMembers(members);
          if (activeMemberId) {
            const linked = new Set(
              members.map((m) => (m.member_id || '').toString().toUpperCase())
            );
            if (!linked.has(activeMemberId.toUpperCase())) {
              setActiveMemberId(null);
            }
          }
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeMemberId, setActiveMemberId]);

  const handleChange = (e) => {
    const val = e.target.value;
    setActiveMemberId(val === 'me' ? null : val);
    onSwitch?.();
  };

  if (loading) {
    return compact ? null : <CircularProgress size={20} />;
  }

  if (familyMembers.length === 0) return null;

  const selected = activeMemberId ? activeMemberId : 'me';

  return (
    <Box sx={{ minWidth: compact ? 140 : 200 }}>
      {!compact && (
        <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
          Viewing account
        </Typography>
      )}
      <FormControl size="small" fullWidth>
        <Select
          value={selected}
          onChange={handleChange}
          sx={{
            bgcolor: compact ? 'rgba(11,31,59,0.06)' : 'background.paper',
            fontSize: compact ? 13 : 14,
            fontWeight: 600,
          }}
        >
          <MenuItem value="me">{selfId} (My Account)</MenuItem>
          {familyMembers.map((m) => {
            const id = (m.member_id || '').toString().toUpperCase();
            const label = m.full_name ? `${m.full_name} (${id})` : id;
            return (
              <MenuItem key={m._id || m.id || id} value={id}>
                {label}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    </Box>
  );
};

export default MemberSwitcher;
