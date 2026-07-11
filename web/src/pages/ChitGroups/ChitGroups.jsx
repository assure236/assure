import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import {
  GroupWork as GroupIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useActiveMember } from '../../context/ActiveMemberContext';

const formatDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatAmount = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('en-IN');
};

/** Compact INR: 100000 → 1L (not 1.0L) */
const shortAmount = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  if (num >= 100000) {
    const lakhs = num / 100000;
    const rounded = Math.round(lakhs * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 0.05) return `${Math.round(rounded)}L`;
    return `${rounded.toFixed(1)}L`;
  }
  if (num >= 1000) return `${Math.round(num / 1000)}K`;
  return formatAmount(num);
};

const statusLabel = (status) => {
  if (status === 'vacant') return 'Vacant';
  if (status === 'not_started') return 'Starting Soon';
  if (status === 'active') return 'Active';
  return 'Upcoming';
};

const ChitGroupCard = ({ group, onViewDetails, onEnroll }) => {
  const totalMembers = Number(group.total_members || 0);
  const enrolledCount = Number(
    group.member_count ||
      group.enrolled_members ||
      group.current_members ||
      0
  );
  const slotsLeft = Math.max(0, totalMembers - enrolledCount);
  const psoNumber = group.pso_number || group.registration_number || '';
  const isNotStarted = group.status === 'not_started';
  const enrollDisabled = slotsLeft <= 0 || isNotStarted;
  const dateLabel = formatDate(group.commencement_date);

  return (
    <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <Box sx={{ height: 4, bgcolor: 'primary.main' }} />
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Box>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
              ₹ {formatAmount(group.chit_value)}
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {group.group_name || 'Chit Group'}
            </Typography>
          </Box>
          <Chip
            label={statusLabel(group.status)}
            size="small"
            sx={{ bgcolor: 'rgba(11,31,59,0.08)', color: 'primary.main', fontWeight: 600, border: '1px solid rgba(11,31,59,0.25)' }}
          />
        </Box>

        <Grid container spacing={1.5} mb={2}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Subscription</Typography>
            <Typography fontWeight={700}>₹{shortAmount(group.monthly_installment)}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Duration</Typography>
            <Typography fontWeight={700}>{group.duration_months || 0} months</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Members</Typography>
            <Typography fontWeight={700}>{totalMembers}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Auction Type</Typography>
            <Typography fontWeight={700}>{group.auction_type || 'Monthly'}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              {group.status === 'vacant' ? 'Slots Available' : group.status === 'active' ? 'Started' : 'Starts'}
            </Typography>
            <Typography fontWeight={700} color="text.primary">
              {group.status === 'vacant'
                ? (slotsLeft > 0 ? `${slotsLeft} open` : 'Almost full')
                : (dateLabel || (group.status === 'active' ? 'In progress' : 'TBD'))}
            </Typography>
          </Grid>
          {psoNumber ? (
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">PSO No.</Typography>
              <Typography fontWeight={700}>{psoNumber}</Typography>
            </Grid>
          ) : null}
        </Grid>

        <Box display="flex" gap={1}>
          <Button variant="outlined" fullWidth onClick={onViewDetails}>View Details</Button>
          <Button
            variant="contained"
            fullWidth
            onClick={onEnroll}
            disabled={enrollDisabled}
          >
            {isNotStarted ? 'Enrollment Closed' : enrollDisabled ? 'Group Full' : 'Invest Now'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

const ChitGroups = () => {
  const navigate = useNavigate();
  const { refreshKey } = useActiveMember();
  const [allGroups, setAllGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [banner, setBanner] = useState(null);
  const [confirmGroup, setConfirmGroup] = useState(null);
  const [gateDialog, setGateDialog] = useState(null);
  const [enrollingGroupId, setEnrollingGroupId] = useState('');

  const toGroups = (response) => {
    if (!response?.data?.success) return [];
    const payload = response.data.data;
    return Array.isArray(payload) ? payload : (payload?.groups || []);
  };

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [notStartedRes, activeRes, vacantRes] = await Promise.all([
        axios.get('/chit-groups?status=not_started&limit=50'),
        axios.get('/chit-groups?status=active&limit=50'),
        axios.get('/chit-groups?status=vacant&limit=50'),
      ]);

      const mergedById = new Map();
      for (const group of [...toGroups(notStartedRes), ...toGroups(activeRes), ...toGroups(vacantRes)]) {
        const id = group?._id || group?.id;
        if (!id) continue;
        mergedById.set(String(id), group);
      }

      const merged = Array.from(mergedById.values()).sort((a, b) => {
        const ad = new Date(a.commencement_date || 0).getTime();
        const bd = new Date(b.commencement_date || 0).getTime();
        return bd - ad;
      });

      setAllGroups(merged);
    } catch (err) {
      setError('Failed to load chit groups. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups, refreshKey]);

  const ensureEnrollmentAllowed = async () => {
    try {
      const profileRes = await axios.get('/users/profile');
      if (profileRes?.data?.success !== true) return false;

      const profile = profileRes.data.data || {};
      const kycStatus = String(profile.kyc_status || '').toLowerCase();
      const profileStatus = String(profile.profile_edit_status || 'none').toLowerCase();

      if (kycStatus !== 'verified') {
        setGateDialog({
          title: 'KYC Required',
          message: 'Please complete KYC verification first. Group joining is enabled only after KYC is verified.',
          actionLabel: 'Go to KYC',
          actionPath: '/kyc',
        });
        return false;
      }

      if (profileStatus === 'pending') {
        setGateDialog({
          title: 'Profile Under Review',
          message: 'Your profile is under admin review. You can join chit groups after final approval.',
          actionLabel: '',
          actionPath: '',
        });
        return false;
      }

      if (profileStatus !== 'approved') {
        setGateDialog({
          title: 'Profile Approval Required',
          message: 'Submit your profile details first. Group joining is available after admin final approval.',
          actionLabel: 'Complete Profile',
          actionPath: '/profile',
        });
        return false;
      }

      return true;
    } catch (err) {
      return false;
    }
  };

  const submitEnrollment = async (group) => {
    const groupId = String(group?._id || group?.id || '');
    if (!groupId) return;

    setEnrollingGroupId(groupId);
    try {
      const response = await axios.post(`/chit-groups/${groupId}/enroll`);
      const ok = response?.data?.success === true;
      setBanner({ type: ok ? 'success' : 'error', message: response?.data?.message || (ok ? 'Enrolled successfully' : 'Enrollment failed') });
      if (ok) {
        await fetchGroups();
      }
    } catch (err) {
      setBanner({ type: 'error', message: err?.response?.data?.message || 'Unable to enroll right now. Please try again.' });
    } finally {
      setEnrollingGroupId('');
    }
  };

  const handleEnrollClick = async (group) => {
    const allowed = await ensureEnrollmentAllowed();
    if (!allowed) return;
    setConfirmGroup(group);
  };

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allGroups;
    return allGroups.filter((group) => {
      const name = String(group.group_name || '').toLowerCase();
      const number = String(group.group_number || '').toLowerCase();
      return name.includes(q) || number.includes(q);
    });
  }, [allGroups, searchQuery]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={1} flexWrap="wrap">
        <Box>
          <Typography variant="h4">New Chits</Typography>
          <Typography variant="body2" color="text.secondary">
            New, active, and vacant chits available to invest — in one list.
          </Typography>
        </Box>
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          <Button size="small" variant="outlined" onClick={() => navigate('/chit-groups/history/completed')}>
            Completed
          </Button>
          <Button size="small" variant="outlined" color="inherit" onClick={() => navigate('/chit-groups/history/cancelled')}>
            Cancelled
          </Button>
          <Chip label={`${filteredList.length} groups`} size="small" />
        </Box>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {banner ? (
        <Alert severity={banner.type} sx={{ mb: 2 }} onClose={() => setBanner(null)}>
          {banner.message}
        </Alert>
      ) : null}

      <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" mb={2}>
        <TextField
          size="small"
          placeholder="Search chit groups..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: { xs: '100%', sm: 320 } }}
        />
      </Box>

      {filteredList.length === 0 ? (
        <Box textAlign="center" py={10}>
          <GroupIcon sx={{ fontSize: 72, color: 'grey.300' }} />
          <Typography color="text.secondary" mt={2}>No groups available.</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredList.map((group) => {
            const groupId = String(group?._id || group?.id || '');
            return (
              <Grid item xs={12} md={6} lg={4} key={groupId}>
                <ChitGroupCard
                  group={group}
                  onViewDetails={() => navigate(`/chit-groups/${groupId}`)}
                  onEnroll={() => handleEnrollClick(group)}
                />
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={Boolean(confirmGroup)} onClose={() => setConfirmGroup(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Investment</DialogTitle>
        <DialogContent>
          {confirmGroup ? (
            <Typography>
              Do you want to invest in {confirmGroup.group_name || 'this chit group'}?
              <br />
              <br />
              Subscription: ₹{formatAmount(confirmGroup.monthly_installment)}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmGroup(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!confirmGroup || enrollingGroupId === String(confirmGroup?._id || confirmGroup?.id || '')}
            onClick={async () => {
              const target = confirmGroup;
              setConfirmGroup(null);
              if (target) await submitEnrollment(target);
            }}
          >
            Invest Now
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(gateDialog)} onClose={() => setGateDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{gateDialog?.title || 'Action Required'}</DialogTitle>
        <DialogContent>
          <Typography>{gateDialog?.message || 'Unable to proceed.'}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGateDialog(null)}>Close</Button>
          {gateDialog?.actionLabel ? (
            <Button
              variant="contained"
              onClick={() => {
                const route = gateDialog.actionPath;
                setGateDialog(null);
                if (route) navigate(route);
              }}
            >
              {gateDialog.actionLabel}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ChitGroups;
