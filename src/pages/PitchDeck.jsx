import React, { useEffect, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleDollarSign, Globe2, LockKeyhole,
  MapPin, Menu, Pause, Play, ShieldCheck, Smartphone, Sparkles, UserRound, Wallet,
  Zap,
} from 'lucide-react'

const slides = [
  {
    eyebrow: 'Investor briefing · 2024',
    title: 'The Future of Local\nService Marketplaces.',
    subtitle: 'Bridging the trust gap through secure handshake technology.',
    type: 'hero',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1600&q=85',
  },
  {
    eyebrow: '01 / The gap',
    title: 'Trust is the missing\nlocal infrastructure.',
    subtitle: 'Home service apps make discovery easy, but the moment work begins, certainty disappears.',
    type: 'problem',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1000&q=85',
  },
  {
    eyebrow: '02 / The ecosystem',
    title: 'Three roles.\nOne secure loop.',
    subtitle: 'HustleFix aligns every participant around visibility, accountability, and fair exchange.',
    type: 'ecosystem',
  },
  {
    eyebrow: '03 / Discovery',
    title: 'Great work is\ncloser than you think.',
    subtitle: 'GPS mathematics filters trusted experts within a 50km radius, turning local demand into local opportunity.',
    type: 'proximity',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1000&q=85',
  },
  {
    eyebrow: '04 / Our USP',
    title: 'The handshake\nthat earns trust.',
    subtitle: 'The client holds the 4-digit OTP. The Pro gets paid only after the work is confirmed.',
    type: 'handshake',
  },
  {
    eyebrow: '05 / Admin power',
    title: 'Safety is a\nreal-time decision.',
    subtitle: 'A reactive Admin Portal gives the team the authority to protect the marketplace in the moment.',
    type: 'admin',
  },
  {
    eyebrow: '06 / Revenue engine',
    title: 'Simple economics.\nInstant alignment.',
    subtitle: 'Every completed job automatically routes 90% to the Hustler and 10% to the Admin Wallet.',
    type: 'revenue',
  },
  {
    eyebrow: '07 / South Africa',
    title: 'Built for the\ncommunity it serves.',
    subtitle: 'Localization in English, Zulu, and Afrikaans makes the marketplace feel genuinely local.',
    type: 'localization',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85',
  },
  {
    eyebrow: '08 / The foundation',
    title: 'Modern architecture.\nSecure by design.',
    subtitle: 'A fast mobile experience, resilient data layer, and standalone payment control room.',
    type: 'tech',
  },
  {
    eyebrow: '09 / The close',
    title: 'Ready for the\nPlay Store.',
    subtitle: 'A scalable, profitable, and secure marketplace for the modern world.',
    type: 'close',
    image: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1400&q=85',
  },
]

function Phone({ children, className = '' }) {
  return <div className={`pitch-phone ${className}`}><div className="pitch-phone-notch" /><div className="pitch-phone-screen">{children}</div></div>
}

function MiniHeader({ label, dark = false }) {
  return <div className={`pitch-mini-header ${dark ? 'is-dark' : ''}`}><span className="pitch-mini-logo">H</span><span>{label}</span><Menu size={14} /></div>
}

function SlideVisual({ slide }) {
  if (slide.type === 'hero') return <div className="pitch-hero-image" style={{ backgroundImage: `url(${slide.image})` }}><div className="pitch-hero-phone"><Phone><MiniHeader label="HustleFix" /><div className="pitch-phone-copy"><span>Good morning,</span><b>Find a Pro nearby.</b></div><div className="pitch-map"><MapPin size={20} /><i /><i /><i /></div><div className="pitch-phone-list"><span><Zap size={12} /> 24 Pros active now</span><span className="pitch-gold-text">Within 50 km <ChevronRight size={12} /></span></div></Phone></div></div>
  if (slide.type === 'problem') return <div className="pitch-photo-card" style={{ backgroundImage: `url(${slide.image})` }}><div className="pitch-photo-caption"><span>THE COST OF UNCERTAINTY</span><b>Fake work. Hidden risk.<br />Zero recourse.</b></div></div>
  if (slide.type === 'ecosystem') return <div className="pitch-ecosystem"><div className="pitch-ecosystem-line" /><div className="pitch-role client"><UserRound /><b>Client</b><span>Requests the fix</span></div><div className="pitch-role pro"><Zap /><b>Pro</b><span>Delivers the work</span></div><div className="pitch-role admin"><ShieldCheck /><b>Admin</b><span>Protects the loop</span></div><div className="pitch-core"><LockKeyhole size={22} /><span>SECURE<br />SAAS CORE</span></div></div>
  if (slide.type === 'proximity') return <div className="pitch-proximity-visual"><div className="pitch-map-large"><span className="pitch-radius">50 km</span><div className="pitch-map-center"><MapPin size={25} /></div><div className="pitch-ping p1" /><div className="pitch-ping p2" /><div className="pitch-ping p3" /><div className="pitch-ping p4" /></div><Phone className="pitch-overlap-phone"><MiniHeader label="Pros near you" /><div className="pitch-phone-copy"><span>Based on your location</span><b>7 trusted Pros found</b></div><div className="pitch-pro-row"><span className="pitch-avatar">TM</span><span><b>Thabo M.</b><small>Electrician · 4.9 ★</small></span><MapPin size={14} /></div><div className="pitch-pro-row"><span className="pitch-avatar gold">LN</span><span><b>Lebo N.</b><small>Plumber · 4.8 ★</small></span><MapPin size={14} /></div></Phone></div>
  if (slide.type === 'handshake') return <div className="pitch-handshake-visual"><div className="pitch-otp-card"><span>CLIENT CONFIRMATION</span><LockKeyhole size={28} /><b>4 8 2 6</b><small>Share only when the work is done.</small></div><div className="pitch-arrow-flow"><span>Job complete</span><ArrowRight /><span>Verify OTP</span><ArrowRight /><span>Release payment</span></div><div className="pitch-verified"><Check size={18} /> PAYMENT VERIFIED</div></div>
  if (slide.type === 'admin') return <div className="pitch-admin-visual"><div className="pitch-admin-top"><span>COMMAND & CONTROL</span><span className="pitch-live"><i /> LIVE</span></div><div className="pitch-admin-grid"><div className="pitch-admin-stat"><small>ACTIVE USERS</small><b>2,481</b><span className="pitch-green">+12.8%</span></div><div className="pitch-admin-stat alert"><small>OPEN DISPUTES</small><b>03</b><span>Needs attention</span></div><div className="pitch-admin-panel"><span><ShieldCheck size={14} /> Safety controls</span><button>Suspend user <Zap size={12} /></button><button>Broadcast update <Globe2 size={12} /></button></div></div><div className="pitch-admin-feed"><span><i className="dot red" /> Suspended account · Mobile kick-out triggered</span><span>2 min ago</span></div></div>
  if (slide.type === 'revenue') return <div className="pitch-revenue-visual"><div className="pitch-revenue-ring"><div><b>10%</b><span>PLATFORM</span></div></div><div className="pitch-money-flow"><div><UserRound /><b>Hustler</b><strong>90%</strong><span>Instant payout</span></div><ArrowRight /><div className="admin-wallet"><Wallet /><b>Admin Wallet</b><strong>10%</strong><span>Platform commission</span></div></div><div className="pitch-complete"><Check size={14} /> JOB COMPLETED · FUNDS ROUTED</div></div>
  if (slide.type === 'localization') return <div className="pitch-localization-visual" style={{ backgroundImage: `url(${slide.image})` }}><div className="pitch-language-card"><span>YOUR MARKET, YOUR LANGUAGE</span><b>Welkom.<br />Sawubona.<br />Hello.</b><div><i>EN</i><i>ZU</i><i>AF</i></div></div></div>
  if (slide.type === 'tech') return <div className="pitch-tech-visual"><div className="pitch-tech-orbit"><div className="pitch-tech-center"><Smartphone size={24} /><span>HUSTLEFIX<br />PLATFORM</span></div><div className="pitch-tech-node compose"><span>01</span><b>Jetpack Compose</b><small>Fast, native UI</small></div><div className="pitch-tech-node firebase"><span>02</span><b>Firebase Realtime DB</b><small>Live marketplace data</small></div><div className="pitch-tech-node render"><span>03</span><b>Node.js on Render</b><small>Secure payments</small></div></div></div>
  return <div className="pitch-close-visual" style={{ backgroundImage: `url(${slide.image})` }}><div className="pitch-close-phone"><Phone><MiniHeader label="HustleFix" /><div className="pitch-phone-copy"><span>Everything is ready.</span><b>Let's get to work.</b></div><div className="pitch-ready"><Check /><span>Play Store<br /><b>READY</b></span></div><div className="pitch-phone-button">Find a Pro <ArrowRight size={14} /></div></Phone></div></div>
}

export default function PitchDeck() {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(false)
  const slide = slides[active]

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowRight' || event.key === ' ') setActive((value) => Math.min(value + 1, slides.length - 1))
      if (event.key === 'ArrowLeft') setActive((value) => Math.max(value - 1, 0))
      if (event.key === 'Escape') setPlaying(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!playing) return undefined
    const timer = setInterval(() => setActive((value) => value === slides.length - 1 ? 0 : value + 1), 7000)
    return () => clearInterval(timer)
  }, [playing])

  return <main className="pitch-deck">
    <div className="pitch-noise" />
    <header className="pitch-topbar"><a className="pitch-brand" href="/"><span>H</span> HUSTLEFIX</a><div className="pitch-top-meta"><span>INVESTOR DECK</span><span className="pitch-top-divider" /><span>SEPT 2024</span></div><button className="pitch-play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause presentation' : 'Play presentation'}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'PAUSE' : 'AUTOPLAY'}</button></header>
    <div className="pitch-main">
      <aside className="pitch-sidebar"><div className="pitch-sidebar-label">HUSTLEFIX / DECK</div><div className="pitch-progress"><span style={{ height: `${((active + 1) / slides.length) * 100}%` }} /></div><div className="pitch-slide-count"><b>{String(active + 1).padStart(2, '0')}</b><span>/</span><span>{String(slides.length).padStart(2, '0')}</span></div><div className="pitch-sidebar-foot">PRIVATE & CONFIDENTIAL<br /><span>SOUTH AFRICA · ZA</span></div></aside>
      <section className={`pitch-content pitch-${slide.type}`} key={active}>
        <div className="pitch-copy"><div className="pitch-eyebrow"><span />{slide.eyebrow}</div><h1>{slide.title.split('\n').map((line, index) => <React.Fragment key={line}>{index > 0 && <br />}{line}</React.Fragment>)}</h1><p>{slide.subtitle}</p>{slide.type === 'hero' && <div className="pitch-hero-meta"><span><Sparkles size={15} /> Trust, re-engineered</span><span>01 — 10</span></div>}{slide.type === 'problem' && <div className="pitch-stat-row"><div><b>62%</b><span>of customers fear<br />poor workmanship</span></div><div><b>0</b><span>secure completion<br />mechanisms today</span></div></div>}{slide.type === 'localization' && <div className="pitch-locale-pills"><span>English</span><span>isiZulu</span><span>Afrikaans</span></div>}{slide.type === 'close' && <button className="pitch-cta" onClick={() => setActive(0)}>Restart the story <ArrowRight size={16} /></button>}</div>
        <div className="pitch-visual"><SlideVisual slide={slide} /></div>
      </section>
    </div>
    <footer className="pitch-footer"><div className="pitch-dots">{slides.map((item, index) => <button key={item.eyebrow} className={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Go to slide ${index + 1}`}><span /></button>)}</div><div className="pitch-nav"><button onClick={() => setActive(Math.max(active - 1, 0))} disabled={active === 0} aria-label="Previous slide"><ArrowLeft size={17} /></button><button onClick={() => setActive(Math.min(active + 1, slides.length - 1))} disabled={active === slides.length - 1} aria-label="Next slide"><ArrowRight size={17} /></button></div><span className="pitch-key-hint">USE ARROW KEYS TO NAVIGATE</span></footer>
  </main>
}
