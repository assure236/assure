import React, { useState, useEffect } from 'react';
import {
  Container, Grid, Card, CardContent, Typography, Box, Chip,
  CircularProgress, Button, Tabs, Tab, LinearProgress, Alert,
  Avatar, List, ListItem, ListItemAvatar, ListItemText, Divider,
  Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Checkbox, FormControlLabel,
  IconButton,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, CheckCircle as CheckIcon, Error as OverdueIcon, Schedule as PendingIcon, PersonAdd as JoinIcon, CreditCard as PayIcon, Close as CloseIcon, Payment as PaymentIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDisplayUser } from '../../hooks/useDisplayUser';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { ensureCashfreeSdk } from '../../utils/cashfreeSdk';

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const formatMonthYear = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const getUserId = (user) => String(user?.id || user?._id || '');

const ChitGroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useDisplayUser();
  const { refreshKey } = useActiveMember();
  const [tab, setTab] = useState(0);
  const [group, setGroup] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [banner, setBanner] = useState(null);
  const [confirmEnrollOpen, setConfirmEnrollOpen] = useState(false);
  const [gateDialog, setGateDialog] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [transferRecipientId, setTransferRecipientId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [payDialog, setPayDialog] = useState({ open: false, item: null });
  const [paying, setPaying] = useState(false);
  const [bidHistory, setBidHistory] = useState({ open: false, loading: false, auction: null, bids: [] });

  const openBidHistory = async (auction) => {
    const auctionId = auction?._id || auction?.id;
    setBidHistory({ open: true, loading: true, auction, bids: [] });
    if (!auctionId) {
      setBidHistory((s) => ({ ...s, loading: false }));
      return;
    }
    try {
      const res = await axios.get(`/auctions/${auctionId}/bids`);
      const rows = res.data?.success ? (res.data.data || []) : [];
      setBidHistory({ open: true, loading: false, auction, bids: Array.isArray(rows) ? rows : [] });
    } catch {
      setBidHistory({ open: true, loading: false, auction, bids: [] });
    }
  };

  useEffect(() => { fetchAll(); }, [id, refreshKey]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gRes, aRes, pRes] = await Promise.all([
        axios.get(`/chit-groups/${id}`),
        axios.get(`/chit-groups/${id}/auctions`).catch(() => ({ data: { success: false, data: [] } })),
        axios.get(`/chit-groups/${id}/payment-schedule`).catch(() => ({ data: { success: false, data: [] } })),
      ]);

      const groupData = gRes?.data?.success ? (gRes.data.data || null) : null;
      setGroup(groupData);
      setAuctions(aRes?.data?.success ? (aRes.data.data || []) : (groupData?.auctions || []));
      setPayments(pRes?.data?.success ? (pRes.data.data || []) : []);

      const members = Array.isArray(groupData?.members) ? groupData.members : [];
      const userId = getUserId(user);
      if (userId) {
        const isEnrolled = members.some((member) => {
          const memberUserId = String(member?.user_id?._id || member?.user_id || member?.user?._id || '');
          return memberUserId === userId;
        });
        setEnrolled(isEnrolled);
      } else {
        setEnrolled(false);
      }
    } catch (err) {
      setError('Could not load group details.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async (scheduleItem) => {
    if (!scheduleItem || paying) return;
    setPaying(true);
    try {
      const res = await axios.post('/payments/create-order', {
        chit_group_id: id,
        month_number: scheduleItem.month_number,
        amount: scheduleItem.amount,
        late_fee: 0,
      });
      if (!res.data.success) {
        toast?.error?.(res.data.message || 'Could not create payment order');
        setPaying(false);
        return;
      }
      const { payment_session_id, order_id, payment_id: newPaymentId } = res.data.data;
      if (payment_session_id) {
        try {
          await ensureCashfreeSdk();
          const cashfree = window.Cashfree({ mode: process.env.REACT_APP_CASHFREE_ENV || 'sandbox' });
          setPayDialog({ open: false, item: null });
          await cashfree.checkout({ paymentSessionId: payment_session_id, redirectTarget: '_modal' });
          const vRes = await axios.post('/payments/verify', { order_id, payment_id: newPaymentId });
          if (vRes.data.success && (vRes.data.data?.payment_status === 'success' || vRes.data.message === 'Already verified')) {
            toast?.success?.('Payment successful! ✓');
          }
          fetchAll();
        } catch (sdkErr) {
          toast?.error?.('Payment checkout failed.');
        }
      } else {
        toast?.warning?.('Cashfree gateway not configured. Contact admin.');
      }
    } catch (err) {
      toast?.error?.('Could not initiate payment.');
    } finally {
      setPaying(false);
    }
  };

  const ensureEnrollmentAllowed = async () => {
    try {
      const profileRes = await axios.get('/users/profile');
      if (profileRes?.data?.success !== true) return false;

      const profile = profileRes.data.data || {};
      const kycStatus = String(profile.kyc_status || '').toLowerCase();
      const profileStatus = String(profile.profile_edit_status || 'none').toLowerCase();

      if (kycStatus !== 'verified') {
        setGateDialog({
          title: 'KYC Required',
          message: 'Please complete KYC verification first. Group joining is enabled only after KYC is verified.',
          actionLabel: 'Go to KYC',
          actionPath: '/documents',
        });
        return false;
      }

      if (profileStatus === 'pending') {
        setGateDialog({
          title: 'Profile Under Review',
          message: 'Your profile is under admin review. You can join chit groups after final approval.',
          actionLabel: '',
          actionPath: '',
        });
        return false;
      }

      if (profileStatus !== 'approved') {
        setGateDialog({
          title: 'Profile Approval Required',
          message: 'Submit your profile details first. Group joining is available after admin final approval.',
          actionLabel: 'Complete Profile',
          actionPath: '/profile',
        });
        return false;
      }

      return true;
    } catch (_) {
      return false;
    }
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await axios.post(`/chit-groups/${id}/enroll`);
      if (res.data.success) {
        setEnrolled(true);
        setBanner({ type: 'success', message: res.data.message || 'Successfully joined the chit group!' });
        fetchAll();
      }
    } catch (err) {
      setBanner({ type: 'error', message: err.response?.data?.message || 'Failed to join group.' });
    } finally {
      setEnrolling(false);
    }
  };

  const submitTransferRequest = async () => {
    if (!transferRecipientId.trim() || !transferReason.trim()) {
      setBanner({ type: 'error', message: 'Recipient user ID and reason are required for transfer request.' });
      return;
    }

    setRequestSubmitting(true);
    try {
      const res = await axios.post('/chit-groups/transfer-request', {
        chit_group_id: id,
        recipient_member_id: transferRecipientId.trim(),
        reason: transferReason.trim(),
      });
      setBanner({
        type: res?.data?.success ? 'success' : 'error',
        message: res?.data?.message || (res?.data?.success ? 'Transfer request submitted.' : 'Transfer request failed.'),
      });
      if (res?.data?.success) {
        setTransferOpen(false);
        setTransferRecipientId('');
        setTransferReason('');
      }
    } catch (err) {
      setBanner({ type: 'error', message: err?.response?.data?.message || 'Failed to submit transfer request.' });
    } finally {
      setRequestSubmitting(false);
    }
  };

  const submitCancelRequest = async () => {
    if (!cancelReason.trim()) {
      setBanner({ type: 'error', message: 'Please provide cancellation reason.' });
      return;
    }
    if (!cancelConfirmed) {
      setBanner({ type: 'error', message: 'Please confirm cancellation terms before submitting.' });
      return;
    }

    setRequestSubmitting(true);
    try {
      const res = await axios.post('/chit-groups/cancel-request', {
        chit_group_id: id,
        reason: cancelReason.trim(),
      });
      setBanner({
        type: res?.data?.success ? 'success' : 'error',
        message: res?.data?.message || (res?.data?.success ? 'Cancellation request submitted.' : 'Cancellation request failed.'),
      });
      if (res?.data?.success) {
        setCancelOpen(false);
        setCancelReason('');
        setCancelConfirmed(false);
      }
    } catch (err) {
      setBanner({ type: 'error', message: err?.response?.data?.message || 'Failed to submit cancellation request.' });
    } finally {
      setRequestSubmitting(false);
    }
  };

  const openPsoLink = () => {
    const psoNo = group?.pso_number || group?.group_number || '';
    if (!psoNo) return;
    window.open(
      `https://tchits.telangana.gov.in/CHITS_Display_Approval_Details.htm?PSO_NO=${encodeURIComponent(psoNo)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  if (error || !group) return (
    <Container sx={{ py: 4 }}>
      <Alert severity="error">{error || 'Group not found.'}</Alert>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/chit-groups')} sx={{ mt: 2 }}>Back</Button>
    </Container>
  );

  const progress = group.duration_months > 0
    ? Math.round(((group.current_month || 0) / group.duration_months) * 100) : 0;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      {banner ? (
        <Alert severity={banner.type} sx={{ mb: 2 }} onClose={() => setBanner(null)}>
          {banner.message}
        </Alert>
      ) : null}

      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/chit-groups')} sx={{ mb: 2 }}>
        Back to Chit Groups
      </Button>

      {/* Header Card */}
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <Box sx={{ background: 'linear-gradient(135deg, #0B1F3B, #1E3A8A)', p: 3, color: 'white', borderRadius: '12px 12px 0 0' }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h5" fontWeight={700}>{group.group_name}</Typography>
              <Typography sx={{ opacity: 0.8 }}>{group.group_number}</Typography>
            </Box>
            <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
              <Chip label={group.status?.replace('_', ' ')}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, textTransform: 'capitalize' }} />
              {!enrolled && ['active', 'vacant'].includes(String(group.status || '').toLowerCase()) && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<JoinIcon />}
                  onClick={async () => {
                    const allowed = await ensureEnrollmentAllowed();
                    if (allowed) setConfirmEnrollOpen(true);
                  }}
                  disabled={enrolling}
                  sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' }, fontWeight: 700 }}
                >
                  {enrolling ? 'Joining…' : 'Join Group'}
                </Button>
              )}
              {enrolled && (
                <Chip label="✓ Enrolled" sx={{ bgcolor: 'success.main', color: 'white', fontWeight: 600 }} />
              )}
            </Box>
          </Box>

          <Box mt={1} mb={2}>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {group.group_name}
            </Typography>
          </Box>

          <Box mt={2}>
            <Box display="flex" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Progress</Typography>
              <Typography variant="caption">{group.current_month || 0} / {group.duration_months} months</Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress}
              sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { bgcolor: '#fff' } }} />
          </Box>
        </Box>
        <CardContent>
          <Grid container spacing={2}>
            {[
              { label: 'Chit Value', value: `₹${Number(group.chit_value || 0).toLocaleString('en-IN')}` },
              { label: 'Subscription', value: `₹${Number(group.monthly_installment || 0).toLocaleString('en-IN')}` },
              { label: 'Members', value: group.total_members || group.max_members || '—' },
              { label: 'Start Date', value: group.commencement_date ? new Date(group.commencement_date).toLocaleDateString('en-IN') : '—' },
            ].map(({ label, value }) => (
              <Grid item xs={6} sm={3} key={label}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography fontWeight={700}>{value}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Overview" />
        <Tab label="Prized Tickets" />
        <Tab label="Transactions" />
        <Tab label="More Info" />
      </Tabs>

      {/* Overview Tab */}
      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Group Information</Typography>
                <Divider sx={{ mb: 2 }} />
                {[
                  { label: 'Duration', value: `${group.duration_months} months` },
                  { label: 'Auction', value: 'Monthly' },
                  { label: 'PSO No.', value: group.pso_number || group.group_number || '—' },
                  { label: 'Current Month', value: group.current_month || 0 },
                  { label: 'Remaining Months', value: (group.duration_months || 0) - (group.current_month || 0) },
                  { label: 'Commenced from', value: formatMonthYear(group.commencement_date) },
                ].map(({ label, value }) => (
                  <Box key={label} display="flex" justifyContent="space-between" py={0.8}
                    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{value}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Your Position</Typography>
                <Divider sx={{ mb: 2 }} />
                {[
                  { label: 'Status', value: group.member_status?.replace('_', ' ') || 'Active' },
                  { label: 'Total Paid', value: formatCurrency(group.total_paid || 0) },
                  { label: 'Outstanding', value: formatCurrency(group.outstanding || 0) },
                  { label: 'Chit Received', value: group.chit_received ? 'Yes ✅' : 'No' },
                ].map(({ label, value }) => (
                  <Box key={label} display="flex" justifyContent="space-between" py={0.8}
                    sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>{value}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          {enrolled ? (
            <Grid item xs={12}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Membership Actions</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Submit transfer or cancellation requests for admin approval, similar to mobile flow.
                  </Typography>
                  <Box display="flex" gap={1.5} flexWrap="wrap">
                    <Button variant="outlined" onClick={() => setTransferOpen(true)}>
                      Transfer Chit
                    </Button>
                    <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)}>
                      Cancel Chit
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ) : null}
        </Grid>
      )}

      {/* Prized Tickets Tab */}
      {tab === 1 && (
        auctions.length === 0
          ? <Alert severity="info">No prized tickets yet. Winners will appear here after auctions.</Alert>
          : <Card sx={{ borderRadius: 3 }}>
            <List>
              {auctions.map((auction, i) => {
                const month = auction.month_number || i + 1;
                const winner = auction.winner_id?.full_name || 'Winner';
                const ticket = auction.winner_ticket_number || '-';
                const amount = formatCurrency(auction.winning_bid_amount || 0);
                return (
                <React.Fragment key={auction._id || `${month}-${ticket}-${i}`}>
                  <ListItem button onClick={() => openBidHistory(auction)}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>{ticket}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`Month ${month} — ${winner}`}
                      secondary={
                        <Typography component="span" variant="body2" color="primary" sx={{ textDecoration: 'underline' }}>
                          Ticket #{ticket} · View bid history
                        </Typography>
                      }
                    />
                    <Box textAlign="right">
                      <Typography variant="body2" fontWeight={700} color="text.primary">{amount}</Typography>
                      <Chip label="Winner" size="small" color="primary" variant="outlined" />
                    </Box>
                  </ListItem>
                  {i < auctions.length - 1 && <Divider inset="72px" />}
                </React.Fragment>
                );
              })}
            </List>
          </Card>
      )}

      {/* Schedule Tab */}
      {tab === 2 && (
        payments.length === 0
          ? <Alert severity="info">Payment schedule not available yet.</Alert>
          : <Card sx={{ borderRadius: 3 }}>
            <List>
              {payments.map((s, i) => {
                const isPaid = s.status === 'paid';
                const isOverdue = s.status === 'overdue';
                return (
                  <React.Fragment key={i}>
                    <ListItem>
                      <ListItemAvatar>
                        {isPaid
                          ? <Avatar sx={{ bgcolor: 'success.main' }}><CheckIcon /></Avatar>
                          : isOverdue
                          ? <Avatar sx={{ bgcolor: 'error.main' }}><OverdueIcon /></Avatar>
                          : <Avatar sx={{ bgcolor: 'grey.400' }}><PendingIcon /></Avatar>}
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box>
                            {`Month ${s.month_number} — ₹${Number(s.amount || 0).toLocaleString('en-IN')}`}
                            {s.dividend_reduction > 0 && (
                              <Typography component="span" variant="caption" color="success.main" sx={{ ml: 1 }}>
                                (₹{Number(s.dividend_reduction).toLocaleString('en-IN')} dividend applied)
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={s.due_date ? new Date(s.due_date).toLocaleDateString('en-IN') : '—'}
                      />
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          label={s.status || 'pending'}
                          size="small"
                          color={isPaid ? 'success' : isOverdue ? 'error' : 'default'}
                          sx={{ textTransform: 'capitalize' }}
                        />
                        {s.can_pay && (
                          <Button
                            size="small"
                            variant="contained"
                            color={isOverdue ? 'error' : 'primary'}
                            startIcon={<PayIcon />}
                            onClick={() => setPayDialog({ open: true, item: s })}
                          >
                            Pay Now
                          </Button>
                        )}
                      </Box>
                    </ListItem>
                    {i < payments.length - 1 && <Divider inset="72px" />}
                  </React.Fragment>
                );
              })}
            </List>
          </Card>
      )}

      {/* More Info Tab */}
      {tab === 3 && (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Documents & Certificates</Typography>
            <Divider sx={{ mb: 2 }} />
            {[
              { label: 'FDR Certificate', url: group.fdr_certificate_url },
              { label: 'PSO Certificate', url: group.pso_certificate_url },
              { label: 'Draft Agreement', url: group.draft_agreement_url },
              { label: 'Signed Agreement', url: group.signed_agreement_url },
            ].map((doc) => (
              <Box key={doc.label} display="flex" justifyContent="space-between" alignItems="center" py={1.2}
                sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2">{doc.label}</Typography>
                {doc.url ? (
                  <Button size="small" variant="outlined" href={doc.url} target="_blank" rel="noopener noreferrer">
                    View
                  </Button>
                ) : (
                  <Typography variant="caption" color="text.secondary">Not uploaded</Typography>
                )}
              </Box>
            ))}
            {(group.pso_number || group.group_number) ? (
              <Box mt={2}>
                <Button size="small" variant="text" onClick={openPsoLink} endIcon={<OpenInNewIcon fontSize="small" />}>
                  Open Telangana PSO portal
                </Button>
              </Box>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Dialog open={bidHistory.open} onClose={() => setBidHistory({ open: false, loading: false, auction: null, bids: [] })} maxWidth="sm" fullWidth>
        <DialogTitle>
          Bid History
          {bidHistory.auction ? ` — Ticket #${bidHistory.auction.winner_ticket_number || '—'}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          {bidHistory.loading ? (
            <Box display="flex" justifyContent="center" py={3}><CircularProgress size={28} /></Box>
          ) : bidHistory.bids.length === 0 ? (
            <Typography color="text.secondary">No bids found for this auction.</Typography>
          ) : (
            <List dense>
              {bidHistory.bids.map((b, i) => (
                <ListItem key={b._id || i} divider>
                  <ListItemText
                    primary={b.user_id?.full_name || b.member_name || 'Member'}
                    secondary={b.created_at ? new Date(b.created_at).toLocaleString('en-IN') : ''}
                  />
                  <Typography fontWeight={700}>{formatCurrency(b.bid_amount || b.amount)}</Typography>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBidHistory({ open: false, loading: false, auction: null, bids: [] })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Pay Now Dialog */}
      <Dialog open={payDialog.open} onClose={() => !paying && setPayDialog({ open: false, item: null })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Pay Installment
          {!paying && <IconButton size="small" onClick={() => setPayDialog({ open: false, item: null })}><CloseIcon /></IconButton>}
        </DialogTitle>
        <DialogContent>
          {payDialog.item && (
            <Box>
              <Typography variant="h4" textAlign="center" fontWeight={900} my={2} color="primary.main">
                ₹{Number(payDialog.item.amount || 0).toLocaleString('en-IN')}
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center" mb={2}>
                {group?.group_name} — Month {payDialog.item.month_number}
              </Typography>
              {payDialog.item.dividend_reduction > 0 && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Dividend of ₹{Number(payDialog.item.dividend_reduction).toLocaleString('en-IN')} applied. Base: ₹{Number(payDialog.item.base_amount).toLocaleString('en-IN')}
                </Alert>
              )}
              {payDialog.item.status === 'overdue' && (
                <Alert severity="warning" sx={{ mb: 2 }}>This payment is overdue. Late fee may apply.</Alert>
              )}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">Due Date</Typography>
                  <Typography variant="body2" fontWeight={600}>{payDialog.item.due_date ? new Date(payDialog.item.due_date).toLocaleDateString('en-IN') : '—'}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography fontWeight={700}>Total</Typography>
                  <Typography fontWeight={700} color="primary.main">₹{Number(payDialog.item.amount || 0).toLocaleString('en-IN')}</Typography>
                </Box>
              </Paper>
              <Alert severity="info" icon={<PaymentIcon />}>
                You will be redirected to Cashfree secure payment page.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog({ open: false, item: null })} disabled={paying}>Cancel</Button>
          <Button variant="contained" startIcon={paying ? <CircularProgress size={16} /> : <PayIcon />} onClick={() => handlePayNow(payDialog.item)} disabled={paying}>
            {paying ? 'Processing...' : 'Pay with Cashfree'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmEnrollOpen} onClose={() => setConfirmEnrollOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Enrollment</DialogTitle>
        <DialogContent>
          <Typography>
            Do you want to enroll in {group.group_name || 'this chit group'}?
            <br />
            <br />
            Monthly installment: {formatCurrency(group.monthly_installment || 0)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmEnrollOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={enrolling}
            onClick={async () => {
              setConfirmEnrollOpen(false);
              await handleEnroll();
            }}
          >
            Enroll
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(gateDialog)} onClose={() => setGateDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{gateDialog?.title || 'Action Required'}</DialogTitle>
        <DialogContent>
          <Typography>{gateDialog?.message || 'Unable to proceed.'}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGateDialog(null)}>Close</Button>
          {gateDialog?.actionLabel ? (
            <Button
              variant="contained"
              onClick={() => {
                const route = gateDialog.actionPath;
                setGateDialog(null);
                if (route) navigate(route);
              }}
            >
              {gateDialog.actionLabel}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <Dialog open={transferOpen} onClose={() => !requestSubmitting && setTransferOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Transfer Chit</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Submit a request to transfer this chit to another member.
          </Typography>
          <TextField
            fullWidth
            label="Recipient User ID"
            placeholder="Enter recipient user ID"
            value={transferRecipientId}
            onChange={(event) => setTransferRecipientId(event.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Reason for Transfer"
            placeholder="Explain why you want to transfer"
            value={transferReason}
            onChange={(event) => setTransferReason(event.target.value)}
            multiline
            minRows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferOpen(false)} disabled={requestSubmitting}>Cancel</Button>
          <Button variant="contained" onClick={submitTransferRequest} disabled={requestSubmitting}>
            {requestSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cancelOpen} onClose={() => !requestSubmitting && setCancelOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancel Chit</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Request cancellation of your chit membership. Admin approval is required.
          </Typography>
          <TextField
            fullWidth
            label="Reason for Cancellation"
            placeholder="Explain why you want to cancel"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            multiline
            minRows={4}
            sx={{ mt: 1 }}
          />
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox
                checked={cancelConfirmed}
                onChange={(event) => setCancelConfirmed(event.target.checked)}
              />
            }
            label="I understand cancellation terms and agree to proceed."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)} disabled={requestSubmitting}>Close</Button>
          <Button variant="contained" color="error" onClick={submitCancelRequest} disabled={requestSubmitting}>
            {requestSubmitting ? 'Submitting...' : 'Submit Cancellation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ChitGroupDetails;

