# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # Dev server on localhost:3000 (Create React App)
npm run build    # Production bundle
npm test         # Jest tests (run a single file: npm test -- src/path/to/file.test.js)
```

Optional Flask backend:
```bash
pip install flask flask-cors anthropic supabase
python app.py    # REST API on localhost:5000
```

Environment setup — copy `.env.example` to `.env` and fill in:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `ANTHROPIC_KEY` (Flask backend only)

## Architecture

**Travel Hub** is a React 18 PWA with direct Supabase access. The Flask `app.py` is an optional REST layer and is not needed for the frontend to function.

### Data flow

All frontend data access goes through helper objects in `src/lib/supabase.js` (`tripsApi`, `docsApi`, `loyaltyApi`, `itineraryApi`), each exposing consistent `get/create/update/delete` methods that call Supabase directly from the browser. Supabase Row-Level Security enforces per-user data isolation — no separate authorization layer is needed.

Authentication is handled by `src/hooks/useAuth.js`, which wraps Supabase Auth in a React context (`AuthProvider`). The `useAuth()` hook is the single source of truth for `user`, `signIn`, `signUp`, and `signOut` throughout the app.

### Routing & layout

`src/App.js` owns routing (React Router v6), the layout shell (sidebar + bottom tabs), and the protected-route redirect. Desktop shows a fixed sidebar; mobile shows a top header and a bottom tab bar. All page components live in `src/pages/`.

### Pages pattern

Each page follows the same shape: local `useState` for a data list, a `modal` flag, and a `form` object. CRUD actions call the relevant `*Api` helper, then refresh local state. No global state library — everything is React hooks.

### AI Planner

`src/pages/AIPlanner.js` builds a system prompt from the user's live trips, loyalty accounts, and documents before sending each message to Claude. The Claude API is only called from the Flask backend (`/api/ai`); the React page hits that endpoint rather than Anthropic directly.

### Styling

All styles are in `src/App.css` using CSS custom properties for colors, with a mobile-first responsive layout. Core layout classes: `.app-shell`, `.sidebar`, `.main-content`, `.bottom-tabs`, `.card`, `.card-grid`, `.modal-backdrop`, `.modal`, `.badge`.

### Database schema

`supabase-schema.sql` contains the authoritative table definitions and RLS policies for the four tables: `trips`, `documents`, `loyalty_accounts`, `itinerary_items`. All tables carry a `user_id` column tied to Supabase Auth.
