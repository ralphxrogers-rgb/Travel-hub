import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = process.env.PUBLIC_URL + '/pdf.worker.min.js'

export async function extractText(file) {
  if (file.name.match(/\.docx?$/i)) {
    const buf = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer: buf })
    return result.value
  }
  if (file.name.match(/\.pdf$/i)) {
    const buf = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map(item => item.str).join(' ') + '\n'
    }
    return text
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export function detectCategory(text) {
  const t = text.toLowerCase()
  if (/hotel|inn|resort|motel|suites?|lodge|check.?in|check.?out|hilton|marriott|hyatt|sheraton|radisson|westin|doubletree|holiday\s*inn|hampton|courtyard|accommodation/.test(t)) return 'hotel'
  if (/car\s*rental|vehicle\s*rental|hertz|enterprise\s*rent|avis|budget\s*rent|alamo|national\s*car|sixt|thrifty|dollar\s*rent|europcar/.test(t)) return 'car'
  if (/flight|airline|boarding\s*pass|depart|departure|arrival|gate\s*[a-z]?\d|seat\s*\d|airways|air\s*[a-z]+\s*\d{2,4}/.test(t)) return 'flight'
  if (/\btrain\b|amtrak|eurostar|\brail\b|platform\s*\d|coach\s*[a-z]\d/.test(t)) return 'train'
  return 'other'
}

export function findDates(text) {
  const results = []
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/g
  let m
  while ((m = iso.exec(text))) results.push(m[1])
  const slash = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g
  while ((m = slash.exec(text))) results.push(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`)
  const months = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' }
  const named = /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/gi
  while ((m = named.exec(text))) results.push(`${m[3]}-${months[m[2].slice(0,3).toLowerCase()]}-${m[1].padStart(2,'0')}`)
  const named2 = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/gi
  while ((m = named2.exec(text))) results.push(`${m[3]}-${months[m[1].slice(0,3).toLowerCase()]}-${m[2].padStart(2,'0')}`)
  return [...new Set(results)].sort()
}

function findTime(text) {
  const m = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i)
  if (!m) return ''
  let h = parseInt(m[1])
  const min = m[2]
  if (m[3]) {
    if (m[3].toLowerCase() === 'pm' && h < 12) h += 12
    if (m[3].toLowerCase() === 'am' && h === 12) h = 0
  }
  return `${String(h).padStart(2,'0')}:${min}`
}

function findBookingRef(text) {
  const conf = text.match(/(?:confirmation|booking\s*(?:ref|reference|number|no\.?)|reservation\s*(?:no\.?|number|#)|record\s*locator)[:\s#]*([A-Z0-9-]{4,15})/i)
  if (conf) return conf[1].toUpperCase()
  const pnr = text.match(/\b([A-Z]{1,2}[A-Z0-9]{5,7})\b/)
  if (pnr) return pnr[1]
  return ''
}

function findFlightTitle(text) {
  const num = text.match(/\b([A-Z]{2})\s*(\d{1,4})\b/)
  return num ? `Flight ${num[1]}${num[2]}` : 'Flight'
}

function findAirports(text) {
  const hits = [...text.matchAll(/\b([A-Z]{3})\b/g)]
    .map(m => m[1])
    .filter(a => !['THE','AND','FOR','ARE','WAS','HAS','NOT','YOU','ALL','NEW'].includes(a))
  return [...new Set(hits)]
}

function findHotelTitle(text) {
  const line = text.match(/^.*(hotel|inn|resort|suites?|lodge|hilton|marriott|hyatt|sheraton|radisson|westin|doubletree|hampton|courtyard).*$/im)
  if (line) return line[0].trim().replace(/\s+/g, ' ').slice(0, 60)
  return 'Hotel Reservation'
}

function findCarTitle(text) {
  const co = text.match(/\b(hertz|enterprise|avis|budget|alamo|national|sixt|thrifty|dollar|europcar)\b/i)
  const cls = text.match(/\b(economy|compact|midsize|mid.?size|full.?size|suv|luxury|minivan|convertible|sedan)\b/i)
  const parts = [co?.[1], cls?.[1], 'Rental'].filter(Boolean)
  return parts.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

function findLocation(text, category) {
  if (category === 'flight') {
    const airports = findAirports(text)
    if (airports.length >= 2) return `${airports[0]} → ${airports[airports.length - 1]}`
  }
  if (category === 'hotel') {
    const addr = text.match(/\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:St|Ave|Blvd|Rd|Dr|Way|Lane|Ln|Court|Ct)\.?)?\s*,\s*[A-Z][a-z]+/i)
    if (addr) return addr[0].trim().slice(0, 80)
  }
  if (category === 'car') {
    const pickup = text.match(/(?:pickup|pick.up|collection)\s*(?:location|at|from)?[:\s]+([^\n,]{5,50})/i)
    if (pickup) return pickup[1].trim()
  }
  if (category === 'train') {
    const route = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:to|→|-)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
    if (route) return `${route[1]} → ${route[2]}`
  }
  return ''
}

export function parseReservation(text, category) {
  const dates = findDates(text)
  let title = ''
  if (category === 'flight') title = findFlightTitle(text)
  else if (category === 'hotel') title = findHotelTitle(text)
  else if (category === 'car') title = findCarTitle(text)
  else if (category === 'train') title = text.match(/\b(amtrak|eurostar|[a-z]+ rail)\b/i)?.[1] || 'Train Reservation'
  else title = 'Reservation'

  return {
    title,
    category,
    item_date: dates[0] || '',
    item_time: findTime(text),
    location: findLocation(text, category),
    booking_ref: findBookingRef(text),
    description: text.slice(0, 300).trim(),
  }
}
