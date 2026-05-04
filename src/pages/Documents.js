import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { docsApi } from '../lib/supabase'
import { format, parseISO, differenceInDays } from 'date-fns'
import { extractText, findDates } from '../lib/parseReservation'

const BLANK = { name:'', type:'passport', doc_number:'', issued_date:'', expiry_date:'', issuing_country:'', notes:'' }
const TYPES = ['passport','visa','insurance','membership','license','other']
const EMOJI = { passport:'🛂', visa:'📋', insurance:'🏥', membership:'⭐', license:'🪪', other:'📄' }

function docStatus(expiry_date) {
  if (!expiry_date) return null
  const days = differenceInDays(parseISO(expiry_date), new Date())
  if (days < 0) return { label:'Expired', cls:'badge-red' }
  if (days < 90) return { label:`${days} days left`, cls:'badge-red' }
  if (days < 180) return { label:`${days} days left`, cls:'badge-amber' }
  return { label:'Valid', cls:'badge-green' }
}


function detectType(text) {
  const t = text.toLowerCase()
  if (t.includes('passport')) return 'passport'
  if (t.includes('visa')) return 'visa'
  if (t.includes('insurance') || t.includes('policy')) return 'insurance'
  if (t.includes('membership') || t.includes('loyalty') || t.includes('rewards')) return 'membership'
  if (t.includes('license') || t.includes('licence')) return 'license'
  return 'other'
}

function detectDocNumber(text) {
  // Passport-style: letter + 7-8 digits
  const passport = text.match(/\b([A-Z]\d{7,8})\b/)
  if (passport) return passport[1]
  // Generic alphanumeric reference 6-12 chars
  const ref = text.match(/\b([A-Z0-9]{6,12})\b/)
  if (ref) return ref[1]
  return ''
}

function detectCountry(text) {
  const countries = ['USA','United States','UK','United Kingdom','Canada','Australia','Germany','France','Japan','China','India','Brazil','Mexico','Spain','Italy','Netherlands','Singapore','New Zealand','Ireland','Sweden','Norway','Denmark','Switzerland']
  for (const c of countries) {
    if (text.toLowerCase().includes(c.toLowerCase())) return c
  }
  return ''
}


export default function Documents() {
  const { user } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  const load = async () => {
    const { data } = await docsApi.getAll(user.id)
    setDocs(data || []); setLoading(false)
  }
  useEffect(() => { if (user) load() }, [user])

  const openAdd = () => { setForm(BLANK); setModal('add') }
  const openEdit = (d) => { setForm({...BLANK,...d, issued_date:d.issued_date||'', expiry_date:d.expiry_date||''}); setModal(d) }
  const close = () => setModal(null)

  const save = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = { ...form, user_id: user.id }
    if (modal === 'add') await docsApi.create(payload)
    else await docsApi.update(modal.id, payload)
    await load(); setSaving(false); close()
  }

  const del = async (id) => {
    if (!window.confirm('Delete this document?')) return
    await docsApi.delete(id); load()
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const text = await extractText(file)
      const dates = findDates(text)
      const parsed = {
        name: file.name.replace(/\.(txt|docx?)$/i, '').replace(/[-_]/g, ' '),
        type: detectType(text),
        doc_number: detectDocNumber(text),
        issuing_country: detectCountry(text),
        issued_date: dates[0] || '',
        expiry_date: dates[dates.length - 1] || '',
        notes: text.slice(0, 500).trim(),
      }
      setForm(parsed)
      setModal('add')
    } catch {
      alert('Could not read file. Please try a .txt or .docx file.')
    } finally {
      setImporting(false)
    }
  }

  const filtered = filter === 'all' ? docs : docs.filter(d => d.type === filter)

  if (loading) return <div className="spinner" />

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="page-subtitle">{docs.length} document{docs.length !== 1 ? 's' : ''} stored</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{display:'none'}} onChange={handleImport} />
          <button className="btn" onClick={() => fileRef.current.click()} disabled={importing}>
            {importing ? 'Reading…' : '↑ Import file'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add document</button>
        </div>
      </div>

      {/* Type filter pills */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:'1.25rem'}}>
        {['all',...TYPES].map(t => (
          <button key={t} onClick={()=>setFilter(t)}
            style={{padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:500,cursor:'pointer',border:'1px solid',
              borderColor: filter===t ? 'var(--brand)' : 'var(--border-md)',
              background: filter===t ? 'var(--brand-pale)' : 'var(--surface)',
              color: filter===t ? 'var(--brand)' : 'var(--text-2)',
              fontFamily:'var(--font-body)'}}>
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="card">
          {filtered.map(doc => {
            const st = docStatus(doc.expiry_date)
            return (
              <div key={doc.id} className="doc-row">
                <div className="doc-icon">{EMOJI[doc.type]||'📄'}</div>
                <div className="doc-info">
                  <div className="doc-name">{doc.name}</div>
                  <div className="doc-meta">
                    {doc.doc_number && `#${doc.doc_number} · `}
                    {doc.issuing_country && `${doc.issuing_country} · `}
                    {doc.expiry_date && `Expires ${format(parseISO(doc.expiry_date),'MMM d, yyyy')}`}
                  </div>
                  {doc.notes && <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{doc.notes}</div>}
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
                  {st && <span className={`badge ${st.cls}`}>{st.label}</span>}
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-sm" onClick={()=>openEdit(doc)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={()=>del(doc.id)}>Del</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <div className="empty-state-title">No documents yet</div>
          <div className="empty-state-text">Add your passport, visas, insurance, and memberships.</div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal==='add'?'New document':'Edit document'}</div>
              <button className="modal-close" onClick={close}>×</button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Document name *</label>
                  <input className="form-input" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. US Passport, Travel Insurance" />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    {TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Document number</label>
                  <input className="form-input" value={form.doc_number} onChange={e=>setForm(f=>({...f,doc_number:e.target.value}))} placeholder="C12345678" />
                </div>
                <div className="form-group">
                  <label className="form-label">Issuing country</label>
                  <input className="form-input" value={form.issuing_country} onChange={e=>setForm(f=>({...f,issuing_country:e.target.value}))} placeholder="USA" />
                </div>
                <div className="form-group">
                  <label className="form-label">Issue date</label>
                  <input className="form-input" type="date" value={form.issued_date} onChange={e=>setForm(f=>({...f,issued_date:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry date</label>
                  <input className="form-input" type="date" value={form.expiry_date} onChange={e=>setForm(f=>({...f,expiry_date:e.target.value}))} />
                </div>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Policy number, contact info, etc." />
                </div>
              </div>
              <div className="modal-footer">
                {modal !== 'add' && (
                  <button type="button" className="btn btn-danger" style={{marginRight:'auto'}} onClick={()=>{del(modal.id);close()}}>Delete</button>
                )}
                <button type="button" className="btn" onClick={close}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':'Save document'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
