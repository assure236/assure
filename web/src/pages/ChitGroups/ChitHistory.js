import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useActiveMember } from '../../context/ActiveMemberContext';

const ChitHistory = () => {
  const navigate = useNavigate();
  const { status } = useParams();

  const validStatus = status === 'completed' || status === 'cancelled' ? status : 'completed';
  const title = validStatus === 'completed' ? 'Completed Chits' : 'Cancelled Chits';
  const iconColor = validStatus === 'completed' ? 'success.main' : 'text.secondary';

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
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">{title}</Typography>
        <Button variant="outlined" onClick={() => navigate('/chit-groups')}>Back to Chit Groups</Button>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {groups.length === 0 ? (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ textAlign: 'center', py: 7 }}>
            {validStatus === 'completed' ? (
              <CheckCircleOutlineIcon sx={{ fontSize: 56, color: 'grey.300' }} />
            ) : (
              <CancelOutlinedIcon sx={{ fontSize: 56, color: 'grey.300' }} />
            )}
            <Typography color="text.secondary" mt={1}>No {title.toLowerCase()} found.</Typography>
            <Typography variant="caption" color="text.secondary">Your {validStatus} chit groups will appear here.</Typography>
          </CardContent>
        </Card>
      ) : groups.map((group, index) => (
        <Card
          key={String(group._id || group.id || index)}
          sx={{
            borderRadius: 3,
            mb: 1.5,
            border: '1px solid #E2E8F0',
            cursor: 'pointer',
          }}
          onClick={() => navigate(`/chit-groups/${group._id || group.id}`)}
        >
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography fontWeight={700}>{group.group_name}</Typography>
                <Typography variant="caption" color="text.secondary">{group.group_number}</Typography>
              </Box>
              <Chip
                label={validStatus.toUpperCase()}
                size="small"
                sx={{ color: iconColor, bgcolor: validStatus === 'completed' ? '#DCFCE7' : '#F1F5F9', fontWeight: 700 }}
              />
            </Box>
          </CardContent>
        </Card>
      ))}
    </Container>
  );
};

export default ChitHistory;
