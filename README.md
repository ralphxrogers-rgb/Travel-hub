# Travel Hub

Personal travel management web app — trips, documents, Hilton loyalty points, and AI-powered itineraries.

## Tech stack
- **React** (Create React App) — frontend
- **Supabase** — database, authentication, file storage
- **Claude API** — AI planner
- **Vercel** — hosting (free tier)

---

## Setup (step by step)

### 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New Project**, choose a name like "travelhub", set a database password, pick a region close to you (US East or US West)
3. Wait ~2 minutes for it to provision

### 2. Run the database schema

1. In your Supabase dashboard, go to **SQL Editor** > **New Query**
2. Open `supabase-schema.sql` from this project
3. Paste the entire contents and click **Run**
4. You should see "Success" — your tables are created with security policies

### 3. Get your API keys

In Supabase: **Settings** > **API**
- Copy **Project URL** → this is your `SUPABASE_URL`
- Copy **anon / public key** → this is your `SUPABASE_ANON_KEY`

### 4. Configure the app

```bash
# In the travelhub folder:
cp .env.example .env.local

# Edit .env.local with your values:
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...
```

### 5. Install and run

```bash
npm install
npm start
```

The app opens at http://localhost:3000. Create an account, then check your email to confirm it (Supabase sends a confirmation link).

---

## Deploy to Vercel (free, works on Galaxy S23)

```bash
npm install -g vercel
vercel
```

Follow the prompts. Then in the Vercel dashboard, add your environment variables under **Settings** > **Environment Variables**.

Your app will get a URL like `https://travelhub-xxx.vercel.app` — open this on your Galaxy S23 browser. Chrome on Android will prompt "Add to Home Screen" — tap it and it installs like an app icon.

---

## Features

- **Dashboard** — overview of upcoming trips, expiring documents, loyalty balances
- **Trips** — add/edit/delete trips with dates, hotel, booking ref, points used
- **Documents** — passport, visa, insurance, memberships with expiry tracking
- **Loyalty Points** — Hilton Honors, HGV, airlines — tracks balance, tier progress, estimated value
- **AI Planner** — Claude-powered chat that knows your trips and points

## File structure

```
src/
  App.js          — routing, layout, nav
  App.css         — all styles (responsive, mobile-first)
  hooks/
    useAuth.js    — Supabase auth context
  lib/
    supabase.js   — DB client + API helpers
  pages/
    Auth.js       — sign in / sign up
    Dashboard.js  — overview page
    Trips.js      — trip management
    Documents.js  — document tracker
    Loyalty.js    — points tracker
    AIPlanner.js  — Claude AI chat
```

## Later: add mobile app

When you're ready to build the native mobile app, run:
```bash
npx create-expo-app TravelHubMobile --template blank-typescript
```
The same Supabase project and Claude API key work for both.
