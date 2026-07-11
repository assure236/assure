import React, { useState, useEffect, useMemo } from 'react';
import {
  Grid, Typography, Box, Button, TextField,
  MenuItem, CircularProgress, Chip, Tabs, Tab, Divider, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress,
  InputAdornment, Checkbox, FormControlLabel
} from '@mui/material';
import {
  AccountBalance as LoanIcon,
  Send as ApplyIcon,
  History as HistoryIcon,
  CheckCircle as ApprovedIcon,
  HourglassEmpty as PendingIcon,
  Cancel as RejectedIcon,
  CurrencyRupee as RupeeIcon,
  CalendarMonth as CalendarIcon,
  Description as PurposeIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { securityLogger } from '../../utils/securityLogger';
import { toast } from 'react-toastify';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { PageShell, PageHeader, Surface, EmptyState, SectionTitle } from '../../components/ui/PageKit';
import { brand } from '../../theme/brand';

const STATUS_CONFIG = {
  requested: { label: 'Requested', color: 'info', icon: <PendingIcon fontSize="small" /> },
  under_review: { label: 'Under Review', color: 'warning', icon: <PendingIcon fontSize="small" /> },
  approved: { label: 'Approved', color: 'success', icon: <ApprovedIcon fontSize="small" /> },
  disbursed: { label: 'Disbursed', color: 'success', icon: <ApprovedIcon fontSize="small" /> },
  active: { label: 'Active', color: 'primary', icon: <LoanIcon fontSize="small" /> },
  closed: { label: 'Closed', color: 'default', icon: <ApprovedIcon fontSize="small" /> },
  rejected: { label: 'Rejected', color: 'error', icon: <RejectedIcon fontSize="small" /> },
};

const formatCurrency = (val) => {
  if (!val && val !== 0) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
};

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const Loans = () => {
  const [tab, setTab] = useState(0);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [detailLoan, setDetailLoan] = useState(null);

  // Application form
  const [form, setForm] = useState({
    loan_type: 'personal_loan',
    requested_amount: '',
    tenure_months: '',
    purpose: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const { refreshKey } = useActiveMember();

  useEffect(() => {
    fetchLoans();
  }, [refreshKey]);

  const fetchLoans = async () => {
    try {
      const res = await axios.get('/loans/my-loans');
      if (res.data.success) setLoans(res.data.data || []);
    } catch (err) {
      // SECURITY FIX: sanitize loan API error logging.
      securityLogger.error('Loans fetch failed', { status: err?.response?.status });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!form.requested_amount || !form.tenure_months) {
      toast.error('Please fill in amount and tenure');
      return;
    }
    if (!acceptedTerms) {
      toast.error('Please accept Terms & Conditions to continue');
      return;
    }
    if (Number(form.requested_amount) < 1000) {
      toast.error('Minimum loan amount is ₹1,000');
      return;
    }
    if (Number(form.tenure_months) < 1 || Number(form.tenure_months) > 60) {
      toast.error('Tenure must be between 1 and 60 months');
      return;
    }

    setApplying(true);
    try {
      const payload = {
        loan_type: 'personal_loan',
        requested_amount: Number(form.requested_amount),
        tenure_months: Number(form.tenure_months),
        purpose: form.purpose,
      };
      const res = await axios.post('/loans/apply', payload);
      if (res.data.success) {
        toast.success('Loan application submitted successfully!');
        setForm({ loan_type: 'personal_loan', requested_amount: '', tenure_months: '', purpose: '' });
        setAcceptedTerms(false);
        fetchLoans();
        setTab(1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit loan application');
    } finally {
      setApplying(false);
    }
  };

  const hasActiveLoan = useMemo(() => {
    return loans.some(l => ['requested', 'under_review', 'approved', 'disbursed', 'active'].includes(l.status));
  }, [loans]);

  const activeLoans = useMemo(() => loans.filter(l => ['requested', 'under_review', 'approved', 'disbursed', 'active'].includes(l.status)), [loans]);
  const pastLoans = useMemo(() => loans.filter(l => ['closed', 'rejected'].includes(l.status)), [loans]);

  // EMI Calculator (simple estimate)
  const estimatedEMI = useMemo(() => {
    const P = Number(form.requested_amount);
    const N = Number(form.tenure_months);
    if (!P || !N || P < 1000 || N < 1) return null;
    const r = 12 / 100 / 12; // Assume 12% annual rate
    const emi = P * r * Math.pow(1 + r, N) / (Math.pow(1 + r, N) - 1);
    return Math.round(emi);
  }, [form.requested_amount, form.tenure_months]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Credit"
        title="Loans"
        subtitle="Apply for a loan or track your existing applications"
      />

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3, '& .MuiTab-root': { fontWeight: 600 } }}>
        <Tab icon={<ApplyIcon />} iconPosition="start" label="Apply for Loan" />
        <Tab icon={<HistoryIcon />} iconPosition="start" label={`My Loans (${loans.length})`} />
      </Tabs>

      {/* ─── APPLY TAB ─── */}
      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Surface>
                <Typography variant="h6" fontWeight={700} sx={{ color: brand.navy, mb: 3 }}>
                  Loan Application
                </Typography>

                {hasActiveLoan && (
                  <Alert severity="warning" sx={{ mb: 3 }}>
                    You already have an active loan application. You can apply for a new one after the current one is closed/rejected.
                  </Alert>
                )}

                <Grid container spacing={2.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth label="Loan Amount (₹)" type="number" value={form.requested_amount}
                      onChange={(e) => setForm({ ...form, requested_amount: e.target.value })}
                      disabled={hasActiveLoan}
                      InputProps={{ startAdornment: <InputAdornment position="start"><RupeeIcon fontSize="small" /></InputAdornment> }}
                      helperText="Minimum ₹1,000"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth label="Tenure (Months)" type="number" value={form.tenure_months}
                      onChange={(e) => setForm({ ...form, tenure_months: e.target.value })}
                      disabled={hasActiveLoan}
                      InputProps={{ startAdornment: <InputAdornment position="start"><CalendarIcon fontSize="small" /></InputAdornment> }}
                      helperText="1 to 60 months"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth label="Purpose (Optional)" multiline rows={2} value={form.purpose}
                      onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                      disabled={hasActiveLoan}
                      placeholder="e.g., Business expansion, Medical expenses, Education..."
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          disabled={hasActiveLoan}
                        />
                      }
                      label="I agree to the Terms & Conditions for loan applications"
                    />
                  </Grid>
                </Grid>

                <Button
                  variant="contained" fullWidth size="large" disabled={hasActiveLoan || applying || !acceptedTerms}
                  onClick={handleApply}
                  sx={{ mt: 3, fontWeight: 700, py: 1.5 }}
                >
                  {applying ? <CircularProgress size={24} /> : 'Submit Loan Application'}
                </Button>
            </Surface>
          </Grid>

          <Grid item xs={12} md={5}>
            {/* EMI Estimate Card */}
            <Surface sx={{ mb: 2, background: `linear-gradient(135deg, ${brand.navy}, ${brand.royal})`, color: 'white', border: 'none' }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: brand.gold, mb: 2 }}>
                  EMI Estimate
                </Typography>
                {estimatedEMI ? (
                  <>
                    <Typography variant="h3" fontWeight={800} sx={{ mb: 0.5 }}>
                      {formatCurrency(estimatedEMI)}
                      <Typography component="span" variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>/month</Typography>
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2 }}>
                      * Estimated at 12% p.a. Actual rate may vary based on approval.
                    </Typography>
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', my: 1.5 }} />
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>Loan Amount</Typography>
                      <Typography fontWeight={600}>{formatCurrency(Number(form.requested_amount))}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>Tenure</Typography>
                      <Typography fontWeight={600}>{form.tenure_months} months</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>Total Payable</Typography>
                      <Typography fontWeight={600} sx={{ color: brand.gold }}>
                        {formatCurrency(estimatedEMI * Number(form.tenure_months))}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    Enter loan amount and tenure to see EMI estimate
                  </Typography>
                )}
            </Surface>

            <Surface>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <InfoIcon sx={{ color: brand.goldDark }} />
                  <Typography variant="h6" fontWeight={700} sx={{ color: brand.navy }}>Before you apply</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Fill amount and tenure, accept Terms & Conditions, then submit. Our team reviews applications and contacts you with the next steps.
                </Typography>
            </Surface>
          </Grid>
        </Grid>
      )}

      {/* ─── MY LOANS TAB ─── */}
      {tab === 1 && (
        <Box>
          {loans.length === 0 ? (
            <Surface>
              <EmptyState
                icon={<LoanIcon sx={{ fontSize: 32 }} />}
                title="No loans yet"
                description={'You haven\'t applied for any loans yet. Switch to the Apply for Loan tab to get started.'}
                actionLabel="Apply Now"
                onAction={() => setTab(0)}
              />
            </Surface>
          ) : (
            <>
              {activeLoans.length > 0 && (
                <Box mb={3}>
                  <SectionTitle title="Active / Pending" />
                  <Grid container spacing={2}>
                    {activeLoans.map(loan => (
                      <Grid item xs={12} md={6} key={loan._id}>
                        <LoanCard loan={loan} onViewDetails={() => setDetailLoan(loan)} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {pastLoans.length > 0 && (
                <Box>
                  <SectionTitle title="History" />
                  <Grid container spacing={2}>
                    {pastLoans.map(loan => (
                      <Grid item xs={12} md={6} key={loan._id}>
                        <LoanCard loan={loan} onViewDetails={() => setDetailLoan(loan)} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      {/* ─── LOAN DETAIL DIALOG ─── */}
      <Dialog open={!!detailLoan} onClose={() => setDetailLoan(null)} maxWidth="sm" fullWidth>
        {detailLoan && (
          <>
            <DialogTitle sx={{ fontWeight: 700, color: brand.navy }}>
              Loan Details
              <Chip
                label={STATUS_CONFIG[detailLoan.status]?.label || detailLoan.status}
                color={STATUS_CONFIG[detailLoan.status]?.color || 'default'}
                size="small" sx={{ ml: 2 }}
              />
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                {[
                  { label: 'Loan Type', value: detailLoan.loan_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
                  { label: 'Requested Amount', value: formatCurrency(detailLoan.requested_amount) },
                  { label: 'Approved Amount', value: formatCurrency(detailLoan.approved_amount) },
                  { label: 'Interest Rate', value: detailLoan.interest_rate ? `${detailLoan.interest_rate}% p.a.` : '—' },
                  { label: 'Tenure', value: `${detailLoan.tenure_months} months` },
                  { label: 'EMI Amount', value: formatCurrency(detailLoan.emi_amount) },
                  { label: 'Outstanding', value: formatCurrency(detailLoan.outstanding_amount) },
                  { label: 'Applied On', value: formatDate(detailLoan.created_at) },
                  { label: 'Approved On', value: formatDate(detailLoan.approved_at) },
                  { label: 'Disbursed On', value: formatDate(detailLoan.disbursed_at) },
                  { label: 'Next EMI Date', value: formatDate(detailLoan.next_emi_date) },
                  { label: 'Chit Group', value: detailLoan.chit_group_id?.group_name || '—' },
                ].map((item, i) => (
                  <Grid item xs={6} key={i}>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                    <Typography fontWeight={600} sx={{ color: brand.navy }}>{item.value}</Typography>
                  </Grid>
                ))}
                {detailLoan.purpose && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Purpose</Typography>
                    <Typography sx={{ color: '#475569' }}>{detailLoan.purpose}</Typography>
                  </Grid>
                )}
                {detailLoan.rejection_reason && (
                  <Grid item xs={12}>
                    <Alert severity="error" sx={{ mt: 1 }}>
                      <strong>Rejection Reason:</strong> {detailLoan.rejection_reason}
                    </Alert>
                  </Grid>
                )}
                {detailLoan.admin_notes && (
                  <Grid item xs={12}>
                    <Alert severity="info" sx={{ mt: 1 }}>
                      <strong>Admin Notes:</strong> {detailLoan.admin_notes}
                    </Alert>
                  </Grid>
                )}

                {/* Repayment progress for active/disbursed loans */}
                {detailLoan.approved_amount && detailLoan.outstanding_amount !== undefined && ['active', 'disbursed'].includes(detailLoan.status) && (
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2" fontWeight={600} sx={{ color: brand.navy, mb: 1 }}>Repayment Progress</Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.max(0, ((detailLoan.approved_amount - detailLoan.outstanding_amount) / detailLoan.approved_amount) * 100)}
                      sx={{ height: 10, borderRadius: 2, bgcolor: brand.mist, '& .MuiLinearProgress-bar': { bgcolor: brand.success, borderRadius: 2 } }}
                    />
                    <Box display="flex" justifyContent="space-between" mt={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Paid: {formatCurrency(detailLoan.approved_amount - detailLoan.outstanding_amount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Remaining: {formatCurrency(detailLoan.outstanding_amount)}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailLoan(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </PageShell>
  );
};

// ─── Loan Card Component ───
const LoanCard = ({ loan, onViewDetails }) => {
  const cfg = STATUS_CONFIG[loan.status] || STATUS_CONFIG.requested;
  return (
    <Surface onClick={onViewDetails}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Typography variant="body2" fontWeight={700} sx={{ color: brand.navy, textTransform: 'capitalize' }}>
            {loan.loan_type?.replace(/_/g, ' ')}
          </Typography>
          <Chip label={cfg.label} color={cfg.color} size="small" icon={cfg.icon} />
        </Box>

        <Typography variant="h5" fontWeight={800} sx={{ color: brand.navy, mb: 0.5 }}>
          {formatCurrency(loan.approved_amount || loan.requested_amount)}
        </Typography>

        <Grid container spacing={1} sx={{ mt: 1 }}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Tenure</Typography>
            <Typography variant="body2" fontWeight={600}>{loan.tenure_months} months</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">EMI</Typography>
            <Typography variant="body2" fontWeight={600}>{formatCurrency(loan.emi_amount)}</Typography>
          </Grid>
          {loan.chit_group_id?.group_name && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">Chit Group</Typography>
              <Typography variant="body2" fontWeight={600}>{loan.chit_group_id.group_name}</Typography>
            </Grid>
          )}
        </Grid>

        <Typography variant="caption" sx={{ color: brand.muted, display: 'block', mt: 1.5 }}>
          Applied: {formatDate(loan.created_at)}
        </Typography>
    </Surface>
  );
};

export default Loans;
