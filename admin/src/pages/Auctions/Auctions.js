import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container, Typography, Box, Card, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Chip, Button,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, MenuItem, Divider, List, ListItem,
  ListItemText, ListItemAvatar, Avatar, Paper, IconButton, Tabs, Tab, Badge
} from '@mui/material';
import {
  Add as AddIcon, Gavel as GavelIcon, People as PeopleIcon, Timer as TimerIcon,
  Visibility as ViewIcon, Pause as PauseIcon, PlayArrow as PlayIcon,
  Stop as StopIcon, EmojiEvents as TrophyIcon, Close as CloseIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';
import { io as socketIO } from 'socket.io-client';

const statusColors = { active: 'error', in_progress: 'error', paused: 'info', scheduled: 'warning', completed: 'success', cancelled: 'default' };

const defaultForm = {
  chit_group_id: '', month_number: '', start_time: '',
  duration_minutes: 30, min_bid_increment: 100,
  anti_snipe_seconds: 15, anti_snipe_extension: 30,
  bid_fee: 0, max_bids_per_user: 0
};

const Auctions = () => {
  const [auctions, setAuctions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [createDialog, setCreateDialog] = useState(false);
  const [chitGroups, setChitGroups] = useState([]);
  const [form, setForm] = useState({ ...defaultForm });
  const [creating, setCreating] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, auctionId: null, action: '', title: '', message: '' });

  // Live auction view state
  const [liveView, setLiveView] = useState(false);
  const [liveAuction, setLiveAuction] = useState(null);
  const [liveBids, setLiveBids] = useState([]);
  const [liveTimer, setLiveTimer] = useState(0);
  const [liveActiveUsers, setLiveActiveUsers] = useState(0);
  const [liveTab, setLiveTab] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => { fetchAuctions(); }, [page, rowsPerPage]);
  useEffect(() => {
    if (createDialog) fetchChitGroups();
  }, [createDialog]);

  const fetchAuctions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/auctions?page=${page + 1}&limit=${rowsPerPage}`);
      if (res.data.success) { setAuctions(res.data.data?.auctions || []); setTotal(res.data.data?.total || 0); }
    } catch (err) { setError('Could not load auctions.'); }
    finally { setLoading(false); }
  };

  const fetchChitGroups = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/chit-groups?limit=100`);
      if (res.data.success) setChitGroups(res.data.data?.chit_groups || []);
    } catch (err) {}
  };

  const handleCreate = async () => {
    if (!form.chit_group_id || !form.month_number || !form.start_time) {
      toast.error('Group, month, and start time are required'); return;
    }
    setCreating(true);
    try {
      const payload = {
        ...form,
        duration_minutes: Number(form.duration_minutes) || 30,
        min_bid_increment: Number(form.min_bid_increment) || 100,
        anti_snipe_seconds: Number(form.anti_snipe_seconds) || 15,
        anti_snipe_extension: Number(form.anti_snipe_extension) || 30,
        bid_fee: Number(form.bid_fee) || 0,
        max_bids_per_user: Number(form.max_bids_per_user) || 0,
      };
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/admin/auctions`, payload);
      if (res.data.success) { toast.success('Auction scheduled!'); setCreateDialog(false); setForm({ ...defaultForm }); fetchAuctions(); }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create auction'); }
    finally { setCreating(false); }
  };

  const handleAuctionAction = async (auctionId, action) => {
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/admin/auctions/${auctionId}/${action}`);
      const labels = { start: 'started', end: 'ended', pause: 'paused', resume: 'resumed' };
      toast.success(`Auction ${labels[action] || action}!`);
      fetchAuctions();
    } catch (err) { toast.error(err.response?.data?.message || `${action} failed`); }
    finally { setConfirmDialog({ open: false, auctionId: null, action: '', title: '', message: '' }); }
  };

  const openConfirm = (auctionId, action) => {
    const msgs = {
      start: { title: 'Start Auction?', message: 'This will make the auction LIVE and start the timer. Members can start bidding immediately.' },
      end: { title: 'End Auction?', message: 'This will end the auction and determine the winner based on the highest bid.' },
      pause: { title: 'Pause Auction?', message: 'This will pause the auction timer. Members cannot bid while paused.' },
      resume: { title: 'Resume Auction?', message: 'This will resume the auction timer from where it was paused.' },
    };
    setConfirmDialog({ open: true, auctionId, action, ...(msgs[action] || { title: 'Confirm?', message: `Are you sure you want to ${action}?` }) });
  };

  const handleGroupSelect = async (groupId) => {
    setForm(f => ({ ...f, chit_group_id: groupId }));
    if (groupId) {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/auctions/next-month/${groupId}`);
        if (res.data.success) setForm(f => ({ ...f, month_number: res.data.data.next_month }));
      } catch (err) {}
    }
  };

  // ---- Live Auction View ----
  const openLiveView = useCallback(async (auctionId) => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/auctions/${auctionId}`);
      if (!res.data.success) return toast.error('Could not load auction');
      const { auction, bids } = res.data.data;
      setLiveAuction(auction);
      setLiveBids(bids || []);
      setLiveTimer(0);
      setLiveActiveUsers(auction.active_users || 0);
      setLiveTab(0);
      setLiveView(true);

      // Connect socket
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const baseUrl = apiUrl.replace('/api/v1', '');
      const socket = socketIO(baseUrl, { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('join_auction', { auction_id: auctionId });
      });

      socket.on('auction_sync', (data) => {
        setLiveTimer(data.remaining_seconds || 0);
        setLiveActiveUsers(data.active_users || 0);
      });

      socket.on('timer_tick', (data) => {
        setLiveTimer(data.remaining_seconds || 0);
        setLiveActiveUsers(data.active_users || 0);
      });

      socket.on('time_warning', (data) => {
        const urgency = data.urgency || 'medium';
        if (urgency === 'critical') {
          toast.error(`⏰ ${data.message}`);
        } else {
          toast.warning(`⏰ ${data.message}`);
        }
      });

      socket.on('new_bid', (data) => {
        setLiveBids(prev => {
          const updated = [{ ...data, _id: data.timestamp, user_id: { full_name: data.bidder_name, _id: data.user_id } }, ...prev];
          return updated;
        });
        setLiveAuction(prev => prev ? { ...prev, current_highest_bid: Math.max(prev.current_highest_bid || 0, data.bid_amount) } : prev);
      });

      socket.on('auction_paused', (data) => {
        setLiveTimer(data.remaining_seconds || 0);
        setLiveAuction(prev => prev ? { ...prev, status: 'paused' } : prev);
        toast.info('Auction paused');
      });

      socket.on('auction_resumed', (data) => {
        setLiveTimer(data.remaining_seconds || 0);
        setLiveAuction(prev => prev ? { ...prev, status: 'in_progress' } : prev);
        toast.info('Auction resumed');
      });

      socket.on('auction_ended', (data) => {
        setLiveAuction(prev => prev ? { ...prev, status: 'completed', winner_id: data.winner ? { full_name: data.winner.full_name } : null, winning_bid_amount: data.winning_amount } : prev);
        setLiveTimer(0);
        toast.success('Auction ended!');
      });
    } catch (err) {
      toast.error('Failed to open live view');
    }
  }, []);

  const closeLiveView = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setLiveView(false);
    setLiveAuction(null);
    setLiveBids([]);
    fetchAuctions();
  }, []);

  const handleLiveAction = async (action) => {
    if (!liveAuction) return;
    const id = liveAuction._id || liveAuction.id;
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/admin/auctions/${id}/${action}`);
      const labels = { pause: 'paused', resume: 'resumed', end: 'ended' };
      toast.success(`Auction ${labels[action]}!`);
      if (action === 'end') {
        setTimeout(() => closeLiveView(), 2000);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `${action} failed`);
    }
  };

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Get unique participants from bids
  const getParticipants = () => {
    const map = {};
    liveBids.forEach(b => {
      const uid = b.user_id?._id || b.user_id;
      const name = b.user_id?.full_name || b.bidder_name || 'Unknown';
      if (!map[uid]) map[uid] = { name, count: 0, highest: 0 };
      map[uid].count++;
      const amt = Number(b.bid_amount);
      if (amt > map[uid].highest) map[uid].highest = amt;
    });
    return Object.entries(map).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.highest - a.highest);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">Auctions</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialog(true)}>
          Schedule Auction
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ borderRadius: 3 }}>
        {loading ? <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box> : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    {['Group', 'Month', 'Start Time', 'Duration', 'Status', 'Highest Bid', 'Total Bids', 'Winner', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auctions.map(a => (
                    <TableRow key={a._id || a.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{a.chit_group_id?.group_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{a.chit_group_id?.group_number}</Typography>
                      </TableCell>
                      <TableCell>Month {a.month_number}</TableCell>
                      <TableCell>{a.start_time ? new Date(a.start_time).toLocaleString('en-IN') : '—'}</TableCell>
                      <TableCell>{a.duration_minutes || 30} min</TableCell>
                      <TableCell>
                        <Chip label={a.status} size="small" color={statusColors[a.status] || 'default'}
                          sx={{ textTransform: 'capitalize' }} />
                        {(a.status === 'in_progress' || a.status === 'active') && a.active_users > 0 && (
                          <Chip icon={<PeopleIcon />} label={a.active_users} size="small" sx={{ ml: 0.5 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        {a.current_highest_bid || a.winning_bid_amount
                          ? `₹${Number(a.current_highest_bid || a.winning_bid_amount).toLocaleString('en-IN')}`
                          : '—'}
                      </TableCell>
                      <TableCell>{a.total_bid_count || 0}</TableCell>
                      <TableCell>{a.winner_id?.full_name || a.winner?.full_name || '—'}</TableCell>
                      <TableCell>
                        {a.status === 'scheduled' && (
                          <Button size="small" variant="outlined" color="error"
                            startIcon={<GavelIcon />}
                            onClick={() => openConfirm(a._id || a.id, 'start')}>
                            Start
                          </Button>
                        )}
                        {(a.status === 'in_progress' || a.status === 'active') && (
                          <>
                            <Button size="small" variant="contained" color="primary" sx={{ mr: 1 }}
                              startIcon={<ViewIcon />}
                              onClick={() => openLiveView(a._id || a.id)}>
                              View
                            </Button>
                            <Button size="small" variant="outlined" color="warning" sx={{ mr: 1 }}
                              onClick={() => openConfirm(a._id || a.id, 'pause')}>
                              Pause
                            </Button>
                            <Button size="small" variant="outlined"
                              onClick={() => openConfirm(a._id || a.id, 'end')}>
                              End
                            </Button>
                          </>
                        )}
                        {a.status === 'paused' && (
                          <>
                            <Button size="small" variant="contained" color="primary" sx={{ mr: 1 }}
                              startIcon={<ViewIcon />}
                              onClick={() => openLiveView(a._id || a.id)}>
                              View
                            </Button>
                            <Button size="small" variant="outlined" color="success" sx={{ mr: 1 }}
                              onClick={() => openConfirm(a._id || a.id, 'resume')}>
                              Resume
                            </Button>
                            <Button size="small" variant="outlined"
                              onClick={() => openConfirm(a._id || a.id, 'end')}>
                              End
                            </Button>
                          </>
                        )}
                        {a.status === 'completed' && (
                          <Button size="small" variant="outlined" color="info"
                            startIcon={<ViewIcon />}
                            onClick={() => openLiveView(a._id || a.id)}>
                            Details
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={total} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]} />
          </>
        )}
      </Card>

      {/* Create Dialog - Enhanced with live bidding settings */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Schedule New Auction</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {/* Basic Info */}
            <Grid item xs={12}>
              <TextField fullWidth select label="Chit Group *" value={form.chit_group_id}
                onChange={e => handleGroupSelect(e.target.value)}>
                {chitGroups.map(g => <MenuItem key={g._id || g.id} value={g._id || g.id}>{g.group_name} ({g.group_number})</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Month Number *" type="number" value={form.month_number}
                onChange={e => setForm({ ...form, month_number: e.target.value })} inputProps={{ min: 1 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Start Time *" type="datetime-local" value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>

            <Grid item xs={12}><Divider><Chip label="Live Bidding Settings" icon={<TimerIcon />} /></Divider></Grid>

            {/* Timer Settings */}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Duration (minutes)" type="number" value={form.duration_minutes}
                onChange={e => setForm({ ...form, duration_minutes: e.target.value })}
                helperText="Auction duration once started" inputProps={{ min: 1, max: 180 }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Min Bid Increment (₹)" type="number" value={form.min_bid_increment}
                onChange={e => setForm({ ...form, min_bid_increment: e.target.value })}
                helperText="Min amount above current highest" inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Max Bids Per User" type="number" value={form.max_bids_per_user}
                onChange={e => setForm({ ...form, max_bids_per_user: e.target.value })}
                helperText="0 = unlimited" inputProps={{ min: 0 }} />
            </Grid>

            <Grid item xs={12}><Divider><Chip label="Anti-Snipe Protection" /></Divider></Grid>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Anti-Snipe Trigger (seconds)" type="number" value={form.anti_snipe_seconds}
                onChange={e => setForm({ ...form, anti_snipe_seconds: e.target.value })}
                helperText="Extend timer if bid in last N seconds" inputProps={{ min: 0, max: 120 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Anti-Snipe Extension (seconds)" type="number" value={form.anti_snipe_extension}
                onChange={e => setForm({ ...form, anti_snipe_extension: e.target.value })}
                helperText="Extend timer by this many seconds" inputProps={{ min: 0, max: 120 }} />
            </Grid>

            <Grid item xs={12}><Divider><Chip label="Wallet & Fees" /></Divider></Grid>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Bid Fee (₹)" type="number" value={form.bid_fee}
                onChange={e => setForm({ ...form, bid_fee: e.target.value })}
                helperText="Fee per bid (0 = free)" inputProps={{ min: 0 }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : <AddIcon />}>
            Schedule Auction
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog for Start/End/Pause/Resume */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, auctionId: null, action: '', title: '', message: '' })}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, auctionId: null, action: '', title: '', message: '' })}>Cancel</Button>
          <Button variant="contained" color={confirmDialog.action === 'end' ? 'error' : 'primary'}
            onClick={() => handleAuctionAction(confirmDialog.auctionId, confirmDialog.action)}>
            {confirmDialog.action ? confirmDialog.action.charAt(0).toUpperCase() + confirmDialog.action.slice(1) : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========= Live Auction View Dialog ========= */}
      <Dialog open={liveView} onClose={closeLiveView} maxWidth="lg" fullWidth
        PaperProps={{ sx: { minHeight: '80vh' } }}>
        {liveAuction && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box>
                <Typography variant="h5" component="span" fontWeight={700}>
                  {liveAuction.chit_group_id?.group_name || 'Auction'} — Month {liveAuction.month_number}
                </Typography>
                <Chip label={liveAuction.status} size="small" color={statusColors[liveAuction.status] || 'default'}
                  sx={{ ml: 2, textTransform: 'capitalize' }} />
              </Box>
              <IconButton onClick={closeLiveView}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
              {/* Top Stats Bar */}
              <Box sx={{ display: 'flex', gap: 2, p: 2, bgcolor: 'grey.50', flexWrap: 'wrap' }}>
                {/* Timer */}
                <Paper elevation={2} sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
                  <TimerIcon color={liveTimer <= 30 ? 'error' : 'primary'} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Time Left</Typography>
                    <Typography variant="h5" fontWeight={700}
                      color={liveTimer <= 30 ? 'error.main' : liveTimer <= 60 ? 'warning.main' : 'primary.main'}
                      sx={{ fontFamily: 'monospace' }}>
                      {liveAuction.status === 'completed' ? 'ENDED' : liveAuction.status === 'paused' ? 'PAUSED' : formatTimer(liveTimer)}
                    </Typography>
                  </Box>
                </Paper>

                {/* Highest Bid */}
                <Paper elevation={2} sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, minWidth: 180 }}>
                  <TrophyIcon color="warning" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Highest Bid</Typography>
                    <Typography variant="h5" fontWeight={700} color="success.main">
                      ₹{Number(liveBids[0]?.bid_amount || liveAuction.current_highest_bid || 0).toLocaleString('en-IN')}
                    </Typography>
                  </Box>
                </Paper>

                {/* Active Users */}
                <Paper elevation={2} sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PeopleIcon color="info" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Online</Typography>
                    <Typography variant="h5" fontWeight={700}>{liveActiveUsers}</Typography>
                  </Box>
                </Paper>

                {/* Total Bids */}
                <Paper elevation={2} sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GavelIcon color="secondary" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Total Bids</Typography>
                    <Typography variant="h5" fontWeight={700}>{liveBids.length}</Typography>
                  </Box>
                </Paper>

                {/* Leader */}
                {liveBids.length > 0 && (
                  <Paper elevation={2} sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'warning.50' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Leader</Typography>
                      <Typography variant="body1" fontWeight={700}>
                        🏆 {liveBids[0]?.user_id?.full_name || liveBids[0]?.bidder_name || '—'}
                      </Typography>
                    </Box>
                  </Paper>
                )}

                {/* Winner (if completed) */}
                {liveAuction.status === 'completed' && liveAuction.winner_id && (
                  <Paper elevation={2} sx={{ px: 3, py: 1.5, bgcolor: 'success.50', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrophyIcon color="success" />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Winner</Typography>
                      <Typography variant="body1" fontWeight={700} color="success.main">
                        {liveAuction.winner_id?.full_name || '—'} — ₹{Number(liveAuction.winning_bid_amount || 0).toLocaleString('en-IN')}
                      </Typography>
                    </Box>
                  </Paper>
                )}
              </Box>

              {/* Tabs: Bids / Participants */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={liveTab} onChange={(_, v) => setLiveTab(v)}>
                  <Tab label={`Bid History (${liveBids.length})`} />
                  <Tab label={`Participants (${getParticipants().length})`} />
                </Tabs>
              </Box>

              {/* Tab Content */}
              <Box sx={{ height: 360, overflow: 'auto', p: 0 }}>
                {liveTab === 0 ? (
                  <List dense disablePadding>
                    {liveBids.length === 0 && (
                      <ListItem><ListItemText primary="No bids yet" sx={{ textAlign: 'center', color: 'text.secondary' }} /></ListItem>
                    )}
                    {liveBids.map((b, i) => (
                      <ListItem key={b._id || i} divider
                        sx={{ bgcolor: i === 0 ? 'warning.50' : 'transparent' }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: i === 0 ? 'warning.main' : 'grey.400', width: 32, height: 32, fontSize: 14 }}>
                            {i === 0 ? '🏆' : `#${i + 1}`}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" fontWeight={i === 0 ? 700 : 400}>
                                {b.user_id?.full_name || b.bidder_name || 'Unknown'}
                              </Typography>
                              <Typography variant="body2" fontWeight={700} color={i === 0 ? 'warning.main' : 'text.primary'}>
                                ₹{Number(b.bid_amount).toLocaleString('en-IN')}
                              </Typography>
                            </Box>
                          }
                          secondary={b.timestamp ? new Date(b.timestamp || b.createdAt).toLocaleTimeString('en-IN') : ''}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <List dense disablePadding>
                    {getParticipants().map((p, i) => (
                      <ListItem key={p.id} divider sx={{ bgcolor: i === 0 ? 'warning.50' : 'transparent' }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: i === 0 ? 'warning.main' : 'primary.main', width: 32, height: 32, fontSize: 14 }}>
                            {i === 0 ? '🏆' : i + 1}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" fontWeight={i === 0 ? 700 : 400}>{p.name}</Typography>
                              <Typography variant="body2" fontWeight={700} color="success.main">
                                ₹{Number(p.highest).toLocaleString('en-IN')}
                              </Typography>
                            </Box>
                          }
                          secondary={`${p.count} bid${p.count > 1 ? 's' : ''}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </DialogContent>

            {/* Admin Controls Footer */}
            {liveAuction.status !== 'completed' && (
              <DialogActions sx={{ justifyContent: 'center', gap: 2, py: 2 }}>
                {(liveAuction.status === 'in_progress' || liveAuction.status === 'active') && (
                  <>
                    <Button variant="contained" color="warning" size="large" startIcon={<PauseIcon />}
                      onClick={() => handleLiveAction('pause')}>
                      Pause Auction
                    </Button>
                    <Button variant="contained" color="error" size="large" startIcon={<StopIcon />}
                      onClick={() => handleLiveAction('end')}>
                      End Auction
                    </Button>
                  </>
                )}
                {liveAuction.status === 'paused' && (
                  <>
                    <Button variant="contained" color="success" size="large" startIcon={<PlayIcon />}
                      onClick={() => handleLiveAction('resume')}>
                      Resume Auction
                    </Button>
                    <Button variant="contained" color="error" size="large" startIcon={<StopIcon />}
                      onClick={() => handleLiveAction('end')}>
                      End Auction
                    </Button>
                  </>
                )}
              </DialogActions>
            )}
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default Auctions;

