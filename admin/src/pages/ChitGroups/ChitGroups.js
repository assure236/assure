import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Card, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Chip,
  TextField, InputAdornment, Button, CircularProgress, Alert,
  IconButton, Tooltip, LinearProgress, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Edit as EditIcon,
  Pause as PauseIcon, PlayArrow as ResumeIcon, Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const statusColors = { not_started: 'warning', active: 'success', vacant: 'info', completed: 'default', suspended: 'error', pending: 'warning', accepting_members: 'info' };

const ChitGroups = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, group: null, action: '' });

  useEffect(() => { fetchGroups(); }, [page, rowsPerPage, search]);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: page + 1, limit: rowsPerPage });
      if (search) params.append('search', search);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/chit-groups?${params}`);
      if (res.data.success) {
        setGroups(res.data.data?.chit_groups || []);
        setTotal(res.data.data?.total || 0);
      }
    } catch (err) {
      setError('Could not load chit groups.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusAction = async () => {
    const { group, action } = confirmDialog;
    let newStatus;
    if (action === 'start') newStatus = 'active';
    else if (action === 'suspend') newStatus = 'suspended';
    else newStatus = 'active';
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/admin/chit-groups/${group._id || group.id}`, { status: newStatus });
      const label = action === 'start' ? 'started' : newStatus === 'active' ? 'activated' : 'suspended';
      toast.success(`Group ${label} successfully`);
      setConfirmDialog({ open: false, group: null, action: '' });
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Typography variant="h4">Chit Groups</Typography>
        <Box display="flex" gap={2}>
          <TextField
            size="small" placeholder="Search groups…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ width: 250 }}
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/chit-groups/create')}>
            New Group
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ borderRadius: 3 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    {['Group', 'Chit Value', 'Monthly', 'Members', 'Progress', 'Status', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map(g => {
                    const progress = g.duration_months > 0 ? Math.round(((g.current_month || 0) / g.duration_months) * 100) : 0;
                    return (
                      <TableRow key={g._id || g.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{g.group_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{g.group_number}</Typography>
                        </TableCell>
                        <TableCell>₹{Number(g.chit_value || 0).toLocaleString('en-IN')}</TableCell>
                        <TableCell>₹{Number(g.monthly_installment || 0).toLocaleString('en-IN')}</TableCell>
                        <TableCell>{g.memberCount ?? '—'}/{g.total_members || '—'}</TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <Box>
                            <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
                            <Typography variant="caption">{g.current_month || 0}/{g.duration_months}m</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={g.status?.replace('_', ' ')} size="small"
                            color={statusColors[g.status] || 'default'}
                            sx={{ textTransform: 'capitalize' }} />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="View">
                            <IconButton size="small" onClick={() => navigate(`/chit-groups/${g._id || g.id}`)}><ViewIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          {g.status === 'not_started' && (
                            <Tooltip title="Start Chit">
                              <IconButton size="small" color="success"
                                onClick={() => setConfirmDialog({ open: true, group: g, action: 'start' })}>
                                <ResumeIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {g.status !== 'not_started' && (
                            <Tooltip title={g.status === 'active' ? 'Suspend' : 'Activate'}>
                              <IconButton size="small"
                                color={g.status === 'active' ? 'error' : 'success'}
                                onClick={() => setConfirmDialog({ open: true, group: g, action: g.status === 'active' ? 'suspend' : 'activate' })}>
                                {g.status === 'active' ? <PauseIcon fontSize="small" /> : <ResumeIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div" count={total} page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </>
        )}
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, group: null, action: '' })}>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to {confirmDialog.action} <strong>{confirmDialog.group?.group_name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, group: null, action: '' })}>Cancel</Button>
          <Button variant="contained" color={confirmDialog.action === 'suspend' ? 'error' : 'success'}
            onClick={handleStatusAction}>
            {confirmDialog.action === 'suspend' ? 'Suspend' : 'Activate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ChitGroups;

