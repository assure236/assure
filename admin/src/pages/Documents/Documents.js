import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, CircularProgress, IconButton, Tooltip, Tabs, Tab, Avatar,
  Grid, Card, CardContent
} from '@mui/material';
import {
  CheckCircle, Cancel, Visibility, Refresh, AssignmentTurnedIn,
  PendingActions, Block, Delete
} from '@mui/icons-material';
import axios from 'axios';

const DOC_TYPES = ['all', 'aadhaar_card', 'pan_card', 'cancelled_cheque', 'selfie_photo'];
const STATUSES = ['all', 'pending', 'approved', 'rejected'];

export default function Documents() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [docFilter, setDocFilter] = useState('all');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [verifyDialog, setVerifyDialog] = useState({ open: false, doc: null, action: '' });
  const [remarks, setRemarks] = useState('');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, doc: null });

  const statusFromTab = ['all', 'pending', 'approved', 'rejected'];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/documents`, {
        params: { page: page + 1, limit: 20, status: statusFromTab[tabIndex], doc_type: docFilter }
      });
      setRows(res.data.data || []);
      setTotal(res.data.total || 0);
      // Also load stats
      const [pe, ap, re] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/admin/documents`, { params: { limit: 1, status: 'pending' } }),
        axios.get(`${process.env.REACT_APP_API_URL}/admin/documents`, { params: { limit: 1, status: 'approved' } }),
        axios.get(`${process.env.REACT_APP_API_URL}/admin/documents`, { params: { limit: 1, status: 'rejected' } }),
      ]);
      setStats({ pending: pe.data.total || 0, approved: ap.data.total || 0, rejected: re.data.total || 0 });
    } catch (e) {
      setError('Failed to load documents');
    } finally { setLoading(false); }
  }, [page, tabIndex, docFilter]); // eslint-disable-line

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVerify = async () => {
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/admin/documents/${verifyDialog.doc._id || verifyDialog.doc.id}/verify`, {
        status: verifyDialog.action,
        remarks
      });
      setSuccess(`Document ${verifyDialog.action} successfully`);
      setVerifyDialog({ open: false, doc: null, action: '' });
      setRemarks('');
      fetchData();
    } catch (e) { setError('Failed to update document status'); }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/admin/documents/${deleteDialog.doc._id || deleteDialog.doc.id}`);
      setSuccess('Document deleted. User will need to re-upload.');
      setDeleteDialog({ open: false, doc: null });
      fetchData();
    } catch (e) { setError('Failed to delete document'); }
  };

  const statusColor = (s) => ({ approved: 'success', rejected: 'error', pending: 'warning' }[s] || 'default');

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Document & KYC Management</Typography>
        <Button startIcon={<Refresh />} onClick={fetchData} variant="outlined">Refresh</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Pending Review', value: stats.pending, color: '#f57c00', icon: <PendingActions /> },
          { label: 'Approved', value: stats.approved, color: '#388e3c', icon: <AssignmentTurnedIn /> },
          { label: 'Rejected', value: stats.rejected, color: '#d32f2f', icon: <Block /> },
        ].map((c, i) => (
          <Grid item xs={4} key={i}>
            <Card sx={{ borderTop: `4px solid ${c.color}`, cursor: 'pointer' }}
              onClick={() => setTabIndex(i + 1)}>
              <CardContent sx={{ py: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                    <Typography variant="h5" fontWeight={700}>{c.value}</Typography>
                  </Box>
                  <Box sx={{ color: c.color }}>{c.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2 }}>
          <Tabs value={tabIndex} onChange={(_, v) => { setTabIndex(v); setPage(0); }}>
            <Tab label="All" />
            <Tab label={`Pending (${stats.pending})`} />
            <Tab label="Approved" />
            <Tab label="Rejected" />
          </Tabs>
          <TextField select label="Doc Type" size="small" value={docFilter} sx={{ minWidth: 160, my: 1 }}
            onChange={e => { setDocFilter(e.target.value); setPage(0); }}>
            {DOC_TYPES.map(t => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t.replace('_', ' ')}</MenuItem>)}
          </TextField>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Preview', 'Member', 'KYC Status', 'Document Type', 'Status', 'Uploaded', 'Notes', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>No documents found</TableCell></TableRow>
                  ) : rows.map(row => (
                    <TableRow key={row._id || row.id} hover>
                      <TableCell sx={{ width: 60 }}>
                        {row.file_url ? (
                          <Box component="img" src={row.file_url} alt="doc"
                            sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1, cursor: 'pointer', border: '1px solid #e0e0e0' }}
                            onClick={() => setPreviewDoc(row)} />
                        ) : (
                          <Avatar variant="rounded" sx={{ width: 48, height: 48, bgcolor: 'grey.200' }}>
                            <Visibility fontSize="small" color="disabled" />
                          </Avatar>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 30, height: 30, bgcolor: 'primary.main', fontSize: 12 }}>
                            {(row.user_id?.full_name || '?')[0].toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>{row.user_id?.full_name || '-'}</Typography>
                            <Typography variant="caption" color="text.secondary">{row.user_id?.mobile}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={row.user_id?.kyc_status || 'unknown'} size="small"
                          color={row.user_id?.kyc_status === 'verified' ? 'success' : row.user_id?.kyc_status === 'rejected' ? 'error' : 'warning'} />
                      </TableCell>
                      <TableCell>
                        <Chip label={(row.document_type || '-').replace('_', ' ')} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell>
                        <Chip label={row.verification_status || 'pending'} size="small" color={statusColor(row.verification_status)} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{row.notes || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {row.file_url && (
                            <Tooltip title="Preview Document">
                              <IconButton size="small" onClick={() => setPreviewDoc(row)}>
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {row.verification_status !== 'approved' && (
                            <Tooltip title="Approve">
                              <IconButton size="small" color="success"
                                onClick={() => setVerifyDialog({ open: true, doc: row, action: 'approved' })}>
                                <CheckCircle fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {row.verification_status !== 'rejected' && (
                            <Tooltip title="Reject">
                              <IconButton size="small" color="error"
                                onClick={() => setVerifyDialog({ open: true, doc: row, action: 'rejected' })}>
                                <Cancel fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Delete Document">
                            <IconButton size="small" color="error"
                              onClick={() => setDeleteDialog({ open: true, doc: row })}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div" count={total} page={page} rowsPerPage={20} rowsPerPageOptions={[20]}
              onPageChange={(_, v) => setPage(v)}
            />
          </>
        )}
      </Paper>

      {/* Verify Dialog */}
      <Dialog open={verifyDialog.open} onClose={() => setVerifyDialog({ open: false, doc: null, action: '' })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: verifyDialog.action === 'approved' ? 'success.main' : 'error.main' }}>
          {verifyDialog.action === 'approved' ? 'Approve Document' : 'Reject Document'}
        </DialogTitle>
        <DialogContent>
          {verifyDialog.doc && (
            <Box>
              <Typography gutterBottom>Member: <strong>{verifyDialog.doc.user_id?.full_name || '—'}</strong></Typography>
              <Typography gutterBottom>Mobile: <strong>{verifyDialog.doc.user_id?.mobile || '—'}</strong></Typography>
              <Typography gutterBottom>Document: <strong>{(verifyDialog.doc.document_type || '').replace(/_/g, ' ')}</strong></Typography>
              {verifyDialog.doc.file_url && (
                <Box component="img" src={verifyDialog.doc.file_url} alt="doc"
                  sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 1, mt: 1, mb: 1, border: '1px solid #e0e0e0' }} />
              )}
              <TextField
                label="Remarks (optional)" multiline rows={3} fullWidth size="small" sx={{ mt: 2 }}
                value={remarks} onChange={e => setRemarks(e.target.value)}
                placeholder={verifyDialog.action === 'rejected' ? 'Reason for rejection...' : 'Approval notes...'}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerifyDialog({ open: false, doc: null, action: '' })}>Cancel</Button>
          <Button onClick={handleVerify} variant="contained"
            color={verifyDialog.action === 'approved' ? 'success' : 'error'}>
            {verifyDialog.action === 'approved' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onClose={() => setPreviewDoc(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ textTransform: 'capitalize' }}>
          Document Preview — {previewDoc?.document_type?.replace(/_/g, ' ')}
          {previewDoc?.user_id?.full_name && (
            <Typography variant="body2" color="text.secondary">
              {previewDoc.user_id.full_name} • {previewDoc.user_id.mobile || ''}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {previewDoc?.file_url ? (
            previewDoc.mime_type === 'application/pdf' ? (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', height: 500 }}>
                <iframe src={previewDoc.file_url} title="doc" width="100%" height="100%" style={{ border: 0 }} />
              </Box>
            ) : (
              <Box component="img" src={previewDoc.file_url}
                alt="document" sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 1 }} />
            )
          ) : (
            <Typography color="text.secondary">No file available for preview</Typography>
          )}
          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip label={previewDoc?.verification_status || 'pending'} size="small"
              color={statusColor(previewDoc?.verification_status)} />
            <Typography variant="caption" color="text.secondary">
              Uploaded: {previewDoc?.created_at ? new Date(previewDoc.created_at).toLocaleDateString('en-IN') : '—'}
            </Typography>
            {previewDoc?.uploaded_from && (
              <Typography variant="caption" color="text.secondary">Source: {previewDoc.uploaded_from}</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          {previewDoc?.file_url && (
            <Button onClick={() => window.open(previewDoc.file_url, '_blank')}>Open in New Tab</Button>
          )}
          <Button onClick={() => setPreviewDoc(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, doc: null })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>Delete Document</DialogTitle>
        <DialogContent>
          {deleteDialog.doc && (
            <Box>
              <Typography gutterBottom>
                Are you sure you want to delete this <strong>{(deleteDialog.doc.document_type || '').replace(/_/g, ' ')}</strong> document?
              </Typography>
              <Typography gutterBottom>
                Member: <strong>{deleteDialog.doc.user_id?.full_name || '—'}</strong> ({deleteDialog.doc.user_id?.mobile || '—'})
              </Typography>
              <Alert severity="warning" sx={{ mt: 1 }}>
                This will permanently remove the file from the database. The user will be asked to upload this document again.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, doc: null })}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
