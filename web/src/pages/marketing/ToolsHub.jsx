import React from 'react';
import { Box, Button, Grid, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { brand } from '../../theme/brand';
import { MarketingPage } from '../../components/marketing/MarketingLayout';

const CARDS = [
  { title: 'Returns Calculator', path: '/plans/calculator', body: 'Estimate monthly installment and sample dividend.' },
  { title: 'Member Journey', path: '/learn/member-journey', body: 'From register and DigiLocker to your first auction.' },
  { title: 'Education Hub', path: '/learn', body: 'Short guides without the long homepage scroll.' },
  { title: 'How Chits Work', path: '/plans/how-chits-work', body: 'The full monthly cycle in plain language.' },
];

export default function ToolsHub() {
  const navigate = useNavigate();
  return (
    <MarketingPage
      eyebrow="Tools"
      title="Tools to plan before you join"
      subtitle="Top chit platforms put calculators and education next to schemes — so you enroll with eyes open."
    >
      <Grid container spacing={2}>
        {CARDS.map((c) => (
          <Grid item xs={12} sm={6} key={c.path}>
            <Box
              onClick={() => navigate(c.path)}
              sx={{
                p: 2.5,
                height: '100%',
                borderRadius: 3,
                border: `1px solid ${brand.line}`,
                bgcolor: '#fff',
                cursor: 'pointer',
                '&:hover': { borderColor: 'rgba(201,162,39,0.5)' },
              }}
            >
              <Typography fontWeight={800}>{c.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{c.body}</Typography>
              <Button size="small" sx={{ mt: 1.5 }} onClick={(e) => { e.stopPropagation(); navigate(c.path); }}>
                Open
              </Button>
            </Box>
          </Grid>
        ))}
      </Grid>
    </MarketingPage>
  );
}
