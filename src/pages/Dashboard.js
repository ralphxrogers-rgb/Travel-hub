import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { tripsApi, docsApi, loyaltyApi } from '../lib/supabase'
import { format, differenceInDays, isPast, isFuture, parseISO } from 'date-fns'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState([])
  const [docs, setDocs] = useState([])
  const [loyalty, setLoyalty] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      tripsApi.getAll(user.id),
      docsApi.getAll(user.id),
      loyaltyApi.getAll(user.id),
    ]).then(([t, d, l]) => {
      setTrips(t.data || [])
      setDocs(d.data || [])
      setLoyalty(l.data || [])
      setLoading(false)
    })
  }, [user])

  const upcoming = trips.filter(t => t.start_date && isFuture(parseISO(t.start_date))).slice(0,3)
  const completed = trips.filter(t => t.status === 'completed').length
  const expiringDocs = docs.filter(d => {
    if (!d.expiry_date) return false
    const days = differenceInDays(parseISO(d.expiry_date), new Date())
    return days >= 0 && days <= 180
  })
  const totalPoints = loyalty.reduce((sum, l) => sum + (l.points_balance || 0), 0)

  const docStatus = (d) => {
    if (!d.expiry_date) return null
    const days = differenceInDays(parseISO(d.expiry_date), new Date())
    if (days < 0) return { label: 'Expired', cls: 'badge-red' }
    if (days < 90) return { label: `${days}d left`, cls: 'badge-red' }
    if (days < 180) return { label: `${days}d left`, cls: 'badge-amber' }
    return { label: 'Valid', cls: 'badge-green' }
  }

  if (loading) return <div className="spinner" />

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}</h1>
          <p className="page-subtitle">{user.email}</p>
        </div>
      </div>

      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-label">Upcoming trips</div>
          <div className="metric-value">{upcoming.length}</div>
          <div className="metric-sub">{completed} completed</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total points</div>
          <div className="metric-value">{totalPoints.toLocaleString()}</div>
          <div className="metric-sub">across {loyalty.length} program{loyalty.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Documents</div>
          <div className="metric-value">{docs.length}</div>
          <div className="metric-sub">{expiringDocs.length} expiring soon</div>
        </div>
      </div>

      {upcoming.length > 0 && <>
        <div className="section-label">Upcoming trips</div>
        <div className="card-grid">
          {upcoming.map(trip => (
            <div key={trip.id} className="card" style={{cursor:'pointer'}} onClick={() => navigate('/trips')}>
              <div className="trip-card-header">
                <div>
                  <div className="trip-card-dest">{trip.destination}</div>
                  {trip.hotel && <div className="trip-card-hotel">{trip.hotel}</div>}
                </div>
                <span className={`badge ${trip.status === 'confirmed' ? 'badge-green' : trip.status === 'planning' ? 'badge-amber' : 'badge-gray'}`}>
                  {trip.status}
                </span>
              </div>
              <div className="trip-card-dates">
                {trip.start_date && <span>{format(parseISO(trip.start_date), 'MMM d')} – {trip.end_date ? format(parseISO(trip.end_date), 'MMM d, yyyy') : '?'}</span>}
                {trip.booking_ref && <span>Ref: {trip.booking_ref}</span>}
                {trip.points_used > 0 && <span>{trip.points_used.toLocaleString()} pts</span>}
              </div>
            </div>
          ))}
        </div>
      </>}

      {expiringDocs.length > 0 && <>
        <div className="section-label">Documents expiring soon</div>
        <div className="card">
          {expiringDocs.map(doc => {
            const st = docStatus(doc)
            return (
              <div key={doc.id} className="doc-row">
                <div className="doc-icon">{docEmoji(doc.type)}</div>
                <div className="doc-info">
                  <div className="doc-name">{doc.name}</div>
                  <div className="doc-meta">{doc.doc_number && `#${doc.doc_number} · `}Expires {format(parseISO(doc.expiry_date), 'MMM d, yyyy')}</div>
                </div>
                {st && <span className={`badge ${st.cls}`}>{st.label}</span>}
              </div>
            )
          })}
        </div>
      </>}

      {loyalty.length > 0 && <>
        <div className="section-label">Loyalty accounts</div>
        <div className="card-grid">
          {loyalty.map(l => (
            <div key={l.id} className="card" onClick={() => navigate('/loyalty')} style={{cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontSize:15,fontWeight:600}}>{l.program}</div>
                {l.tier && <span className="badge badge-brand">{l.tier}</span>}
              </div>
              <div style={{fontSize:'1.6rem',fontWeight:700,color:'var(--brand)'}}>{(l.points_balance||0).toLocaleString()}</div>
              <div style={{fontSize:12,color:'var(--text-3)',marginTop:4}}>points available{l.expiry_date ? ` · expires ${format(parseISO(l.expiry_date),'MMM yyyy')}` : ''}</div>
            </div>
          ))}
        </div>
      </>}

      {trips.length === 0 && docs.length === 0 && loyalty.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">✈️</div>
          <div className="empty-state-title">Welcome to Travel Hub</div>
          <div className="empty-state-text">Add your first trip, documents, or loyalty accounts to get started.</div>
        </div>
      )}
    </div>
  )
}

function docEmoji(type) {
  const map = { passport:'🛂', visa:'📋', insurance:'🏥', membership:'⭐', license:'🪪', other:'📄' }
  return map[type] || '📄'
}
