/**
 * Knowledge Base Seed Data for DayTradeDak Chatbot
 * This file contains all FAQ and knowledge content for the RAG system
 */

export interface KnowledgeSeedDocument {
  title: string;
  content: string;
  region: 'us' | 'es' | 'both';
  category: 'faq' | 'academy' | 'mentorship' | 'navigation' | 'pricing' | 'general';
  language: 'en' | 'es';
  tags: string[];
}

export const knowledgeBaseSeedData: KnowledgeSeedDocument[] = [
  // ============================================
  // GENERAL FAQs - English
  // ============================================
  {
    title: 'What is DayTradeDak?',
    content: `DayTradeDak is a professional trading education platform founded by Mijail Medina. We provide comprehensive trading education including live trading sessions, video courses, mentorship programs, and a supportive community of traders.

Key offerings:
- Live Trading Room with real-time market analysis
- Video courses covering trading fundamentals to advanced strategies
- 1-on-1 mentorship programs
- Trading psychology (PsicoTrading) sessions
- Trading journal for tracking and improving performance
- Community events and workshops

Important: DayTradeDak is an EDUCATIONAL platform only. We do not execute trades for users, we are not a broker, and we do not provide financial or investment advice. All content is for educational purposes only.`,
    region: 'both',
    category: 'general',
    language: 'en',
    tags: ['about', 'company', 'overview', 'what is'],
  },
  {
    title: 'Who is Mijail Medina?',
    content: `Mijail Medina is the founder and CEO of DayTradeDak. He is a profitable trader originally from Cienfuegos, Cuba, with a background in mechanical engineering.

His journey:
- Experienced 4 years of losses before achieving consistent profitability
- Reached his first million in trading profits
- Author of "Trading Step by Step" book
- Specialized in live interactive trading sessions
- Passionate about helping others achieve financial independence through disciplined trading

Mijail's teaching philosophy focuses on personal transformation, understanding that success in trading starts with developing the right mindset and discipline.`,
    region: 'both',
    category: 'general',
    language: 'en',
    tags: ['founder', 'ceo', 'mijail', 'about'],
  },
  {
    title: 'Is DayTradeDak a broker?',
    content: `No, DayTradeDak is NOT a broker and does NOT execute trades for users.

DayTradeDak is purely an educational platform that provides:
- Trading education and courses
- Live market analysis sessions
- Mentorship and coaching
- Educational trading signals (for learning purposes only)

To actually trade, you need to:
1. Open an account with a regulated broker of your choice
2. Fund your own trading account
3. Execute your own trades based on your own decisions

We recommend choosing a reputable, regulated broker that suits your needs. Always ensure your broker is properly licensed in your jurisdiction.`,
    region: 'both',
    category: 'faq',
    language: 'en',
    tags: ['broker', 'trading', 'execute', 'not a broker'],
  },
  {
    title: 'What languages does DayTradeDak support?',
    content: `DayTradeDak supports both English and Spanish throughout the platform.

Language support includes:
- Platform interface in English and Spanish
- Course content primarily in Spanish with English subtitles/translations
- Spanish-speaking instructor team
- Customer support in both languages
- Community interactions in both languages

You can change your language preference in the platform settings at any time.`,
    region: 'both',
    category: 'faq',
    language: 'en',
    tags: ['language', 'spanish', 'english', 'bilingual'],
  },

  // ============================================
  // SUBSCRIPTION & PRICING - English
  // ============================================
  {
    title: 'What subscription plans are available?',
    content: `DayTradeDak offers several subscription plans:

**Live Trading Plans:**
- Weekly Live (Manual): Daily live trading sessions, real-time analysis, trading signals, chat with professional traders. Manual weekly renewal.
- Weekly Live (Auto): Same benefits with automatic renewal at a discounted price.

**Monthly Subscriptions:**
- Master Classes: Advanced trading strategies, professional technical analysis, exclusive community. Special price for live subscribers.
- PsicoTrading: Trading psychology sessions, emotional control, mindfulness techniques, personalized mental plan.
- Classes: 15-day intensive course with 40+ hours of content, 6 structured modules.

**One-Time Courses:**
- Peace with Money: 60-day financial transformation program
- Master Course: Comprehensive program with online + in-person components

**Included FREE with Live subscription:**
- Recorded Live: Access to all recorded sessions, new content daily

All prices are in USD. Contact support for current pricing details.`,
    region: 'both',
    category: 'pricing',
    language: 'en',
    tags: ['subscription', 'plans', 'pricing', 'cost', 'weekly', 'monthly'],
  },
  {
    title: 'How do I cancel my subscription?',
    content: `You can cancel your subscription at any time through your account settings.

Steps to cancel:
1. Log in to your account
2. Go to Profile > Subscriptions
3. Find the subscription you want to cancel
4. Click "Cancel Subscription"
5. Confirm your cancellation

Important notes:
- Your access continues until the end of your current billing period
- No partial refunds for unused time
- You can resubscribe at any time
- Auto-renewal subscriptions can be turned off without fully canceling

If you have any issues, contact support@daytradedak.com for assistance.`,
    region: 'both',
    category: 'pricing',
    language: 'en',
    tags: ['cancel', 'subscription', 'unsubscribe', 'stop'],
  },
  {
    title: 'What payment methods are accepted?',
    content: `DayTradeDak accepts the following payment methods:

**Credit/Debit Cards:**
- Visa
- MasterCard
- American Express
- Discover

**Buy Now, Pay Later:**
- Klarna (flexible financing options)
- Afterpay (4 interest-free payments)

**Payment Processing:**
- All payments processed securely through Stripe
- 256-bit SSL encryption
- PCI DSS compliant
- We do NOT store your credit card information

**Payment Options:**
- Full payment
- 2 installments (for some courses)
- 4 monthly payments (for some courses)

All prices are in USD.`,
    region: 'both',
    category: 'pricing',
    language: 'en',
    tags: ['payment', 'credit card', 'klarna', 'afterpay', 'stripe'],
  },
  {
    title: 'What is the refund policy?',
    content: `DayTradeDak refund policy:

**30-Day Guarantee:**
Most subscription plans come with a 30-day money-back guarantee. If you're not satisfied, contact support within 30 days.

**No Refund Items:**
- Master Course (commitment-based program)
- Already consumed digital content
- Partial month usage

**Cancellation Policy:**
- Cancel anytime for recurring subscriptions
- Access continues until end of billing period
- No partial refunds for unused time

**Digital Services Notice:**
Due to the immediate digital nature of our services, refunds are limited once content has been accessed.

For refund requests, contact support@daytradedak.com with your account email and reason for refund.`,
    region: 'both',
    category: 'pricing',
    language: 'en',
    tags: ['refund', 'money back', 'guarantee', 'return'],
  },

  // ============================================
  // ACADEMY & COURSES - English
  // ============================================
  {
    title: 'What courses are available in the Academy?',
    content: `The DayTradeDak Academy offers comprehensive trading education:

**Core Courses:**
- Trading Fundamentals & Market Psychology
- Technical Analysis Mastery (indicators, moving averages, patterns)
- Risk Management Strategies
- Trading Platform Configuration
- Market Structure & Price Action
- Entry & Exit Strategies
- Portfolio Management
- Trading Plan Development

**Specialized Programs:**
- Master Classes: Advanced weekly sessions
- PsicoTrading: Trading psychology deep dive
- Peace with Money: Financial mindset transformation

**Course Features:**
- 40+ hours of video content
- 6 structured modules
- Practical exercises
- Downloadable materials
- Completion certificates
- 24/7 access to subscribed content
- Progress tracking

Courses are primarily in Spanish with support for English speakers.`,
    region: 'both',
    category: 'academy',
    language: 'en',
    tags: ['courses', 'academy', 'learn', 'education', 'classes'],
  },
  {
    title: 'How do I access my courses?',
    content: `To access your courses:

1. Log in to your DayTradeDak account
2. Go to the Academy section from the navigation menu
3. Click on "Courses" or "Classes"
4. Select the course you want to watch
5. Your progress is automatically saved

**Features:**
- Resume where you left off
- Progress tracking across all courses
- Downloadable materials (PDFs, resources)
- Mobile-responsive (watch on any device)
- 24/7 access to your subscribed content

**Troubleshooting:**
- Make sure you have an active subscription for the course
- Check your internet connection
- Try clearing your browser cache
- Use a modern browser (Chrome recommended)

If you can't access a course you've paid for, contact support@daytradedak.com.`,
    region: 'both',
    category: 'academy',
    language: 'en',
    tags: ['access', 'courses', 'watch', 'video', 'login'],
  },
  {
    title: 'Do I get a certificate after completing courses?',
    content: `Yes! DayTradeDak provides completion certificates for courses.

**Certificate Details:**
- Issued upon completing all course modules
- Includes your name and completion date
- Digital certificate (downloadable PDF)
- Verifiable completion record

**How to get your certificate:**
1. Complete all lessons in the course
2. Finish any required exercises
3. Your certificate will be automatically generated
4. Download from your profile or course completion page

**Courses with certificates:**
- Classes (15-day course)
- Master Classes
- Peace with Money
- Master Course (with special certification)

Certificates are great for showing your commitment to trading education!`,
    region: 'both',
    category: 'academy',
    language: 'en',
    tags: ['certificate', 'completion', 'diploma', 'credential'],
  },

  // ============================================
  // LIVE TRADING - English
  // ============================================
  {
    title: 'What is the Live Trading Room?',
    content: `The Live Trading Room is an educational space where you can watch professional traders analyze markets in real-time.

**What happens in Live sessions:**
- Pre-market analysis (8:45 AM - 9:30 AM EST)
- Live market analysis at market open
- Real-time trade explanations
- Technical indicator demonstrations
- Q&A with professional traders
- Community interaction

**Schedule:**
- Monday through Friday
- Morning sessions during market hours
- All sessions are recorded for later viewing

**What you'll learn:**
- How to read charts and identify patterns
- When to enter and exit trades
- Risk management in real scenarios
- Professional decision-making process

**Important:** The Live Trading Room is for EDUCATIONAL purposes only. We share analysis and educational signals, NOT investment advice. You trade through your own broker with your own capital.`,
    region: 'both',
    category: 'academy',
    language: 'en',
    tags: ['live', 'trading room', 'real-time', 'market analysis', 'sessions'],
  },
  {
    title: 'What time are the live trading sessions?',
    content: `Live Trading Room Schedule (Eastern Time - EST):

**Morning Sessions (Monday-Friday):**
- 8:45 AM - 9:30 AM: Pre-market analysis
- 9:30 AM - 10:30 AM: Market open & live trading
- 10:30 AM - 11:00 AM: Q&A session

**Special Sessions:**
- 5:00 PM EST: Afternoon mentorship (select days)
- 6:00 PM EST: YouTube Live Stream (public)
- Friday: Weekly wrap-up and extended Q&A

**Time Zone Conversion:**
- EST = Eastern Standard Time (New York)
- For other time zones, convert from EST
- Example: 9:30 AM EST = 2:30 PM GMT

**Recorded Sessions:**
All live sessions are recorded and available in the "Recorded Live" section for subscribers who can't attend live.

Market holidays: No live sessions on US market holidays.`,
    region: 'us',
    category: 'academy',
    language: 'en',
    tags: ['schedule', 'time', 'live', 'hours', 'when'],
  },
  {
    title: 'Can I watch recorded live sessions?',
    content: `Yes! All live trading sessions are recorded and available for replay.

**Recorded Live Access:**
- FREE for all Live Trading subscribers
- New recordings added daily
- Access to full archive of past sessions
- Watch anytime, 24/7

**How to access:**
1. Log in to your account
2. Go to Academy > Recorded Live (or Live Grabados)
3. Browse sessions by date or topic
4. Click to watch

**Features:**
- Search by date or topic
- Step-by-step explained strategies
- Same content as live sessions
- Download not available (content protection)

**Who gets access:**
- Weekly Live Manual subscribers
- Weekly Live Auto subscribers
- Master Course participants

Perfect for those who can't attend live due to time zones or schedule conflicts!`,
    region: 'both',
    category: 'academy',
    language: 'en',
    tags: ['recorded', 'replay', 'watch later', 'archive', 'grabados'],
  },

  // ============================================
  // TRADING JOURNAL - English
  // ============================================
  {
    title: 'What is the Trading Journal?',
    content: `The Trading Journal is a powerful tool to track, analyze, and improve your trading performance.

**What you can track:**
- All trade types: stocks, options, forex, futures, crypto
- Entry and exit details (price, time, position size)
- Direction (long/short, buy/sell)
- For options: type (call/put), strike price, expiration

**Risk Management tracking:**
- Stop loss and take profit levels
- Position size calculations
- Risk percentage per trade
- R-Multiple calculations
- Risk/reward ratios

**Psychology tracking:**
- Emotions before, during, and after trades
- Confidence levels
- Decision-making notes

**Analysis features:**
- Pre-trade and post-trade notes
- Lessons learned
- Strategy tagging
- Mistake identification

The journal helps you identify patterns in your trading behavior and continuously improve.`,
    region: 'both',
    category: 'navigation',
    language: 'en',
    tags: ['trading journal', 'track trades', 'log', 'journal'],
  },
  {
    title: 'How do I log a trade in the Trading Journal?',
    content: `To log a trade in your Trading Journal:

**Step-by-step:**
1. Go to Academy > Trading Journal
2. Click "Add Trade" or "New Trade"
3. Fill in the required fields:
   - Date and time
   - Symbol (e.g., AAPL, SPY)
   - Market type (stocks, options, forex, etc.)
   - Direction (Long/Short or Buy/Sell)
   - Entry price and position size
4. Optional fields:
   - Stop loss and take profit
   - Strategy used
   - Pre-trade analysis
   - Emotions before trade
5. Click "Save"

**After closing the trade:**
1. Find the trade in your journal
2. Click "Edit" or "Close Trade"
3. Add exit price and time
4. Record exit reason
5. Add post-trade notes and lessons learned
6. Save your updates

Your analytics dashboard will automatically update with your new trade data.`,
    region: 'both',
    category: 'navigation',
    language: 'en',
    tags: ['log trade', 'add trade', 'record trade', 'journal entry'],
  },
  {
    title: 'What analytics does the Trading Journal provide?',
    content: `The Trading Journal provides comprehensive analytics to improve your trading:

**Performance Metrics:**
- Total trades count
- Win rate percentage
- Total P&L (profit and loss)
- Profit factor
- Average winner and loser
- Largest win and loss
- Average R-Multiple
- Expectancy calculation

**Risk Analysis:**
- Average hold time
- Maximum drawdown
- Risk per trade analysis
- Risk/reward ratios

**Breakdown Reports:**
- Performance by market type
- Performance by strategy
- Performance by day of week
- Best and worst trades
- Monthly/weekly summaries

**Psychological Insights:**
- Emotion correlation with results
- Decision pattern analysis
- Mistake frequency tracking

**Export Options:**
- Export your trade data
- Generate performance reports

Use these analytics to identify what's working and what needs improvement in your trading.`,
    region: 'both',
    category: 'navigation',
    language: 'en',
    tags: ['analytics', 'statistics', 'performance', 'metrics', 'reports'],
  },

  // ============================================
  // MENTORSHIP - English
  // ============================================
  {
    title: 'How does the mentorship program work?',
    content: `The DayTradeDak Mentorship Program provides personalized guidance from professional traders.

**What's included:**
- 1-on-1 coaching sessions
- Personalized trading plan development
- Direct feedback on your trades
- Strategy customization for your goals
- Ongoing support and accountability

**Types of mentorship:**
1. **Group Mentorship** (included in some plans)
   - Live Zoom sessions
   - Q&A with mentors
   - Community learning

2. **Private Mentorship** (Master Course)
   - Individual attention
   - Personalized curriculum
   - Trade review sessions

**How to access:**
- Included in Master Course
- Available as upgrade for other plans
- Contact support for availability

**What you'll work on:**
- Developing your trading strategy
- Improving risk management
- Building mental discipline
- Analyzing your journal entries
- Setting realistic goals`,
    region: 'both',
    category: 'mentorship',
    language: 'en',
    tags: ['mentorship', 'coaching', '1-on-1', 'personal', 'mentor'],
  },
  {
    title: 'What is the Master Course?',
    content: `The Master Course is DayTradeDak's most comprehensive trading education program.

**Program Structure:**

**Phase 1: Online Learning (15 days)**
- 8 video lessons
- 16 group mentorship sessions via Zoom
- 4 preparatory live mentorship sessions
- Platform configuration assistance

**Phase 2: In-Person Intensive (3 days)**
- Location: Tampa, FL (US version)
- Live trading sessions with real capital
- 1-on-1 coaching
- Professional networking
- Group trading exercises
- All meals included

**Phase 3: Supervised Practice (2 months)**
- Weekly Q&A sessions
- Private WhatsApp group
- Personalized trading feedback
- Performance tracking

**What's included:**
- 8 comprehensive online modules
- 12+ mentoring sessions
- All course materials
- Professional certification
- Lifetime community access
- Limited to 25 spots per cohort

**Pricing:** Contact for current rates. Payment plans available.`,
    region: 'us',
    category: 'mentorship',
    language: 'en',
    tags: ['master course', 'intensive', 'comprehensive', 'in-person'],
  },

  // ============================================
  // PSICOTRADING - English
  // ============================================
  {
    title: 'What is PsicoTrading?',
    content: `PsicoTrading is our specialized trading psychology program that addresses the mental and emotional aspects of trading.

**Why it matters:**
"90% of trading success is psychological" - Many traders have the technical skills but struggle with emotions like fear, greed, and impulsive decisions.

**What you'll learn:**

**Emotional Control:**
- Managing fear and greed
- Stress management techniques
- Controlling impulses
- Preventing revenge trading

**Mental Discipline:**
- Developing a consistent mindset
- Building patience
- Maintaining focus
- Strengthening discipline

**Decision Making:**
- Making rational trading decisions
- Managing overconfidence
- Recognizing cognitive biases
- Avoiding emotional trading

**Mindfulness Practices:**
- Trading mindfulness techniques
- Mental preparation routines
- Daily practices for traders
- Stress relief methods

**Format:**
- Video lessons and exercises
- Personalized psychological evaluation
- Mental plan adapted to your trading style
- Support group access`,
    region: 'both',
    category: 'academy',
    language: 'en',
    tags: ['psicotrading', 'psychology', 'emotions', 'mental', 'mindset'],
  },

  // ============================================
  // PEACE WITH MONEY - English
  // ============================================
  {
    title: 'What is the Peace with Money program?',
    content: `Peace with Money is a 21-day financial transformation program designed to heal your relationship with money.

**Program Overview:**
- 21 video lessons with theory and practical exercises
- 60 days of access to all content
- Self-paced, 100% online
- Instructor: Jorge Lázaro León (therapist & coach)

**What's included:**
- E-book: "The Definitive Guide to Living Peace with Money"
- Introspection exercises
- Visualization exercises
- Abundance activation exercises
- 3 self-inquiry worksheets (days 7, 14, 21)

**Key themes covered:**
- Identifying limiting beliefs about money
- Healing emotional relationship with wealth
- Building inner peace with finances
- Developing worthiness and abundance mindset
- Creating sustainable financial growth

**Who is it for:**
- Traders frustrated with results despite technical skills
- Those experiencing emotional ups and downs with money
- People who make money but struggle to keep it
- Anyone sensing internal self-sabotage
- Those who understand financial freedom is more than technical analysis

This program addresses the root causes that may be blocking your financial success.`,
    region: 'both',
    category: 'academy',
    language: 'en',
    tags: ['peace with money', 'financial', 'mindset', 'abundance', 'transformation'],
  },

  // ============================================
  // EVENTS - English
  // ============================================
  {
    title: 'How do I register for events?',
    content: `To register for DayTradeDak events:

**Steps:**
1. Go to the Events page
2. Find the event you want to attend
3. Click "Register" or "View Details"
4. Choose your registration type:
   - Free Registration (general access)
   - VIP Registration (exclusive sessions + premium benefits)
5. Fill out the registration form:
   - Personal information
   - Dietary restrictions (for in-person events)
   - Room preferences (if applicable)
6. Complete payment (for paid events)
7. Receive confirmation email

**Registration types:**

**Free Access includes:**
- Main event access
- General activities
- Networking opportunities

**VIP Access includes:**
- Everything in Free access
- Exclusive VIP sessions
- Private talk with mentors
- Signed book (where applicable)
- Private photo opportunity
- Premium seating

**Important:**
- Spots are limited
- Early registration recommended
- Payment plans available for some events`,
    region: 'both',
    category: 'navigation',
    language: 'en',
    tags: ['events', 'register', 'sign up', 'workshop', 'seminar'],
  },
  {
    title: 'What types of events does DayTradeDak offer?',
    content: `DayTradeDak offers various types of events:

**Educational Events:**
- Master Course Intensives: Multi-day comprehensive programs
- Workshops: Focused skill-building sessions
- Webinars: Online educational presentations
- Bootcamps: Intensive short-term training

**Community Events:**
- Networking meetups
- Community gatherings
- Success celebrations
- Trader meetups

**Event Formats:**
- In-person (Tampa, FL and other locations)
- Virtual (Zoom/online)
- Hybrid (combination)

**Typical Event Features:**
- Professional instruction
- Hands-on exercises
- Q&A sessions
- Networking opportunities
- Materials and resources
- Certificates of attendance

**Upcoming Events:**
Check the Events page for current schedule and registration. Events fill up quickly, so register early!

**Location (US):**
Most in-person events are held in Tampa, FL. Virtual options available for those who can't travel.`,
    region: 'us',
    category: 'navigation',
    language: 'en',
    tags: ['events', 'workshop', 'seminar', 'webinar', 'meetup'],
  },

  // ============================================
  // ACCOUNT & PROFILE - English
  // ============================================
  {
    title: 'How do I create an account?',
    content: `Creating a DayTradeDak account is quick and easy:

**Steps:**
1. Go to the Sign Up page
2. Enter your first name
3. Enter your last name
4. Enter your email address
5. Create a password (minimum 6 characters)
6. Accept the Terms of Service
7. Accept the Privacy Policy
8. Accept the Media Usage Terms
9. Accept the Community Guidelines
10. Click "Create Account"

**After registration:**
- You'll receive a verification email
- Click the link to verify your email
- Log in to access your account

**No requirements:**
- No document verification needed
- No broker account required
- No real trading experience necessary

**Tips:**
- Use a valid email you check regularly
- Choose a strong password
- Keep your login credentials secure
- One account per person recommended`,
    region: 'both',
    category: 'navigation',
    language: 'en',
    tags: ['sign up', 'create account', 'register', 'new account'],
  },
  {
    title: 'How do I reset my password?',
    content: `To reset your DayTradeDak password:

**Steps:**
1. Go to the Sign In page
2. Click "Forgot password?"
3. Enter your registered email address
4. Click "Send Reset Link"
5. Check your email (including spam folder)
6. Click the reset link in the email
7. Enter your new password
8. Confirm the new password
9. Log in with your new password

**Tips:**
- Reset links expire after 24 hours
- Use a strong password (mix of letters, numbers, symbols)
- Don't share your password with anyone
- If you don't receive the email, check spam or contact support

**Still having issues?**
Contact support@daytradedak.com with your account email for assistance.`,
    region: 'both',
    category: 'navigation',
    language: 'en',
    tags: ['password', 'reset', 'forgot', 'recover', 'login problem'],
  },
  {
    title: 'How do I update my profile information?',
    content: `To update your profile information:

**Steps:**
1. Log in to your account
2. Click on your profile icon (top right)
3. Select "Profile" or "My Account"
4. Navigate to "Personal Information"
5. Update the fields you want to change:
   - First name
   - Last name
   - Phone number
   - Address
6. Click "Save" to apply changes

**Note:** Your email address cannot be changed directly. Contact support if you need to change your email.

**Other profile sections:**
- Security: Change password
- Subscriptions: View and manage your plans
- Notifications: Set your preferences

**Profile stats you can view:**
- Member since date
- Courses completed
- Learning hours
- Achievements earned
- Day streak`,
    region: 'both',
    category: 'navigation',
    language: 'en',
    tags: ['profile', 'update', 'edit', 'personal information', 'account'],
  },

  // ============================================
  // TECHNICAL SUPPORT - English
  // ============================================
  {
    title: 'What are the technical requirements?',
    content: `Technical requirements for DayTradeDak:

**Minimum Requirements:**
- Stable internet connection (5+ Mbps recommended)
- Modern web browser
- Computer, tablet, or smartphone

**Supported Browsers:**
- Google Chrome (recommended)
- Mozilla Firefox
- Safari
- Microsoft Edge

**For best experience:**
- Use the latest browser version
- Enable JavaScript
- Allow cookies
- Disable ad blockers on our site

**No special software needed:**
- No downloads required
- No plugins needed
- Works entirely in your browser

**Mobile devices:**
- Fully responsive design
- Works on iOS and Android
- Mobile app coming soon

**Video streaming:**
- Stable internet for live sessions
- 720p/1080p video quality
- Some content downloadable (PDFs)

**Troubleshooting:**
- Clear browser cache if experiencing issues
- Try a different browser
- Check internet connection
- Contact support if problems persist`,
    region: 'both',
    category: 'faq',
    language: 'en',
    tags: ['technical', 'requirements', 'browser', 'computer', 'mobile'],
  },
  {
    title: 'How do I contact customer support?',
    content: `DayTradeDak customer support options:

**Email Support:**
- support@daytradedak.com
- Response within 24-48 hours
- Best for detailed questions

**Live Chat:**
- Available on the website
- Click the chat icon
- For quick questions

**Support Hours:**
- Monday - Friday
- 9:00 AM - 6:00 PM EST

**When contacting support, include:**
- Your account email
- Description of the issue
- Screenshots if applicable
- Order/transaction IDs if billing related

**Common issues we help with:**
- Account access problems
- Subscription questions
- Technical difficulties
- Payment issues
- Course access
- Event registration

**Self-service options:**
- Check our FAQ section
- Use this chatbot for quick answers
- Review your account settings

We aim to resolve all issues as quickly as possible!`,
    region: 'both',
    category: 'faq',
    language: 'en',
    tags: ['support', 'contact', 'help', 'customer service', 'email'],
  },

  // ============================================
  // LEGAL & DISCLAIMERS - English
  // ============================================
  {
    title: 'Trading risk disclaimer',
    content: `IMPORTANT RISK DISCLAIMER:

Trading financial instruments carries HIGH RISK and is NOT suitable for all investors.

**Key points:**
- You may lose part or ALL of your invested capital
- Past performance does NOT guarantee future results
- Only trade with money you can afford to lose

**DayTradeDak clarifications:**
- We are an EDUCATIONAL platform only
- We are NOT a broker
- We do NOT execute trades for you
- We do NOT provide financial or investment advice
- All content is for educational purposes only

**Your responsibilities:**
- Do your own research (DYOR)
- Consult with licensed financial advisors
- Understand the risks before trading
- Trade through regulated brokers
- Follow your local regulations

**Educational signals:**
Any trading signals or analysis shared are for EDUCATIONAL purposes only and should NOT be considered investment advice or recommendations to buy/sell any security.

By using DayTradeDak, you acknowledge understanding these risks.`,
    region: 'both',
    category: 'general',
    language: 'en',
    tags: ['risk', 'disclaimer', 'legal', 'warning', 'not advice'],
  },

  // ============================================
  // NAVIGATION HELP - English
  // ============================================
  {
    title: 'How do I navigate the Academy?',
    content: `Navigating the DayTradeDak Academy:

**Main sections:**

**Academy Overview:**
- Dashboard with your progress
- Quick stats (courses completed, hours, achievements)
- Continue where you left off

**Courses/Classes:**
- Browse all available courses
- Filter by category or level
- Track your progress

**Live Trading:**
- Access live trading room
- View schedule
- Join live sessions

**Recorded Live:**
- Archive of all recorded sessions
- Search by date or topic
- Watch at your convenience

**Trading Journal:**
- Log and track your trades
- View analytics and performance
- Identify improvement areas

**Mentorship:**
- Group mentorship sessions
- Schedule information
- Resources and materials

**PsicoTrading:**
- Trading psychology content
- Mental exercises
- Mindset development

**Books:**
- Recommended reading
- Trading library
- Educational resources

Use the left sidebar navigation to quickly access any section.`,
    region: 'both',
    category: 'navigation',
    language: 'en',
    tags: ['navigation', 'academy', 'menu', 'sections', 'how to find'],
  },

  // ============================================
  // SPANISH CONTENT - FAQs Generales
  // ============================================
  {
    title: '¿Qué es DayTradeDak?',
    content: `DayTradeDak es una plataforma de educación profesional en trading fundada por Mijail Medina. Proporcionamos educación integral en trading incluyendo sesiones de trading en vivo, cursos en video, programas de mentoría y una comunidad de apoyo.

Lo que ofrecemos:
- Sala de Trading en Vivo con análisis de mercado en tiempo real
- Cursos en video desde fundamentos hasta estrategias avanzadas
- Programas de mentoría 1-a-1
- Sesiones de psicología del trading (PsicoTrading)
- Diario de trading para seguimiento y mejora
- Eventos comunitarios y talleres

Importante: DayTradeDak es ÚNICAMENTE una plataforma EDUCATIVA. No ejecutamos operaciones para usuarios, no somos un broker y no proporcionamos asesoramiento financiero o de inversión. Todo el contenido es solo para fines educativos.`,
    region: 'both',
    category: 'general',
    language: 'es',
    tags: ['qué es', 'sobre', 'compañía', 'descripción'],
  },
  {
    title: '¿Quién es Mijail Medina?',
    content: `Mijail Medina es el fundador y CEO de DayTradeDak. Es un trader rentable originario de Cienfuegos, Cuba, con formación en ingeniería mecánica.

Su trayectoria:
- Experimentó 4 años de pérdidas antes de lograr rentabilidad consistente
- Alcanzó su primer millón en ganancias de trading
- Autor del libro "Trading Paso a Paso"
- Especializado en sesiones de trading interactivas en vivo
- Apasionado por ayudar a otros a lograr independencia financiera

La filosofía de enseñanza de Mijail se centra en la transformación personal, entendiendo que el éxito en el trading comienza con desarrollar la mentalidad y disciplina correctas.`,
    region: 'both',
    category: 'general',
    language: 'es',
    tags: ['fundador', 'ceo', 'mijail', 'sobre'],
  },
  {
    title: '¿DayTradeDak es un broker?',
    content: `No, DayTradeDak NO es un broker y NO ejecuta operaciones para los usuarios.

DayTradeDak es puramente una plataforma educativa que proporciona:
- Educación y cursos de trading
- Sesiones de análisis de mercado en vivo
- Mentoría y coaching
- Señales educativas de trading (solo para aprendizaje)

Para operar realmente, necesitas:
1. Abrir una cuenta con un broker regulado de tu elección
2. Depositar fondos en tu propia cuenta de trading
3. Ejecutar tus propias operaciones basadas en tus propias decisiones

Recomendamos elegir un broker de buena reputación y regulado que se adapte a tus necesidades. Siempre asegúrate de que tu broker esté debidamente autorizado en tu jurisdicción.`,
    region: 'both',
    category: 'faq',
    language: 'es',
    tags: ['broker', 'trading', 'ejecutar', 'no es broker'],
  },

  // ============================================
  // SPANISH - Suscripciones y Precios
  // ============================================
  {
    title: '¿Qué planes de suscripción están disponibles?',
    content: `DayTradeDak ofrece varios planes de suscripción:

**Planes de Trading en Vivo:**
- Live Semanal (Manual): Sesiones diarias de trading en vivo, análisis en tiempo real, señales de trading, chat con traders profesionales. Renovación semanal manual.
- Live Semanal (Auto): Mismos beneficios con renovación automática a precio con descuento.

**Suscripciones Mensuales:**
- Master Classes: Estrategias avanzadas de trading, análisis técnico profesional, comunidad exclusiva. Precio especial para suscriptores de Live.
- PsicoTrading: Sesiones de psicología del trading, control emocional, técnicas de mindfulness, plan mental personalizado.
- Clases: Curso intensivo de 15 días con más de 40 horas de contenido, 6 módulos estructurados.

**Cursos de Pago Único:**
- Paz con el Dinero: Programa de transformación financiera de 60 días
- Máster Course: Programa integral con componentes online + presenciales

**Incluido GRATIS con suscripción Live:**
- Live Grabados: Acceso a todas las sesiones grabadas, contenido nuevo diariamente

Todos los precios están en USD. Contacta a soporte para detalles de precios actuales.`,
    region: 'both',
    category: 'pricing',
    language: 'es',
    tags: ['suscripción', 'planes', 'precios', 'costo', 'mensual', 'semanal'],
  },
  {
    title: '¿Cómo cancelo mi suscripción?',
    content: `Puedes cancelar tu suscripción en cualquier momento desde la configuración de tu cuenta.

Pasos para cancelar:
1. Inicia sesión en tu cuenta
2. Ve a Perfil > Suscripciones
3. Encuentra la suscripción que deseas cancelar
4. Haz clic en "Cancelar Suscripción"
5. Confirma tu cancelación

Notas importantes:
- Tu acceso continúa hasta el final de tu período de facturación actual
- No hay reembolsos parciales por tiempo no utilizado
- Puedes volver a suscribirte en cualquier momento
- Las suscripciones con renovación automática pueden desactivarse sin cancelar completamente

Si tienes algún problema, contacta a support@daytradedak.com para asistencia.`,
    region: 'both',
    category: 'pricing',
    language: 'es',
    tags: ['cancelar', 'suscripción', 'dar de baja', 'detener'],
  },
  {
    title: '¿Qué métodos de pago se aceptan?',
    content: `DayTradeDak acepta los siguientes métodos de pago:

**Tarjetas de Crédito/Débito:**
- Visa
- MasterCard
- American Express
- Discover

**Compra Ahora, Paga Después:**
- Klarna (opciones de financiamiento flexible)
- Afterpay (4 pagos sin intereses)

**Procesamiento de Pagos:**
- Todos los pagos procesados de forma segura a través de Stripe
- Encriptación SSL de 256 bits
- Cumplimiento PCI DSS
- NO almacenamos información de tu tarjeta de crédito

**Opciones de Pago:**
- Pago completo
- 2 cuotas (para algunos cursos)
- 4 pagos mensuales (para algunos cursos)

Todos los precios están en USD.`,
    region: 'both',
    category: 'pricing',
    language: 'es',
    tags: ['pago', 'tarjeta', 'klarna', 'afterpay', 'stripe'],
  },

  // ============================================
  // SPANISH - Academia y Cursos
  // ============================================
  {
    title: '¿Qué cursos están disponibles en la Academia?',
    content: `La Academia DayTradeDak ofrece educación integral en trading:

**Cursos Principales:**
- Fundamentos del Trading y Psicología del Mercado
- Dominio del Análisis Técnico (indicadores, medias móviles, patrones)
- Estrategias de Gestión de Riesgo
- Configuración de Plataformas de Trading
- Estructura del Mercado y Acción del Precio
- Estrategias de Entrada y Salida
- Gestión de Portafolio
- Desarrollo del Plan de Trading

**Programas Especializados:**
- Master Classes: Sesiones avanzadas semanales
- PsicoTrading: Profundización en psicología del trading
- Paz con el Dinero: Transformación de mentalidad financiera

**Características de los Cursos:**
- Más de 40 horas de contenido en video
- 6 módulos estructurados
- Ejercicios prácticos
- Materiales descargables
- Certificados de finalización
- Acceso 24/7 al contenido suscrito
- Seguimiento de progreso`,
    region: 'both',
    category: 'academy',
    language: 'es',
    tags: ['cursos', 'academia', 'aprender', 'educación', 'clases'],
  },
  {
    title: '¿Cuál es el horario de las sesiones en vivo?',
    content: `Horario de la Sala de Trading en Vivo (Hora del Este - EST):

**Sesiones Matutinas (Lunes-Viernes):**
- 8:45 AM - 9:30 AM: Análisis pre-mercado
- 9:30 AM - 10:30 AM: Apertura del mercado y trading en vivo
- 10:30 AM - 11:00 AM: Sesión de preguntas y respuestas

**Sesiones Especiales:**
- 5:00 PM EST: Mentoría de la tarde (días selectos)
- 6:00 PM EST: Transmisión en vivo en YouTube (público)
- Viernes: Resumen semanal y Q&A extendido

**Conversión de Zona Horaria:**
- EST = Hora Estándar del Este (Nueva York)
- Para otras zonas horarias, convierte desde EST
- España: 9:30 AM EST = 3:30 PM hora española

**Sesiones Grabadas:**
Todas las sesiones en vivo se graban y están disponibles en la sección "Live Grabados" para suscriptores que no pueden asistir en vivo.

Días festivos: No hay sesiones en vivo en días festivos del mercado estadounidense.`,
    region: 'both',
    category: 'academy',
    language: 'es',
    tags: ['horario', 'tiempo', 'en vivo', 'horas', 'cuándo'],
  },

  // ============================================
  // SPANISH - Diario de Trading
  // ============================================
  {
    title: '¿Qué es el Diario de Trading?',
    content: `El Diario de Trading es una herramienta poderosa para rastrear, analizar y mejorar tu rendimiento en trading.

**Qué puedes rastrear:**
- Todos los tipos de operaciones: acciones, opciones, forex, futuros, cripto
- Detalles de entrada y salida (precio, hora, tamaño de posición)
- Dirección (largo/corto, compra/venta)
- Para opciones: tipo (call/put), precio strike, vencimiento

**Seguimiento de Gestión de Riesgo:**
- Niveles de stop loss y take profit
- Cálculos de tamaño de posición
- Porcentaje de riesgo por operación
- Cálculos de R-Múltiple
- Ratios de riesgo/recompensa

**Seguimiento Psicológico:**
- Emociones antes, durante y después de las operaciones
- Niveles de confianza
- Notas de toma de decisiones

**Funciones de Análisis:**
- Notas pre y post operación
- Lecciones aprendidas
- Etiquetado de estrategias
- Identificación de errores

El diario te ayuda a identificar patrones en tu comportamiento de trading y mejorar continuamente.`,
    region: 'both',
    category: 'navigation',
    language: 'es',
    tags: ['diario', 'trading journal', 'registrar', 'operaciones'],
  },
  {
    title: '¿Cómo registro una operación en el Diario de Trading?',
    content: `Para registrar una operación en tu Diario de Trading:

**Paso a paso:**
1. Ve a Academia > Diario de Trading
2. Haz clic en "Agregar Operación" o "Nueva Operación"
3. Completa los campos requeridos:
   - Fecha y hora
   - Símbolo (ej: AAPL, SPY)
   - Tipo de mercado (acciones, opciones, forex, etc.)
   - Dirección (Largo/Corto o Compra/Venta)
   - Precio de entrada y tamaño de posición
4. Campos opcionales:
   - Stop loss y take profit
   - Estrategia utilizada
   - Análisis pre-operación
   - Emociones antes de la operación
5. Haz clic en "Guardar"

**Después de cerrar la operación:**
1. Encuentra la operación en tu diario
2. Haz clic en "Editar" o "Cerrar Operación"
3. Agrega precio y hora de salida
4. Registra razón de salida
5. Agrega notas post-operación y lecciones aprendidas
6. Guarda tus actualizaciones

Tu panel de análisis se actualizará automáticamente con los datos de tu nueva operación.`,
    region: 'both',
    category: 'navigation',
    language: 'es',
    tags: ['registrar operación', 'agregar trade', 'anotar', 'entrada diario'],
  },

  // ============================================
  // SPANISH - PsicoTrading
  // ============================================
  {
    title: '¿Qué es PsicoTrading?',
    content: `PsicoTrading es nuestro programa especializado de psicología del trading que aborda los aspectos mentales y emocionales del trading.

**Por qué importa:**
"El 90% del éxito en trading es psicológico" - Muchos traders tienen las habilidades técnicas pero luchan con emociones como el miedo, la avaricia y las decisiones impulsivas.

**Qué aprenderás:**

**Control Emocional:**
- Manejar el miedo y la avaricia
- Técnicas de manejo del estrés
- Control de impulsos
- Prevenir el trading de venganza

**Disciplina Mental:**
- Desarrollar una mentalidad consistente
- Construir paciencia
- Mantener el enfoque
- Fortalecer la disciplina

**Toma de Decisiones:**
- Tomar decisiones racionales de trading
- Manejar el exceso de confianza
- Reconocer sesgos cognitivos
- Evitar el trading emocional

**Prácticas de Mindfulness:**
- Técnicas de mindfulness para trading
- Rutinas de preparación mental
- Prácticas diarias para traders
- Métodos de alivio del estrés`,
    region: 'both',
    category: 'academy',
    language: 'es',
    tags: ['psicotrading', 'psicología', 'emociones', 'mental', 'mentalidad'],
  },

  // ============================================
  // SPANISH - Paz con el Dinero
  // ============================================
  {
    title: '¿Qué es el programa Paz con el Dinero?',
    content: `Paz con el Dinero es un programa de transformación financiera de 21 días diseñado para sanar tu relación con el dinero.

**Descripción del Programa:**
- 21 lecciones en video con teoría y ejercicios prácticos
- 60 días de acceso a todo el contenido
- A tu propio ritmo, 100% online
- Instructor: Jorge Lázaro León (terapeuta y coach)

**Qué incluye:**
- E-book: "La Guía Definitiva para Vivir en Paz con el Dinero"
- Ejercicios de introspección
- Ejercicios de visualización
- Ejercicios de activación de abundancia
- 3 hojas de auto-indagación (días 7, 14, 21)

**Temas clave cubiertos:**
- Identificar creencias limitantes sobre el dinero
- Sanar la relación emocional con la riqueza
- Construir paz interior con las finanzas
- Desarrollar mentalidad de merecimiento y abundancia
- Crear crecimiento financiero sostenible

**Para quién es:**
- Traders frustrados con resultados a pesar de habilidades técnicas
- Quienes experimentan altibajos emocionales con el dinero
- Personas que ganan dinero pero luchan por mantenerlo
- Cualquiera que sienta auto-sabotaje interno
- Quienes entienden que la libertad financiera es más que análisis técnico`,
    region: 'both',
    category: 'academy',
    language: 'es',
    tags: ['paz con el dinero', 'financiero', 'mentalidad', 'abundancia', 'transformación'],
  },

  // ============================================
  // SPANISH - Cuenta y Soporte
  // ============================================
  {
    title: '¿Cómo creo una cuenta?',
    content: `Crear una cuenta en DayTradeDak es rápido y fácil:

**Pasos:**
1. Ve a la página de Registro
2. Ingresa tu nombre
3. Ingresa tu apellido
4. Ingresa tu correo electrónico
5. Crea una contraseña (mínimo 6 caracteres)
6. Acepta los Términos de Servicio
7. Acepta la Política de Privacidad
8. Acepta los Términos de Uso de Medios
9. Acepta las Normas de la Comunidad
10. Haz clic en "Crear Cuenta"

**Después del registro:**
- Recibirás un correo de verificación
- Haz clic en el enlace para verificar tu email
- Inicia sesión para acceder a tu cuenta

**Sin requisitos:**
- No se necesita verificación de documentos
- No se requiere cuenta de broker
- No se necesita experiencia real en trading

**Consejos:**
- Usa un email válido que revises regularmente
- Elige una contraseña segura
- Mantén tus credenciales de acceso seguras
- Se recomienda una cuenta por persona`,
    region: 'both',
    category: 'navigation',
    language: 'es',
    tags: ['registrarse', 'crear cuenta', 'nueva cuenta', 'inscribirse'],
  },
  {
    title: '¿Cómo contacto al soporte al cliente?',
    content: `Opciones de soporte al cliente de DayTradeDak:

**Soporte por Email:**
- support@daytradedak.com
- Respuesta dentro de 24-48 horas
- Mejor para preguntas detalladas

**Chat en Vivo:**
- Disponible en el sitio web
- Haz clic en el ícono de chat
- Para preguntas rápidas

**Horario de Soporte:**
- Lunes - Viernes
- 9:00 AM - 6:00 PM EST

**Al contactar soporte, incluye:**
- Tu email de cuenta
- Descripción del problema
- Capturas de pantalla si aplica
- IDs de orden/transacción si es relacionado con facturación

**Problemas comunes con los que ayudamos:**
- Problemas de acceso a cuenta
- Preguntas sobre suscripciones
- Dificultades técnicas
- Problemas de pago
- Acceso a cursos
- Registro a eventos

¡Nuestro objetivo es resolver todos los problemas lo más rápido posible!`,
    region: 'both',
    category: 'faq',
    language: 'es',
    tags: ['soporte', 'contacto', 'ayuda', 'servicio al cliente', 'email'],
  },

  // ============================================
  // SPANISH - Disclaimer Legal
  // ============================================
  {
    title: 'Descargo de responsabilidad sobre riesgos del trading',
    content: `IMPORTANTE DESCARGO DE RESPONSABILIDAD SOBRE RIESGOS:

Operar con instrumentos financieros conlleva ALTO RIESGO y NO es adecuado para todos los inversores.

**Puntos clave:**
- Puedes perder parte o TODO tu capital invertido
- El rendimiento pasado NO garantiza resultados futuros
- Solo opera con dinero que puedas permitirte perder

**Aclaraciones de DayTradeDak:**
- Somos una plataforma EDUCATIVA únicamente
- NO somos un broker
- NO ejecutamos operaciones por ti
- NO proporcionamos asesoramiento financiero o de inversión
- Todo el contenido es solo para fines educativos

**Tus responsabilidades:**
- Haz tu propia investigación (DYOR)
- Consulta con asesores financieros licenciados
- Entiende los riesgos antes de operar
- Opera a través de brokers regulados
- Sigue las regulaciones de tu localidad

**Señales educativas:**
Cualquier señal de trading o análisis compartido es ÚNICAMENTE para fines EDUCATIVOS y NO debe considerarse asesoramiento de inversión o recomendaciones para comprar/vender ningún valor.

Al usar DayTradeDak, reconoces entender estos riesgos.`,
    region: 'both',
    category: 'general',
    language: 'es',
    tags: ['riesgo', 'descargo', 'legal', 'advertencia', 'no es consejo'],
  },
];

export default knowledgeBaseSeedData;
