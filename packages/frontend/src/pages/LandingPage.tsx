import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ShoppingBag,
  Zap,
  ShieldCheck,
  LayoutDashboard,
  Smartphone,
  BarChart3,
  Menu as MenuIcon,
  X,
  Star,
  QrCode,
  Bell,
  TrendingUp,
  Users,
  MapPin,
  Loader2,
} from 'lucide-react';

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap');

  :root {
    --primary: #ff4d00;
    --primary-dark: #cc3d00;
    --primary-mid: #ff6a33;
    --primary-light: #ffe9e0;
    --primary-bg: #fff5f0;
    --orange: #f97316;
    --orange-dark: #ea580c;
    --orange-light: #fed7aa;
    --orange-bg: #fff7ed;
    --dark: #111827;
    --gray-900: #1f2937;
    --gray-600: #4b5563;
    --gray-400: #9ca3af;
    --gray-100: #f3f4f6;
    --white: #ffffff;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .lp-root {
    font-family: 'Roboto', sans-serif;
    background: var(--white);
    color: var(--dark);
    overflow-x: hidden;
    min-height: 100vh;
  }

  /* ── Nav ── */
  .lp-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    height: 68px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 3rem;
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid #e5e7eb;
  }
  .lp-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
  }
  .lp-logo-icon { background: var(--primary);
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lp-logo-text {
    font-size: 1.3rem;
    font-weight: 800;
    color: var(--dark);
    letter-spacing: -0.3px;
  }
  .lp-logo-text span { color: var(--primary); }

  .lp-nav-links {
    display: flex;
    align-items: center;
    gap: 2.5rem;
    list-style: none;
  }
  .lp-nav-links a {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--gray-600);
    text-decoration: none;
    transition: color 0.2s;
  }
  .lp-nav-links a:hover { color: var(--primary); }

  .lp-btn-nav {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0.6rem 1.4rem;
    border-radius: 999px;
    background: var(--primary);
    color: white;
    font-weight: 700;
    font-size: 0.875rem;
    text-decoration: none;
    transition: all 0.25s;
    font-family: 'Roboto', sans-serif;
    border: none;
    cursor: pointer;
  }
  .lp-btn-nav:hover {
    background: var(--primary-dark);
    transform: translateY(-1px);
    color: white;
    text-decoration: none;
  }

  .lp-mobile-btn {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--dark);
  }

  /* ── Hero ── */
  .lp-hero {
    padding: 120px 3rem 80px;
    background: var(--white);
    position: relative;
  }

  .lp-hero-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
    align-items: center;
  }

  .lp-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--primary-bg);
    color: var(--primary);
    font-size: 0.78rem;
    font-weight: 700;
    border: 1px solid #bbf7d0;
    margin-bottom: 1.5rem;
    letter-spacing: 0.2px;
  }

  .lp-hero-title {
    font-size: clamp(2.4rem, 4.5vw, 3.8rem);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -1.5px;
    margin-bottom: 1.5rem;
    color: var(--dark);
  }
  .lp-hero-title .g { color: var(--primary); }
  .lp-hero-title .o { color: var(--orange); }

  .lp-hero-desc {
    font-size: 1.05rem;
    color: var(--gray-600);
    line-height: 1.75;
    margin-bottom: 2.5rem;
    max-width: 480px;
    font-weight: 400;
  }

  .lp-hero-cta {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 3rem;
  }

  .lp-btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0.85rem 2rem;
    border-radius: 14px;
    background: var(--primary);
    color: white;
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    transition: all 0.25s;
    font-family: 'Roboto', sans-serif;
    border: none;
    cursor: pointer;
    letter-spacing: -0.2px;
  }
  .lp-btn-primary:hover {
    background: var(--primary-dark);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(22,163,74,0.35);
    color: white;
    text-decoration: none;
  }
  .lp-btn-primary .arrow { transition: transform 0.2s; }
  .lp-btn-primary:hover .arrow { transform: translateX(3px); }

  .lp-btn-ghost {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0.85rem 2rem;
    border-radius: 14px;
    background: var(--white);
    color: var(--dark);
    font-weight: 600;
    font-size: 0.95rem;
    text-decoration: none;
    border: 1.5px solid #e5e7eb;
    transition: all 0.25s;
    font-family: 'Roboto', sans-serif;
  }
  .lp-btn-ghost:hover {
    border-color: var(--primary);
    color: var(--primary);
    text-decoration: none;
  }

  .lp-stats {
    display: flex;
    gap: 2rem;
    padding-top: 2rem;
    border-top: 1px solid #f3f4f6;
  }
  .lp-stat-num {
    font-size: 1.7rem;
    font-weight: 800;
    letter-spacing: -1px;
  }
  .lp-stat-num.g { color: var(--primary); }
  .lp-stat-num.o { color: var(--orange); }
  .lp-stat-label {
    font-size: 0.75rem;
    color: var(--gray-400);
    font-weight: 600;
    margin-top: 3px;
  }
  .lp-stat-divider {
    width: 1px;
    background: #f3f4f6;
    align-self: stretch;
  }

  /* Hero right: clean phone mockup */
  .lp-hero-visual {
    position: relative;
    display: flex;
    justify-content: center;
  }
  .lp-phone {
    width: 260px;
    background: var(--dark);
    border-radius: 40px;
    padding: 14px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.06);
  }
  .lp-phone-screen {
    background: #1a1a2e;
    border-radius: 30px;
    overflow: hidden;
    aspect-ratio: 9/19;
    display: flex;
    flex-direction: column;
  }
  .lp-phone-header {
    padding: 18px 14px 12px;
    background: linear-gradient(135deg, rgba(249,115,22,0.25), rgba(22,163,74,0.2));
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .lp-phone-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .lp-phone-logo-dot {
    width: 26px; height: 26px;
    border-radius: 8px;
    background: var(--orange);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lp-phone-title {
    font-size: 0.72rem;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
  }
  .lp-phone-subtitle {
    font-size: 0.58rem;
    color: rgba(255,255,255,0.4);
  }
  .lp-phone-qr {
    display: flex;
    align-items: center;
    gap: 7px;
    background: rgba(22,163,74,0.2);
    border-radius: 8px;
    padding: 7px 9px;
    border: 1px solid rgba(22,163,74,0.3);
  }
  .lp-phone-qr-text {
    font-size: 0.6rem;
    color: rgba(255,255,255,0.65);
    font-weight: 600;
  }
  .lp-phone-body {
    flex: 1;
    padding: 12px;
  }
  .lp-menu-section-label {
    font-size: 0.58rem;
    font-weight: 700;
    color: rgba(255,255,255,0.38);
    letter-spacing: 0.8px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .lp-menu-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px;
    margin-bottom: 10px;
  }
  .lp-menu-item {
    background: rgba(255,255,255,0.05);
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.04);
  }
  .lp-menu-img {
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
  }
  .lp-menu-item-info { padding: 5px 7px 7px; }
  .lp-menu-item-name {
    font-size: 0.56rem;
    font-weight: 700;
    color: rgba(255,255,255,0.82);
    margin-bottom: 2px;
  }
  .lp-menu-item-price {
    font-size: 0.58rem;
    color: var(--orange);
    font-weight: 700;
  }
  .lp-phone-cart {
    margin-top: 8px;
    background: var(--primary);
    border-radius: 8px;
    padding: 9px 11px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .lp-cart-text { font-size: 0.6rem; font-weight: 700; color: white; }
  .lp-cart-arrow {
    width: 18px; height: 18px;
    background: rgba(255,255,255,0.2);
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Floating badges */
  .lp-floating-badge {
    position: absolute;
    background: var(--white);
    border-radius: 14px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--dark);
    white-space: nowrap;
    z-index: 3;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    border: 1px solid #f3f4f6;
  }
  .lp-fb-new-order {
    top: 10%;
    left: -80px;
  }
  .lp-fb-rating {
    bottom: 22%;
    right: -70px;
  }
  .lp-fb-icon {
    width: 28px; height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* ── Trusted brands bar ── */
  .lp-trust {
    background: var(--primary-bg);
    padding: 2rem 3rem;
    border-top: 1px solid #bbf7d0;
    border-bottom: 1px solid #bbf7d0;
  }
  .lp-trust-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 3rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  .lp-trust-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--primary);
    text-transform: uppercase;
    letter-spacing: 1px;
    white-space: nowrap;
  }
  .lp-trust-items {
    display: flex;
    gap: 2.5rem;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
  }
  .lp-trust-item {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--gray-400);
    letter-spacing: 0.5px;
  }

  /* ── Features Section ── */
  .lp-features {
    background: var(--white);
    padding: 7rem 3rem;
  }
  .lp-features-inner {
    max-width: 1200px;
    margin: 0 auto;
  }
  .lp-section-header {
    text-align: center;
    margin-bottom: 4rem;
  }
  .lp-section-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border-radius: 999px;
    background: var(--primary-bg);
    color: var(--primary);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 1rem;
    border: 1px solid #bbf7d0;
  }
  .lp-section-tag.orange {
    background: var(--orange-bg);
    color: var(--orange);
    border-color: #fed7aa;
  }
  .lp-section-title {
    font-size: clamp(1.8rem, 3.5vw, 2.8rem);
    font-weight: 800;
    letter-spacing: -1px;
    line-height: 1.15;
    margin-bottom: 1rem;
    color: var(--dark);
  }
  .lp-section-desc {
    font-size: 1.05rem;
    color: var(--gray-600);
    line-height: 1.7;
    max-width: 560px;
    margin: 0 auto;
  }

  .lp-features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
  .lp-feat-card {
    padding: 2rem;
    border-radius: 20px;
    border: 1.5px solid #f3f4f6;
    transition: all 0.25s;
    background: var(--white);
  }
  .lp-feat-card:hover {
    border-color: var(--primary);
    box-shadow: 0 8px 32px rgba(22,163,74,0.1);
    transform: translateY(-3px);
  }
  .lp-feat-icon {
    width: 48px; height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.2rem;
  }
  .lp-feat-icon.green { background: var(--primary-bg); color: var(--primary); }
  .lp-feat-icon.orange { background: var(--orange-bg); color: var(--orange); }
  .lp-feat-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--dark);
    margin-bottom: 0.5rem;
    letter-spacing: -0.2px;
  }
  .lp-feat-desc {
    font-size: 0.875rem;
    color: var(--gray-600);
    line-height: 1.65;
  }

  /* ── How it works ── */
  .lp-steps {
    background: var(--primary-bg);
    padding: 7rem 3rem;
    border-top: 1px solid #bbf7d0;
    border-bottom: 1px solid #bbf7d0;
  }
  .lp-steps-inner {
    max-width: 1200px;
    margin: 0 auto;
  }
  .lp-steps-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2rem;
    margin-top: 3rem;
    position: relative;
  }
  .lp-steps-grid::before {
    content: '';
    position: absolute;
    top: 30px;
    left: 12%;
    right: 12%;
    height: 2px;
    background: linear-gradient(90deg, var(--orange), var(--primary));
    border-radius: 2px;
    z-index: 0;
  }
  .lp-step {
    text-align: center;
    position: relative;
    z-index: 1;
  }
  .lp-step-circle {
    width: 64px; height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.2rem;
    font-size: 1.1rem;
    font-weight: 800;
    color: white;
    transition: transform 0.25s;
  }
  .lp-step:hover .lp-step-circle { transform: scale(1.1); }
  .lp-step-circle.orange { background: var(--orange); box-shadow: 0 6px 20px rgba(249,115,22,0.35); }
  .lp-step-circle.green { background: var(--primary); box-shadow: 0 6px 20px rgba(22,163,74,0.35); }
  .lp-step-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--dark);
    margin-bottom: 0.4rem;
  }
  .lp-step-desc {
    font-size: 0.82rem;
    color: var(--gray-600);
    line-height: 1.6;
  }

  /* ── Testimonials ── */
  .lp-testimonials {
    background: var(--white);
    padding: 7rem 3rem;
  }
  .lp-testimonials-inner {
    max-width: 1200px;
    margin: 0 auto;
  }
  .lp-testimonials-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    margin-top: 3rem;
  }
  .lp-testimonial-card {
    padding: 2rem;
    border-radius: 20px;
    border: 1.5px solid #f3f4f6;
    background: var(--white);
    transition: all 0.25s;
  }
  .lp-testimonial-card:hover {
    border-color: var(--primary);
    box-shadow: 0 8px 32px rgba(22,163,74,0.08);
  }
  .lp-testimonial-stars {
    display: flex;
    gap: 3px;
    margin-bottom: 1rem;
  }
  .lp-testimonial-text {
    font-size: 0.92rem;
    color: var(--gray-600);
    line-height: 1.7;
    margin-bottom: 1.5rem;
    font-style: italic;
  }
  .lp-testimonial-author {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .lp-author-avatar {
    width: 40px; height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.85rem;
    color: white;
  }
  .lp-author-name {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--dark);
  }
  .lp-author-role {
    font-size: 0.75rem;
    color: var(--gray-400);
    font-weight: 500;
  }

  /* ── CTA Banner ── */
  .lp-cta {
    background: var(--primary);
    padding: 7rem 3rem;
  }
  .lp-cta-inner {
    max-width: 900px;
    margin: 0 auto;
    text-align: center;
  }
  .lp-cta-title {
    font-size: clamp(2rem, 4vw, 3.2rem);
    font-weight: 800;
    color: white;
    letter-spacing: -1.5px;
    line-height: 1.15;
    margin-bottom: 1.2rem;
  }
  .lp-cta-desc {
    font-size: 1.05rem;
    color: rgba(255,255,255,0.8);
    line-height: 1.7;
    margin-bottom: 2.5rem;
    max-width: 520px;
    margin-left: auto;
    margin-right: auto;
  }
  .lp-cta-btns {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  .lp-btn-cta-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 1rem 2.2rem;
    border-radius: 14px;
    background: var(--white);
    color: var(--primary-dark);
    font-weight: 800;
    font-size: 0.95rem;
    text-decoration: none;
    transition: all 0.25s;
    font-family: 'Roboto', sans-serif;
    border: none;
    cursor: pointer;
  }
  .lp-btn-cta-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.2);
    color: var(--primary-dark);
    text-decoration: none;
  }
  .lp-btn-cta-ghost {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 1rem 2.2rem;
    border-radius: 14px;
    background: rgba(255,255,255,0.12);
    color: white;
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    transition: all 0.25s;
    border: 1.5px solid rgba(255,255,255,0.3);
    font-family: 'Roboto', sans-serif;
    cursor: pointer;
  }
  .lp-btn-cta-ghost:hover {
    background: rgba(255,255,255,0.22);
    color: white;
    text-decoration: none;
  }

  /* ── Footer ── */
  .lp-footer {
    background: var(--dark);
    padding: 3rem;
  }
  .lp-footer-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1.5rem;
  }
  .lp-footer-links {
    display: flex;
    gap: 2rem;
    list-style: none;
  }
  .lp-footer-links a {
    font-size: 0.85rem;
    color: rgba(255,255,255,0.4);
    text-decoration: none;
    transition: color 0.2s;
    font-weight: 500;
  }
  .lp-footer-links a:hover { color: var(--primary-mid); }
  .lp-footer-copy {
    font-size: 0.8rem;
    color: rgba(255,255,255,0.25);
    font-weight: 500;
  }

  /* Mobile menu overlay */
  .lp-mobile-menu {
    position: fixed;
    inset: 0;
    z-index: 99;
    background: rgba(17,24,39,0.97);
    backdrop-filter: blur(20px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2.5rem;
  }
  .lp-mobile-menu a {
    font-size: 1.4rem;
    font-weight: 700;
    color: white;
    text-decoration: none;
    font-family: 'Sora', sans-serif;
    transition: color 0.2s;
  }
  .lp-mobile-menu a:hover { color: var(--orange); }
  .lp-mobile-close {
    position: absolute;
    top: 1.2rem; right: 1.5rem;
    width: 44px; height: 44px;
    border-radius: 12px;
    background: rgba(255,255,255,0.1);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .lp-features-grid { grid-template-columns: repeat(2, 1fr); }
    .lp-steps-grid { grid-template-columns: repeat(2, 1fr); gap: 2.5rem; }
    .lp-steps-grid::before { display: none; }
    .lp-testimonials-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 768px) {
    .lp-nav { padding: 0 1.5rem; }
    .lp-nav-links { display: none; }
    .lp-mobile-btn { display: flex; }
    .lp-hero { padding: 100px 1.5rem 60px; }
    .lp-hero-inner { grid-template-columns: 1fr; text-align: center; }
    .lp-hero-cta { justify-content: center; }
    .lp-stats { justify-content: center; }
    .lp-hero-visual { display: none; }
    .lp-hero-desc { margin: 0 auto 2.5rem; }
    .lp-features { padding: 5rem 1.5rem; }
    .lp-features-grid { grid-template-columns: 1fr; }
    .lp-steps { padding: 5rem 1.5rem; }
    .lp-steps-grid { grid-template-columns: 1fr 1fr; gap: 2rem; }
    .lp-testimonials { padding: 5rem 1.5rem; }
    .lp-testimonials-grid { grid-template-columns: 1fr; }
    .lp-cta { padding: 5rem 1.5rem; }
    .lp-footer { padding: 2rem 1.5rem; }
    .lp-footer-inner { flex-direction: column; text-align: center; }
    .lp-footer-links { justify-content: center; }
    .lp-trust { padding: 1.5rem; }
    .lp-fb-new-order, .lp-fb-rating { display: none; }
  }

  @media (max-width: 480px) {
    .lp-steps-grid { grid-template-columns: 1fr; }
    .lp-hero-title { letter-spacing: -1px; }
  }

  /* ── Gallery ── */
  .lp-gallery {
    background: var(--white);
    padding: 7rem 3rem;
  }
  .lp-gallery-inner {
    max-width: 1200px;
    margin: 0 auto;
  }
  .lp-gallery-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
    margin-top: 3rem;
  }
  .lp-gallery-item {
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0,0,0,0.1);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    background: var(--white);
    border: 1px solid #f3f4f6;
  }
  .lp-gallery-item:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  }
  .lp-gallery-img {
    width: 100%;
    height: auto;
    display: block;
    object-fit: cover;
  }

  @media (max-width: 1024px) {
    .lp-gallery-grid { grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
  }
  @media (max-width: 768px) {
    .lp-gallery { padding: 5rem 1.5rem; }
    .lp-gallery-grid { grid-template-columns: 1fr; gap: 2rem; }
    .lp-gallery-item:hover { transform: translateY(-4px) scale(1.01); }
  }

  /* ── Desktop Mockup ── */
  .lp-desktop {
    background: var(--primary-bg);
    padding: 7rem 3rem;
    border-top: 1px solid #bbf7d0;
    border-bottom: 1px solid #bbf7d0;
  }
  .lp-desktop-inner {
    max-width: 1200px;
    margin: 0 auto;
    text-align: center;
  }
  .lp-desktop-container {
    margin-top: 3rem;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2.5rem;
  }
  .lp-desktop-card {
    background: var(--white);
    border-radius: 16px;
    padding: 8px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.1);
    border: 1px solid #e5e7eb;
    transition: transform 0.3s ease;
  }
  .lp-desktop-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 25px 70px rgba(0,0,0,0.15);
  }
  .lp-desktop-bar {
    height: 24px;
    background: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 5px;
    border-radius: 10px 10px 0 0;
  }
  .lp-dot { width: 8px; height: 8px; border-radius: 50%; opacity: 0.5; }
  .lp-dot.r { background: #ef4444; }
  .lp-dot.y { background: #f59e0b; }
  .lp-dot.g { background: #10b981; }
  .lp-desktop-img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 0 0 10px 10px;
  }

  @media (max-width: 1024px) {
    .lp-desktop-container { gap: 1.5rem; }
  }
  @media (max-width: 768px) {
    .lp-desktop { padding: 5rem 1.5rem; }
    .lp-desktop-container { grid-template-columns: 1fr; }
  }
`;

const parseMockGoogleMaps = (url: string) => {
  let shopName = 'Quán Ăn Của Tôi';
  let address = '123 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh';
  let lat = '10.7769';
  let lng = '106.7009';
  let phone = '0909123456';

  try {
    const placeMatch = url.match(/\/place\/([^/]+)/);
    if (placeMatch && placeMatch[1]) {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      shopName = decoded.split('/')[0] || shopName;
    }
    const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      lat = coordMatch[1];
      lng = coordMatch[2];
    } else {
      const qMatch = url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) {
        lat = qMatch[1];
        lng = qMatch[2];
      }
    }
  } catch (e) {
    console.error(e);
  }

  return { shopName, address, lat, lng, phone };
};

export const LandingPage: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mapsUrl, setMapsUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const navigate = useNavigate();

  const handleAnalyze = () => {
    if (!mapsUrl.trim()) {
      toast.error('Vui lòng nhập đường dẫn Google Maps của quán!');
      return;
    }
    setAnalyzing(true);
    setActiveStep(0);
  };

  const steps = [
    'Đang phân tích địa chỉ URL Google Maps...',
    'Đang trích xuất thông tin cửa hàng (tên, số điện thoại)...',
    'Đang xác định tọa độ kinh độ & vĩ độ địa lý...',
    'Đang tạo cơ sở dữ liệu menu và website cho quán...',
    'Hoàn tất! Đang chuyển hướng sang trang đăng ký...'
  ];

  useEffect(() => {
    if (!analyzing) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= 4) {
          clearInterval(interval);
          const { shopName, address, lat, lng, phone } = parseMockGoogleMaps(mapsUrl);
          setTimeout(() => {
            setAnalyzing(false);
            navigate(`/register?shopName=${encodeURIComponent(shopName)}&address=${encodeURIComponent(address)}&lat=${lat}&lng=${lng}&phone=${phone}&googleMapsUrl=${encodeURIComponent(mapsUrl)}`);
          }, 600);
          return prev;
        }
        return prev + 1;
      });
    }, 850);
    return () => clearInterval(interval);
  }, [analyzing, mapsUrl, navigate]);

  return (
    <div className="lp-root">
      {/* Inject styles */}
      <style>{globalStyles}</style>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="lp-mobile-menu">
          <button className="lp-mobile-close" onClick={() => setIsMenuOpen(false)}>
            <X size={20} />
          </button>
          <a href="#features" onClick={() => setIsMenuOpen(false)}>Tính năng</a>
          <a href="#gallery" onClick={() => setIsMenuOpen(false)}>Giao diện</a>
          <a href="#how" onClick={() => setIsMenuOpen(false)}>Cách hoạt động</a>
          <a href="#testimonials" onClick={() => setIsMenuOpen(false)}>Đánh giá</a>
          <a href="#contact" onClick={() => setIsMenuOpen(false)}>Liên hệ</a>
          <Link to="/customer/login" onClick={() => setIsMenuOpen(false)} style={{ color: 'var(--gray-600)' }}>
            Khách hàng — đăng nhập →
          </Link>
          <Link to="/customer/register" onClick={() => setIsMenuOpen(false)} style={{ color: 'var(--gray-600)' }}>
            Khách hàng — đăng ký →
          </Link>
          <Link to="/register" onClick={() => setIsMenuOpen(false)} style={{ color: 'var(--primary)' }}>
            Đăng ký mở quán →
          </Link>
          <Link to="/login" onClick={() => setIsMenuOpen(false)} style={{ color: 'var(--orange)' }}>
            Đăng nhập →
          </Link>
          <Link to="/employee-login" onClick={() => setIsMenuOpen(false)} style={{ color: 'var(--gray-600)' }}>
            Nhân viên — đăng nhập →
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav className="lp-nav">
        <Link to="/" className="lp-logo">
          <div className="lp-logo-icon">
            <ShoppingBag size={18} color="white" />
          </div>
          <span className="lp-logo-text">Lagi<span>Menu</span></span>
        </Link>

        <ul className="lp-nav-links">
          <li><a href="#features">Tính năng</a></li>
          <li><a href="#gallery">Giao diện</a></li>
          <li><a href="#how">Cách hoạt động</a></li>
          <li><a href="#testimonials">Đánh giá</a></li>
        </ul>

        <Link
          to="/customer/login"
          style={{
            marginRight: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--gray-600)',
            textDecoration: 'none',
          }}
        >
          Khách hàng
        </Link>
        <Link
          to="/employee-login"
          style={{
            marginRight: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--gray-600)',
            textDecoration: 'none',
          }}
        >
          Nhân viên
        </Link>
        <Link to="/register" className="lp-btn-nav" style={{ marginRight: '0.75rem' }}>Đăng ký mở quán</Link>
        <Link to="/login" className="lp-btn-nav">Đăng nhập</Link>

        <button className="lp-mobile-btn" onClick={() => setIsMenuOpen(true)}>
          <MenuIcon size={22} />
        </button>
      </nav>

      {/* Hero */}
      <section className="lp-hero bg-slate-900 text-white min-h-[75vh] flex items-center justify-center py-16 relative overflow-hidden" style={{ background: 'radial-gradient(circle at center, #787878 0%, #3e3e3e 100%)' }}>
        <div className="absolute inset-0 bg-black/10 z-0" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl z-0" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl z-0" />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-8 animate-fade-in">
          {/* Badge capsule */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-black/80 text-white rounded-full text-xs font-bold border border-white/10 shadow-lg select-none">
            <MapPin size={14} className="text-primary" />
            <span className="opacity-90">Google Maps &rarr; Website</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
            Website cho quán<br />
            từ Google Maps
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-200/90 max-w-xl mx-auto font-medium leading-relaxed">
            Dán link Google Maps, hệ thống tự động tạo website hoàn chỉnh.
          </p>

          {/* Input Bar Card */}
          <div className="max-w-lg mx-auto bg-white rounded-2xl p-2 shadow-2xl flex items-center border border-slate-100 group transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/20">
            <MapPin className="text-slate-400 ml-3.5 shrink-0" size={18} />
            <input
              type="text"
              placeholder="Dán link Google Maps..."
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 text-sm px-3.5 h-10 font-medium"
            />
            <button
              onClick={handleAnalyze}
              className="w-10 h-10 rounded-full bg-black hover:bg-slate-900 active:scale-95 text-white flex items-center justify-center transition-all shrink-0 shadow-md"
              type="button"
            >
              <span className="text-base font-bold">&uarr;</span>
            </button>
          </div>

          {/* Free tag */}
          <p className="text-xs text-slate-300/80 font-semibold tracking-wide select-none">
            Miễn phí &middot; Không cần thẻ tín dụng
          </p>
        </div>
      </section>

      {/* Multi-step loading/generating Overlay */}
      {analyzing && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-stone-900 border border-stone-850 rounded-3xl p-6 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary animate-pulse">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Đang quét thông tin từ Google Maps...</h3>
              <p className="text-xs text-stone-400 mt-1">Vui lòng chờ trong giây lát</p>
            </div>
            
            <div className="space-y-3 text-left border-t border-stone-800 pt-4">
              {steps.map((sText, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    activeStep > idx 
                      ? 'bg-emerald-500 text-white' 
                      : activeStep === idx 
                        ? 'bg-primary text-white' 
                        : 'bg-stone-800 text-stone-600'
                  }`}>
                    {activeStep > idx ? '✓' : idx + 1}
                  </div>
                  <p className={`text-xs ${
                    activeStep === idx 
                      ? 'text-white font-bold' 
                      : activeStep > idx 
                        ? 'text-stone-300' 
                        : 'text-stone-500'
                  }`}>{sText}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trust bar */}
      <div className="lp-trust">
        <div className="lp-trust-inner">
          <span className="lp-trust-label">Được tin tưởng bởi</span>
          <div className="lp-trust-items">
            {['Nhà hàng', 'Quán cà phê', 'Trà sữa', 'Quán ăn', 'Karaoke', 'Chuỗi F&B'].map((name) => (
              <span key={name} className="lp-trust-item">{name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <section id="features" className="lp-features">
        <div className="lp-features-inner">
          <div className="lp-section-header">
            <div className="lp-section-tag">
              <Zap size={12} />
              Tính năng
            </div>
            <h2 className="lp-section-title">Mọi thứ bạn cần<br />để vận hành xuất sắc</h2>
            <p className="lp-section-desc">
              Từ gọi món đến thanh toán và báo cáo, LagiMenu lo hết — để bạn tập trung phục vụ khách tốt hơn.
            </p>
          </div>

          <div className="lp-features-grid">
            {[
              {
                icon: <QrCode size={22} />,
                iconClass: 'orange',
                title: 'Quét QR không cần app',
                desc: 'Khách quét mã QR trên bàn, gọi món ngay trên điện thoại. Không tải app, không đăng ký.',
              },
              {
                icon: <Bell size={22} />,
                iconClass: 'green',
                title: 'Đơn đẩy trực tiếp đến bếp',
                desc: 'Đơn hàng đồng bộ real-time đến từng khu vực chế biến — bếp nóng, bếp lạnh, bar.',
              },
              {
                icon: <BarChart3 size={22} />,
                iconClass: 'orange',
                title: 'Theo dõi trạng thái món trực quan',
                desc: 'Hiển thị: đã nhận đơn → đang làm → hoàn tất. Cấu hình ưu tiên hiển thị theo thứ tự phục vụ.',
              },
              {
                icon: <LayoutDashboard size={22} />,
                iconClass: 'green',
                title: 'KDS — Màn hình bếp thông minh',
                desc: 'Màn hình KDS cho quầy, bếp, thu ngân — tất cả đồng bộ, không bỏ sót đơn nào.',
              },
              {
                icon: <TrendingUp size={22} />,
                iconClass: 'orange',
                title: 'Gợi ý món thông minh, tăng doanh thu',
                desc: 'Đề xuất combo, món bán chạy, chương trình ưu đãi theo chiến dịch ngay trên menu.',
              },
              {
                icon: <ShieldCheck size={22} />,
                iconClass: 'green',
                title: 'Menu cập nhật tức thì',
                desc: 'Thêm món, đổi giá, ẩn món hết mùa chỉ bằng 1 chạm. Không cần in lại menu.',
              },
              {
                icon: <Zap size={22} />,
                iconClass: 'orange',
                title: 'Cắt giảm chi phí in ấn',
                desc: 'Menu số dùng lâu dài, không tốn giấy in, không phí bảo trì menu giấy. Tiết kiệm chi phí vận hành.',
              },
              {
                icon: <Users size={22} />,
                iconClass: 'green',
                title: 'Báo cáo minh bạch, kiểm kê nhanh',
                desc: 'Tự động tổng hợp số đơn, doanh thu, hình thức thanh toán. Kiểm kê cuối ca chỉ vài phút.',
              },
            ].map((feat) => (
              <div key={feat.title} className="lp-feat-card">
                <div className={`lp-feat-icon ${feat.iconClass}`}>{feat.icon}</div>
                <h3 className="lp-feat-title">{feat.title}</h3>
                <p className="lp-feat-desc">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="lp-steps">
        <div className="lp-steps-inner">
          <div className="lp-section-header">
            <div className="lp-section-tag orange">
              <Smartphone size={12} />
              Cách hoạt động
            </div>
            <h2 className="lp-section-title">Quy trình phục vụ tự động hóa</h2>
            <p className="lp-section-desc">
              Từ lúc khách quét QR đến lúc món được bàn — mọi bước đều tự động, không cần nhân viên ghi order.
            </p>
          </div>

          <div className="lp-steps-grid">
            {[
              { num: '01', label: 'Khách quét QR trên bàn', desc: 'Mở camera, quét mã QR. Menu hiện ngay trên điện thoại — không cần tải app.', color: 'orange' },
              { num: '02', label: 'Gọi món trên điện thoại', desc: 'Chọn món, thêm ghi chú, xem gợi ý combo. Thanh toán ngay trên menu.', color: 'green' },
              { num: '03', label: 'Đơn đẩy xuống bếp', desc: 'Đơn hàng đồng bộ real-time đến KDS. Bếp nhận đơn ngay, sắp xếp theo thứ tự ưu tiên.', color: 'orange' },
              { num: '04', label: 'Theo dõi & phục vụ', desc: 'Trạng thái món hiển thị: đã nhận → đang làm → hoàn tất. Khách biết chờ bao lâu.', color: 'green' },
            ].map((step) => (
              <div key={step.num} className="lp-step">
                <div className={`lp-step-circle ${step.color}`}>{step.num}</div>
                <h3 className="lp-step-title">{step.label}</h3>
                <p className="lp-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Desktop Showcase */}
      <section className="lp-desktop">
        <div className="lp-desktop-inner">
          <div className="lp-section-header">
            <div className="lp-section-tag orange">
              <LayoutDashboard size={12} />
              Quản lý
            </div>
            <h2 className="lp-section-title">Hệ thống quản lý<br />từ bếp đến thu ngân</h2>
            <p className="lp-section-desc">
              Dashboard đồng bộ: theo dõi đơn hàng, quản lý thực đơn và báo cáo doanh thu trực quan trên mọi thiết bị.
            </p>
          </div>

          <div className="lp-desktop-container">
            {[
              { src: '/des1.png', alt: 'Tổng quan' },
              { src: '/des2.png', alt: 'Quản lý đơn' },
              { src: '/des3.png', alt: 'Báo cáo' },
              { src: '/des4.png', alt: 'Cấu hình' },
            ].map((d, i) => (
              <div key={i} className="lp-desktop-card">
                <div className="lp-desktop-bar">
                  <div className="lp-dot r" />
                  <div className="lp-dot y" />
                  <div className="lp-dot g" />
                </div>
                <img src={d.src} alt={d.alt} className="lp-desktop-img" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="lp-gallery">
        <div className="lp-gallery-inner">
          <div className="lp-section-header">
            <div className="lp-section-tag">
              <Smartphone size={12} />
              Giao Diện
            </div>
            <h2 className="lp-section-title">Giao diện hiện đại,<br />trải nghiệm tự phục vụ mượt mà</h2>
            <p className="lp-section-desc">
              Tối ưu cho cả thực khách dùng di động và chủ quán quản lý trên máy tính. Không cần đào tạo nhân viên.
            </p>
          </div>

          <div className="lp-gallery-grid">
            {[
              { src: '/m1.png', alt: 'Giao diện Menu Số 1' },
              { src: '/m2.png', alt: 'Giao diện Menu Số 2' },
              { src: '/m3.png', alt: 'Giao diện Menu Số 3' },
              { src: '/m4.png', alt: 'Giao diện Menu Số 4' },
            ].map((img, i) => (
              <div key={i} className="lp-gallery-item">
                <img src={img.src} alt={img.alt} className="lp-gallery-img" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="lp-testimonials">
        <div className="lp-testimonials-inner">
          <div className="lp-section-header">
            <div className="lp-section-tag">
              <Users size={12} />
              Đánh giá
            </div>
            <h2 className="lp-section-title">Chủ quán nói gì về Lagi Menu</h2>
            <p className="lp-section-desc">
              Hàng trăm chủ nhà hàng đã tăng tốc độ phục vụ và doanh thu cùng LagiMenu.
            </p>
          </div>

          <div className="lp-testimonials-grid">
            {[
              {
                text: '"Tốc độ phục vụ tăng rõ rệt sau khi dùng LagiMenu. Khách quét QR là đơn hiện ngay trên bếp — không cần nhân viên ghi order nữa."',
                name: 'Anh Minh',
                role: 'Chủ quán Phở Hạnh',
                color: 'var(--primary)',
                initials: 'AM',
              },
              {
                text: '"Setup chỉ mất 15 phút. Không phải đào tạo nhân viên quá nhiều. Đơn hàng tự động hiện trên màn hình KDS."',
                name: 'Chị Hương',
                role: 'Quản lý Trà Sữa House',
                color: 'var(--orange)',
                initials: 'CH',
              },
              {
                text: '"Báo cáo doanh thu theo ngày, theo món rất chi tiết. Giờ cao điểm kiểm soát được hết. Menu cập nhật giá chỉ bằng 1 chạm."',
                name: 'Anh Tuấn',
                role: 'Chủ nhà hàng Nhất Phương',
                color: 'var(--primary)',
                initials: 'AT',
              },
            ].map((t) => (
              <div key={t.name} className="lp-testimonial-card">
                <div className="lp-testimonial-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} color="#f59e0b" fill="#f59e0b" />
                  ))}
                </div>
                <p className="lp-testimonial-text">{t.text}</p>
                <div className="lp-testimonial-author">
                  <div className="lp-author-avatar" style={{ background: t.color }}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="lp-author-name">{t.name}</div>
                    <div className="lp-author-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="lp-cta">
        <div className="lp-cta-inner">
          <h2 className="lp-cta-title">
            Biến điện thoại khách<br />
            thành thiết bị phục vụ
          </h2>
          <p className="lp-cta-desc">
            Giảm 40% thời gian chờ gọi món, tăng doanh thu trung bình 20% sau 3 tháng.
            Không cần tăng nhân sự — quán vận hành nhanh hơn ngay từ ngày đầu.
          </p>
          <div className="lp-cta-btns">
            <Link to="/register" className="lp-btn-cta-primary">
              <ShoppingBag size={18} />
              Đăng ký mở quán
            </Link>
            <button className="lp-btn-cta-ghost">
              Liên hệ tư vấn
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-logo">
            <div className="lp-logo-icon">
              <ShoppingBag size={16} color="white" />
            </div>
            <span className="lp-logo-text" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Lagi<span>Menu</span>
            </span>
          </div>

          <ul className="lp-footer-links">
            <li><a href="#">Điều khoản</a></li>
            <li><a href="#">Bảo mật</a></li>
            <li><a href="#">Hỗ trợ</a></li>
            <li><a href="#">Liên hệ</a></li>
          </ul>

          <p className="lp-footer-copy">© 2026 Lagi Menu. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
