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
  Tab,
  Tabs,
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

const shortAmount = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `${Math.round(num / 1000)}K`;
  return formatAmount(num);
};

const statusLabel = (status) => {
  if (status === 'vacant') return 'Seats Available';
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
    <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Box>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: 'primary.main', lineHeight: 1.2 }}>
              ₹ {formatAmount(group.chit_value)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {group.group_name || 'Chit Group'}
            </Typography>
          </Box>
          <Chip
            label={statusLabel(group.status)}
            size="small"
            sx={{ bgcolor: 'primary.main', color: '#fff', fontWeight: 600 }}
          />
        </Box>

        <Grid container spacing={1.5} mb={2}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Monthly EMI</Typography>
            <Typography fontWeight={700}>₹{shortAmount(group.monthly_installment)}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Months</Typography>
            <Typography fontWeight={700}>{group.duration_months || 0}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Members</Typography>
            <Typography fontWeight={700}>{enrolledCount}/{totalMembers}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Auction</Typography>
            <Typography fontWeight={700}>{group.auction_type || 'Monthly'}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              {group.status === 'vacant' ? 'Slots Available' : group.status === 'active' ? 'Started' : 'Starts'}
            </Typography>
            <Typography
              fontWeight={700}
              color={group.status === 'vacant' ? (slotsLeft > 0 ? 'success.main' : 'error.main') : 'text.primary'}
            >
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
            {isNotStarted ? 'Enrollment Closed' : enrollDisabled ? 'Group Full' : 'Enroll Now'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

const ChitGroups = () => {
  const navigate = useNavigate();
  const { refreshKey } = useActiveMember();
  const [tab, setTab] = useState(0);
  const [newGroups, setNewGroups] = useState([]);
  const [vacantGroups, setVacantGroups] = useState([]);
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
      for (const group of [...toGroups(notStartedRes), ...toGroups(activeRes)]) {
        const id = group?._id || group?.id;
        if (!id) continue;
        mergedById.set(String(id), group);
      }

      const merged = Array.from(mergedById.values()).sort((a, b) => {
        const ad = new Date(a.commencement_date || 0).getTime();
        const bd = new Date(b.commencement_date || 0).getTime();
        return bd - ad;
      });

      setNewGroups(merged);
      setVacantGroups(toGroups(vacantRes));
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
          actionPath: '/documents',
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

  const activeList = tab === 0 ? newGroups : vacantGroups;
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeList;
    return activeList.filter((group) => {
      const name = String(group.group_name || '').toLowerCase();
      const number = String(group.group_number || '').toLowerCase();
      return name.includes(q) || number.includes(q);
    });
  }, [activeList, searchQuery]);

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
        <Typography variant="h4">Chit Groups</Typography>
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
        <Tabs value={tab} onChange={(_, value) => setTab(value)}>
          <Tab label={`New (${newGroups.length})`} />
          <Tab label={`Vacant (${vacantGroups.length})`} />
        </Tabs>
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
          sx={{ ml: 'auto', minWidth: { xs: '100%', sm: 260 } }}
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
        <DialogTitle>Confirm Enrollment</DialogTitle>
        <DialogContent>
          {confirmGroup ? (
            <Typography>
              Do you want to enroll in {confirmGroup.group_name || 'this chit group'}?
              <br />
              <br />
              Monthly installment: ₹{formatAmount(confirmGroup.monthly_installment)}
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
            Enroll
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
