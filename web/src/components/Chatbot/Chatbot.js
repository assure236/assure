import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Fab, Dialog, DialogTitle, DialogContent, IconButton, TextField,
  Typography, Paper, CircularProgress, Chip, Slide
} from '@mui/material';
import {
  SmartToy as BotIcon, Close as CloseIcon, Send as SendIcon,
  ArrowForward as ArrowIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const WELCOME_MESSAGE = { from: 'bot', text: "Hi! I'm Assure Bot 🤖\nHow can I help you today?\n\nTry: \"Show chits for 20 months\" or \"My payments\"", chitGroups: [] };

const Chatbot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const navigate = useNavigate();

  // Reset chat on close — fresh greeting on next open
  const handleClose = () => {
    setOpen(false);
    // Wipe history after dialog close animation finishes
    setTimeout(() => {
      setMessages([WELCOME_MESSAGE]);
      setInput('');
    }, 250);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { from: 'user', text }]);
    setLoading(true);
    try {
      // Build history of last 8 turns excluding the welcome message and the
      // user message we just appended (the server prepends the current message).
      const history = messages
        .filter(m => m !== WELCOME_MESSAGE && m.text)
        .slice(-8)
        .map(m => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text }));
      const res = await axios.post('/chatbot/chat', { message: text, history });
      if (res.data.success) {
        const { reply, chitGroups, actionType } = res.data.data;
        setMessages(prev => [...prev, { from: 'bot', text: reply, chitGroups: chitGroups || [], actionType }]);
      } else {
        setMessages(prev => [...prev, { from: 'bot', text: 'Sorry, something went wrong. Please try again.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { from: 'bot', text: 'Unable to reach server. Please try again later.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleChitClick = (id) => {
    handleClose();
    navigate(`/chit-groups/${id}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* FAB */}
      <Fab
        color="primary"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
          background: 'linear-gradient(135deg, #0B1F3B, #1E3A8A)',
          '&:hover': { background: 'linear-gradient(135deg, #1E3A8A, #0d47a1)' }
        }}
      >
        <BotIcon />
      </Fab>

      {/* Chat Dialog */}
      <Dialog
        open={open} onClose={handleClose}
        maxWidth="sm" fullWidth
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'up' }}
        PaperProps={{ sx: { borderRadius: 3, height: '70vh', maxHeight: 600, display: 'flex', flexDirection: 'column' } }}
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #0B1F3B, #1E3A8A)',
          color: 'white', display: 'flex', alignItems: 'center', gap: 1, py: 1.5
        }}>
          <BotIcon /> Assure Bot
          <Box flex={1} />
          <IconButton onClick={handleClose} sx={{ color: 'white' }}><CloseIcon /></IconButton>
        </DialogTitle>

        <DialogContent sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: '#f5f5f5' }}>
          {messages.map((msg, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start', mb: 1.5 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5, maxWidth: '85%', borderRadius: 2,
                  bgcolor: msg.from === 'user' ? '#0B1F3B' : 'white',
                  color: msg.from === 'user' ? 'white' : 'text.primary',
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{msg.text}</Typography>

                {/* Clickable chit group cards */}
                {msg.chitGroups?.length > 0 && (
                  <Box mt={1.5}>
                    {msg.chitGroups.map(g => (
                      <Paper
                        key={g._id}
                        elevation={1}
                        onClick={() => handleChitClick(g._id)}
                        sx={{
                          p: 1.5, mb: 1, borderRadius: 2, cursor: 'pointer',
                          border: '1px solid #e0e0e0',
                          '&:hover': { bgcolor: '#E8EDF5', borderColor: '#0B1F3B' },
                          transition: 'all 0.2s'
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{g.group_name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              ₹{Number(g.chit_value).toLocaleString('en-IN')} • {g.duration_months} months • ₹{Number(g.monthly_installment).toLocaleString('en-IN')}/mo
                            </Typography>
                          </Box>
                          <ArrowIcon fontSize="small" color="primary" />
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Paper>
            </Box>
          ))}
          {loading && (
            <Box display="flex" justifyContent="flex-start" mb={1.5}>
              <Paper elevation={0} sx={{ p: 1.5, bgcolor: 'white', borderRadius: 2 }}>
                <CircularProgress size={18} />
              </Paper>
            </Box>
          )}
          <div ref={bottomRef} />
        </DialogContent>

        {/* Quick Chips */}
        <Box sx={{ px: 2, py: 1, bgcolor: '#fafafa', display: 'flex', gap: 0.5, overflowX: 'auto' }}>
          {['Active chits', 'My payments', 'Next auction'].map(q => (
            <Chip
              key={q} label={q} size="small" variant="outlined" clickable
              onClick={() => { setInput(q); }}
              sx={{ fontSize: 11 }}
            />
          ))}
        </Box>

        {/* Input */}
        <Box sx={{ display: 'flex', gap: 1, p: 1.5, borderTop: '1px solid #e0e0e0' }}>
          <TextField
            fullWidth size="small" placeholder="Type your message..."
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
          <IconButton color="primary" onClick={sendMessage} disabled={!input.trim() || loading}>
            <SendIcon />
          </IconButton>
        </Box>
      </Dialog>
    </>
  );
};

export default Chatbot;
