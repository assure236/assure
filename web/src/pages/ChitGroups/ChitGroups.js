import React, { useState, useEffect } from 'react';
import {
  Container, Grid, Card, CardContent, Typography, Button, Chip,
  CircularProgress, Box, Tabs, Tab, LinearProgress, TextField,
  InputAdornment, Alert, Paper, Divider
} from '@mui/material';
import { Search as SearchIcon, GroupWork as GroupIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const statusColors = { active: 'success', completed: 'default', suspended: 'error', pending: 'warning', accepting_members: 'info' };

const ChitGroupCard = ({ group, onViewDetails, onEnroll }) => {
  const progress = group.duration_months > 0
    ? Math.round(((group.current_month || 0) / group.duration_months) * 100) : 0;
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
            { label: 'Chit Value', value: `₹${Number(group.chit_value || 0).toLocaleString('en-IN')}` },
            { label: 'Monthly', value: `₹${Number(group.monthly_installment || 0).toLocaleString('en-IN')}` },
            { label: 'Duration', value: `${group.duration_months} months` },
          ].map(({ label, value }) => (
            <Grid item xs={4} key={label}>
              <Paper variant="outlined" sx={{ p: 1, textAlign: 'center', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body2" fontWeight={700}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Typography variant="caption" color="text.secondary">
          Progress — Month {group.current_month || 0} / {group.duration_months}
        </Typography>
        <LinearProgress variant="determinate" value={progress}
          sx={{ height: 8, borderRadius: 4, mt: 0.5, mb: 2 }} />
      </CardContent>
      <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1 }}>
        <Button variant="outlined" fullWidth onClick={onViewDetails} sx={{ borderRadius: 2 }}>
          View Details
        </Button>
        {onEnroll && (
          <Button variant="contained" color="success" fullWidth onClick={onEnroll} sx={{ borderRadius: 2 }}>
            Join
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
    } catch (err) {
      setError('Could not load chit groups.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filterGroups = (list) =>
    list.filter(g => !search || g.group_name?.toLowerCase().includes(search.toLowerCase()) || g.group_number?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;

  const showList = tab === 0 ? filterGroups(myGroups) : filterGroups(available);

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Chit Groups</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={`My Groups (${myGroups.length})`} />
          <Tab label={`Available (${available.length})`} />
        </Tabs>
        <TextField size="small" placeholder="Search groups…"
          value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ minWidth: 220 }}
        />
      </Box>

      {showList.length === 0 ? (
        <Box textAlign="center" py={10}>
          <GroupIcon sx={{ fontSize: 72, color: 'grey.200' }} />
          <Typography color="text.secondary" mt={2}>
            {tab === 0 ? "You haven't enrolled in any chit groups yet." : "No chit groups are accepting new members right now."}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {showList.map((group) => (
            <Grid item xs={12} md={6} lg={4} key={group._id || group.id}>
              <ChitGroupCard
                group={group}
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

