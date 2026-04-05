import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Box, Card, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Chip,
  TextField, InputAdornment, Button, CircularProgress, Alert,
  Avatar, IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, Divider, Tabs, Tab, List, ListItem,
  ListItemText, ListItemAvatar
} from '@mui/material';
import {
  Search as SearchIcon, Visibility as ViewIcon,
  PersonOff as BanIcon, PersonAdd as UnbanIcon,
  VerifiedUser as KycIcon, Payment as PaymentIcon,
  Group as GroupIcon, Description as DocIcon,
  DeleteOutline as ClearIcon, Edit as EditIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

const kycColors = { verified: 'success', pending: 'warning', rejected: 'error' };

const Users = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [kycDialog, setKycDialog] = useState({ open: false, user: null });

  const openDetail = async (user) => {
    setSelectedUser(user);
    setDetailTab(0);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/users/${user._id || user.id}`);
      if (res.data.success) {
        const { user: userData, memberships, documents, recentPayments } = res.data.data;
        setDetailData({ ...userData, memberships: memberships || [], documents: documents || [], recentPayments: recentPayments || [], groupSchedules: res.data.data.groupSchedules || [] });
      }
    } catch {
      toast.error('Could not load member details');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page, rowsPerPage, search]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: page + 1, limit: rowsPerPage });
      if (search) params.append('search', search);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/users?${params}`);
      if (res.data.success) {
        setUsers(res.data.data?.users || []);
        setTotal(res.data.data?.total || 0);
      }
    } catch (err) {
      setError('Could not load users.');
    } finally {
      setLoading(false);
    }
  };

  const handleKycAction = async (userId, action) => {
    try {
      const res = await axios.put(`${process.env.REACT_APP_API_URL}/admin/users/${userId}`, { kyc_status: action });
      if (res.data.success) {
        toast.success(`KYC ${action} successfully!`);
        setKycDialog({ open: false, user: null });
        fetchUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/admin/users/${userId}/toggle-status`);
      toast.success('User status toggled');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Users</Typography>
        <TextField
          size="small" placeholder="Search by name or phone…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 280 }}
        />
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
                    {['User', 'Phone', 'KYC', 'Credit Score', 'Status', 'Joined', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u._id || u.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'primary.main' }}>
                            {(u.full_name || 'U')[0].toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" fontWeight={500}>{u.full_name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{u.mobile}</TableCell>
                      <TableCell>
                        <Chip label={u.kyc_status || 'pending'} size="small"
                          color={kycColors[u.kyc_status] || 'default'}
                          sx={{ textTransform: 'capitalize', cursor: 'pointer' }}
                          onClick={() => setKycDialog({ open: true, user: u })} />
                      </TableCell>
                      <TableCell>{u.credit_score ?? '—'}</TableCell>
                      <TableCell>
                        <Chip label={u.is_active ? 'Active' : 'Inactive'} size="small"
                          color={u.is_active ? 'success' : 'error'}
                          sx={{ textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => openDetail(u)}><ViewIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title={u.is_active !== false ? 'Suspend User' : 'Activate User'}>
                          <IconButton size="small" color={u.is_active !== false ? 'error' : 'success'}
                            onClick={() => handleToggleStatus(u._id || u.id)}>
                            {u.is_active !== false ? <BanIcon fontSize="small" /> : <UnbanIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
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

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onClose={() => setSelectedUser(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
              {(selectedUser?.full_name || 'U')[0].toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6">{selectedUser?.full_name}</Typography>
              <Typography variant="caption" color="text.secondary">{selectedUser?.member_id || selectedUser?.mobile}</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Profile" />
          <Tab label="Payments" />
          <Tab label="Chit Groups" />
          <Tab label="Documents" />
        </Tabs>
        <DialogContent sx={{ minHeight: 300, pt: 2 }}>
          {detailLoading ? (
            <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
          ) : detailData ? (
            <>
              {/* Profile Tab */}
              {detailTab === 0 && (
                <Grid container spacing={1.5}>
                  {[
                    { label: 'Full Name', value: detailData.full_name, field: 'full_name' },
                    { label: 'Phone', value: detailData.mobile },
                    { label: 'Email', value: detailData.email || '—', field: 'email' },
                    { label: 'KYC Status', value: detailData.kyc_status },
                    { label: 'Credit Score', value: detailData.credit_score ?? '—' },
                    { label: 'Referral Code', value: detailData.referral_code || '—' },
                    { label: 'Status', value: detailData.is_active ? 'Active' : 'Inactive' },
                    { label: 'PAN', value: detailData.pan_number || '—', field: 'pan_number' },
                    { label: 'Aadhaar', value: detailData.aadhaar_number ? '****' + detailData.aadhaar_number.slice(-4) : '—', field: 'aadhaar_number' },
                    { label: 'City', value: detailData.city || '—', field: 'city' },
                    { label: 'State', value: detailData.state || '—', field: 'state' },
                    { label: 'Joined', value: detailData.created_at ? new Date(detailData.created_at).toLocaleDateString('en-IN') : '—' },
                  ].map(({ label, value, field }) => (
                    <Grid item xs={6} key={label}>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="caption" color="text.secondary">{label}</Typography>
                          <Typography variant="body2" fontWeight={500} sx={{ textTransform: 'capitalize' }}>{value}</Typography>
                        </Box>
                        {field && (
                          <Box display="flex" gap={0.5}>
                            <Tooltip title={`Edit ${label}`}>
                              <IconButton size="small" color="primary" onClick={() => {
                                const currentVal = field === 'aadhaar_number' ? (detailData.aadhaar_number || '') : (value === '—' ? '' : String(value));
                                const newVal = window.prompt(`Edit ${label}:`, currentVal);
                                if (newVal === null) return;
                                if (newVal.trim() === '') {
                                  toast.error(`${label} cannot be empty. Use the delete button to clear.`);
                                  return;
                                }
                                (async () => {
                                  try {
                                    await axios.put(`${process.env.REACT_APP_API_URL}/admin/users/${selectedUser._id || selectedUser.id}`, { [field]: newVal.trim() });
                                    toast.success(`${label} updated`);
                                    openDetail(selectedUser);
                                  } catch (e) { toast.error('Failed to update field'); }
                                })();
                              }}><EditIcon fontSize="small" /></IconButton>
                            </Tooltip>
                            {value !== '—' && (
                              <Tooltip title={`Clear ${label}`}>
                                <IconButton size="small" color="error" onClick={async () => {
                                  if (!window.confirm(`Clear ${label} for this user?`)) return;
                                  try {
                                    await axios.put(`${process.env.REACT_APP_API_URL}/admin/users/${selectedUser._id || selectedUser.id}`, { clear_fields: [field] });
                                    toast.success(`${label} cleared`);
                                    openDetail(selectedUser);
                                  } catch (e) { toast.error('Failed to clear field'); }
                                }}><ClearIcon fontSize="small" /></IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
              {/* Payments Tab - Full Schedule per Group */}
              {detailTab === 1 && (
                detailData.groupSchedules?.length === 0 ? (
                  <Box textAlign="center" py={4}><PaymentIcon sx={{ fontSize: 48, color: 'grey.300' }} /><Typography color="text.secondary">No payment schedule found</Typography></Box>
                ) : (
                  detailData.groupSchedules.map(gs => (
                    <Box key={gs.group_id} sx={{ mb: 3 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle1" fontWeight={700}>{gs.group_name} <Typography component="span" variant="caption" color="text.secondary">({gs.group_number})</Typography></Typography>
                        <Box display="flex" gap={1}>
                          <Chip label={`${gs.paid_count}/${gs.total_months} Paid`} size="small" color="success" variant="outlined" />
                          {gs.overdue_count > 0 && <Chip label={`${gs.overdue_count} Overdue`} size="small" color="error" variant="outlined" />}
                          <Chip label={`₹${Number(gs.total_paid).toLocaleString('en-IN')} paid`} size="small" />
                        </Box>
                      </Box>
                      <Table size="small">
                        <TableHead><TableRow>
                          {['Month', 'Due Date', 'Base Amt', 'Dividend', 'Net Amount', 'Status'].map(h => <TableCell key={h} sx={{ fontWeight: 700, py: 0.5 }}>{h}</TableCell>)}
                        </TableRow></TableHead>
                        <TableBody>
                          {gs.schedule.map(s => (
                            <TableRow key={s.month_number} sx={{ bgcolor: s.status === 'overdue' ? 'error.50' : s.status === 'paid' ? 'success.50' : 'transparent' }}>
                              <TableCell sx={{ py: 0.5 }}>Month {s.month_number}</TableCell>
                              <TableCell sx={{ py: 0.5 }}>{new Date(s.due_date).toLocaleDateString('en-IN')}</TableCell>
                              <TableCell sx={{ py: 0.5 }}>₹{Number(s.base_amount).toLocaleString('en-IN')}</TableCell>
                              <TableCell sx={{ py: 0.5, color: s.dividend_reduction > 0 ? 'success.main' : 'text.secondary' }}>
                                {s.dividend_reduction > 0 ? `-₹${Number(s.dividend_reduction).toLocaleString('en-IN')}` : '—'}
                              </TableCell>
                              <TableCell sx={{ py: 0.5, fontWeight: 600 }}>₹{Number(s.amount).toLocaleString('en-IN')}</TableCell>
                              <TableCell sx={{ py: 0.5 }}>
                                <Chip label={s.status} size="small"
                                  color={s.status === 'paid' ? 'success' : s.status === 'overdue' ? 'error' : 'default'}
                                  sx={{ textTransform: 'capitalize' }} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <Divider sx={{ mt: 2 }} />
                    </Box>
                  ))
                )
              )}
              {/* Chit Groups Tab */}
              {detailTab === 2 && (
                detailData.memberships?.length === 0 ? (
                  <Box textAlign="center" py={4}><GroupIcon sx={{ fontSize: 48, color: 'grey.300' }} /><Typography color="text.secondary">Not enrolled in any group</Typography></Box>
                ) : (
                  <List>
                    {(detailData.memberships || []).map(m => (
                      <ListItem key={m._id || m.id} divider>
                        <ListItemAvatar><Avatar sx={{ bgcolor: 'primary.light' }}><GroupIcon /></Avatar></ListItemAvatar>
                        <ListItemText
                          primary={m.chit_group_id?.group_name || 'Unknown Group'}
                          secondary={`${m.chit_group_id?.group_number} • ₹${Number(m.chit_group_id?.chit_value || 0).toLocaleString('en-IN')} • ${m.chit_group_id?.status}`}
                        />
                        <Chip label={m.is_active ? 'Active' : 'Inactive'} size="small" color={m.is_active ? 'success' : 'default'} />
                      </ListItem>
                    ))}
                  </List>
                )
              )}
              {/* Documents Tab */}
              {detailTab === 3 && (
                detailData.documents?.length === 0 ? (
                  <Box textAlign="center" py={4}><DocIcon sx={{ fontSize: 48, color: 'grey.300' }} /><Typography color="text.secondary">No documents uploaded</Typography></Box>
                ) : (
                  <Table size="small">
                    <TableHead><TableRow>
                      {['Type', 'File', 'Status', 'Uploaded'].map(h => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
                    </TableRow></TableHead>
                    <TableBody>
                      {(detailData.documents || []).map(d => (
                        <TableRow key={d._id || d.id}>
                          <TableCell sx={{ textTransform: 'capitalize' }}>{d.document_type?.replace(/_/g, ' ')}</TableCell>
                          <TableCell>
                            <Button size="small" href={d.file_url} target="_blank" rel="noopener noreferrer">View</Button>
                          </TableCell>
                          <TableCell><Chip label={d.status || 'pending'} size="small" color={d.status === 'approved' ? 'success' : d.status === 'rejected' ? 'error' : 'warning'} /></TableCell>
                          <TableCell>{new Date(d.created_at).toLocaleDateString('en-IN')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              )}
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          {selectedUser?.kyc_status === 'pending' && (
            <>
              <Button color="success" onClick={() => { handleKycAction(selectedUser._id || selectedUser.id, 'verified'); setSelectedUser(null); }}>Approve KYC</Button>
              <Button color="error" onClick={() => { handleKycAction(selectedUser._id || selectedUser.id, 'rejected'); setSelectedUser(null); }}>Reject KYC</Button>
            </>
          )}
          <Button onClick={() => setSelectedUser(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* KYC Quick Action Dialog */}
      <Dialog open={kycDialog.open} onClose={() => setKycDialog({ open: false, user: null })} maxWidth="xs" fullWidth>
        <DialogTitle>KYC Action — {kycDialog.user?.full_name}</DialogTitle>
        <DialogContent>
          <Typography>Current status: <strong>{kycDialog.user?.kyc_status}</strong></Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKycDialog({ open: false, user: null })}>Cancel</Button>
          <Button color="error" onClick={() => handleKycAction(kycDialog.user?._id || kycDialog.user?.id, 'rejected')}>Reject</Button>
          <Button color="success" variant="contained" onClick={() => handleKycAction(kycDialog.user?._id || kycDialog.user?.id, 'verified')}>Approve</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Users;

