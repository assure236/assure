import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  LinearProgress,
  Typography,
} from '@mui/material';
import SavingsIcon from '@mui/icons-material/Savings';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import axios from 'axios';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { brand, fmtINR } from '../../theme/brand';
import { PageShell, PageHeader, Surface, EmptyState, SectionTitle } from '../../components/ui/PageKit';

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
    <PageShell maxWidth={720}>
      <PageHeader
        eyebrow="Portfolio"
        title="Total Investment"
        subtitle={`Across ${groups.length} chit group${groups.length === 1 ? '' : 's'}`}
      />

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Surface
        sx={{
          mb: 3,
          background: `linear-gradient(135deg, ${brand.navy}, ${brand.royal})`,
          color: '#fff',
          border: 'none',
        }}
      >
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <SavingsIcon sx={{ fontSize: 42, opacity: 0.85, color: brand.goldSoft }} />
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 1 }}>Total Amount Invested</Typography>
          <Typography
            variant="h4"
            fontWeight={800}
            sx={{ mt: 0.5, fontFamily: brand.fontDisplay }}
          >
            {fmtINR(totalInvested)}
          </Typography>
        </Box>
      </Surface>

      <SectionTitle title="Group-wise Breakdown" />

      {groups.length === 0 ? (
        <Surface>
          <EmptyState
            icon={<GroupWorkIcon />}
            title="No active investments yet"
            description="Your chit group contributions will appear here once you enroll."
          />
        </Surface>
      ) : groups.map((group) => (
        <Surface key={group.id} sx={{ mb: 1.5 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography fontWeight={700} sx={{ color: brand.navy }}>{group.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                Chit Value: {fmtINR(group.chitValue)}
              </Typography>
            </Box>
            <Typography fontWeight={800} sx={{ color: brand.goldDark }}>{fmtINR(group.totalPaid)}</Typography>
          </Box>

          <Box display="flex" gap={1.5} mt={1.5} mb={1} flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">
              EMI: <strong>{fmtINR(group.monthlyInstallment)}</strong>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Paid: <strong>{group.monthsPaid}/{group.duration} months</strong>
            </Typography>
          </Box>

          <LinearProgress
            variant="determinate"
            value={group.progress}
            sx={{
              height: 6,
              borderRadius: 4,
              bgcolor: brand.mist,
              '& .MuiLinearProgress-bar': { bgcolor: brand.gold, borderRadius: 4 },
            }}
          />
          <Typography variant="caption" color="text.secondary">{group.progress}% complete</Typography>
        </Surface>
      ))}
    </PageShell>
  );
};

export default TotalInvestment;
