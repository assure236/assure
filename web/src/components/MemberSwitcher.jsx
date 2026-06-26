import React from 'react';
import {
  Box, FormControl, Select, MenuItem, Typography, CircularProgress
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useActiveMember } from '../context/ActiveMemberContext';

const MemberSwitcher = ({ compact = false }) => {
  const { user } = useAuth();
  const {
    activeMemberId,
    setActiveMemberId,
    familyMembers,
    familyMembersLoading,
  } = useActiveMember();

  const selfId = user?.member_id || 'ME';

  if (familyMembersLoading) {
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
          onChange={(e) => {
            const val = e.target.value;
            setActiveMemberId(val === 'me' ? null : val);
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                bgcolor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                boxShadow: '0 8px 24px rgba(11, 31, 59, 0.12)',
                '& .MuiMenuItem-root': {
                  color: '#0B1F3B',
                  '&:hover': { bgcolor: '#F1F5F9' },
                  '&.Mui-selected': { bgcolor: '#E2E8F0', fontWeight: 600 },
                  '&.Mui-selected:hover': { bgcolor: '#CBD5E1' },
                },
              },
            },
          }}
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
