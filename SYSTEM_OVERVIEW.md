# Expense Tracker System Overview

## Purpose

The Expense Tracker is a web application designed to help users manage their personal finances by tracking expenses, budgets, savings, and financial insights. It provides a user-friendly interface for recording transactions, visualizing spending patterns, and gaining actionable insights to improve financial health.

## Tech Stack

- **Frontend Framework:** Next.js (React, TypeScript)
- **Styling:** Tailwind CSS, PostCSS
- **State Management:** React Context/State
- **Data Storage:**
  - Supabase Postgres (transactions, budgets, profiles, alerts)
  - IndexedDB (pending offline queue for sync)
- **Authentication:** Supabase Auth (email/password + password reset)
- **API:** Next.js Route Handlers (RESTful endpoints)
- **Testing/Quality:** ESLint
- **PWA Support:** Service Worker, Manifest

## Key Features

- **Expense Tracking:**
  - Add, edit, and delete transactions
  - Categorize expenses
- **Accounts & Transfers:**
  - Multi-account balances with a system Cash wallet
  - Internal transfers recorded as linked ledger rows
  - Withdraw-to-cash flow that moves funds without counting them as spending
  - External withdrawals created as pending payout requests before ledger posting
- **Budget Management:**
  - Set and track budgets
  - View budget status
- **Timeline View:**
  - Visualize transactions chronologically
- **Insights & Analytics:**
  - Charts and cards for financial insights
  - Savings tracking
- **Dashboard:**
  - Widgets summarizing financial status
- **Settings:**
  - User preferences and theme selection
- **Authentication:**
  - Signup, login, forgot password
  - Session-based access to protected data routes
- **PWA Functionality:**
  - Offline support
  - Home screen installation
- **Navigation:**
  - Sidebar and bottom navigation
  - Floating add button for quick expense entry

## Directory Structure

- **public/**: Static assets, manifest, service worker
- **supabase/**: Schema and migration files
- **src/**
  - **app/**: Main app pages and API routes
  - **components/**: UI components (modals, charts, navigation, etc.)
  - **lib/**: Utility libraries (Supabase, insights engine, types)

## Current Progress

- Core pages and navigation implemented
- API routes for auth, budgets, transactions, transfers, insights, savings, sync, and timeline
- UI components for expense management, dashboard, charts, and insights
- Supabase integration completed for auth + backend persistence
- RLS-aligned route handling with authenticated session checks
- IndexedDB integration for offline queue and sync
- Service worker and manifest for PWA support
- Basic settings and theme provider
- Account detail withdraw flow now opens the transfer modal, can hand off to expense logging after cash withdrawal, and can create pending external payout requests

## Next Steps

- Enhance analytics and insights
- Improve mobile responsiveness
- Expand settings and customization
- Refine error handling and validation


_Last updated: March 28, 2026_
