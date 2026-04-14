import React, { useState, useEffect, useMemo } from 'react';
import {
  Container, Grid, Card, CardContent, Typography, Button, Chip,
  CircularProgress, Box, Tabs, Tab, LinearProgress, TextField,
  InputAdornment, Alert, Paper, Divider, MenuItem, IconButton,
  Tooltip, ToggleButtonGroup, ToggleButton
} from '@mui/material';
import {
  Search as SearchIcon, GroupWork as GroupIcon, Sort as SortIcon,
  CalendarMonth as CalendarIcon, People as PeopleIcon,
  CurrencyRupee as RupeeIcon, ViewModule as GridViewIcon,
  ViewList as ListViewIcon, FilterList as FilterIcon,
  EventAvailable as EventIcon, ArrowUpward, ArrowDownward
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const statusColors = { active: 'success', completed: 'default', suspended: 'error', pending: 'warning', accepting_members: 'info' };

const SORT_OPTIONS = [
  { value: 'chit_value_asc', label: 'Chit Value: Low → High' },
  { value: 'chit_value_desc', label: 'Chit Value: High → Low' },
  { value: 'monthly_asc', label: 'Installment: Low → High' },
  { value: 'monthly_desc', label: 'Installment: High → Low' },
  { value: 'duration_asc', label: 'Duration: Short → Long' },
  { value: 'duration_desc', label: 'Duration: Long → Short' },
  { value: 'slots_desc', label: 'Available Slots: Most First' },
  { value: 'date_asc', label: 'Start Date: Earliest' },
  { value: 'date_desc', label: 'Start Date: Latest' },
];

const VALUE_RANGES = [
  { value: 'all', label: 'All Values' },
  { value: '0-50000', label: 'Up to ₹50,000' },
  { value: '50000-100000', label: '₹50K – ₹1 Lakh' },
  { value: '100000-200000', label: '₹1L – ₹2 Lakh' },
  { value: '200000-999999999', label: '₹2 Lakh+' },
];

const DURATION_RANGES = [
  { value: 'all', label: 'All Durations' },
  { value: '0-12', label: 'Up to 12 months' },
  { value: '12-20', label: '12 – 20 months' },
  { value: '20-36', label: '20 – 36 months' },
  { value: '36-999', label: '36+ months' },
];

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const auctionDayLabel = (day) => {
  if (!day) return '—';
  const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
  return `${day}${suffix} of every month`;
};

const ChitGroupCard = ({ group, onViewDetails, onEnroll, memberCounts }) => {
  const progress = group.duration_months > 0
    ? Math.round(((group.current_month || 0) / group.duration_months) * 100) : 0;
  const enrolled = memberCounts[group._id || group.id] || 0;
  const availableSlots = Math.max(0, (group.total_members || 0) - enrolled);

  return (
    <Card sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', transition: '0.2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 } }}>
      <Box sx={{ background: 'linear-gradient(135deg, #0B1F3B, #1E3A8A)', p: 2, color: 'white', borderRadius: '12px 12px 0 0' }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" fontWeight={700}>{group.group_name}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>{group.group_number}</Typography>
          </Box>
          <Chip label={group.status?.replace('_', ' ')} color={statusColors[group.status] || 'default'}
            size="small" sx={{ fontWeight: 600, textTransform: 'capitalize' }} />
        </Box>
      </Box>
      <CardContent sx={{ flex: 1 }}>
        <Grid container spacing={1.5} mb={2}>
          {[
            { label: 'Chit Value', value: `₹${Number(group.chit_value || 0).toLocaleString('en-IN')}`, icon: <RupeeIcon sx={{ fontSize: 14, color: '#D4AF37' }} /> },
            { label: 'Monthly', value: `₹${Number(group.monthly_installment || 0).toLocaleString('en-IN')}`, icon: <RupeeIcon sx={{ fontSize: 14, color: '#4caf50' }} /> },
            { label: 'Duration', value: `${group.duration_months} months`, icon: <CalendarIcon sx={{ fontSize: 14, color: '#1E3A8A' }} /> },
          ].map(({ label, value, icon }) => (
            <Grid item xs={4} key={label}>
              <Paper variant="outlined" sx={{ p: 1, textAlign: 'center', borderRadius: 2 }}>
                <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                  {icon}
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                </Box>
                <Typography variant="body2" fontWeight={700}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Available Slots & Auction Info */}
        <Box sx={{ bgcolor: '#F8F9FB', borderRadius: 2, p: 1.5, mb: 2 }}>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Box display="flex" alignItems="center" gap={0.5}>
                <PeopleIcon sx={{ fontSize: 16, color: availableSlots > 0 ? '#4caf50' : '#f44336' }} />
                <Typography variant="caption" color="text.secondary">Available Slots</Typography>
              </Box>
              <Typography variant="body2" fontWeight={700} color={availableSlots > 0 ? 'success.main' : 'error.main'}>
                {availableSlots} / {group.total_members}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Box display="flex" alignItems="center" gap={0.5}>
                <EventIcon sx={{ fontSize: 16, color: '#1E3A8A' }} />
                <Typography variant="caption" color="text.secondary">Auction Day</Typography>
              </Box>
              <Typography variant="body2" fontWeight={700}>{auctionDayLabel(group.auction_day)}</Typography>
            </Grid>
          </Grid>
          {group.commencement_date && (
            <Box mt={1} display="flex" alignItems="center" gap={0.5}>
              <CalendarIcon sx={{ fontSize: 16, color: '#D4AF37' }} />
              <Typography variant="caption" color="text.secondary">
                Start Date: <strong>{formatDate(group.commencement_date)}</strong>
              </Typography>
            </Box>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary">
          Progress — Month {group.current_month || 0} / {group.duration_months}
        </Typography>
        <LinearProgress variant="determinate" value={progress}
          sx={{ height: 8, borderRadius: 4, mt: 0.5, mb: 1 }} />
      </CardContent>
      <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1 }}>
        <Button variant="outlined" fullWidth onClick={onViewDetails} sx={{ borderRadius: 2 }}>
          View Details
        </Button>
        {onEnroll && availableSlots > 0 && (
          <Button variant="contained" color="success" fullWidth onClick={onEnroll} sx={{ borderRadius: 2 }}>
            Apply Now
          </Button>
        )}
      </Box>
    </Card>
  );
};

const ChitGroups = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [myGroups, setMyGroups] = useState([]);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('chit_value_asc');
  const [valueFilter, setValueFilter] = useState('all');
  const [durationFilter, setDurationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [memberCounts, setMemberCounts] = useState({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [myRes, avRes] = await Promise.all([
        axios.get('/users/my-chit-groups'),
        axios.get('/chit-groups'),
      ]);
      const enrolled = myRes.data.success
        ? (myRes.data.data || []).map(m => m.chit_group_id).filter(Boolean)
        : [];
      setMyGroups(enrolled);
      const enrolledIds = new Set(enrolled.map(g => g._id || g.id));
      const allActive = avRes.data.success ? (avRes.data.data?.groups || avRes.data.data || []) : [];
      setAvailable(allActive.filter(g => !enrolledIds.has(g._id || g.id)));

      // Build member count map from all groups
      const counts = {};
      for (const g of allActive) {
        const id = g._id || g.id;
        counts[id] = g.member_count || g.enrolled_count || 0;
      }
      // Also count enrolled from myGroups perspective
      for (const g of enrolled) {
        const id = g._id || g.id;
        if (!counts[id]) counts[id] = g.member_count || g.enrolled_count || 0;
      }
      setMemberCounts(counts);
    } catch (err) {
      setError('Could not load chit groups.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = (list) => {
    let filtered = list;

    // Text search
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(g =>
        g.group_name?.toLowerCase().includes(s) || g.group_number?.toLowerCase().includes(s)
      );
    }

    // Value filter
    if (valueFilter !== 'all') {
      const [min, max] = valueFilter.split('-').map(Number);
      filtered = filtered.filter(g => (g.chit_value || 0) >= min && (g.chit_value || 0) <= max);
    }

    // Duration filter
    if (durationFilter !== 'all') {
      const [min, max] = durationFilter.split('-').map(Number);
      filtered = filtered.filter(g => (g.duration_months || 0) >= min && (g.duration_months || 0) <= max);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(g => g.status === statusFilter);
    }

    // Sort
    const [field, dir] = sortBy.split(/_(?=asc|desc)/);
    const mult = dir === 'desc' ? -1 : 1;
    filtered.sort((a, b) => {
      let va, vb;
      switch (field) {
        case 'chit_value': va = a.chit_value || 0; vb = b.chit_value || 0; break;
        case 'monthly': va = a.monthly_installment || 0; vb = b.monthly_installment || 0; break;
        case 'duration': va = a.duration_months || 0; vb = b.duration_months || 0; break;
        case 'slots':
          va = (a.total_members || 0) - (memberCounts[a._id || a.id] || 0);
          vb = (b.total_members || 0) - (memberCounts[b._id || b.id] || 0);
          break;
        case 'date':
          va = a.commencement_date ? new Date(a.commencement_date).getTime() : 0;
          vb = b.commencement_date ? new Date(b.commencement_date).getTime() : 0;
          break;
        default: va = 0; vb = 0;
      }
      return (va - vb) * mult;
    });

    return filtered;
  };

  const showList = useMemo(
    () => applyFiltersAndSort(tab === 0 ? myGroups : available),
    [tab, myGroups, available, search, sortBy, valueFilter, durationFilter, statusFilter, memberCounts]
  );

  const allStatuses = useMemo(() => {
    const set = new Set();
    [...myGroups, ...available].forEach(g => { if (g.status) set.add(g.status); });
    return Array.from(set);
  }, [myGroups, available]);

  const activeFilterCount = [valueFilter !== 'all', durationFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length;

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Typography variant="h4">Chit Groups</Typography>
        <Box display="flex" gap={1} alignItems="center">
          <Chip label={`${showList.length} groups`} size="small" />
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Tabs + Search + Filter toggle */}
      <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={`My Groups (${myGroups.length})`} />
          <Tab label={`Available (${available.length})`} />
        </Tabs>
        <Box display="flex" gap={1} alignItems="center" ml="auto" flexWrap="wrap">
          <TextField size="small" placeholder="Search groups…"
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ minWidth: 200 }}
          />
          <Tooltip title="Filters">
            <IconButton onClick={() => setShowFilters(!showFilters)}
              color={activeFilterCount > 0 ? 'primary' : 'default'}
              sx={{ border: '1px solid', borderColor: activeFilterCount > 0 ? 'primary.main' : 'divider', borderRadius: 2 }}>
              <FilterIcon />
              {activeFilterCount > 0 && (
                <Box sx={{ position: 'absolute', top: -4, right: -4, bgcolor: 'primary.main', color: 'white', width: 18, height: 18, borderRadius: '50%', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activeFilterCount}
                </Box>
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filter & Sort Bar */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: '#F8F9FB' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField select fullWidth size="small" label="Sort By" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField select fullWidth size="small" label="Chit Value" value={valueFilter} onChange={e => setValueFilter(e.target.value)}>
                {VALUE_RANGES.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField select fullWidth size="small" label="Duration" value={durationFilter} onChange={e => setDurationFilter(e.target.value)}>
                {DURATION_RANGES.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField select fullWidth size="small" label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <MenuItem value="all">All Statuses</MenuItem>
                {allStatuses.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
          {activeFilterCount > 0 && (
            <Box mt={1.5} display="flex" gap={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">Active filters:</Typography>
              {valueFilter !== 'all' && <Chip size="small" label={VALUE_RANGES.find(v => v.value === valueFilter)?.label} onDelete={() => setValueFilter('all')} />}
              {durationFilter !== 'all' && <Chip size="small" label={DURATION_RANGES.find(v => v.value === durationFilter)?.label} onDelete={() => setDurationFilter('all')} />}
              {statusFilter !== 'all' && <Chip size="small" label={statusFilter.replace('_', ' ')} onDelete={() => setStatusFilter('all')} sx={{ textTransform: 'capitalize' }} />}
              <Button size="small" onClick={() => { setValueFilter('all'); setDurationFilter('all'); setStatusFilter('all'); }}>
                Clear All
              </Button>
            </Box>
          )}
        </Paper>
      )}

      {showList.length === 0 ? (
        <Box textAlign="center" py={10}>
          <GroupIcon sx={{ fontSize: 72, color: 'grey.200' }} />
          <Typography color="text.secondary" mt={2}>
            {tab === 0 ? "You haven't enrolled in any chit groups yet." : "No chit groups match your filters."}
          </Typography>
          {activeFilterCount > 0 && (
            <Button sx={{ mt: 1 }} onClick={() => { setValueFilter('all'); setDurationFilter('all'); setStatusFilter('all'); setSearch(''); }}>
              Clear All Filters
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {showList.map((group) => (
            <Grid item xs={12} md={6} lg={4} key={group._id || group.id}>
              <ChitGroupCard
                group={group}
                memberCounts={memberCounts}
                onViewDetails={() => navigate(`/chit-groups/${group._id || group.id}`)}
                onEnroll={tab === 1 ? () => navigate(`/chit-groups/${group._id || group.id}`) : undefined}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default ChitGroups;
