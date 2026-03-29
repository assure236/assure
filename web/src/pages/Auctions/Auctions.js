import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Grid, Card, CardContent, Typography, Box, Chip,
  CircularProgress, Button, Tabs, Tab, Avatar, LinearProgress, Alert
} from '@mui/material';
import { Gavel as GavelIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';

const Auctions = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchAuctions(); }, []);

  // Real-time: auto-refresh when admin starts/ends auctions
  const socketRef = useRef(null);
  useEffect(() => {
    const SOCKET_URL = process.env.REACT_APP_API_URL
      ? process.env.REACT_APP_API_URL.replace('/api/v1', '')
      : 'http://localhost:5000';
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], reconnectionAttempts: 3 });
    socketRef.current = socket;
    socket.on('auction_status_changed', () => fetchAuctions());
    socket.on('auction_created', () => fetchAuctions());
    socket.on('auction_started', () => fetchAuctions());
    socket.on('auction_ended', () => fetchAuctions());
    return () => { socket.disconnect(); };
  }, []);

  const fetchAuctions = async () => {
    try {
      setError(null);
      const res = await axios.get('/auctions/my-auctions');
      if (res.data.success) setAuctions(res.data.data || []);
    } catch (err) {
      setError('Could not load auctions.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = {
    live: auctions.filter(a => a.status === 'active' || a.status === 'in_progress'),
    upcoming: auctions.filter(a => a.status === 'scheduled'),
    past: auctions.filter(a => a.status === 'completed'),
  };

  const tabData = [
    { label: `Live (${filtered.live.length})`, auctions: filtered.live },
    { label: `Upcoming (${filtered.upcoming.length})`, auctions: filtered.upcoming },
    { label: `Past (${filtered.past.length})`, auctions: filtered.past },
  ];

  if (loading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h4" gutterBottom>Auctions</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        {tabData.map((t, i) => <Tab key={i} label={t.label} />)}
      </Tabs>

      {tabData[tab].auctions.length === 0 ? (
        <Box textAlign="center" py={8}>
          <GavelIcon sx={{ fontSize: 64, color: 'grey.300' }} />
          <Typography color="text.secondary" mt={2}>
            No {['live', 'upcoming', 'past'][tab]} auctions found.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {tabData[tab].auctions.map((auction, i) => {
            const isLive = auction.status === 'active';
            const isPast = auction.status === 'completed';
            const chitGroup = auction.chitGroup || auction.chit_group_id;
            const chitValue = Number(chitGroup?.chit_value || 0);
            const totalMembers = Number(chitGroup?.total_members || 1);
            const highestBid = Number(auction.current_highest_bid || auction.winning_bid_amount || auction.highest_bid || 0);
            const dividend = highestBid > 0 ? Math.round(highestBid / totalMembers) : 0;

            return (
              <Grid item xs={12} md={6} key={i}>
                <Card sx={{
                  borderRadius: 3,
                  border: isLive ? '2px solid #d32f2f' : 'none',
                  position: 'relative',
                  overflow: 'visible'
                }}>
                  {isLive && (
                    <Box sx={{
                      position: 'absolute', top: -10, right: 16,
                      bgcolor: 'error.main', color: 'white',
                      px: 2, py: 0.5, borderRadius: 10, fontSize: 11, fontWeight: 700
                    }}>
                      🔴 LIVE
                    </Box>
                  )}
                  <Box sx={{
                    background: isLive
                      ? 'linear-gradient(135deg, #d32f2f, #b71c1c)'
                      : isPast ? 'linear-gradient(135deg, #616161, #424242)'
                      : 'linear-gradient(135deg, #6a1b9a, #4a148c)',
                    p: 2, color: 'white', borderRadius: '12px 12px 0 0'
                  }}>
                    <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                      Month {auction.month_number} Auction
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {chitGroup?.group_name || 'Chit Group'}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      {chitGroup?.group_number}
                    </Typography>
                  </Box>

                  <CardContent>
                    <Grid container spacing={2} mb={2}>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary">Chit Value</Typography>
                        <Typography fontWeight={700}>₹{chitValue.toLocaleString('en-IN')}</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary">
                          {isPast ? 'Winning Bid' : 'Highest Bid'}
                        </Typography>
                        <Typography fontWeight={700} color={isLive ? 'warning.main' : 'text.primary'}>
                          {highestBid > 0 ? `₹${highestBid.toLocaleString('en-IN')}` : '—'}
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary">Dividend/Member</Typography>
                        <Typography fontWeight={700} color="success.main">
                          {dividend > 0 ? `₹${dividend.toLocaleString('en-IN')}` : '—'}
                        </Typography>
                      </Grid>
                    </Grid>

                    {isPast && auction.winner_id && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: 'warning.light', fontSize: 14 }}>🏆</Avatar>
                        <Typography variant="body2">
                          Winner: <strong>{auction.winner_id?.full_name || auction.winner?.full_name || 'Declared'}</strong>
                        </Typography>
                      </Box>
                    )}

                    {!isPast && (
                      <Button
                        fullWidth variant="contained"
                        disabled={!isLive}
                        onClick={() => isLive && navigate(`/auctions/${auction._id || auction.id}`)}
                        sx={{
                          bgcolor: isLive ? 'error.main' : 'grey.300',
                          '&:hover': { bgcolor: isLive ? 'error.dark' : 'grey.300' },
                          borderRadius: 2
                        }}
                        startIcon={<GavelIcon />}
                      >
                        {isLive ? 'Enter Auction Room' : `Starts ${auction.auction_date
                          ? new Date(auction.auction_date).toLocaleDateString('en-IN')
                          : 'soon'}`}
                      </Button>
                    )}

                    {isPast && (
                      <Button
                        fullWidth variant="outlined"
                        onClick={() => navigate(`/auctions/${auction._id || auction.id}`)}
                        sx={{ borderRadius: 2 }}
                        startIcon={<GavelIcon />}
                      >
                        View Auction Details
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}


    </Container>
  );
};

export default Auctions;

