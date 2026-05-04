import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { tripsApi, itineraryApi } from '../lib/supabase'
import { format, parseISO, isFuture, isPast } from 'date-fns'
import { extractText, detectCategory, parseReservation } from '../lib/parseReservation'

const BLANK_TRIP = { destination:'', country:'', start_date:'', end_date:'', status:'planning', hotel:'', booking_ref:'', points_used:'', points_program:'', notes:'' }
const BLANK_ITEM = { item_date:'', item_time:'', title:'', category:'hotel', location:'', booking_ref:'', description:'' }

const CAT_ICONS = { flight:'✈️', hotel:'🏨', train:'🚆', car:'🚙', activity:'🎯', dining:'🍽️', transport:'🚗', other:'📌' }
const CAT_LABELS = { flight:'Flight', hotel:'Hotel', train:'Train', car:'Car Rental', activity:'Activity', dining:'Dining', transport:'Transport', other:'Other' }

export default function Trips() {
  const { user } = useAuth()
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK_TRIP)
  const [saving, setSaving] = useState(false)

  const [expanded, setExpanded] = useState({})
  const [itineraries, setItineraries] = useState({})
  const [itemModal, setItemModal] = useState(null)
  const [itemForm, setItemForm] = useState(BLANK_ITEM)
  const [savingItem, setSavingItem] = useState(false)

  const fileRef = useRef()
  const [importingFor, setImportingFor] = useState(null)
  const [parsing, setParsing] = useState(false)

  const load = async () => {
    const { data } = await tripsApi.getAll(user.id)
    setTrips(data || [])
    setLoading(false)
  }
  useEffect(() => { if (user) load() }, [user])

  const loadItinerary = async (tripId) => {
    const { data } = await itineraryApi.getByTrip(tripId)
    setItineraries(prev => ({ ...prev, [tripId]: data || [] }))
  }

  const toggleExpand = async (tripId) => {
    const next = !expanded[tripId]
    setExpanded(prev => ({ ...prev, [tripId]: next }))
    if (next) await loadItinerary(tripId)
  }

  // Trip CRUD
  const openAdd = () => { setForm(BLANK_TRIP); setModal('add') }
  const openEdit = (t) => { setForm({ ...BLANK_TRIP, ...t, points_used: t.points_used || '', start_date: t.start_date || '', end_date: t.end_date || '' }); setModal(t) }
  const close = () => setModal(null)

  const save = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = { ...form, user_id: user.id, points_used: form.points_used ? parseInt(form.points_used) : 0 }
    if (modal === 'add') await tripsApi.create(payload)
    else await tripsApi.update(modal.id, payload)
    await load(); setSaving(false); close()
  }

  const del = async (id) => {
    if (!window.confirm('Delete this trip?')) return
    await tripsApi.delete(id)
    setItineraries(prev => { const n = { ...prev }; delete n[id]; return n })
    setExpanded(prev => { const n = { ...prev }; delete n[id]; return n })
    load()
  }

  // Item CRUD
  const openAddItem = (tripId) => { setItemForm({ ...BLANK_ITEM }); setItemModal({ tripId }) }
  const openEditItem = (tripId, item) => {
    setItemForm({ ...BLANK_ITEM, ...item, item_time: item.item_time?.slice(0, 5) || '' })
    setItemModal({ tripId, item })
  }
  const closeItem = () => setItemModal(null)

  const saveItem = async (e) => {
    e.preventDefault(); setSavingItem(true)
    const { tripId, item } = itemModal
    const payload = {
      ...itemForm,
      trip_id: tripId,
      user_id: user.id,
      item_time: itemForm.item_time || null,
      sort_order: item?.sort_order ?? (itineraries[tripId]?.length || 0),
    }
    if (item) await itineraryApi.update(item.id, payload)
    else await itineraryApi.create(payload)
    await loadItinerary(tripId)
    setSavingItem(false); closeItem()
  }

  const delItem = async (tripId, itemId) => {
    if (!window.confirm('Remove this item?')) return
    await itineraryApi.delete(itemId)
    await loadItinerary(tripId)
  }

  // File import
  const triggerImport = (tripId) => {
    setImportingFor(tripId)
    fileRef.current.click()
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !importingFor) return
    e.target.value = ''
    setParsing(true)
    try {
      const text = await extractText(file)
      const category = detectCategory(text)
      const parsed = parseReservation(text, category)
      setItemForm(parsed)
      setItemModal({ tripId: importingFor })
    } catch {
      alert('Could not read file. Please try a .pdf, .txt, or .docx file.')
    } finally {
      setParsing(false)
      setImportingFor(null)
    }
  }

  const upcoming = trips.filter(t => t.start_date && isFuture(parseISO(t.start_date)))
  const past = trips.filter(t => !t.start_date || isPast(parseISO(t.start_date)))

  const tripCard = (trip) => {
    const items = itineraries[trip.id] || []
    const isExpanded = expanded[trip.id]
    const isParsing = parsing && importingFor === trip.id

    // Category summary icons shown on collapsed card
    const catSet = [...new Set(items.map(i => i.category))]

    return (
      <div key={trip.id} className="card">
        <div className="trip-card-header">
          <div>
            <div className="trip-card-dest">{trip.destination}{trip.country ? `, ${trip.country}` : ''}</div>
            {trip.hotel && <div className="trip-card-hotel">{trip.hotel}</div>}
          </div>
          <span className={`badge ${statusBadge(trip.status)}`}>{trip.status}</span>
        </div>
        <div className="trip-card-dates">
          {trip.start_date && <span>📅 {format(parseISO(trip.start_date), 'MMM d')} – {trip.end_date ? format(parseISO(trip.end_date), 'MMM d, yyyy') : '?'}</span>}
          {trip.booking_ref && <span>Ref: {trip.booking_ref}</span>}
          {trip.points_used > 0 && <span>⭐ {trip.points_used.toLocaleString()} {trip.points_program || 'pts'}</span>}
        </div>
        {trip.notes && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8, fontStyle: 'italic' }}>{trip.notes}</div>}

        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <button type="button" className="btn btn-sm" onClick={() => toggleExpand(trip.id)} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              {isExpanded ? '▲ Hide' : '▼ Reservations'}
              {!isExpanded && catSet.length > 0 && (
                <span style={{ letterSpacing: 2 }}>{catSet.map(c => CAT_ICONS[c] || '📌').join('')}</span>
              )}
              {!isExpanded && items.length > 0 && <span style={{ color: 'var(--text-2)', fontWeight: 400 }}>({items.length})</span>}
            </button>
            {isExpanded && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm" onClick={() => triggerImport(trip.id)} disabled={isParsing} style={{ fontSize: 12 }}>
                  {isParsing ? 'Reading…' : '↑ Import'}
                </button>
                <button className="btn btn-sm btn-primary" onClick={() => openAddItem(trip.id)} style={{ fontSize: 12 }}>+ Add</button>
              </div>
            )}
          </div>

          {isExpanded && (
            <div style={{ marginTop: 10 }}>
              {items.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-2)', fontStyle: 'italic', padding: '6px 0' }}>
                  No reservations yet — add one or import a PDF/file.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: 'var(--surface-2,#f5f5f2)', borderRadius: 8 }}>
                      <span style={{ fontSize: 18, lineHeight: 1.3, flexShrink: 0 }}>{CAT_ICONS[item.category] || '📌'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1 }}>{CAT_LABELS[item.category] || item.category}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
                          {item.item_date && <span>📅 {format(parseISO(item.item_date), 'MMM d, yyyy')}</span>}
                          {item.item_time && <span>🕐 {item.item_time.slice(0, 5)}</span>}
                          {item.location && <span>📍 {item.location}</span>}
                          {item.booking_ref && <span style={{ fontFamily: 'monospace' }}>#{item.booking_ref}</span>}
                        </div>
                        {item.description && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, fontStyle: 'italic', whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden' }}>{item.description}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn btn-sm" style={{ fontSize: 11, padding: '2px 7px' }} onClick={() => openEditItem(trip.id, item)}>Edit</button>
                        <button className="btn btn-sm btn-danger" style={{ fontSize: 11, padding: '2px 7px' }} onClick={() => delItem(trip.id, item.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="trip-card-actions">
          <button className="btn btn-sm" onClick={() => openEdit(trip)}>Edit trip</button>
          <button className="btn btn-sm btn-danger" onClick={() => del(trip.id)}>Delete</button>
        </div>
      </div>
    )
  }

  if (loading) return <div className="spinner" />

  return (
    <div>
      <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: 'none' }} onChange={handleImport} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Trips</h1>
          <p className="page-subtitle">{trips.length} trip{trips.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add trip</button>
      </div>

      {upcoming.length > 0 && <>
        <div className="section-label">Upcoming</div>
        <div className="card-grid">{upcoming.map(tripCard)}</div>
      </>}
      {past.length > 0 && <>
        <div className="section-label">Past trips</div>
        <div className="card-grid">{past.map(tripCard)}</div>
      </>}
      {trips.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">✈️</div>
          <div className="empty-state-title">No trips yet</div>
          <div className="empty-state-text">Add your first trip to start organizing your travel.</div>
        </div>
      )}

      {/* Trip modal */}
      {modal && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'add' ? 'New trip' : 'Edit trip'}</div>
              <button className="modal-close" onClick={close}>×</button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Destination *</label>
                  <input className="form-input" required value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="e.g. Maui, Hawaii" />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input className="form-input" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="USA" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="planning">Planning</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Start date</label>
                  <input className="form-input" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">End date</label>
                  <input className="form-input" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Hotel / Property</label>
                  <input className="form-input" value={form.hotel} onChange={e => setForm(f => ({ ...f, hotel: e.target.value }))} placeholder="e.g. Hilton Grand Wailea" />
                </div>
                <div className="form-group">
                  <label className="form-label">Booking reference</label>
                  <input className="form-input" value={form.booking_ref} onChange={e => setForm(f => ({ ...f, booking_ref: e.target.value }))} placeholder="HGV-4821" />
                </div>
                <div className="form-group">
                  <label className="form-label">Points used</label>
                  <input className="form-input" type="number" value={form.points_used} onChange={e => setForm(f => ({ ...f, points_used: e.target.value }))} placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Points program</label>
                  <input className="form-input" value={form.points_program} onChange={e => setForm(f => ({ ...f, points_program: e.target.value }))} placeholder="Hilton Honors" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any details, reminders…" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={close}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save trip'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reservation item modal */}
      {itemModal && (
        <div className="modal-backdrop" onClick={closeItem}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{itemModal.item ? 'Edit reservation' : 'Add reservation'}</div>
              <button className="modal-close" onClick={closeItem}>×</button>
            </div>
            <form onSubmit={saveItem}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="flight">✈️ Flight</option>
                    <option value="hotel">🏨 Hotel</option>
                    <option value="car">🚙 Car Rental</option>
                    <option value="train">🚆 Train</option>
                    <option value="activity">🎯 Activity</option>
                    <option value="dining">🍽️ Dining</option>
                    <option value="transport">🚗 Transport</option>
                    <option value="other">📌 Other</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Title *</label>
                  <input className="form-input" required value={itemForm.title} onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Hilton London Check-in, AA 1234, Hertz Rental" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={itemForm.item_date} onChange={e => setItemForm(f => ({ ...f, item_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input className="form-input" type="time" value={itemForm.item_time} onChange={e => setItemForm(f => ({ ...f, item_time: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Location</label>
                  <input className="form-input" value={itemForm.location} onChange={e => setItemForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Heathrow Airport, 123 High St London" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Booking / Confirmation #</label>
                  <input className="form-input" value={itemForm.booking_ref} onChange={e => setItemForm(f => ({ ...f, booking_ref: e.target.value }))} placeholder="e.g. ABC123" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" rows={3} value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Check-out date, seat number, car class, etc." />
                </div>
              </div>
              <div className="modal-footer">
                {itemModal.item && (
                  <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => { delItem(itemModal.tripId, itemModal.item.id); closeItem() }}>Delete</button>
                )}
                <button type="button" className="btn" onClick={closeItem}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingItem}>{savingItem ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function statusBadge(s) {
  return { planning: 'badge-amber', confirmed: 'badge-green', completed: 'badge-gray', cancelled: 'badge-red' }[s] || 'badge-gray'
}
