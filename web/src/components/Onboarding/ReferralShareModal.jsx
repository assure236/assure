import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, IconButton, Box } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import { toast } from 'react-toastify';

const SITE_URL = 'https://assure.fund';
const SHARE_TEXT = `Hi! I’ve been using Assure ChitFunds — a transparent, secure way to save and grow your money with monthly chit auctions. Join me on the platform and start your savings journey today.\n\n${SITE_URL}`;

export default function ReferralShareModal({ open, onClose, referralCode }) {
  const text = referralCode
    ? `${SHARE_TEXT}\n\nUse my referral code: ${referralCode}`
    : SHARE_TEXT;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); }
    catch { toast.error('Copy failed'); }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Assure ChitFunds', text, url: SITE_URL }); }
      catch (_) {}
    } else {
      copy();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pr: 5 }}>
        Share Assure with friends
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Welcome aboard! Share Assure with friends and family — and earn referral rewards when they join.
          </Typography>
          <Box sx={{ bgcolor: '#f1f5f9', p: 1.5, borderRadius: 1.5, fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {text}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, p: 2 }}>
        <Button onClick={onClose} color="inherit">Maybe later</Button>
        <Button startIcon={<ContentCopyIcon />} onClick={copy}>Copy</Button>
        <Button startIcon={<ShareIcon />} onClick={nativeShare}>Share</Button>
        <Button
          variant="contained"
          startIcon={<WhatsAppIcon />}
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1ebe5a' } }}
        >
          WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  );
}
