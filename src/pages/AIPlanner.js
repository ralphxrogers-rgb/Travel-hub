import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { tripsApi, loyaltyApi, docsApi } from '../lib/supabase'

const QUICK = [
  { label: 'Build a 5-day Maui itinerary', prompt: 'Build a detailed 5-day itinerary for Maui, Hawaii, with activities, dining, and tips for a Hilton Grand Wailea stay. Consider beach time, Road to Hana, Haleakala, and local food.' },
  { label: 'Maximize my Hilton points', prompt: 'Looking at my loyalty points and upcoming trips, how should I strategically use my Hilton Honors points for maximum value? What redemptions give the best cents-per-point?' },
  { label: 'NYC long weekend ideas', prompt: 'Plan a 3-night long weekend in New York City staying at Hilton Midtown. Include must-see spots, restaurants, and how to make the most of a short visit.' },
  { label: 'Document renewal checklist', prompt: 'Create a travel document renewal checklist. My Global Entry expires in August 2026. Walk me through what to renew, in what order, and how far in advance.' },
  { label: 'Packing list for Hawaii', prompt: 'Create a comprehensive packing list for a 5-night Hawaii beach resort trip in May. Include beach, dining out, outdoor excursions, and resort activities.' },
  { label: 'HGV points strategy', prompt: 'Explain how Hilton Grand Vacations ClubPoints work — booking windows, home resort priority, how to use points vs renting, and tips for owners to maximize their membership.' },
]

export default function AIPlanner() {
  const { user } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!user) return
    Promise.all([tripsApi.getAll(user.id), loyaltyApi.getAll(user.id), docsApi.getAll(user.id)]).then(([t,l,d]) => {
      const trips = t.data || []
      const loyalty = l.data || []
      const docs = d.data || []
      setContext(`User travel profile:
TRIPS: ${trips.length === 0 ? 'None recorded yet' : trips.map(t => `${t.destination}${t.start_date?' ('+t.start_date+' to '+(t.end_date||'?')+')':''}${t.hotel?' at '+t.hotel:''}${t.status?' ['+t.status+']':''}`).join('; ')}
LOYALTY: ${loyalty.length === 0 ? 'None recorded yet' : loyalty.map(l => `${l.program}: ${(l.points_balance||0).toLocaleString()} pts${l.tier?' ('+l.tier+')':''}${l.expiry_date?' expires '+l.expiry_date:''}`).join('; ')}
DOCUMENTS: ${docs.length === 0 ? 'None recorded yet' : docs.map(d => `${d.name}${d.expiry_date?' expires '+d.expiry_date:''}`).join('; ')}`)
    })
  }, [user])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const ask = async (text) => {
    const q = text || prompt.trim()
    if (!q || loading) return
    setPrompt('')
    const newMessages = [...messages, { role:'user', content: q }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are a knowledgeable travel assistant inside a personal Travel Hub app. Be warm, practical, and specific. Use the user's actual travel data when relevant. Format responses clearly — use short paragraphs or bullet points where helpful. Today's date is ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}.

${context}`,
          messages: newMessages,
        })
      })
      const data = await resp.json()
      const reply = data.content?.map(b => b.text || '').join('') || 'Sorry, I had trouble responding. Please try again.'
      setMessages(m => [...m, { role:'assistant', content: reply }])
    } catch {
      setMessages(m => [...m, { role:'assistant', content: 'Connection error. Please check your network and try again.' }])
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Planner</h1>
          <p className="page-subtitle">Powered by Claude — knows your trips & points</p>
        </div>
        {messages.length > 0 && (
          <button className="btn btn-sm" onClick={() => setMessages([])}>Clear chat</button>
        )}
      </div>

      {messages.length === 0 && (
        <>
          <p style={{fontSize:14,color:'var(--text-2)',marginBottom:'1.25rem',lineHeight:1.7}}>
            Ask anything about your trips, loyalty points, itinerary ideas, document renewals, packing lists, or travel strategy. Your travel data is shared automatically.
          </p>
          <div className="ai-quick-actions">
            {QUICK.map(q => (
              <button key={q.label} className="ai-quick-btn" onClick={() => ask(q.prompt)}>
                {q.label} →
              </button>
            ))}
          </div>
        </>
      )}

      {/* Chat messages */}
      {messages.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:'1.25rem'}}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display:'flex',
              flexDirection: m.role==='user' ? 'row-reverse' : 'row',
              gap:10,alignItems:'flex-start'
            }}>
              <div style={{
                width:32,height:32,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,
                background: m.role==='user' ? 'var(--brand)' : 'var(--accent-pale)',
                color: m.role==='user' ? '#fff' : 'var(--accent)',
              }}>{m.role==='user' ? 'You' : 'AI'}</div>
              <div style={{
                maxWidth:'78%',
                padding:'10px 14px',
                borderRadius: m.role==='user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: m.role==='user' ? 'var(--brand)' : 'var(--surface)',
                color: m.role==='user' ? '#fff' : 'var(--text)',
                border: m.role==='assistant' ? '1px solid var(--border)' : 'none',
                fontSize:14, lineHeight:1.7, whiteSpace:'pre-wrap',
              }}>{m.content}</div>
            </div>
          ))}
          {loading && (
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:'var(--accent-pale)',color:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600}}>AI</div>
              <div style={{padding:'12px 16px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'14px 14px 14px 4px'}}>
                <div style={{display:'flex',gap:4}}>
                  {[0,0.2,0.4].map((d,i)=><span key={i} style={{width:6,height:6,borderRadius:'50%',background:'var(--text-3)',animation:'bounce 1s ease infinite',animationDelay:`${d}s`,display:'inline-block'}} />)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div style={{position:'sticky',bottom:0,background:'var(--surface-2)',paddingTop:12,paddingBottom:4}}>
        <div className="ai-input-area">
          <input
            className="form-input"
            value={prompt}
            onChange={e=>setPrompt(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask()} }}
            placeholder="Ask about itineraries, points strategy, packing lists…"
            disabled={loading}
          />
          <button className="btn btn-primary" onClick={()=>ask()} disabled={loading||!prompt.trim()}>
            {loading ? '…' : 'Send'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
      `}</style>
    </div>
  )
}
