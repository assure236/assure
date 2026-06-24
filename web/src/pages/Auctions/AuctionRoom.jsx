import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container, Grid, Card, CardContent, Typography, Box, Chip,
  Button, TextField, CircularProgress, Alert, Paper, Avatar,
  List, ListItem, ListItemAvatar, ListItemText, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab
} from '@mui/material';
import {
  Gavel as GavelIcon, ArrowBack as BackIcon, Timer as TimerIcon,
  Wifi as LiveIcon, People as PeopleIcon, AccountBalanceWallet as WalletIcon,
  Shield as ShieldIcon, AutoAwesome as AiIcon,
  ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon,
  TrendingUp as TrendIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import { getSocketUrl } from '../../config/env';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { getAccessToken } from '../../context/AuthContext';
import { useDisplayUser } from '../../hooks/useDisplayUser';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
} from 'recharts';

const AuctionRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const displayUser = useDisplayUser();
  const { refreshKey } = useActiveMember();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bids, setBids] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);
  const pollRef = useRef(null);
  const [bidConfirmOpen, setBidConfirmOpen] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(5);
  const confirmTimerRef = useRef(null);

  // ── Server-controlled timer state ──
  const [serverTimeRemaining, setServerTimeRemaining] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [antiSnipeAlert, setAntiSnipeAlert] = useState(null);
  const [timeWarning, setTimeWarning] = useState(null);
  const [rightTab, setRightTab] = useState(0);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);
  const [bidAnalytics, setBidAnalytics] = useState(null);

  // Current user ID for chat-style bid display (selected member context)
  const currentUserId = String(displayUser?._id || displayUser?.id || '');

  // Format seconds → HH:MM:SS
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Number to words (Indian system)
  const numberToWords = (num) => {
    if (!num || isNaN(num) || num <= 0) return '';
    const n = Math.floor(Number(num));
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numberToWords(n % 100) : '');
    if (n < 100000) return numberToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numberToWords(n % 1000) : '');
    if (n < 10000000) return numberToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numberToWords(n % 100000) : '');
    return numberToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numberToWords(n % 10000000) : '');
  };

  const formatCompactCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

  const openBidConfirm = () => {
    const amount = Number(bidAmount);
    const chitGroup = auction?.chitGroup || auction?.chit_group_id;
    const chitValue = Number(chitGroup?.chit_value || 0);
    const commissionPct = Number(chitGroup?.foreman_commission_percentage || 5);
    const commission = Math.round(chitValue * (commissionPct / 100));
    const auctionPool = chitValue - commission;
    const maxBidAmount = Math.round(auctionPool * 0.30);
    if (!amount || amount <= 0) { toast.error('Enter a valid bid amount'); return; }
    if (amount > maxBidAmount) { toast.error(`Max bid is 30% of pool = ₹${maxBidAmount.toLocaleString('en-IN')}`); return; }
    const sortedB = [...bids].sort((a, b) => Number(b.bid_amount) - Number(a.bid_amount));
    const ch = Number(auction?.current_highest_bid || sortedB[0]?.bid_amount || 0);
    if (ch > 0 && amount <= ch) { toast.error(`Bid must be higher than current highest: ₹${ch.toLocaleString('en-IN')}`); return; }
    const minInc = auction?.min_bid_increment || 0;
    if (minInc > 0 && ch > 0 && (amount - ch) < minInc) {
      // Allow if bidding the max
      if (amount !== maxBidAmount) {
        toast.error(`Bid must be at least ₹${minInc} more than current highest`); return;
      }
    }
    setBidConfirmOpen(true);
    setConfirmCountdown(5);
    let count = 5;
    confirmTimerRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(confirmTimerRef.current);
        setConfirmCountdown(0);
      } else {
        setConfirmCountdown(count);
      }
    }, 1000);
  };

  // Auto-submit when countdown reaches 0
  useEffect(() => {
    if (bidConfirmOpen && confirmCountdown === 0) {
      handleBid();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmCountdown, bidConfirmOpen]);

  const cancelBidConfirm = () => {
    setBidConfirmOpen(false);
    if (confirmTimerRef.current) clearInterval(confirmTimerRef.current);
  };

  const fetchAuction = useCallback(async () => {
    try {
      const res = await axios.get(`/auctions/${id}`);
      if (res.data.success) {
        const aData = res.data.data;
        setAuction(aData);
        setBids(aData.bids || []);
        if (aData.server_time_remaining != null) {
          setServerTimeRemaining(aData.server_time_remaining);
        }
        if (aData.active_users != null) setActiveUsers(aData.active_users);
        if (aData.wallet_balance != null) setWalletBalance(aData.wallet_balance);
        setLoading(false);
      }
    } catch (err) {
      setError('Could not load auction details.');
      setLoading(false);
    }
  }, [id]);

  const fetchBidAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await axios.get(`/auctions/${id}/bid-analytics`);
      if (res.data?.success) {
        setBidAnalytics(res.data.data || null);
      } else {
        setBidAnalytics(null);
      }
    } catch {
      setBidAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAuction();
    fetchBidAnalytics();

    // Socket.io real-time connection
    // SECURITY FIX: use in-memory access token, not localStorage.
    const token = getAccessToken() || axios.defaults.headers.common['Authorization']?.replace('Bearer ', '');
    const socket = io(getSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_auction', { auction_id: id });
    });
    socket.on('disconnect', () => setSocketConnected(false));

    // ── SERVER TIMER TICK (every second from server) ──
    socket.on('timer_tick', (data) => {
      if (String(data.auction_id) === String(id)) {
        setServerTimeRemaining(data.remaining_seconds);
        if (data.active_users != null) setActiveUsers(data.active_users);
      }
    });

    // ── AUCTION SYNC (sent when joining room) ──
    socket.on('auction_sync', (data) => {
      if (String(data.auction_id) === String(id)) {
        setServerTimeRemaining(data.remaining_seconds || 0);
        setActiveUsers(data.active_users || 0);
      }
    });

    // ── ANTI-SNIPE TIMER EXTENSION ──
    socket.on('timer_extended', (data) => {
      if (String(data.auction_id) === String(id)) {
        setAntiSnipeAlert(`⏰ Timer extended by ${data.extension_seconds}s — last-second bid detected!`);
        toast.warning(`Anti-snipe: Timer extended by ${data.extension_seconds} seconds!`, { autoClose: 5000 });
        setTimeout(() => setAntiSnipeAlert(null), 8000);
      }
    });

    // ── ACTIVE USERS UPDATE ──
    socket.on('active_users_update', (data) => {
      if (String(data.auction_id) === String(id)) {
        setActiveUsers(data.count);
      }
    });

    // ── TIME WARNING ──
    socket.on('time_warning', (data) => {
      if (String(data.auction_id) === String(id)) {
        const urgency = data.urgency || 'medium';
        setTimeWarning(data.message);
        if (urgency === 'critical') {
          toast.error(`⏰ ${data.message}`, { autoClose: 5000 });
        } else {
          toast.warning(`⏰ ${data.message}`, { autoClose: 4000 });
        }
        setTimeout(() => setTimeWarning(null), 5000);
      }
    });

    // ── NEW BID ──
    socket.on('new_bid', (data) => {
      if (String(data.auction_id) === String(id)) {
        setBids(prev => {
          const dataUid = String(data.user_id);
          const newBids = [data, ...prev.filter(b => {
            const bUid = String(b.user_id?._id || b.user_id || '');
            return !(bUid === dataUid && Number(b.bid_amount) === Number(data.bid_amount));
          })];
          return newBids;
        });
        setAuction(prev => prev ? { ...prev, current_highest_bid: data.bid_amount, total_bid_count: data.total_bids } : prev);
        fetchBidAnalytics();
        toast.info(`New bid: ₹${Number(data.bid_amount).toLocaleString('en-IN')} by Ticket #${data.ticket_number || '?'}`, { autoClose: 3000 });
        if (data.anti_snipe_extended) {
          setAntiSnipeAlert(`⏰ Anti-snipe activated! Timer extended by ${data.extension_seconds || 30}s`);
          setTimeout(() => setAntiSnipeAlert(null), 8000);
        }
      }
    });

    socket.on('auction_ended', (data) => {
      if (String(data.auction_id) === String(id)) {
        toast.success(`Auction ended! Winner: Ticket #${data.winner_ticket_number || data.ticket_number || '?'}`, { autoClose: 5000 });
        setServerTimeRemaining(0);
        fetchAuction();
      }
    });
    socket.on('auction_started', (data) => {
      if (String(data.auction_id) === String(id)) {
        toast.info('Auction is now LIVE!', { autoClose: 3000 });
        fetchAuction();
      }
    });
    socket.on('auction_status_changed', () => fetchAuction());

    socket.on('auction_paused', (data) => {
      if (String(data.auction_id) === String(id)) {
        toast.warning('Auction has been PAUSED by admin.', { autoClose: 5000 });
        setServerTimeRemaining(data.remaining_seconds || 0);
        fetchAuction();
      }
    });
    socket.on('auction_resumed', (data) => {
      if (String(data.auction_id) === String(id)) {
        toast.info('Auction has been RESUMED!', { autoClose: 3000 });
        fetchAuction();
      }
    });

    socket.on('connect_error', () => {
      if (!pollRef.current) pollRef.current = setInterval(fetchAuction, 10000);
    });

    return () => {
      socket.emit('leave_auction', { auction_id: id });
      socket.disconnect();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, refreshKey, fetchAuction, fetchBidAnalytics]);

  const handleBid = async () => {
    cancelBidConfirm();
    const amount = Number(bidAmount);

    setSubmitting(true);
    try {
      const res = await axios.post(`/auctions/${id}/bid`, { bid_amount: amount });
      if (res.data.success) {
        toast.success('Bid submitted successfully!');
        setBidAmount('');
        if (res.data.data?.wallet_balance != null) setWalletBalance(res.data.data.wallet_balance);
        if (res.data.data?.anti_snipe_extended) {
          toast.warning('Anti-snipe activated! Timer extended.', { autoClose: 4000 });
        }
        if (!socketConnected) fetchAuction();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Bid submission failed';
      if (err.response?.status === 429) {
        toast.warning(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  if (error || !auction) return (
    <Container sx={{ py: 4 }}>
      <Alert severity="error">{error || 'Auction not found.'}</Alert>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/auctions')} sx={{ mt: 2 }}>Back to Auctions</Button>
    </Container>
  );

  const isLive = auction.status === 'active' || auction.status === 'in_progress';
  const isPaused = auction.status === 'paused';
  const chitGroup = auction.chitGroup || auction.chit_group_id;
  const chitValue = Number(chitGroup?.chit_value || 0);
  const commissionPct = Number(chitGroup?.foreman_commission_percentage || 5);
  const commission = Math.round(chitValue * (commissionPct / 100));
  const auctionPool = chitValue - commission;
  const maxBidAmount = Math.round(auctionPool * 0.30);
  const sortedBids = [...bids].sort((a, b) => Number(b.bid_amount) - Number(a.bid_amount));
  const currentHighest = Number(auction.current_highest_bid || sortedBids[0]?.bid_amount || 0);
  const dividend = currentHighest > 0 ? Math.round(currentHighest / (chitGroup?.total_members || 1)) : 0;
  const bidFee = auction.bid_fee || 0;
  const minIncrement = auction.min_bid_increment || 100;
  const aiSuggestion = bidAnalytics?.ai_suggestion || {};
  const bidHistory = bidAnalytics?.history || {};
  const trendRows = Array.isArray(bidHistory?.trend)
    ? bidHistory.trend.map((row) => ({
      month: `M${row.month}`,
      winningBid: Number(row.winning_bid || 0),
    }))
    : [];

  // Timer urgency (last 60 seconds = red pulsing)
  const isUrgent = serverTimeRemaining > 0 && serverTimeRemaining <= 60;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/auctions')} sx={{ mb: 2 }}>
        Back to Auctions
      </Button>

      {/* Anti-snipe Alert */}
      {antiSnipeAlert && (
        <Alert severity="warning" sx={{ mb: 2, animation: 'pulse 1s ease-in-out 3' }}>
          {antiSnipeAlert}
        </Alert>
      )}

      {/* Time Warning */}
      {timeWarning && (
        <Alert severity={serverTimeRemaining <= 30 ? 'error' : 'warning'} sx={{ mb: 2, fontWeight: 'bold', animation: 'pulse 1s ease-in-out infinite' }}>
          ⏰ {timeWarning}
        </Alert>
      )}

      {/* Header */}
      <Card sx={{ mb: 3, borderRadius: 3 }}>
        <Box sx={{
          background: isPaused ? 'linear-gradient(135deg, #ff8f00, #e65100)' : isLive ? 'linear-gradient(135deg, #d32f2f, #b71c1c)' : 'linear-gradient(135deg, #616161, #424242)',
          p: 3, color: 'white', borderRadius: '12px 12px 0 0'
        }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                Month {auction.month_number} Auction
              </Typography>
              <Typography variant="h5" fontWeight={700}>{chitGroup?.group_name}</Typography>
              <Typography sx={{ opacity: 0.7 }}>{chitGroup?.group_number}</Typography>
            </Box>
            {isPaused && (
              <Box textAlign="center">
                <Chip label="⏸️ PAUSED" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700, fontSize: 14 }} />
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>Auction is paused by admin</Typography>
              </Box>
            )}
            {isLive && (
              <Box textAlign="center">
                <Box display="flex" gap={1} mb={1}>
                  <Chip label="🔴 LIVE" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700 }} />
                  {socketConnected && <Chip icon={<LiveIcon style={{ color: '#69f0ae' }} />} label="Real-time" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 11 }} />}
                </Box>
                {/* Server-Controlled Timer */}
                <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                  <TimerIcon fontSize="small" />
                  <Typography variant="h5" fontWeight={700} sx={{
                    color: isUrgent ? '#ff5252' : 'white',
                    animation: isUrgent ? 'pulse 1s infinite' : 'none',
                  }}>
                    {formatTime(serverTimeRemaining)}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>Server Timer</Typography>
                {/* Active Users + Wallet */}
                <Box display="flex" gap={2} mt={1} justifyContent="center">
                  <Chip icon={<PeopleIcon style={{ color: 'white' }} />} label={`${activeUsers} online`} size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 11 }} />
                  <Chip icon={<WalletIcon style={{ color: 'white' }} />} label={`Avail: ₹${walletBalance.toLocaleString('en-IN')}`} size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 11 }} />
                </Box>
              </Box>
            )}
          </Box>
        </Box>
        <CardContent>
          <Grid container spacing={2}>
            {[
              { label: 'Chit Value', value: `₹${chitValue.toLocaleString('en-IN')}` },
              { label: 'Current Highest Bid', value: currentHighest > 0 ? `₹${currentHighest.toLocaleString('en-IN')}` : 'No bids yet' },
              { label: 'Dividend / Member', value: dividend > 0 ? `₹${dividend.toLocaleString('en-IN')}` : '—' },
              { label: 'Total Bids', value: auction.total_bid_count || bids.length },
            ].map(({ label, value }) => (
              <Grid item xs={6} sm={3} key={label}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography fontWeight={700}>{value}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          {/* Auction rules bar */}
          {isLive && (
            <Box display="flex" gap={2} mt={2} flexWrap="wrap">
              <Chip icon={<ShieldIcon />} label={`Min increment: ₹${minIncrement}`} size="small" variant="outlined" />
              <Chip label={`Anti-snipe: last ${auction.anti_snipe_seconds || 15}s → +${auction.anti_snipe_extension || 30}s`} size="small" variant="outlined" />
              {bidFee > 0 && <Chip icon={<WalletIcon />} label={`Bid fee: ₹${bidFee}`} size="small" variant="outlined" color="warning" />}
              <Chip label="Highest bid wins" size="small" variant="outlined" color="info" />
            </Box>
          )}
        </CardContent>
      </Card>

      {analyticsLoading ? (
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={22} />
          </CardContent>
        </Card>
      ) : bidAnalytics ? (
        <Card sx={{ mb: 3, borderRadius: 3, border: '1px solid #C7D2FE', bgcolor: '#EEF2FF' }}>
          <CardContent>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              sx={{ cursor: 'pointer' }}
              onClick={() => setAnalyticsExpanded((prev) => !prev)}
            >
              <Box display="flex" alignItems="center" gap={1.5}>
                <Avatar sx={{ bgcolor: '#C7D2FE', color: '#3730A3' }}>
                  <AiIcon fontSize="small" />
                </Avatar>
                <Box>
                  <Typography fontWeight={700}>AI Bid Suggestion</Typography>
                  {(Number(aiSuggestion?.suggested_min || 0) > 0 && Number(aiSuggestion?.suggested_max || 0) > 0) ? (
                    <Typography variant="body2" color="primary.main" fontWeight={600}>
                      {formatCompactCurrency(aiSuggestion.suggested_min)} - {formatCompactCurrency(aiSuggestion.suggested_max)}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
              {analyticsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>

            {analyticsExpanded ? (
              <Box mt={2}>
                {aiSuggestion?.message ? (
                  <Alert severity="info" icon={<AiIcon fontSize="small" />} sx={{ mb: 2 }}>
                    {aiSuggestion.message}
                  </Alert>
                ) : null}

                {Number(bidHistory?.total_completed || 0) > 0 ? (
                  <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                    <Chip label={`Avg ${formatCompactCurrency(bidHistory.avg_winning_bid)}`} color="primary" variant="outlined" />
                    <Chip label={`Min ${formatCompactCurrency(bidHistory.min_winning_bid)}`} color="success" variant="outlined" />
                    <Chip label={`Max ${formatCompactCurrency(bidHistory.max_winning_bid)}`} color="error" variant="outlined" />
                  </Box>
                ) : null}

                {trendRows.length >= 2 ? (
                  <Box>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <TrendIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">Bid Trend (by month)</Typography>
                    </Box>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={trendRows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Math.round(Number(v || 0) / 1000)}k`} />
                        <ChartTooltip formatter={(value) => [formatCompactCurrency(value), 'Winning Bid']} />
                        <Line type="monotone" dataKey="winningBid" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                ) : null}
              </Box>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Grid container spacing={3}>
        {/* Bid Panel */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {isLive ? 'Place Your Bid' : isPaused ? '⏸️ Auction Paused' : auction.status === 'completed' ? 'Auction Ended' : 'Auction Not Started'}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {isLive ? (
                <>
                  {/* Min / Max bid limits bar */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} p={1.5}
                    sx={{ borderRadius: 2, background: 'linear-gradient(90deg, #E8EDF5, #FDF8E8)' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Min Bid</Typography>
                      <Typography fontWeight={700} color="primary.main">
                        ₹{(() => {
                          const rawMin = currentHighest > 0 ? currentHighest + minIncrement : (auction.min_bid_amount || 1000);
                          return Math.min(rawMin, maxBidAmount).toLocaleString('en-IN');
                        })()}
                      </Typography>
                    </Box>
                    {bidFee > 0 && (
                      <Chip size="small" color="warning" variant="outlined" label={`Fee: ₹${bidFee}`} />
                    )}
                    <Box textAlign="right">
                      <Typography variant="caption" color="text.secondary">Max Bid</Typography>
                      <Typography fontWeight={700} color="error.main">
                        ₹{maxBidAmount.toLocaleString('en-IN')}
                      </Typography>
                    </Box>
                  </Box>
                  <TextField
                    fullWidth label="Enter Bidding Amount (₹)"
                    type="number" value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    helperText={
                      bidAmount && Number(bidAmount) > 0
                        ? `₹${Number(bidAmount).toLocaleString('en-IN')} — ${numberToWords(bidAmount)} Rupees`
                        : null
                    }
                    sx={{ mb: 2 }}
                  />
                  <Button
                    fullWidth variant="contained" color="error"
                    startIcon={submitting ? <CircularProgress size={16} /> : <GavelIcon />}
                    onClick={openBidConfirm} disabled={submitting || !bidAmount || serverTimeRemaining <= 0}
                    sx={{ borderRadius: 2, py: 1.5, fontSize: 16, mb: 1 }}
                  >
                    {submitting ? 'Submitting…' : serverTimeRemaining <= 0 ? 'Time Expired' : 'PLACE BID'}
                  </Button>
                  <Button
                    fullWidth variant="outlined" color="error"
                    onClick={() => setBidAmount(String(maxBidAmount))}
                    disabled={submitting || serverTimeRemaining <= 0}
                    sx={{ borderRadius: 2, py: 1, fontSize: 14 }}
                    startIcon={<span style={{ fontSize: 16 }}>⚡</span>}
                  >
                    Place Max Bid — ₹{maxBidAmount.toLocaleString('en-IN')}
                  </Button>
                  {!socketConnected && (
                    <Alert severity="info" sx={{ mt: 2, fontSize: 11 }}>
                      Connecting to real-time server…
                    </Alert>
                  )}
                  {serverTimeRemaining <= 0 && (
                    <Alert severity="warning" sx={{ mt: 2, fontSize: 12 }}>
                      Auction timer has expired. Waiting for server to finalize results...
                    </Alert>
                  )}
                </>
              ) : (
                <Box textAlign="center" py={3}>
                  <GavelIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                  <Typography color="text.secondary" mt={1}>
                    {auction.status === 'completed'
                      ? `Winner: Ticket #${auction.winner_id?.ticket_number || '?'}`
                      : 'Auction has not started yet.'}
                  </Typography>
                  {auction.status === 'completed' && auction.winning_bid_amount && (
                    <>
                      <Typography variant="h6" color="primary" mt={1}>
                        Winning Bid: ₹{Number(auction.winning_bid_amount).toLocaleString('en-IN')}
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      <Box textAlign="left">
                        <Typography variant="subtitle2" gutterBottom>Settlement Breakdown</Typography>
                        {[
                          { label: 'Chit Value', val: `₹${chitValue.toLocaleString('en-IN')}` },
                          { label: 'Commission (5%)', val: `- ₹${commission.toLocaleString('en-IN')}`, color: 'error.main' },
                          { label: 'Winning Bid (sacrifice)', val: `- ₹${Number(auction.winning_bid_amount).toLocaleString('en-IN')}`, color: 'error.main' },
                          { label: 'Winner Receives', val: `₹${Math.max(0, chitValue - commission - Number(auction.winning_bid_amount)).toLocaleString('en-IN')}`, bold: true, color: 'success.main' },
                          { label: 'Dividend/Member', val: `₹${(auction.dividend_per_member || dividend).toLocaleString('en-IN')}`, color: 'info.main' },
                        ].map(({ label, val, bold, color }) => (
                          <Box key={label} display="flex" justifyContent="space-between" py={0.5}>
                            <Typography variant="body2" color="text.secondary">{label}</Typography>
                            <Typography variant="body2" fontWeight={bold ? 700 : 500} color={color || 'text.primary'}>{val}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Bid History & Participants */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ pb: 0 }}>
              <Tabs value={rightTab} onChange={(_, v) => setRightTab(v)} sx={{ mb: 1 }}>
                <Tab label={`Bid History (${bids.length})`} />
                <Tab label={`Participants (${[...new Map(bids.map(b => [String(b.user_id?._id || b.user_id || b.bidder_name || 'unknown'), b])).values()].length})`} />
              </Tabs>
            </CardContent>
            {rightTab === 0 ? (
              /* Bid History Tab — Chat-style bubbles */
              bids.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography color="text.secondary">No bids placed yet.</Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 500, overflow: 'auto', px: 2, py: 1 }}>
                {sortedBids.map((bid, i) => {
                  const bidUid = bid.user_id?._id || bid.user_id || '';
                  const isMe = currentUserId && String(bidUid) === String(currentUserId);
                  const isHighest = i === 0;
                  const ticketNo = bid.ticket_number || bid.ticketNumber;
                  const displayName = `Ticket #${ticketNo || '?'}`;
                  const ts = bid.created_at || bid.timestamp;
                  const timeStr = (() => {
                    if (!ts) return '';
                    const ms = bid.bid_time_ms ? new Date(bid.bid_time_ms) : new Date(ts);
                    return `${ms.toLocaleTimeString('en-IN')}.${String(ms.getMilliseconds()).padStart(3, '0')}`;
                  })();
                  return (
                    <Box key={bid._id || `${bidUid}-${bid.bid_amount}-${i}`}
                      display="flex" justifyContent={isMe ? 'flex-end' : 'flex-start'} mb={1}>
                      <Box sx={{
                        maxWidth: '70%', px: 2, py: 1.2,
                        borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        bgcolor: isMe ? 'primary.50' : isHighest ? 'success.50' : 'grey.100',
                        border: 1,
                        borderColor: isMe ? 'primary.200' : isHighest ? 'success.200' : 'grey.200',
                      }}>
                        <Box display="flex" alignItems="center" gap={0.5} mb={0.3}>
                          <Typography variant="caption" fontWeight={600} color={isMe ? 'primary.main' : 'text.secondary'}>
                            {isMe ? 'You' : displayName}
                          </Typography>
                        </Box>
                        <Typography fontWeight={700} fontSize={18}
                          color={isHighest ? 'success.dark' : isMe ? 'primary.dark' : 'text.primary'}>
                          ₹{Number(bid.bid_amount).toLocaleString('en-IN')}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          {isHighest && (
                            <Chip label="HIGHEST" size="small" color="success"
                              sx={{ height: 16, fontSize: 9, fontWeight: 700 }} />
                          )}
                          <Typography variant="caption" color="text.disabled">{timeStr}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )
            ) : (
              /* Participants Tab */
              (() => {
                const participantMap = {};
                sortedBids.forEach(bid => {
                  const uid = String(bid.user_id?._id || bid.user_id || bid.bidder_name || 'unknown');
                  const ticketNo = bid.ticket_number || bid.ticketNumber;
                  const name = `Ticket #${ticketNo || '?'}`;
                  if (!participantMap[uid]) {
                    participantMap[uid] = { name, bidCount: 0, highestBid: 0 };
                  }
                  participantMap[uid].bidCount++;
                  const amt = Number(bid.bid_amount);
                  if (amt > participantMap[uid].highestBid) participantMap[uid].highestBid = amt;
                });
                const participants = Object.entries(participantMap)
                  .map(([uid, data]) => ({ uid, ...data }))
                  .sort((a, b) => b.highestBid - a.highestBid);

                return participants.length === 0 ? (
                  <Box textAlign="center" py={4}>
                    <Typography color="text.secondary">No participants yet.</Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {participants.map((p, i) => (
                      <React.Fragment key={p.uid}>
                        <ListItem>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: i === 0 ? 'warning.main' : 'primary.main', fontSize: 14 }}>
                              {i === 0 ? '🏆' : 'T'}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={p.name}
                            secondary={`${p.bidCount} bid${p.bidCount > 1 ? 's' : ''}`}
                          />
                          <Box textAlign="right">
                            <Typography fontWeight={700} color={i === 0 ? 'warning.dark' : 'text.primary'}>
                              ₹{p.highestBid.toLocaleString('en-IN')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">highest bid</Typography>
                          </Box>
                        </ListItem>
                        {i < participants.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                );
              })()
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Bid Confirmation Dialog with 5-second countdown */}
      <Dialog open={bidConfirmOpen} onClose={cancelBidConfirm}>
        <DialogTitle>Confirm Your Bid</DialogTitle>
        <DialogContent>
          <Typography variant="h4" color="error" fontWeight={700} textAlign="center" my={2}>
            ₹{Number(bidAmount || 0).toLocaleString('en-IN')}
          </Typography>
          <Typography textAlign="center" color="text.secondary" mb={1}>
            {numberToWords(bidAmount)} Rupees
          </Typography>
          <Typography textAlign="center" variant="body2" color="text.secondary">
            This bid cannot be undone. You will sacrifice this amount from your payout if you win.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2, gap: 2 }}>
          <Button onClick={cancelBidConfirm} variant="outlined" size="large">Cancel</Button>
          <Button onClick={handleBid} variant="contained" color="error" size="large"
            sx={{ minWidth: 160 }}>
            {confirmCountdown > 0 ? `Confirm (${confirmCountdown}s)` : 'CONFIRM BID'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AuctionRoom;

