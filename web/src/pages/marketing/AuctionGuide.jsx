import React from 'react';
import { Box, Button, Typography, Grid, Stack, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const SECTIONS = [
  {
    title: 'What is a bid (discount)?',
    body: 'In a chit auction, members compete by offering to take less than the full chit value. This offer is called the bid or discount. A bid of ₹80,000 on a ₹1,00,000 chit means the winner accepts ₹20,000 less than the pot — that ₹20,000 becomes the dividend pool for other members.',
  },
  {
    title: 'How the winner is decided',
    body: 'The member with the lowest valid bid wins, subject to group rules and any eligibility checks (for example, members who already took the prize may be ineligible). Ties and invalid bids are handled per the group agreement displayed before you join the room.',
  },
  {
    title: 'Dividend to other members',
    body: 'After the auction closes, the discount is divided equally among members who did not win that month. The dividend reduces your net installment for that cycle and appears in Transactions once processing completes.',
  },
  {
    title: 'Prize payout to the winner',
    body: 'The winner receives the chit value minus their bid amount (and minus any documented charges). Payout timing follows the group schedule — typically within a few business days after the auction, once installments for that month are confirmed.',
  },
  {
    title: 'Live auction room',
    body: 'Assure runs live auction rooms on the web portal and mobile app. You see the countdown, current leading bid, and your own bid status in real time. Join from the Auctions section when your group session is open — no separate phone call is required.',
  },
];

export default function AuctionGuide() {
  const navigate = useNavigate();

  return (
    <MarketingPage
      eyebrow="Chit Plans"
      title="Auction guide"
      subtitle="How monthly bidding works — discounts, winners, dividends, and the live room members use on web and app."
    >
      <Stack spacing={2.5}>
        {SECTIONS.map((s) => (
          <Box
            key={s.title}
            sx={{
              p: 3,
              borderRadius: 3,
              border: `1px solid ${brand.line}`,
              bgcolor: '#fff',
            }}
          >
            <Typography variant="h6" sx={{ color: brand.navy, mb: 1 }}>{s.title}</Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.75}>{s.body}</Typography>
          </Box>
        ))}
      </Stack>

      <Divider sx={{ my: 4, borderColor: brand.line }} />

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Box sx={{ p: 3, borderRadius: 3, bgcolor: brand.canvas, border: `1px solid ${brand.line}` }}>
            <Typography fontWeight={700} sx={{ color: brand.navy, mb: 1 }}>Before you bid</Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.75}>
              Ensure your installment for the month is paid or scheduled. Review the minimum bid allowed and whether you are eligible to take the prize. Bid only what you are willing to accept as payout.
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box sx={{ p: 3, borderRadius: 3, bgcolor: brand.canvas, border: `1px solid ${brand.line}` }}>
            <Typography fontWeight={700} sx={{ color: brand.navy, mb: 1 }}>After the auction</Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.75}>
              Results are recorded in the portal. Winners see payout status; other members see dividend credits. Contact support if an outcome does not match what you observed in the live room.
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mt={4}>
        <Button variant="contained" onClick={() => navigate('/plans/how-chits-work')}>
          How chits work
        </Button>
        <Button onClick={() => navigate('/plans/calculator')}>Try calculator</Button>
        <Button onClick={() => navigate('/login')}>Login to join auctions</Button>
      </Stack>
    </MarketingPage>
  );
}
