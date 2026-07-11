import React, { useState } from 'react';
import { Box, Button, Typography, Grid, Stack, TextField, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand, fmtINR } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

export default function Calculator() {
  const navigate = useNavigate();
  const [chitValue, setChitValue] = useState('100000');
  const [months, setMonths] = useState('20');
  const [members, setMembers] = useState('20');
  const [bidAmount, setBidAmount] = useState('75000');

  const cv = Math.max(0, Number(chitValue) || 0);
  const m = Math.max(1, Number(months) || 1);
  const mem = Math.max(1, Number(members) || 1);
  const bid = Math.max(0, Math.min(cv, Number(bidAmount) || 0));

  const monthlyInstallment = cv / m;
  const discount = cv - bid;
  const dividendPerMember = mem > 1 ? discount / (mem - 1) : 0;
  const winnerPayout = bid;

  return (
    <MarketingPage
      eyebrow="Chit Plans"
      title="Returns calculator"
      subtitle="Illustrative estimates only — actual installments include company charges and depend on your group agreement."
      narrow
    >
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Stack spacing={2}>
            <TextField
              label="Chit value (₹)"
              type="number"
              value={chitValue}
              onChange={(e) => setChitValue(e.target.value)}
              fullWidth
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Tenure (months)"
              type="number"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              fullWidth
              inputProps={{ min: 1 }}
            />
            <TextField
              label="Number of members"
              type="number"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
              fullWidth
              inputProps={{ min: 1 }}
            />
            <TextField
              label="Example winning bid (₹)"
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              fullWidth
              helperText="Lower bid = higher discount shared as dividend"
              inputProps={{ min: 0, max: cv }}
            />
          </Stack>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: brand.navy,
              color: '#fff',
              height: '100%',
            }}
          >
            <Typography variant="overline" sx={{ color: brand.goldSoft }}>Illustrative results</Typography>
            <Stack spacing={2} mt={1.5}>
              <Box>
                <Typography fontSize={13} sx={{ color: 'rgba(255,255,255,0.6)' }}>Est. monthly installment</Typography>
                <Typography sx={{ fontFamily: brand.fontDisplay, fontSize: '1.75rem', fontWeight: 600 }}>
                  {fmtINR(Math.round(monthlyInstallment))}
                </Typography>
                <Typography fontSize={12} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  chit value ÷ months (before charges)
                </Typography>
              </Box>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
              <Box>
                <Typography fontSize={13} sx={{ color: 'rgba(255,255,255,0.6)' }}>Auction discount</Typography>
                <Typography fontWeight={700} fontSize={18}>{fmtINR(Math.round(discount))}</Typography>
              </Box>
              <Box>
                <Typography fontSize={13} sx={{ color: 'rgba(255,255,255,0.6)' }}>Dividend per non-winner</Typography>
                <Typography fontWeight={700} fontSize={18}>{fmtINR(Math.round(dividendPerMember))}</Typography>
              </Box>
              <Box>
                <Typography fontSize={13} sx={{ color: 'rgba(255,255,255,0.6)' }}>Winner payout (bid amount)</Typography>
                <Typography fontWeight={700} fontSize={18}>{fmtINR(Math.round(winnerPayout))}</Typography>
              </Box>
            </Stack>
          </Box>
        </Grid>
      </Grid>

      <Typography variant="body2" color="text.secondary" lineHeight={1.75} mt={3} mb={3}>
        This calculator uses simplified math for education. Real groups may have foreman commission, penalties, replacement members, and rounding rules that change net amounts. Always confirm figures in the portal before enrolling.
      </Typography>

      <Button variant="contained" color="secondary" size="large" onClick={() => navigate('/register')}>
        Create account to enroll
      </Button>
    </MarketingPage>
  );
}
