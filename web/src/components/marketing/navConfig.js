/**
 * Marketing nav — 6 primary tabs (plus Home), patterned after
 * Margadarsi / myPaisaa: About · Schemes · Auctions · Tools · Members · Support.
 * Every leaf is its own page (no long single-page anchors).
 */
export const marketingNav = [
  {
    id: 'about',
    label: 'About Us',
    path: '/company',
    columns: [
      {
        heading: 'Know Assure',
        links: [
          { label: 'Our Story', desc: 'Hyderabad roots and mission', path: '/company/our-story' },
          { label: 'Why Assure', desc: 'What members get in the portal', path: '/company/why-assure' },
          { label: 'Trust & Compliance', desc: 'Registration, KYC, safeguards', path: '/company/trust' },
        ],
      },
    ],
  },
  {
    id: 'schemes',
    label: 'Schemes',
    path: '/plans',
    columns: [
      {
        heading: 'Browse by size',
        links: [
          { label: 'All Chit Plans', desc: 'Starter, Growth, and Prime tiers', path: '/plans' },
          { label: 'Starter Plans', desc: '₹25,000 – ₹1 Lakh groups', path: '/plans/starter' },
          { label: 'Growth Plans', desc: '₹2 – ₹5 Lakh groups', path: '/plans/growth' },
          { label: 'Prime Plans', desc: '₹5 Lakh+ groups', path: '/plans/prime' },
        ],
      },
      {
        heading: 'Understand enrollment',
        links: [
          { label: 'How Chits Work', desc: 'Enroll → pay → auction → payout', path: '/plans/how-chits-work' },
          { label: 'Vacant vs Active', desc: 'When a group starts and seats open', path: '/plans/group-status' },
        ],
      },
    ],
  },
  {
    id: 'auctions',
    label: 'Auctions',
    path: '/auctions-info',
    columns: [
      {
        heading: 'Live bidding',
        links: [
          { label: 'Auction Overview', desc: 'Why auctions matter in a chit', path: '/auctions-info' },
          { label: 'Auction Guide', desc: 'Discount bids, winner, payout', path: '/plans/auction-guide' },
          { label: 'Dividends Explained', desc: 'How non-winners earn each month', path: '/plans/dividends' },
          { label: 'Bidding Tips', desc: 'Practical habits before you bid', path: '/plans/bid-tips' },
        ],
      },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    path: '/tools',
    columns: [
      {
        heading: 'Plan smarter',
        links: [
          { label: 'Returns Calculator', desc: 'Estimate installment and dividend', path: '/plans/calculator' },
          { label: 'Member Journey', desc: 'Register to first auction, step by step', path: '/learn/member-journey' },
          { label: 'Education Hub', desc: 'Guides for first-time members', path: '/learn' },
        ],
      },
    ],
  },
  {
    id: 'members',
    label: 'Members',
    path: '/members',
    columns: [
      {
        heading: 'Your account',
        links: [
          { label: 'Member Login', desc: 'Open the web portal', path: '/login' },
          { label: 'Create Account', desc: 'Start KYC and enrollment', path: '/register' },
          { label: 'Refer & Earn', desc: '₹500 wallet reward when friends join', path: '/learn/refer' },
          { label: 'Family Accounts', desc: 'Manage family chits from one login', path: '/members/family' },
        ],
      },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    path: '/support-center',
    columns: [
      {
        heading: 'Get help',
        links: [
          { label: 'FAQs', desc: 'Payments, KYC, auctions, groups', path: '/support-center/faq' },
          { label: 'Contact Us', desc: 'Phone, email, office hours', path: '/support-center/contact' },
        ],
      },
      {
        heading: 'Legal',
        links: [
          { label: 'Terms of Service', desc: 'Membership terms', path: '/terms' },
          { label: 'Privacy Policy', desc: 'How we handle your data', path: '/privacy-policy' },
        ],
      },
    ],
  },
];

export const footerColumns = [
  {
    heading: 'About',
    links: [
      { label: 'Our Story', path: '/company/our-story' },
      { label: 'Why Assure', path: '/company/why-assure' },
      { label: 'Trust & Compliance', path: '/company/trust' },
    ],
  },
  {
    heading: 'Schemes & Auctions',
    links: [
      { label: 'All Plans', path: '/plans' },
      { label: 'Auctions', path: '/auctions-info' },
      { label: 'Calculator', path: '/plans/calculator' },
      { label: 'How Chits Work', path: '/plans/how-chits-work' },
    ],
  },
  {
    heading: 'Members',
    links: [
      { label: 'Login', path: '/login' },
      { label: 'Register', path: '/register' },
      { label: 'Refer & Earn', path: '/learn/refer' },
      { label: 'Family Accounts', path: '/members/family' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'FAQs', path: '/support-center/faq' },
      { label: 'Contact', path: '/support-center/contact' },
      { label: 'Terms', path: '/terms' },
      { label: 'Privacy', path: '/privacy-policy' },
    ],
  },
];
