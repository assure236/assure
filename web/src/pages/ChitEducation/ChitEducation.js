import React, { useState, useCallback } from 'react';
import {
  Box, Container, Grid, Typography, Button, Card, CardContent,
  AppBar, Toolbar, Chip, Paper, Divider, useMediaQuery, IconButton,
  Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  Calculate as CalcIcon,
  Groups as GroupsIcon,
  Gavel as GavelIcon,
  TrendingUp as TrendingIcon,
  LightbulbOutlined as TipIcon,
  Download as DownloadIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as VolumeOffIcon,
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';

const NAVY    = '#0B1F3B';
const NAV_BG  = '#061225';
const ROYAL   = '#1E3A8A';
const GOLD    = '#D4AF37';
const GOLD_LT = '#E3C668';

const FAQS = [
  { q: 'What exactly is a chit fund?', a: 'A chit fund is a group savings plan. A group of people agree to pay a fixed amount every month for a set number of months. Every month, one person from the group gets the full collected amount through an auction. It\'s like saving and borrowing at the same time!' },
  { q: 'How does the auction work?', a: 'Each month, an auction is held. Members who need money can bid — they say how much discount they\'re willing to take. The person willing to take the lowest amount wins. For example, in a ₹1,00,000 chit, if someone bids ₹70,000 (the lowest bid), they win ₹70,000. The remaining ₹30,000 is shared as dividends among all members.' },
  { q: 'What are dividends?', a: 'Dividends are the profit you earn from each auction. When a winner takes less than the full chit amount, the difference is split equally among all members (after company commission). So you earn money every month even if you don\'t win the auction!' },
  { q: 'Is my money safe?', a: 'Yes! Assure Chit Funds is registered under the Chit Funds Act, 1982. Your money is protected by law. We use bank-grade security, and all transactions are transparent and trackable on our app.' },
  { q: 'What if I don\'t want to bid?', a: 'That\'s perfectly fine! If you never bid, you\'ll collect the full chit amount at the end of the term. Plus, you\'ll have earned dividends every single month. Think of it as a savings plan with monthly bonuses.' },
  { q: 'Can I leave a chit group early?', a: 'Chit funds work best when all members stay for the full duration. If you have an emergency, contact our support team. However, leaving early may affect your future eligibility and credit score.' },
  { q: 'What happens if someone doesn\'t pay?', a: 'We have strict KYC and credit checks to prevent defaults. If a member misses a payment, we follow up immediately. Late payments attract a small penalty, and continued defaults can lead to legal action as per the Chit Funds Act.' },
  { q: 'How much do I need to start?', a: 'Our Silver Plan starts at just ₹2,500 per month (₹50,000 chit value). We have plans for every budget — from ₹2,500 to ₹25,000 per month.' },
  { q: 'Can I join multiple chit groups?', a: 'Yes! Many of our members are part of 2 or 3 chit groups at the same time. Just make sure you can comfortably pay all the monthly installments.' },
  { q: 'How do I join?', a: 'Just register on our app or website, complete your KYC (Aadhaar + PAN), and choose a plan. It takes less than 10 minutes!' },
];

const BROCHURES = {
  English: {
    title: 'Assure Chit Funds — Your Trusted Savings Partner',
    subtitle: 'Save Smart. Earn Dividends. Win Big in Auctions.',
    whatIsTitle: 'What is a Chit Fund?',
    whatIsDesc: 'A chit fund is a simple group savings plan where members contribute a fixed amount every month. Each month, one member wins the full amount through an auction. Even if you don\'t win, you earn dividends (monthly bonus) from every auction!',
    exampleTitle: '💡 Quick Example',
    exampleDesc: '20 people save ₹5,000/month → Total pot: ₹1,00,000. If the winner bids ₹70,000, each member gets ₹1,500 as dividend. That\'s a monthly bonus just for saving!',
    howTitle: 'How Does It Work?',
    howSteps: ['Sign up and complete KYC (Aadhaar + PAN)', 'Choose a plan that fits your budget', 'Pay your monthly amount online', 'Bid in the live auction each month', 'Earn dividends every month — even if you don\'t win!'],
    plansTitle: 'Our Plans',
    plans: [
      { name: '🥈 Silver Plan', value: '₹50,000', monthly: '₹2,500/month' },
      { name: '🥇 Gold Plan', value: '₹1,00,000', monthly: '₹5,000/month' },
      { name: '💎 Diamond Plan', value: '₹2,00,000', monthly: '₹10,000/month' },
      { name: '👑 Platinum Plan', value: '₹5,00,000', monthly: '₹25,000/month' },
    ],
    whyTitle: 'Why Choose Assure?',
    whyPoints: ['Registered under Chit Funds Act, 1982', '100% Transparent — track everything on our app', 'Earn dividends every month', 'Quick payouts — money in your bank within 24 hours', '256-bit SSL security on all transactions'],
    cta: '🚀 Join Assure Chit Funds today! Visit assure.fund or download our app. Start saving with just ₹2,500/month!',
  },
  Hindi: {
    title: 'अश्योर चिट फंड्स — आपका भरोसेमंद बचत साथी',
    subtitle: 'स्मार्ट बचत करें। लाभांश कमाएं। नीलामी में बड़ा जीतें।',
    whatIsTitle: 'चिट फंड क्या है?',
    whatIsDesc: 'चिट फंड एक सामूहिक बचत योजना है जहाँ सदस्य हर महीने एक निश्चित राशि जमा करते हैं। हर महीने, एक सदस्य नीलामी के माध्यम से पूरी राशि जीतता है। अगर आप नहीं भी जीतते हैं, तो भी आपको हर नीलामी से लाभांश (मासिक बोनस) मिलता है!',
    exampleTitle: '💡 उदाहरण',
    exampleDesc: '20 लोग ₹5,000/महीना बचाते हैं → कुल पॉट: ₹1,00,000। अगर विजेता ₹70,000 पर बोली लगाता है, तो प्रत्येक सदस्य को ₹1,500 लाभांश मिलता है।',
    howTitle: 'यह कैसे काम करता है?',
    howSteps: ['साइन अप करें और KYC पूरा करें (आधार + PAN)', 'अपने बजट के अनुसार प्लान चुनें', 'हर महीने ऑनलाइन भुगतान करें', 'हर महीने लाइव नीलामी में बोली लगाएं', 'हर महीने लाभांश कमाएं — भले ही आप न जीतें!'],
    plansTitle: 'हमारे प्लान',
    plans: [
      { name: '🥈 सिल्वर प्लान', value: '₹50,000', monthly: '₹2,500/महीना' },
      { name: '🥇 गोल्ड प्लान', value: '₹1,00,000', monthly: '₹5,000/महीना' },
      { name: '💎 डायमंड प्लान', value: '₹2,00,000', monthly: '₹10,000/महीना' },
      { name: '👑 प्लेटिनम प्लान', value: '₹5,00,000', monthly: '₹25,000/महीना' },
    ],
    whyTitle: 'अश्योर क्यों चुनें?',
    whyPoints: ['चिट फंड्स अधिनियम, 1982 के तहत पंजीकृत', '100% पारदर्शी — सब कुछ ऐप पर ट्रैक करें', 'हर महीने लाभांश कमाएं', 'तेज भुगतान — 24 घंटे में पैसा बैंक में', '256-बिट SSL सुरक्षा'],
    cta: '🚀 आज ही अश्योर चिट फंड्स से जुड़ें! assure.fund पर जाएं। सिर्फ ₹2,500/महीने से शुरू करें!',
  },
  Telugu: {
    title: 'అష్యూర్ చిట్ ఫండ్స్ — మీ నమ్మకమైన పొదుపు భాగస్వామి',
    subtitle: 'స్మార్ట్ గా సేవ్ చేయండి. డివిడెండ్లు సంపాదించండి. వేలంలో పెద్దగా గెలవండి.',
    whatIsTitle: 'చిట్ ఫండ్ అంటే ఏమిటి?',
    whatIsDesc: 'చిట్ ఫండ్ అనేది ఒక సమూహ పొదుపు ప్రణాళిక. సభ్యులు ప్రతి నెలా ఒక నిర్ణీత మొత్తాన్ని జమ చేస్తారు. ప్రతి నెలా, ఒక సభ్యుడు వేలం ద్వారా మొత్తం మొత్తాన్ని గెలుచుకుంటాడు. మీరు గెలవకపోయినా, ప్రతి వేలం నుండి డివిడెండ్లు (నెలవారీ బోనస్) పొందుతారు!',
    exampleTitle: '💡 ఉదాహరణ',
    exampleDesc: '20 మంది ₹5,000/నెల సేవ్ చేస్తారు → మొత్తం: ₹1,00,000. గెలిచిన వ్యక్తి ₹70,000 బిడ్ చేస్తే, ప్రతి సభ్యునికి ₹1,500 డివిడెండ్ వస్తుంది.',
    howTitle: 'ఇది ఎలా పని చేస్తుంది?',
    howSteps: ['సైన్ అప్ చేసి KYC పూర్తి చేయండి (ఆధార్ + PAN)', 'మీ బడ్జెట్ కు తగిన ప్లాన్ ఎంచుకోండి', 'ప్రతి నెలా ఆన్ లైన్ లో చెల్లించండి', 'ప్రతి నెలా లైవ్ వేలంలో బిడ్ చేయండి', 'ప్రతి నెలా డివిడెండ్లు సంపాదించండి!'],
    plansTitle: 'మా ప్లాన్లు',
    plans: [
      { name: '🥈 సిల్వర్ ప్లాన్', value: '₹50,000', monthly: '₹2,500/నెల' },
      { name: '🥇 గోల్డ్ ప్లాన్', value: '₹1,00,000', monthly: '₹5,000/నెల' },
      { name: '💎 డైమండ్ ప్లాన్', value: '₹2,00,000', monthly: '₹10,000/నెల' },
      { name: '👑 ప్లాటినం ప్లాన్', value: '₹5,00,000', monthly: '₹25,000/నెల' },
    ],
    whyTitle: 'అష్యూర్ ఎందుకు ఎంచుకోవాలి?',
    whyPoints: ['చిట్ ఫండ్స్ యాక్ట్, 1982 కింద రిజిస్టర్డ్', '100% పారదర్శకం — యాప్ లో అంతా ట్రాక్ చేయండి', 'ప్రతి నెలా డివిడెండ్లు సంపాదించండి', 'వేగవంతమైన చెల్లింపులు — 24 గంటల్లో బ్యాంకులో', '256-బిట్ SSL భద్రత'],
    cta: '🚀 ఈ రోజే అష్యూర్ చిట్ ఫండ్స్ లో చేరండి! assure.fund ని సందర్శించండి. కేవలం ₹2,500/నెల నుండి ప్రారంభించండి!',
  },
  Tamil: {
    title: 'அஷ்யூர் சிட் ஃபண்ட்ஸ் — உங்கள் நம்பகமான சேமிப்பு பங்குதாரர்',
    subtitle: 'ஸ்மார்ட் ஆக சேமியுங்கள். டிவிடெண்ட் சம்பாதியுங்கள். ஏலத்தில் பெரிதாக வெல்லுங்கள்.',
    whatIsTitle: 'சிட் ஃபண்ட் என்றால் என்ன?',
    whatIsDesc: 'சிட் ஃபண்ட் ஒரு குழு சேமிப்பு திட்டம். உறுப்பினர்கள் ஒவ்வொரு மாதமும் ஒரு நிலையான தொகையை செலுத்துவார்கள். ஒவ்வொரு மாதமும், ஒரு உறுப்பினர் ஏலம் மூலம் முழு தொகையையும் வெல்வார். நீங்கள் வெல்லாவிட்டாலும், ஒவ்வொரு ஏலத்திலிருந்தும் டிவிடெண்ட் பெறுவீர்கள்!',
    exampleTitle: '💡 உதாரணம்',
    exampleDesc: '20 பேர் ₹5,000/மாதம் சேமிக்கிறார்கள் → மொத்தம்: ₹1,00,000. வெற்றியாளர் ₹70,000 பிட் செய்தால், ஒவ்வொரு உறுப்பினருக்கும் ₹1,500 டிவிடெண்ட்.',
    howTitle: 'இது எப்படி வேலை செய்கிறது?',
    howSteps: ['பதிவு செய்து KYC முடியுங்கள் (ஆதார் + PAN)', 'உங்கள் பட்ஜெட்டுக்கு ஏற்ற திட்டத்தை தேர்வு செய்யுங்கள்', 'ஒவ்வொரு மாதமும் ஆன்லைனில் செலுத்துங்கள்', 'ஒவ்வொரு மாதமும் லைவ் ஏலத்தில் பிட் செய்யுங்கள்', 'ஒவ்வொரு மாதமும் டிவிடெண்ட் சம்பாதியுங்கள்!'],
    plansTitle: 'எங்கள் திட்டங்கள்',
    plans: [
      { name: '🥈 சில்வர் திட்டம்', value: '₹50,000', monthly: '₹2,500/மாதம்' },
      { name: '🥇 கோல்ட் திட்டம்', value: '₹1,00,000', monthly: '₹5,000/மாதம்' },
      { name: '💎 டைமண்ட் திட்டம்', value: '₹2,00,000', monthly: '₹10,000/மாதம்' },
      { name: '👑 பிளாட்டினம் திட்டம்', value: '₹5,00,000', monthly: '₹25,000/மாதம்' },
    ],
    whyTitle: 'ஏன் அஷ்யூர் தேர்வு செய்ய வேண்டும்?',
    whyPoints: ['சிட் ஃபண்ட்ஸ் சட்டம், 1982 இன் கீழ் பதிவு செய்யப்பட்டது', '100% வெளிப்படையானது — எல்லாவற்றையும் ஆப்பில் பாருங்கள்', 'ஒவ்வொரு மாதமும் டிவிடெண்ட்', 'விரைவான பணம் — 24 மணி நேரத்தில் வங்கியில்', '256-பிட் SSL பாதுகாப்பு'],
    cta: '🚀 இன்றே அஷ்யூர் சிட் ஃபண்ட்ஸில் சேருங்கள்! assure.fund பாருங்கள். வெறும் ₹2,500/மாதத்தில் தொடங்குங்கள்!',
  },
};

const ChitEducation = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:900px)');
  const [expanded, setExpanded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Voice explanation using Web Speech API
  const speakText = useCallback((text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.lang = 'en-IN';
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const explainChitFunds = () => {
    const text = `Welcome to Assure Chit Funds! Let me explain how chit funds work in simple terms. 
    A chit fund is like a group savings plan. Imagine 20 friends agree to put 5000 rupees each into a pot every month for 20 months. That creates a pot of 1 lakh rupees every month. 
    Each month, there is an auction. Members who need money can bid for the pot. The person willing to take the least amount wins. 
    For example, if someone bids 70,000 rupees, they get that amount. The remaining 30,000 rupees is divided equally among all 20 members as dividends — that's 1,500 rupees each! 
    So even if you don't win, you earn money every month. It's like a savings plan with monthly bonuses.
    Our plans start from just 2,500 rupees per month. Join Assure Chit Funds today and start your savings journey!`;
    speakText(text);
  };

  // Generate brochure as printable HTML
  const downloadBrochure = (lang) => {
    const content = BROCHURES[lang];
    if (!content) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Assure Chit Funds - ${content.title}</title>
    <style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#333}
    h1{color:#0B1F3B;border-bottom:3px solid #D4AF37;padding-bottom:10px}h2{color:#1E3A8A;margin-top:30px}
    .highlight{background:#FFF8E1;padding:15px;border-radius:8px;border-left:4px solid #D4AF37;margin:15px 0}
    .plan{background:#F8F9FB;padding:15px;border-radius:8px;margin:10px 0;border:1px solid #E2E8F0}
    .footer{margin-top:40px;padding-top:20px;border-top:2px solid #0B1F3B;text-align:center;color:#666}
    @media print{body{padding:20px}}</style></head><body>
    <h1>🙏 ${content.title}</h1>
    <p><strong>${content.subtitle}</strong></p>
    <h2>${content.whatIsTitle}</h2><p>${content.whatIsDesc}</p>
    <div class="highlight"><strong>${content.exampleTitle}</strong><br>${content.exampleDesc}</div>
    <h2>${content.howTitle}</h2><ol>${content.howSteps.map(s => `<li>${s}</li>`).join('')}</ol>
    <h2>${content.plansTitle}</h2>
    ${content.plans.map(p => `<div class="plan"><strong>${p.name}</strong> — Chit Value: ${p.value} | Monthly: ${p.monthly}</div>`).join('')}
    <h2>${content.whyTitle}</h2><ul>${content.whyPoints.map(p => `<li>${p}</li>`).join('')}</ul>
    <div class="highlight">${content.cta}</div>
    <div class="footer"><p>Assure Chit Funds Pvt. Ltd. | Registered under Chit Funds Act, 1982</p>
    <p>📞 +91 98765 43210 | 🌐 assure.fund | 📧 support@assurechitfunds.com</p></div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Assure_ChitFunds_Brochure_${lang}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'About Us', to: '/about' },
    { label: 'Learn About Chits', to: '/chit-education' },
    { label: 'Contact Us', to: '/contact' },
  ];

  return (
    <Box sx={{ bgcolor: '#F8F9FB', overflowX: 'hidden' }}>
      {/* ─── NAVBAR ─── */}
      <AppBar position="fixed" sx={{ bgcolor: NAV_BG, backdropFilter: 'blur(12px)', borderBottom: `1px solid rgba(212,175,55,0.15)` }}>
        <Toolbar sx={{ justifyContent: 'space-between', maxWidth: 1200, mx: 'auto', width: '100%', px: { xs: 2, md: 3 } }}>
          <Box display="flex" alignItems="center" gap={1.5} sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            <Box component="img" src="/logo.png" alt="Assure" sx={{ width: 52, height: 52 }} />
            <Typography variant="h6" fontWeight={800} sx={{ color: 'white', fontSize: 20 }}>
              Assure <Box component="span" sx={{ color: GOLD }}>Chit Funds</Box>
            </Typography>
          </Box>
          {!isMobile ? (
            <Box display="flex" gap={0.5} alignItems="center">
              {navLinks.map(link => (
                <Button key={link.label} component={Link} to={link.to}
                  sx={{ color: link.to === '/chit-education' ? GOLD : 'rgba(255,255,255,0.85)', fontWeight: 500, fontSize: 14, '&:hover': { color: GOLD, bgcolor: 'rgba(212,175,55,0.08)' } }}>
                  {link.label}
                </Button>
              ))}
              <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.15)', mx: 1 }} />
              <Button variant="outlined" size="small" onClick={() => navigate('/login')}
                sx={{ borderColor: 'rgba(255,255,255,0.25)', color: 'white', mr: 1, '&:hover': { borderColor: GOLD, color: GOLD } }}>Login</Button>
              <Button variant="contained" size="small" onClick={() => navigate('/register')}
                sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, '&:hover': { bgcolor: GOLD_LT } }}>Get Started</Button>
            </Box>
          ) : (
            <Button variant="contained" size="small" onClick={() => navigate('/register')}
              sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700 }}>Join</Button>
          )}
        </Toolbar>
      </AppBar>

      {/* ─── HERO ─── */}
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY}, ${ROYAL})`, pt: 16, pb: 10, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Box sx={{ fontSize: 56, mb: 2 }}>📚</Box>
          <Typography variant="h2" fontWeight={800} sx={{ color: 'white', fontSize: { xs: '2rem', md: '3rem' }, mb: 2 }}>
            Learn About Chit Funds
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, maxWidth: 600, mx: 'auto', lineHeight: 1.7, mb: 3 }}>
            Don't know what a chit fund is? No problem! We'll explain everything in simple words so you can make smart money decisions.
          </Typography>
          <Button
            variant="contained"
            startIcon={isSpeaking ? <VolumeOffIcon /> : <VolumeIcon />}
            onClick={isSpeaking ? stopSpeaking : explainChitFunds}
            sx={{
              bgcolor: isSpeaking ? 'rgba(255,255,255,0.15)' : GOLD,
              color: isSpeaking ? 'white' : NAVY,
              fontWeight: 700,
              borderRadius: 3,
              px: 4, py: 1.2,
              '&:hover': { bgcolor: isSpeaking ? 'rgba(255,255,255,0.25)' : GOLD_LT },
            }}
          >
            {isSpeaking ? 'Stop Listening' : '🔊 Listen — Explain Chit Funds'}
          </Button>
        </Container>
      </Box>

      {/* ─── WHAT IS A CHIT FUND ─── */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Grid container spacing={6}>
          <Grid item xs={12} md={6}>
            <Chip label="THE BASICS" size="small" sx={{ bgcolor: `${GOLD}15`, color: GOLD, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.7rem', md: '2.2rem' }, mb: 3 }}>
              What is a Chit Fund?
            </Typography>
            <Typography sx={{ color: '#475569', fontSize: 16, lineHeight: 1.8, mb: 2 }}>
              Imagine 20 friends decide to save money together. Every month, each person puts in ₹5,000.
              That means every month, there's a total of ₹1,00,000 collected.
            </Typography>
            <Typography sx={{ color: '#475569', fontSize: 16, lineHeight: 1.8, mb: 2 }}>
              Now, every month, one person from the group gets to take this ₹1,00,000 home.
              But here's the interesting part — it's decided through an <strong>auction</strong>.
            </Typography>
            <Typography sx={{ color: '#475569', fontSize: 16, lineHeight: 1.8 }}>
              The person who needs money most will say "I'll take ₹70,000 instead of ₹1,00,000."
              The remaining ₹30,000? It's shared equally among all 20 members as <strong>profit (dividends)</strong>!
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 4, borderRadius: 4, bgcolor: `${NAVY}`, color: 'white' }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: GOLD, mb: 3 }}>Simple Example</Typography>
              <Box sx={{ '& > div': { py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' } }}>
                <Box display="flex" justifyContent="space-between">
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>Chit Value</Typography>
                  <Typography fontWeight={700}>₹1,00,000</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>Members</Typography>
                  <Typography fontWeight={700}>20 people</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>Monthly Installment</Typography>
                  <Typography fontWeight={700}>₹5,000 / person</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>Duration</Typography>
                  <Typography fontWeight={700}>20 months</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>Monthly Collection</Typography>
                  <Typography fontWeight={700} sx={{ color: GOLD }}>₹1,00,000</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" sx={{ borderBottom: 'none' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>Winning Bid Example</Typography>
                  <Typography fontWeight={700} sx={{ color: '#4ade80' }}>₹70,000</Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.15)' }} />
              <Box display="flex" justifyContent="space-between">
                <Typography sx={{ color: GOLD, fontWeight: 600 }}>Your Monthly Dividend</Typography>
                <Typography fontWeight={800} sx={{ color: '#4ade80', fontSize: 18 }}>₹1,500</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 1 }}>
                (₹30,000 discount ÷ 20 members = ₹1,500 each)
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* ─── HOW AUCTIONS WORK ─── */}
      <Box sx={{ bgcolor: '#F1F5F9', py: 10 }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={6}>
            <Chip label="AUCTIONS" size="small" sx={{ bgcolor: `${ROYAL}15`, color: ROYAL, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.7rem', md: '2.2rem' }, mb: 1 }}>
              How Do Auctions Work?
            </Typography>
          </Box>
          <Grid container spacing={4}>
            {[
              { step: '1', icon: <GroupsIcon sx={{ color: GOLD }} />, title: 'Everyone Pays', desc: 'All members pay their monthly installment. The total amount is collected (e.g., ₹1,00,000).' },
              { step: '2', icon: <GavelIcon sx={{ color: GOLD }} />, title: 'Bidding Starts', desc: 'Members who need money can bid. They say how much less they\'re willing to accept. The lowest bid wins.' },
              { step: '3', icon: <TrendingIcon sx={{ color: GOLD }} />, title: 'Winner Gets Money', desc: 'The winner gets their bid amount in their bank account within 24 hours.' },
              { step: '4', icon: <CalcIcon sx={{ color: GOLD }} />, title: 'Others Get Dividends', desc: 'The discount amount is shared equally among all members. This is your dividend — free money!' },
            ].map((s, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Paper sx={{ p: 3, borderRadius: 3, textAlign: 'center', height: '100%', border: '1px solid #E2E8F0' }}>
                  <Box sx={{ mb: 2 }}>{s.icon}</Box>
                  <Chip label={`Step ${s.step}`} size="small" sx={{ bgcolor: `${NAVY}10`, color: NAVY, fontWeight: 700, mb: 2 }} />
                  <Typography variant="h6" fontWeight={700} sx={{ color: NAVY, mb: 1 }}>{s.title}</Typography>
                  <Typography sx={{ color: '#64748B', fontSize: 14, lineHeight: 1.6 }}>{s.desc}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ─── BENEFITS ─── */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Box textAlign="center" mb={6}>
          <Chip label="BENEFITS" size="small" sx={{ bgcolor: `${GOLD}15`, color: GOLD, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
          <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.7rem', md: '2.2rem' } }}>
            Why Join a Chit Fund?
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {[
            { title: 'Forced Savings', desc: 'It helps you save every month without thinking about it. Many people find it hard to save on their own — a chit group keeps you disciplined.', emoji: '💰' },
            { title: 'Access to Large Amounts', desc: 'Need a big amount for education, medical, wedding, or business? You can win it in an auction without taking a bank loan.', emoji: '🏦' },
            { title: 'Earn Dividends', desc: 'Unlike a bank FD where you wait for years, chit funds give you dividends every single month. Your money works for you from day one.', emoji: '📈' },
            { title: 'No Interest Loans', desc: 'When you win an auction, it\'s not a loan. You don\'t pay interest. You just continue paying your regular monthly installment.', emoji: '✅' },
            { title: 'Community Trust', desc: 'You save together with real people. At Assure, all members are KYC verified and every transaction is tracked and transparent.', emoji: '🤝' },
            { title: 'Flexible Plans', desc: 'Choose from plans starting at ₹2,500/month to ₹25,000/month. There\'s something for every budget.', emoji: '🎯' },
          ].map((b, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{ borderRadius: 3, height: '100%', border: '1px solid #E2E8F0', '&:hover': { borderColor: GOLD, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }, transition: 'all 0.3s' }}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box sx={{ fontSize: 36, mb: 1.5 }}>{b.emoji}</Box>
                  <Typography variant="h6" fontWeight={700} sx={{ color: NAVY, mb: 1 }}>{b.title}</Typography>
                  <Typography sx={{ color: '#64748B', fontSize: 14, lineHeight: 1.7 }}>{b.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ─── PRO TIPS ─── */}
      <Box sx={{ bgcolor: `${GOLD}08`, py: 8, borderTop: `1px solid ${GOLD}20`, borderBottom: `1px solid ${GOLD}20` }}>
        <Container maxWidth="md">
          <Box display="flex" alignItems="center" gap={1.5} mb={3}>
            <TipIcon sx={{ color: GOLD, fontSize: 28 }} />
            <Typography variant="h5" fontWeight={800} sx={{ color: NAVY }}>Pro Tips for New Members</Typography>
          </Box>
          <Grid container spacing={2}>
            {[
              'Start with a plan you can comfortably afford. Don\'t stretch your budget.',
              'Don\'t bid too early. Wait a few months to earn dividends before you bid.',
              'If you don\'t need money urgently, skip the auction. You\'ll get the full amount at the end.',
              'Pay your installment on time every month. It builds your credit score with us.',
              'Use the dividend calculator on our website to estimate your returns before joining.',
              'Join multiple chit groups only if you can handle the monthly payments.',
            ].map((tip, i) => (
              <Grid item xs={12} sm={6} key={i}>
                <Box display="flex" gap={1.5} alignItems="flex-start">
                  <CheckIcon sx={{ color: GOLD, fontSize: 20, mt: 0.3 }} />
                  <Typography sx={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>{tip}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ─── FAQs ─── */}
      <Container maxWidth="md" sx={{ py: 10 }}>
        <Box textAlign="center" mb={5}>
          <Chip label="FAQs" size="small" sx={{ bgcolor: `${NAVY}10`, color: NAVY, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
          <Typography variant="h3" fontWeight={800} sx={{ color: NAVY, fontSize: { xs: '1.7rem', md: '2.2rem' } }}>
            Common Questions
          </Typography>
        </Box>
        {FAQS.map((faq, i) => (
          <Accordion key={i} expanded={expanded === i} onChange={(e, isExpanded) => setExpanded(isExpanded ? i : false)}
            sx={{ mb: 1.5, borderRadius: '12px !important', border: '1px solid #E2E8F0', boxShadow: 'none', '&:before': { display: 'none' }, overflow: 'hidden' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600} sx={{ color: NAVY }}>{faq.q}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography sx={{ color: '#64748B', lineHeight: 1.7 }}>{faq.a}</Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Container>

      {/* ─── DOWNLOAD BROCHURES ─── */}
      <Box sx={{ bgcolor: '#F1F5F9', py: 8 }}>
        <Container maxWidth="md">
          <Box textAlign="center" mb={4}>
            <Chip label="BROCHURES" size="small" sx={{ bgcolor: `${GOLD}15`, color: GOLD, fontWeight: 700, mb: 2, letterSpacing: 1 }} />
            <Typography variant="h4" fontWeight={800} sx={{ color: NAVY, mb: 1 }}>
              Download Brochure in Your Language
            </Typography>
            <Typography sx={{ color: '#64748B', fontSize: 15 }}>
              Get a printable brochure explaining how chit funds work — share it with your family and friends!
            </Typography>
          </Box>
          <Grid container spacing={2} justifyContent="center">
            {Object.keys(BROCHURES).map((lang) => (
              <Grid item xs={6} sm={3} key={lang}>
                <Paper
                  onClick={() => downloadBrochure(lang)}
                  sx={{
                    p: 2.5, borderRadius: 3, textAlign: 'center', cursor: 'pointer',
                    border: '1px solid #E2E8F0', transition: 'all 0.3s',
                    '&:hover': { borderColor: GOLD, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', transform: 'translateY(-2px)' },
                  }}
                >
                  <DownloadIcon sx={{ color: GOLD, fontSize: 32, mb: 1 }} />
                  <Typography fontWeight={700} sx={{ color: NAVY, fontSize: 15 }}>{lang}</Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>Click to download</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ─── CTA ─── */}
      <Box sx={{ background: `linear-gradient(135deg, ${NAVY}, ${ROYAL})`, py: 8, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h3" fontWeight={800} color="white" sx={{ mb: 2, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
            Ready to Start Your Chit Fund Journey?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 4, fontSize: 17 }}>
            Now that you know how chit funds work, join Assure and start earning from day one!
          </Typography>
          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
            <Button variant="contained" size="large" onClick={() => navigate('/register')}
              sx={{ bgcolor: GOLD, color: NAVY, fontWeight: 700, borderRadius: 3, px: 5, py: 1.5, '&:hover': { bgcolor: GOLD_LT } }}>
              Register Free
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/contact')}
              sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', borderRadius: 3, px: 5, py: 1.5, '&:hover': { borderColor: 'rgba(255,255,255,0.5)' } }}>
              Ask a Question
            </Button>
          </Box>
        </Container>
      </Box>

      {/* ─── FOOTER ─── */}
      <Box sx={{ bgcolor: NAV_BG, color: 'white', py: 5 }}>
        <Container maxWidth="lg">
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={1.5} sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
              <Box component="img" src="/logo.png" alt="Assure" sx={{ width: 36, height: 36 }} />
              <Typography fontWeight={700}>Assure <span style={{ color: GOLD }}>Chit Funds</span></Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)' }}>
              © {new Date().getFullYear()} Assure Chit Funds Pvt. Ltd. All rights reserved.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default ChitEducation;
