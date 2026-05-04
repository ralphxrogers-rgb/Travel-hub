import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { loyaltyApi } from '../lib/supabase'
import { format, parseISO } from 'date-fns'

const BLANK = { program:'', member_id:'', points_balance:'', tier:'', expiry_date:'', notes:'' }

const PROGRAMS = [
  { name:'Hilton Honors', tiers:['Member','Silver','Gold','Diamond'], tierPts:[0,10000,40000,150000], color:'#1a4b8c' },
  { name:'Hilton Grand Vacations', tiers:['Club Member','Elite','Elite Plus'], tierPts:[0,0,0], color:'#2A5C45' },
  { name:'American Airlines AAdvantage', tiers:['Member','Gold','Platinum','Executive Platinum'], tierPts:[0,25000,50000,100000], color:'#c8102e' },
  { name:'United MileagePlus', tiers:['Member','Silver','Gold','1K'], tierPts:[0,10000,25000,50000], color:'#003087' },
  { name:'Delta SkyMiles', tiers:['Member','Silver','Gold','Platinum','Diamond'], tierPts:[0,25000,50000,75000,125000], color:'#e01933' },
  { name:'Other', tiers:[], tierPts:[], color:'#5a6360' },
]

function PointsCard({ acct, onEdit, onDelete }) {
  const prog = PROGRAMS.find(p => p.name === acct.program) || PROGRAMS[PROGRAMS.length-1]
  const pts = acct.points_balance || 0
  const tierIdx = prog.tierPts.findIndex((t,i) => pts < (prog.tierPts[i+1] ?? Infinity))
  const nextTier = prog.tiers[tierIdx+1]
  const nextPts = prog.tierPts[tierIdx+1]
  const pct = nextPts ? Math.min(100, Math.round((pts / nextPts) * 100)) : 100

  return (
    <div className="points-card">
      <div className="points-header">
        <div className="points-program">{acct.program}</div>
        {acct.tier && <span className="badge badge-brand">{acct.tier}</span>}
      </div>
      <div className="points-big">{pts.toLocaleString()}</div>
      <div className="points-unit">points{acct.member_id ? ` · #${acct.member_id}` : ''}</div>

      {nextTier && (
        <>
          <div className="points-bar-bg">
            <div className="points-bar-fill" style={{width:`${pct}%`}} />
          </div>
          <div className="points-tier-row">
            <span>{acct.tier || prog.tiers[0] || 'Current'}</span>
            <span>{(nextPts - pts).toLocaleString()} pts to {nextTier}</span>
          </div>
        </>
      )}

      <div className="points-stats">
        <div className="points-stat">
          <div className="points-stat-val">{acct.expiry_date ? format(parseISO(acct.expiry_date), 'MMM yyyy') : '—'}</div>
          <div className="points-stat-label">Expires</div>
        </div>
        <div className="points-stat">
          <div className="points-stat-val">{Math.round(pts / 30000 * 10) / 10}</div>
          <div className="points-stat-label">Free nights est.</div>
        </div>
        <div className="points-stat">
          <div className="points-stat-val">${(pts * 0.006).toFixed(0)}</div>
          <div className="points-stat-label">Est. value</div>
        </div>
      </div>

      {acct.notes && <div style={{marginTop:12,fontSize:12,color:'var(--text-2)',fontStyle:'italic'}}>{acct.notes}</div>}

      <div style={{display:'flex',gap:8,marginTop:14,paddingTop:12,borderTop:'1px solid var(--border)'}}>
        <button className="btn btn-sm" onClick={()=>onEdit(acct)}>Edit</button>
        <button className="btn btn-sm btn-danger" onClick={()=>onDelete(acct.id)}>Delete</button>
      </div>
    </div>
  )
}

export default function Loyalty() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await loyaltyApi.getAll(user.id)
    setAccounts(data || []); setLoading(false)
  }
  useEffect(() => { if (user) load() }, [user])

  const openAdd = () => { setForm(BLANK); setModal('add') }
  const openEdit = (a) => { setForm({...BLANK,...a, points_balance:a.points_balance||'', expiry_date:a.expiry_date||''}); setModal(a) }
  const close = () => setModal(null)

  const save = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = { ...form, user_id: user.id, points_balance: parseInt(form.points_balance)||0 }
    if (modal === 'add') await loyaltyApi.create(payload)
    else await loyaltyApi.update(modal.id, payload)
    await load(); setSaving(false); close()
  }

  const del = async (id) => {
    if (!window.confirm('Delete this loyalty account?')) return
    await loyaltyApi.delete(id); load()
  }

  const totalPts = accounts.reduce((s,a) => s + (a.points_balance||0), 0)
  const selProg = PROGRAMS.find(p => p.name === form.program)

  if (loading) return <div className="spinner" />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Loyalty points</h1>
          <p className="page-subtitle">{totalPts.toLocaleString()} total points across {accounts.length} program{accounts.length!==1?'s':''}</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add account</button>
      </div>

      {/* Hilton tips banner */}
      {accounts.some(a => a.program === 'Hilton Honors') && (
        <div style={{background:'var(--brand-pale)',border:'1px solid rgba(42,92,69,0.15)',borderRadius:'var(--radius-md)',padding:'12px 16px',marginBottom:'1.25rem',fontSize:13,color:'var(--brand)'}}>
          <strong>💡 Hilton tip:</strong> Points expire after 24 months of inactivity. Any account activity (stay, purchase, transfer) resets the clock.
        </div>
      )}

      {accounts.length > 0 ? (
        <div className="card-grid">
          {accounts.map(a => <PointsCard key={a.id} acct={a} onEdit={openEdit} onDelete={del} />)}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">⭐</div>
          <div className="empty-state-title">No loyalty accounts yet</div>
          <div className="empty-state-text">Add your Hilton Honors, HGV, airline miles, and other programs.</div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal==='add'?'Add loyalty account':'Edit account'}</div>
              <button className="modal-close" onClick={close}>×</button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Program *</label>
                  <select className="form-select" required value={form.program} onChange={e=>setForm(f=>({...f,program:e.target.value,tier:''}))}>
                    <option value="">Select program…</option>
                    {PROGRAMS.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Member ID</label>
                  <input className="form-input" value={form.member_id} onChange={e=>setForm(f=>({...f,member_id:e.target.value}))} placeholder="HH-9841023" />
                </div>
                <div className="form-group">
                  <label className="form-label">Points balance</label>
                  <input className="form-input" type="number" min="0" value={form.points_balance} onChange={e=>setForm(f=>({...f,points_balance:e.target.value}))} placeholder="84200" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tier / Status</label>
                  {selProg && selProg.tiers.length > 0 ? (
                    <select className="form-select" value={form.tier} onChange={e=>setForm(f=>({...f,tier:e.target.value}))}>
                      <option value="">Select tier…</option>
                      {selProg.tiers.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input className="form-input" value={form.tier} onChange={e=>setForm(f=>({...f,tier:e.target.value}))} placeholder="Gold" />
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Points expiry</label>
                  <input className="form-input" type="date" value={form.expiry_date} onChange={e=>setForm(f=>({...f,expiry_date:e.target.value}))} />
                </div>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Home resort, membership type, owner details…" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={close}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':'Save account'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
