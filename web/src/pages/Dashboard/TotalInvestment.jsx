import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  LinearProgress,
  Typography,
} from '@mui/material';
import SavingsIcon from '@mui/icons-material/Savings';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import axios from 'axios';
import { useActiveMember } from '../../context/ActiveMemberContext';

const formatInr = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const TotalInvestment = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const { refreshKey } = useActiveMember();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get('/dashboard/member');
        if (res.data?.success) {
          setDashboard(res.data.data || null);
        } else {
          setError('Could not load investment details.');
        }
      } catch {
        setError('Could not load investment details.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [refreshKey]);

  const groups = useMemo(() => {
    const memberships = dashboard?.memberships || [];
    return memberships
      .map((m) => {
        const g = m.chit_group_id || {};
        const duration = Number(g.duration_months || 0);
        const monthsPaid = Number(m.months_paid || 0);
        const progress = duration > 0 ? Math.min(100, Math.round((monthsPaid / duration) * 100)) : 0;

        return {
          id: String(g._id || g.id || m._id || Math.random()),
          name: g.group_name || 'Chit Group',
          chitValue: Number(g.chit_value || 0),
          monthlyInstallment: Number(g.monthly_installment || 0),
          duration,
          monthsPaid,
          totalPaid: Number(m.total_paid || 0),
          progress,
        };
      })
      .filter((group) => group.name);
  }, [dashboard]);

  const sumPaid = groups.reduce((sum, group) => sum + group.totalPaid, 0);
  const totalInvested = Number(dashboard?.totalInvested || 0) || sumPaid;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Card sx={{ borderRadius: 3, mb: 3, background: 'linear-gradient(135deg, #0B1F3B, #1E3A8A)', color: '#fff' }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <SavingsIcon sx={{ fontSize: 42, opacity: 0.85 }} />
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>Total Amount Invested</Typography>
          <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>{formatInr(totalInvested)}</Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Across {groups.length} chit group{groups.length === 1 ? '' : 's'}
          </Typography>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 1.5 }}>Group-wise Breakdown</Typography>

      {groups.length === 0 ? (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <GroupWorkIcon sx={{ fontSize: 48, color: 'grey.400' }} />
            <Typography color="text.secondary" mt={1}>No active investments yet.</Typography>
          </CardContent>
        </Card>
      ) : groups.map((group) => (
        <Card key={group.id} sx={{ borderRadius: 3, mb: 1.5, border: '1px solid #E2E8F0' }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography fontWeight={700}>{group.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Chit Value: {formatInr(group.chitValue)}
                </Typography>
              </Box>
              <Typography fontWeight={800} color="primary.main">{formatInr(group.totalPaid)}</Typography>
            </Box>

            <Box display="flex" gap={1.5} mt={1.5} mb={1} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                EMI: <strong>{formatInr(group.monthlyInstallment)}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Paid: <strong>{group.monthsPaid}/{group.duration} months</strong>
              </Typography>
            </Box>

            <LinearProgress variant="determinate" value={group.progress} sx={{ height: 6, borderRadius: 4 }} />
            <Typography variant="caption" color="text.secondary">{group.progress}% complete</Typography>
          </CardContent>
        </Card>
      ))}
    </Container>
  );
};

export default TotalInvestment;
