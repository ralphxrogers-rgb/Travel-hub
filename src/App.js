import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Dashboard from './pages/Dashboard'
import Trips from './pages/Trips'
import Documents from './pages/Documents'
import Loyalty from './pages/Loyalty'
import AIPlanner from './pages/AIPlanner'
import Auth from './pages/Auth'
import './App.css'

function Layout() {
  const { user, signOut } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  if (!user) return <Navigate to="/auth" replace />

  const navItems = [
    { to: '/', icon: <GridIcon />, label: 'Dashboard' },
    { to: '/trips', icon: <PlaneIcon />, label: 'Trips' },
    { to: '/documents', icon: <DocIcon />, label: 'Documents' },
    { to: '/loyalty', icon: <StarIcon />, label: 'Loyalty' },
    { to: '/ai', icon: <SparkIcon />, label: 'AI Planner' },
  ]

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">TH</div>
          <div>
            <div className="brand-name">Travel Hub</div>
            <div className="brand-email">{user.email?.split('@')[0]}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="signout-btn" onClick={signOut}>
          <SignOutIcon /> Sign out
        </button>
      </aside>

      {/* Mobile header */}
      <header className="mobile-header">
        <div className="brand-name">Travel Hub</div>
        <button className="menu-btn" onClick={() => setMobileNavOpen(o => !o)}>
          <MenuIcon />
        </button>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="mobile-drawer" onClick={() => setMobileNavOpen(false)}>
          <div className="mobile-nav" onClick={e => e.stopPropagation()}>
            {navItems.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setMobileNavOpen(false)}>
                {item.icon}<span>{item.label}</span>
              </NavLink>
            ))}
            <button className="signout-btn" onClick={signOut}><SignOutIcon /> Sign out</button>
          </div>
        </div>
      )}

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/loyalty" element={<Loyalty />} />
          <Route path="/ai" element={<AIPlanner />} />
        </Routes>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="bottom-tabs">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

// ── SVG Icons ────────────────────────────────────────────────
const GridIcon = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="7" height="7" rx="1.5" fill="currentColor" opacity=".9"/><rect x="10" y="1" width="7" height="7" rx="1.5" fill="currentColor" opacity=".5"/><rect x="1" y="10" width="7" height="7" rx="1.5" fill="currentColor" opacity=".5"/><rect x="10" y="10" width="7" height="7" rx="1.5" fill="currentColor" opacity=".25"/></svg>
const PlaneIcon = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M15 3L3 9l4 1.5L9 15l2-4 4-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
const DocIcon = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="1" width="11" height="16" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M6 6h6M6 9h6M6 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
const StarIcon = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.8 3.6L15 6.3l-3 2.9.7 4.1L9 11.4l-3.7 1.9.7-4.1-3-2.9 4.2-.7L9 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
const SparkIcon = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.2 3.2l1.4 1.4M13.4 13.4l1.4 1.4M14.8 3.2l-1.4 1.4M4.6 13.4l-1.4 1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
const SignOutIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
const MenuIcon = () => <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/*" element={<Layout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function AuthPage() {
  const { user } = useAuth()
  if (user) return <Navigate to="/" replace />
  return <Auth />
}
