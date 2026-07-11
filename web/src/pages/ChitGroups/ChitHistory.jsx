import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { brand } from '../../theme/brand';
import { PageShell, PageHeader, Surface, EmptyState } from '../../components/ui/PageKit';

const ChitHistory = () => {
  const navigate = useNavigate();
  const { status } = useParams();

  const validStatus = status === 'completed' || status === 'cancelled' ? status : 'completed';
  const title = validStatus === 'completed' ? 'Completed Chits' : 'Cancelled Chits';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const { refreshKey } = useActiveMember();

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get('/users/my-chit-groups');
        if (!res.data?.success) {
          setError('Could not load chit history.');
          return;
        }
        setRows(res.data.data || []);
      } catch {
        setError('Could not load chit history.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [refreshKey]);

  const groups = useMemo(() => {
    return rows
      .map((membership) => membership.chit_group_id)
      .filter(Boolean)
      .filter((group) => String(group.status || '').toLowerCase() === validStatus);
  }, [rows, validStatus]);

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
        eyebrow="Chit groups"
        title={title}
        subtitle={`Your ${validStatus} chit group memberships`}
        actions={(
          <Button variant="outlined" onClick={() => navigate('/chit-groups')}>
            Back to Chit Groups
          </Button>
        )}
      />

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {groups.length === 0 ? (
        <Surface>
          <EmptyState
            icon={validStatus === 'completed' ? <CheckCircleOutlineIcon /> : <CancelOutlinedIcon />}
            title={`No ${title.toLowerCase()} found`}
            description={`Your ${validStatus} chit groups will appear here.`}
            actionLabel="Browse Chit Groups"
            onAction={() => navigate('/chit-groups')}
          />
        </Surface>
      ) : groups.map((group, index) => (
        <Surface
          key={String(group._id || group.id || index)}
          sx={{ mb: 1.5, cursor: 'pointer' }}
          onClick={() => navigate(`/chit-groups/${group._id || group.id}`)}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography fontWeight={700} sx={{ color: brand.navy }}>{group.group_name}</Typography>
              <Typography variant="caption" color="text.secondary">{group.group_number}</Typography>
            </Box>
            <Chip
              label={validStatus.toUpperCase()}
              size="small"
              sx={{
                color: validStatus === 'completed' ? brand.success : brand.muted,
                bgcolor: validStatus === 'completed' ? 'rgba(21,128,61,0.08)' : brand.mist,
                fontWeight: 700,
              }}
            />
          </Box>
        </Surface>
      ))}
    </PageShell>
  );
};

export default ChitHistory;
