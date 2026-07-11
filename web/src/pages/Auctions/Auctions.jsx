import React, { useState, useEffect, useRef } from 'react';
import {
  Grid, Typography, Box, Chip,
  CircularProgress, Button, Tabs, Tab, Avatar, Alert
} from '@mui/material';
import { Gavel as GavelIcon, EmojiEvents as TrophyIcon, PauseCircleOutline as PauseIcon } from '@mui/icons-material';
import { brand, fmtINR } from '../../theme/brand';
import { PageShell, PageHeader, Surface, EmptyState } from '../../components/ui/PageKit';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../../config/env';
import { useActiveMember } from '../../context/ActiveMemberContext';
import { securityLogger } from '../../utils/securityLogger';

const formatRemaining = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
};

const Auctions = () => {
  const navigate = useNavigate();
  const { refreshKey } = useActiveMember();
  const [tab, setTab] = useState(0);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => { fetchAuctions(); }, [refreshKey]);

  // Real-time: auto-refresh when admin starts/ends auctions
  const socketRef = useRef(null);
  useEffect(() => {
    const socket = io(getSocketUrl(), { transports: ['websocket', 'polling'], reconnectionAttempts: 3 });
    socketRef.current = socket;
    socket.on('auction_status_changed', () => fetchAuctions());
    socket.on('auction_created', () => fetchAuctions());
    socket.on('auction_started', () => fetchAuctions());
    socket.on('auction_ended', () => fetchAuctions());
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAuctions = async () => {
    try {
      setError(null);
      const res = await axios.get('/auctions/my-auctions');
      if (res.data.success) setAuctions(res.data.data || []);
    } catch (err) {
      setError('Could not load auctions.');
      // SECURITY FIX: sanitize auction load error logging.
      securityLogger.error('Auctions fetch failed', { status: err?.response?.status });
    } finally {
      setLoading(false);
    }
  };

  const filtered = {
    live: auctions.filter(a => a.status === 'active' || a.status === 'in_progress' || a.status === 'paused'),
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
    <PageShell>
      <PageHeader
        eyebrow="Live bidding"
        title="Auctions"
        subtitle="Join live auctions, track upcoming sessions, and review past results."
      />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        {tabData.map((t, i) => <Tab key={i} label={t.label} />)}
      </Tabs>

      {tabData[tab].auctions.length === 0 ? (
        <Surface>
          <EmptyState
            icon={<GavelIcon />}
            title={`No ${['live', 'upcoming', 'past'][tab]} auctions`}
            description="Auctions for your chit groups will appear here when scheduled."
          />
        </Surface>
      ) : (
        <Grid container spacing={3}>
          {tabData[tab].auctions.map((auction, i) => {
            const isLive = auction.status === 'active' || auction.status === 'in_progress';
            const isPaused = auction.status === 'paused';
            const isPast = auction.status === 'completed';
            const chitGroup = auction.chitGroup || auction.chit_group_id;
            const chitValue = Number(chitGroup?.chit_value || 0);
            const totalMembers = Number(chitGroup?.total_members || 1);
            const highestBid = Number(auction.current_highest_bid || auction.winning_bid_amount || auction.highest_bid || 0);
            const dividend = highestBid > 0 ? Math.round(highestBid / totalMembers) : 0;
            const fromServer = Number(auction.server_time_remaining || 0);
            const fromEndTime = auction.end_time ? Math.floor((new Date(auction.end_time).getTime() - Date.now()) / 1000) : 0;
            const remainingSeconds = Math.max(0, fromServer > 0 ? fromServer - tick : fromEndTime);

            return (
              <Grid item xs={12} md={6} key={i}>
                <Surface padded={false} sx={{
                  border: isPaused ? `2px solid ${brand.warning}` : isLive ? `2px solid ${brand.danger}` : undefined,
                  position: 'relative',
                  overflow: 'visible',
                  height: '100%',
                }}>
                  {(isLive || isPaused) && (
                    <Box sx={{
                      position: 'absolute', top: -10, right: 16,
                      bgcolor: isPaused ? brand.warning : brand.danger, color: 'white',
                      px: 2, py: 0.5, borderRadius: 10, fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 0.75,
                    }}>
                      {isPaused ? (
                        <> <PauseIcon sx={{ fontSize: 14 }} /> PAUSED </>
                      ) : (
                        <> <span className="assure-live-dot" /> LIVE </>
                      )}
                    </Box>
                  )}
                  <Box sx={{
                    background: isPaused
                      ? `linear-gradient(135deg, ${brand.warning}, #9A5B00)`
                      : isLive
                        ? `linear-gradient(135deg, ${brand.danger}, #8B1A1A)`
                        : isPast ? `linear-gradient(135deg, ${brand.muted}, ${brand.navyMid})`
                        : `linear-gradient(135deg, ${brand.navy}, ${brand.royal})`,
                    p: 2, color: 'white', borderRadius: `${brand.radius}px ${brand.radius}px 0 0`
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
                    {(isLive || isPaused) && (
                      <Box mt={1}>
                        <Chip
                          size="small"
                          label={isPaused ? 'Auction Paused' : `Ends in ${formatRemaining(remainingSeconds)}`}
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.16)',
                            color: '#fff',
                            fontWeight: 700,
                          }}
                        />
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ p: 2.5 }}>
                    <Grid container spacing={2} mb={2}>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary">Chit Value</Typography>
                        <Typography fontWeight={700}>{fmtINR(chitValue)}</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary">
                          {isPast ? 'Winning Bid' : 'Highest Bid'}
                        </Typography>
                        <Typography fontWeight={700} sx={{ color: isLive ? brand.goldDark : brand.navy }}>
                          {highestBid > 0 ? fmtINR(highestBid) : '—'}
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary">Dividend/Member</Typography>
                        <Typography fontWeight={700} sx={{ color: brand.success }}>
                          {dividend > 0 ? fmtINR(dividend) : '—'}
                        </Typography>
                      </Grid>
                    </Grid>

                    {isPast && auction.winner_id && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(201,162,39,0.15)', color: brand.goldDark }}>
                          <TrophyIcon sx={{ fontSize: 16 }} />
                        </Avatar>
                        <Typography variant="body2">
                          Winner: <strong>{auction.winner_id?.full_name || auction.winner?.full_name || 'Declared'}</strong>
                        </Typography>
                      </Box>
                    )}

                    {!isPast && (
                      <Button
                        fullWidth variant="contained"
                        disabled={!isLive && !isPaused}
                        onClick={() => (isLive || isPaused) && navigate(`/auctions/${auction._id || auction.id}`)}
                        sx={{
                          bgcolor: isPaused ? 'warning.main' : isLive ? 'error.main' : 'grey.300',
                          '&:hover': { bgcolor: isPaused ? 'warning.dark' : isLive ? 'error.dark' : 'grey.300' },
                          borderRadius: 2
                        }}
                        startIcon={isPaused ? <GavelIcon /> : <GavelIcon />}
                      >
                        {isPaused ? 'Auction Paused — View Room' : isLive ? 'Enter Auction Room' : `Starts ${auction.auction_date
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
                  </Box>
                </Surface>
              </Grid>
            );
          })}
        </Grid>
      )}


    </PageShell>
  );
};

export default Auctions;

