import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Box, Card, CardContent, Grid, Chip, Button,
  CircularProgress, Alert, Divider, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Avatar, IconButton, Tooltip
} from '@mui/material';
import { ArrowBack as BackIcon, Refresh as RefreshIcon, Edit as EditIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const statusColors = {
  active: 'success', completed: 'default', suspended: 'error',
  pending: 'warning', accepting_members: 'info'
};

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function ChitGroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGroup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/chit-groups/${id}`);
      if (res.data.success) {
        const { group: grpData, members, auctions, recentPayments, totalCollected } = res.data.data;
        setGroup({ ...grpData, members: members || [], auctions: auctions || [], recentPayments: recentPayments || [], totalCollected: totalCollected || 0 });
      }
    } catch (err) {
      setError('Could not load chit group details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  const handleStatusToggle = async () => {
    if (!group) return;
    const newStatus = group.status === 'active' ? 'suspended' : 'active';
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/admin/chit-groups/${id}`, { status: newStatus });
      toast.success(`Group ${newStatus === 'active' ? 'activated' : 'suspended'}`);
      fetchGroup();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress />
    </Box>
  );

  if (error || !group) return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/chit-groups')} sx={{ mb: 2 }}>Back</Button>
      <Alert severity="error">{error || 'Group not found'}</Alert>
    </Container>
  );

  const members = group.members || [];
  const progress = group.duration_months > 0
    ? Math.round(((group.current_month || 0) / group.duration_months) * 100)
    : 0;

  const infoRows = [
    { label: 'Group Number', value: group.group_number },
    { label: 'Chit Value', value: fmt(group.chit_value) },
    { label: 'Monthly Installment', value: fmt(group.monthly_installment) },
    { label: 'Duration', value: `${group.duration_months} months` },
    { label: 'Total Members', value: group.total_members },
    { label: 'Enrolled', value: `${group.enrolled_members || members.length} / ${group.total_members}` },
    { label: 'Current Month', value: `${group.current_month || 0} / ${group.duration_months}` },
    { label: 'Auction Day', value: group.auction_day ? `Day ${group.auction_day} of each month` : '—' },
    { label: 'Start Date', value: fmtDate(group.commencement_date || group.start_date) },
    { label: 'Description', value: group.description || '—' },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/chit-groups')}><BackIcon /></IconButton>
          <Box>
            <Typography variant="h4">{group.group_name}</Typography>
            <Typography variant="body2" color="text.secondary">{group.group_number}</Typography>
          </Box>
          <Chip label={group.status} color={statusColors[group.status] || 'default'} />
        </Box>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchGroup}><RefreshIcon /></IconButton>
          </Tooltip>
          <Button
            variant={group.status === 'active' ? 'outlined' : 'contained'}
            color={group.status === 'active' ? 'error' : 'success'}
            onClick={handleStatusToggle}
            disabled={group.status === 'completed'}
          >
            {group.status === 'active' ? 'Suspend Group' : 'Activate Group'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Group Info */}
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>Group Details</Typography>
              <Divider sx={{ mb: 2 }} />
              {infoRows.map(({ label, value }) => (
                <Box key={label} display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>{label}</Typography>
                  <Typography variant="body2" fontWeight={600} textAlign="right">{value}</Typography>
                </Box>
              ))}
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Progress — Month {group.current_month || 0} of {group.duration_months}
                </Typography>
                <Box sx={{ height: 8, bgcolor: 'grey.200', borderRadius: 4, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: 'primary.main', borderRadius: 4 }} />
                </Box>
                <Typography variant="caption" color="text.secondary">{progress}% complete</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Financial Summary */}
        <Grid item xs={12} md={7}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              { label: 'Total Prize Pool', value: fmt(group.chit_value), color: '#1976d2' },
              { label: 'Monthly Collection', value: fmt(group.monthly_installment * (group.enrolled_members || members.length)), color: '#388e3c' },
              { label: 'Commission (5%)', value: fmt(group.chit_value * 0.05), color: '#f57c00' },
              { label: 'Members Enrolled', value: `${group.enrolled_members || members.length} / ${group.total_members}`, color: '#7b1fa2' },
            ].map(({ label, value, color }) => (
              <Grid item xs={6} key={label}>
                <Card sx={{ borderTop: `4px solid ${color}`, borderRadius: 2 }}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="h6" fontWeight={700}>{value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Members Table */}
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="h6" fontWeight={700}>Members ({members.length})</Typography>
            </CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    {['Ticket', 'Name', 'Mobile', 'Status', 'Received Prize'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No members enrolled yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((m) => (
                      <TableRow key={m._id || m.id} hover>
                        <TableCell>#{m.ticket_number}</TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'primary.main' }}>
                              {(m.user_id?.full_name || 'U').charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2">{m.user_id?.full_name || '—'}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{m.user_id?.mobile || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            label={m.is_active !== false ? 'Active' : 'Inactive'}
                            size="small"
                            color={m.is_active !== false ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={m.has_won_auction ? 'Yes' : 'No'}
                            size="small"
                            color={m.has_won_auction ? 'success' : 'default'}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
