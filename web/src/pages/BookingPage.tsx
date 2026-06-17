import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.css'

function ModernDatePicker({
  value,
  onChange,
  placeholder,
  className,
  minDate,
  disabled
}: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  minDate?: string
  disabled?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const fp = flatpickr(ref.current, {
      dateFormat: 'Y-m-d',
      defaultDate: value || undefined,
      minDate: minDate || undefined,
      onChange: (_, dateStr) => {
        onChange(dateStr)
      },
    })
    return () => fp.destroy()
  }, [minDate])

  useEffect(() => {
    if (ref.current && (ref.current as any)._flatpickr) {
      (ref.current as any)._flatpickr.setDate(value, false)
    }
  }, [value])

  return (
    <input
      ref={ref}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  )
}
import { differenceInDays, addDays, format } from 'date-fns'
import toast from 'react-hot-toast'
import Navbar from '../components/Navbar'
import api from '../lib/api'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000'

interface Scooter {
  id: string; scooterCode: string; title: string; brand: string; model: string
  year: number; color: string; plateNumber: string; dailyRate: number
  weeklyRate: number; monthlyRate: number; status: string; description?: string; images: string[]
}

interface DeliveryZone {
  id: string; zoneName: string; distanceKm: number; fee: number
}

// ─── Price Logic ──────────────────────────────────────────────────────────────
// Rates: monthly if >= 28 days, weekly if >= 7 days (and >= half a week), else daily
function calcPrice(scooter: Scooter, days: number) {
  if (days <= 0) return 0
  const daily = Number(scooter.dailyRate)
  const weekly = Number(scooter.weeklyRate)
  const monthly = Number(scooter.monthlyRate)

  const fullMonths = Math.floor(days / 30)
  const remainingAfterMonths = days % 30
  const fullWeeks = Math.floor(remainingAfterMonths / 7)
  const remainingDays = remainingAfterMonths % 7

  return (fullMonths * monthly) + (fullWeeks * weekly) + (remainingDays * daily)
}

function describeRate(scooter: Scooter, days: number): string {
  if (days <= 0) return ''
  const monthly = Number(scooter.monthlyRate)
  const weekly = Number(scooter.weeklyRate)
  const daily = Number(scooter.dailyRate)

  const fullMonths = Math.floor(days / 30)
  const remainingAfterMonths = days % 30
  const fullWeeks = Math.floor(remainingAfterMonths / 7)
  const remainingDays = remainingAfterMonths % 7

  const parts: string[] = []
  if (fullMonths > 0) parts.push(`${fullMonths}mo × Rs. ${monthly}`)
  if (fullWeeks > 0) parts.push(`${fullWeeks}wk × Rs. ${weekly}`)
  if (remainingDays > 0) parts.push(`${remainingDays}d × Rs. ${daily}`)
  return parts.join(' + ')
}

const DEFAULT_SECURITY_DEPOSIT = 15000

export default function BookingPage() {
  const { scooterId } = useParams<{ scooterId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const qPickup = searchParams.get('pickupDate')
  const qReturn = searchParams.get('returnDate')

  const [scooter, setScooter] = useState<Scooter | null>(null)
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [loading, setLoading] = useState(true)
  const [securityDeposit, setSecurityDeposit] = useState(DEFAULT_SECURITY_DEPOSIT)

  // Form state
  const [form, setForm] = useState({
    customerName: '', nationality: '', passportNumber: '',
    email: '', phone: '',
    pickupDate: qPickup || format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    returnDate: qReturn || format(addDays(new Date(), 3), 'yyyy-MM-dd'),
    pickupType: 'OFFICE',
    deliveryZoneId: '',
    notes: '',
  })
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null)
  const [idpPhoto, setIdpPhoto] = useState<File | null>(null)

  // Booking state
  const [step, setStep] = useState<'form' | 'agreement' | 'sign' | 'confirm_sign'>('form')
  const [localSignature, setLocalSignature] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [booking, setBooking] = useState<{ id: string; bookingId: string; totalAmount: number } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER'>('CASH')
  const [bankSlip, setBankSlip] = useState<File | null>(null)

  // Agreement Scroll Detection
  const termsRef = useRef<HTMLDivElement>(null)
  const [hasReadAgreement, setHasReadAgreement] = useState(false)

  const [rules, setRules] = useState<Array<{ title: string; description: string }>>([
    {
      title: "1. Driving License & Helmet Policy",
      description: "Renter must hold a valid driver's license and suitable International Driving Permit (IDP). Both driver and passenger must wear certified safety helmets at all times when riding the vehicle."
    },
    {
      title: "2. Speed Limits & Safety",
      description: "Obey all local traffic laws and speed limits. Always drive defensively and safely. Sub-renting, loaning, or allowing unauthorized persons to drive the scooter is strictly prohibited."
    },
    {
      title: "3. Scooter Maintenance & Damage Liability",
      description: "Renter acknowledges receipt of the scooter in excellent mechanical and aesthetic condition, and agrees to return it in the same condition. Any damage, mechanical failure, or theft occurring during the rental period is the sole financial responsibility of the renter."
    },
    {
      title: "4. Fuel Policy",
      description: "The vehicle should be returned with the same level of fuel as provided at pickup."
    },
    {
      title: "5. Security Deposit",
      description: "A Security Deposit of Rs. {securityDeposit} is charged. This deposit is fully refundable upon safe, clean, and undamaged return of the vehicle after inspection."
    }
  ])

  useEffect(() => {
    api.get('/bookings/rules')
      .then(res => {
        const data = res.data?.data ?? res.data
        if (Array.isArray(data) && data.length > 0) {
          setRules(data)
        }
      })
      .catch(err => {
        console.error('Failed to fetch agreement rules', err)
      })
  }, [])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 10) {
      setHasReadAgreement(true)
    }
  }

  // Canvas drawing ref and state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return null
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    
    let clientX = 0
    let clientY = 0
    if ('touches' in e) {
      if (e.touches.length === 0) return null
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const coords = getCoordinates(e)
    if (!coords || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return
    e.preventDefault()
    const coords = getCoordinates(e)
    if (!coords) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.lineTo(coords.x, coords.y)
    ctx.strokeStyle = '#0f172a' // clean dark ink
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const handleSignAndSubmit = async () => {
    if (!canvasRef.current || !booking) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('signatureBase64', dataUrl)
      
      await api.post(`/bookings/${booking.id}/sign`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      setLocalSignature(dataUrl)
      setStep('confirm_sign')
      toast.success('Agreement signed successfully!')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to submit signature. Please try again.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Availability state
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  useEffect(() => {
    if (!scooterId || !form.pickupDate || !form.returnDate) return
    const days = differenceInDays(new Date(form.returnDate), new Date(form.pickupDate))
    if (days < 1) {
      setIsAvailable(false)
      return
    }

    setCheckingAvailability(true)
    api.get(`/scooters/${scooterId}/availability`, {
      params: {
        pickupDate: new Date(form.pickupDate).toISOString(),
        returnDate: new Date(form.returnDate).toISOString(),
      }
    }).then(res => {
      const data = res.data?.data ?? res.data
      setIsAvailable(data.available)
    }).catch(() => {
      setIsAvailable(null)
    }).finally(() => {
      setCheckingAvailability(false)
    })
  }, [scooterId, form.pickupDate, form.returnDate])

  useEffect(() => {
    Promise.all([
      api.get(`/scooters/${scooterId}`),
      api.get('/delivery/zones'),
      api.get('/settings').catch(() => ({ data: { depositAmount: DEFAULT_SECURITY_DEPOSIT, depositRequired: true } })),
    ]).then(([sRes, zRes, setRes]) => {
      const s = sRes.data?.data ?? sRes.data
      setScooter(s)
      const z = zRes.data?.data ?? zRes.data
      setZones(Array.isArray(z) ? z : [])
      const settings = setRes.data?.data ?? setRes.data
      if (settings && settings.depositRequired === false) {
        setSecurityDeposit(0)
      } else if (settings) {
        setSecurityDeposit(settings.depositAmount ?? DEFAULT_SECURITY_DEPOSIT)
      }
    }).catch(() => toast.error('Failed to load scooter details'))
      .finally(() => setLoading(false))
  }, [scooterId])

  const days = differenceInDays(new Date(form.returnDate), new Date(form.pickupDate))
  const rentalCost = scooter ? calcPrice(scooter, Math.max(days, 1)) : 0
  const deliveryZone = zones.find(z => z.id === form.deliveryZoneId)
  const deliveryFee = form.pickupType === 'HOTEL' && deliveryZone ? Number(deliveryZone.fee) : 0
  const baseTotal = rentalCost + deliveryFee + securityDeposit
  
  // Card processing fee 3.5%
  const cardFee = paymentMethod === 'CARD' ? baseTotal * 0.035 : 0
  const totalAmount = baseTotal + cardFee

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scooter) return
    if (days < 1) { toast.error('Return date must be after pickup date'); return }
    if (!form.customerName || !form.email || !form.phone || !form.passportNumber) {
      toast.error('Please fill in all required fields'); return
    }
    if (paymentMethod === 'BANK_TRANSFER' && !bankSlip) {
      toast.error('Please upload your bank transfer slip'); return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('scooterId', scooter.id)
      fd.append('customerName', form.customerName)
      fd.append('nationality', form.nationality)
      fd.append('passportNumber', form.passportNumber)
      fd.append('email', form.email)
      fd.append('phone', form.phone)
      fd.append('pickupDate', new Date(form.pickupDate).toISOString())
      fd.append('returnDate', new Date(form.returnDate).toISOString())
      fd.append('rentalDays', String(Math.max(days, 1)))
      fd.append('totalAmount', String(totalAmount))
      fd.append('securityDeposit', String(securityDeposit))
      fd.append('pickupType', form.pickupType)
      if (form.pickupType === 'HOTEL' && form.deliveryZoneId) fd.append('deliveryZoneId', form.deliveryZoneId)
      fd.append('deliveryFee', String(deliveryFee))
      if (form.notes) fd.append('notes', form.notes)
      fd.append('paymentMethod', paymentMethod)

      if (passportPhoto) fd.append('passportPhoto', passportPhoto)
      if (idpPhoto) fd.append('idpPhoto', idpPhoto)
      if (paymentMethod === 'BANK_TRANSFER' && bankSlip) {
        fd.append('bankSlip', bankSlip)
      }

      const res = await api.post('/bookings/customer', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const bk = res.data?.data ?? res.data
      setBooking({ id: bk.id, bookingId: bk.bookingId, totalAmount })

      setStep('agreement')
      toast.success(`Booking created! Please review the rental agreement next.`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Booking failed. Please try again.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="loading-screen">
          <div className="spinner" />
          <span>Loading scooter...</span>
        </div>
      </>
    )
  }

  if (!scooter) {
    return (
      <>
        <Navbar />
        <div className="result-page">
          <div className="result-icon">⚠️</div>
          <h1 className="result-title">Scooter not found</h1>
          <button className="btn btn-primary" onClick={() => navigate('/scooters')}>Back to Fleet</button>
        </div>
      </>
    )
  }

  const imgSrc = scooter.images?.length > 0 ? `${API_BASE}${scooter.images[0]}` : null

  if (step === 'agreement' && booking) {
    return (
      <>
        <Navbar />
        <div className="form-page">
          <div className="form-container">
            <div style={{ paddingTop: 12, paddingBottom: 24 }}>
              <div className="section-label">✦ Step 2 of 4</div>
              <h1 className="page-title">Rental Agreement</h1>
              <p className="page-subtitle">Please scroll through and review the terms of your rental contract</p>
            </div>

            <div 
              ref={termsRef}
              onScroll={handleScroll}
              className="form-card" 
              style={{ padding: '24px', maxHeight: '400px', overflowY: 'auto', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }}
            >
              <h3 style={{ fontFamily: 'Outfit', color: 'white', fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 20 }}>MIGGA SCOOTER RENTAL AGREEMENT</h3>
              
              <div style={{ fontSize: 13, color: 'var(--slate-light)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p>This Rental Agreement (the "Agreement") is entered into by and between <strong>Migga Scooter Rentals</strong> ("Owner") and the Renter specified below:</p>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, marginBottom: 8, background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 8 }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'white' }}>Renter Name:</td>
                      <td style={{ padding: '8px 12px' }}>{form.customerName}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'white' }}>Passport No:</td>
                      <td style={{ padding: '8px 12px' }}>{form.passportNumber}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'white' }}>Scooter Model:</td>
                      <td style={{ padding: '8px 12px' }}>{scooter.brand} {scooter.model}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'white' }}>Rental Period:</td>
                      <td style={{ padding: '8px 12px' }}>{form.pickupDate} to {form.returnDate} ({days} days)</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'white' }}>Total Amount:</td>
                      <td style={{ padding: '8px 12px', color: 'var(--coral)', fontWeight: 700 }}>Rs. {booking.totalAmount.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                {rules.map((rule, idx) => (
                  <div key={idx} style={{ marginBottom: 12 }}>
                    <h4 style={{ color: 'white', margin: '8px 0 2px 0', fontSize: 14 }}>{rule.title}</h4>
                    <p style={{ margin: 0 }}>{rule.description.replace('{securityDeposit}', securityDeposit.toFixed(2))}</p>
                  </div>
                ))}
              </div>
            </div>

            <button 
              className="btn btn-primary btn-full" 
              onClick={() => setStep('sign')} 
              disabled={!hasReadAgreement}
              style={{ marginTop: 24 }}
            >
              {hasReadAgreement ? '✍️ Proceed to Digital Signature' : '📜 Scroll to bottom to unlock signature'}
            </button>
          </div>
        </div>
      </>
    )
  }

  if (step === 'sign' && booking) {
    return (
      <>
        <Navbar />
        <div className="form-page">
          <div className="form-container">
            <div style={{ paddingTop: 12, paddingBottom: 24 }}>
              <div className="section-label">✦ Step 3 of 4</div>
              <h1 className="page-title">Digital Signature</h1>
              <p className="page-subtitle">Please draw your signature inside the box to sign the contract</p>
            </div>

            <div className="form-card" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div style={{ width: '100%' }}>
                <label className="form-label" style={{ marginBottom: 8 }}>Draw Signature *</label>
                <div style={{ background: '#ffffff', border: '2px dashed rgba(255, 107, 74, 0.4)', borderRadius: 16, overflow: 'hidden', touchAction: 'none' }}>
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={200}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{
                      width: '100%',
                      height: '200px',
                      display: 'block',
                      cursor: 'crosshair',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--slate)' }}>Draw inside the white box</span>
                  <button type="button" className="btn btn-outline" onClick={clearCanvas} style={{ padding: '4px 12px', fontSize: 12, height: 'auto', minWidth: 'auto', background: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                    🧹 Clear Canvas
                  </button>
                </div>
              </div>
            </div>

            <button className="btn btn-primary btn-full" onClick={handleSignAndSubmit} disabled={submitting} style={{ marginTop: 24 }}>
              {submitting ? (
                <>
                  <div className="spinner spinner-sm" />
                  Submitting Signature...
                </>
              ) : (
                '📝 Sign & Accept Agreement'
              )}
            </button>
          </div>
        </div>
      </>
    )
  }

  if (step === 'confirm_sign' && booking) {
    const signedDateStr = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    const signedTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

    return (
      <>
        <Navbar />
        <div className="form-page">
          <div className="form-container">
            <div style={{ paddingTop: 12, paddingBottom: 24 }}>
              <div className="section-label">✦ Step 4 of 4</div>
              <h1 className="page-title">Signature Confirmed</h1>
              <p className="page-subtitle">Your agreement is signed and verified. Preview your digital contract below.</p>
            </div>

            {/* Premium PDF document-style preview */}
            <div 
              style={{ 
                padding: '40px', 
                background: '#ffffff', 
                color: '#1e293b', 
                border: '1px solid #e2e8f0', 
                borderRadius: 8, 
                boxShadow: '0 10px 30px rgba(0,0,0,0.25)', 
                fontFamily: 'Inter, system-ui, sans-serif',
                marginBottom: 24
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 28, borderBottom: '2px solid #0f172a', paddingBottom: 16 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '0.05em', margin: 0, fontFamily: 'Outfit, sans-serif' }}>MIGGA SCOOTER RENTALS</h2>
                <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.1em', margin: '6px 0 0 0' }}>OFFICIAL DIGITAL AGREEMENT & LIABILITY WAIVER</p>
              </div>
              
              <div style={{ fontSize: 12, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, marginBottom: 28, borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
                <div>
                  <strong style={{ color: '#0f172a', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Renter Profile</strong>
                  <div style={{ marginTop: 6, fontWeight: 500 }}>Name: {form.customerName}</div>
                  <div>Passport Number: {form.passportNumber}</div>
                  <div>Nationality: {form.nationality}</div>
                  <div>Phone Contact: {form.phone}</div>
                  <div>Email Address: {form.email}</div>
                </div>
                <div>
                  <strong style={{ color: '#0f172a', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Rental Profile</strong>
                  <div style={{ marginTop: 6, fontWeight: 500 }}>Scooter: {scooter.brand} {scooter.model} ({scooter.plateNumber})</div>
                  <div>Pickup: {form.pickupDate} ({form.pickupType})</div>
                  <div>Return Due: {form.returnDate}</div>
                  <div>Rental Duration: {days} days</div>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginTop: 4 }}>Total Amount: Rs. {booking.totalAmount.toFixed(2)}</div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 14, marginBottom: 28, fontSize: 12 }}>
                <div style={{ color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  ✓ DIGITAL SIGNATURE RECORDED
                </div>
                <div style={{ color: '#475569', lineHeight: '1.4' }}>
                  This document serves as binding confirmation. Executed digitally by renter on {signedDateStr} at {signedTimeStr}. IP and metadata logged.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 40 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issued By</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>Migga Scooter Rentals</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Authorized Agent Signature</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Renter Digital Signature</div>
                  {localSignature && (
                    <img src={localSignature} alt="Renter Signature" style={{ maxHeight: 50, maxWidth: 150, borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }} />
                  )}
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{form.customerName}</div>
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 8 }}
              onClick={async () => {
                setSubmitting(true)
                try {
                  await api.post(`/bookings/${booking.id}/confirm-booking`)
                  toast.success('Booking completed successfully!')
                  navigate(`/payments/success?bookingId=${booking.bookingId}&payLater=true`)
                } catch (err) {
                  console.error('Failed to finalize booking:', err)
                  toast.error('Failed to finalize booking. Please try again.')
                } finally {
                  setSubmitting(false)
                }
              }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="spinner spinner-sm" />
                  Finalizing Booking...
                </>
              ) : (
                '🏁 Complete Booking & Get QR Code'
              )}
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="form-page">
        <div className="form-container">
          <div style={{ paddingTop: 12, paddingBottom: 24 }}>
            <div className="section-label">✦ Step 1 of 4</div>
            <h1 className="page-title">Book Your Scooter</h1>
            <p className="page-subtitle">Fill in your details to reserve this scooter</p>
          </div>

          {/* Selected scooter card */}
          <div className="selected-scooter-card">
            {imgSrc
              ? <img src={imgSrc} alt={scooter.title} className="selected-scooter-img" />
              : <div className="selected-scooter-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🛵</div>
            }
            <div className="selected-scooter-info">
              <div className="scooter-name">{scooter.title}</div>
              <div className="scooter-model">{scooter.brand} {scooter.model} · {scooter.year}</div>
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--slate-light)' }}>
                From Rs. {Number(scooter.dailyRate).toFixed(0)}/day · Rs. {Number(scooter.weeklyRate).toFixed(0)}/week · Rs. {Number(scooter.monthlyRate).toFixed(0)}/month
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} id="booking-form">
            {/* Personal details */}
            <div className="form-card fade-up fade-up-1">
              <div className="form-card-title">👤 Personal Details</div>

              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input name="customerName" className="form-input" placeholder="John Smith" value={form.customerName} onChange={handleChange} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nationality *</label>
                  <input name="nationality" className="form-input" placeholder="British" value={form.nationality} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Passport No. *</label>
                  <input name="passportNumber" className="form-input" placeholder="N1234567" value={form.passportNumber} onChange={handleChange} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email *</label>
                <input name="email" type="email" className="form-input" placeholder="john@email.com" value={form.email} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input name="phone" className="form-input" placeholder="+447700900123" value={form.phone} onChange={handleChange} required />
              </div>
            </div>

            {/* Rental Dates */}
            <div className="form-card fade-up fade-up-2">
              <div className="form-card-title">📅 Rental Period</div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Pickup Date *</label>
                  <ModernDatePicker
                    className="form-input"
                    placeholder="Select pickup date"
                    value={form.pickupDate}
                    minDate={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(val) => {
                      setForm(f => ({ ...f, pickupDate: val }))
                      if (form.returnDate && val > form.returnDate) {
                        setForm(f => ({ ...f, returnDate: '' }))
                      }
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Return Date *</label>
                  <ModernDatePicker
                    className="form-input"
                    placeholder="Select return date"
                    value={form.returnDate}
                    minDate={form.pickupDate || format(new Date(), 'yyyy-MM-dd')}
                    onChange={(val) => setForm(f => ({ ...f, returnDate: val }))}
                  />
                </div>
              </div>

              {days > 0 && scooter && (
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--slate-light)', marginBottom: 12 }}>
                  📊 <strong style={{ color: 'white' }}>{days} day{days !== 1 ? 's' : ''}</strong> · {describeRate(scooter, days)} = <strong style={{ color: 'var(--coral)' }}>Rs. {rentalCost.toFixed(2)}</strong>
                </div>
              )}

              {checkingAvailability && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--slate-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="spinner spinner-sm" /> Checking scooter availability...
                </div>
              )}

              {!checkingAvailability && isAvailable === false && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
                  ⚠️ This scooter is booked or unavailable for these dates. Please choose a different date range.
                </div>
              )}

              {!checkingAvailability && isAvailable === true && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#4ade80' }}>
                  ✓ This scooter is available for these dates!
                </div>
              )}
            </div>

            {/* Pickup Type */}
            <div className="form-card fade-up fade-up-3">
              <div className="form-card-title">📍 Pickup Method</div>
              <div className="pickup-options">
                <div className="pickup-option">
                  <input type="radio" id="office" name="pickupType" value="OFFICE" checked={form.pickupType === 'OFFICE'} onChange={handleChange} />
                  <label htmlFor="office" className="pickup-option-label">
                    <span className="pickup-option-icon">🏢</span>
                    <span className="pickup-option-text">Office</span>
                    <span className="pickup-option-sub">Free pickup</span>
                  </label>
                </div>
                <div className="pickup-option">
                  <input type="radio" id="hotel" name="pickupType" value="HOTEL" checked={form.pickupType === 'HOTEL'} onChange={handleChange} />
                  <label htmlFor="hotel" className="pickup-option-label">
                    <span className="pickup-option-icon">🏨</span>
                    <span className="pickup-option-text">Hotel</span>
                    <span className="pickup-option-sub">Delivery fee</span>
                  </label>
                </div>
              </div>

              {form.pickupType === 'HOTEL' && (
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Delivery Zone *</label>
                  <select name="deliveryZoneId" className="form-input" value={form.deliveryZoneId} onChange={handleChange} required={form.pickupType === 'HOTEL'}>
                    <option value="">— Select your area —</option>
                    {zones.map(z => (
                      <option key={z.id} value={z.id}>
                        {z.zoneName} ({Number(z.distanceKm).toFixed(1)} km) — Rs. {Number(z.fee).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Documents */}
            <div className="form-card fade-up fade-up-4">
              <div className="form-card-title">📄 Documents (Optional)</div>
              <p style={{ fontSize: 12, color: 'var(--slate-light)', marginBottom: 16 }}>
                Upload clear photos of your passport and IDP for a faster check-in experience
              </p>

              <div className="form-group">
                <label className="form-label">Passport Photo</label>
                <div className="upload-area">
                  <input type="file" accept="image/*" onChange={e => setPassportPhoto(e.target.files?.[0] ?? null)} />
                  <span className="upload-icon">🛂</span>
                  <div className="upload-label"><span>Tap to upload</span> passport photo</div>
                  {passportPhoto && <div className="upload-name">✓ {passportPhoto.name}</div>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">IDP (International Driving Permit)</label>
                <div className="upload-area">
                  <input type="file" accept="image/*" onChange={e => setIdpPhoto(e.target.files?.[0] ?? null)} />
                  <span className="upload-icon">🪪</span>
                  <div className="upload-label"><span>Tap to upload</span> IDP photo</div>
                  {idpPhoto && <div className="upload-name">✓ {idpPhoto.name}</div>}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="form-card fade-up fade-up-5">
              <div className="form-card-title">📝 Special Requests</div>
              <div className="form-group">
                <textarea name="notes" className="form-input" rows={3}
                  placeholder="Any special requests or notes for us..."
                  value={form.notes} onChange={handleChange}
                  style={{ resize: 'vertical', minHeight: 80 }} />
              </div>
            </div>

            {/* Payment Method */}
            <div className="form-card fade-up fade-up-6">
              <div className="form-card-title">💳 Payment Method</div>
              <div className="pickup-options">
                <div className="pickup-option">
                  <input type="radio" id="pay-cash" name="paymentMethod" value="CASH" checked={paymentMethod === 'CASH'} onChange={() => setPaymentMethod('CASH')} />
                  <label htmlFor="pay-cash" className="pickup-option-label">
                    <span className="pickup-option-icon">💵</span>
                    <span className="pickup-option-text">Cash (At Pickup)</span>
                    <span className="pickup-option-sub">Pay in LKR upon collection</span>
                  </label>
                </div>
                <div className="pickup-option">
                  <input type="radio" id="pay-card" name="paymentMethod" value="CARD" checked={paymentMethod === 'CARD'} onChange={() => setPaymentMethod('CARD')} />
                  <label htmlFor="pay-card" className="pickup-option-label">
                    <span className="pickup-option-icon">💳</span>
                    <span className="pickup-option-text">Card (At Pickup)</span>
                    <span className="pickup-option-sub">Extra 3.5% processing fee</span>
                  </label>
                </div>
                <div className="pickup-option">
                  <input type="radio" id="pay-bank" name="paymentMethod" value="BANK_TRANSFER" checked={paymentMethod === 'BANK_TRANSFER'} onChange={() => setPaymentMethod('BANK_TRANSFER')} />
                  <label htmlFor="pay-bank" className="pickup-option-label">
                    <span className="pickup-option-icon">🏛️</span>
                    <span className="pickup-option-text">Bank Transfer (Now)</span>
                    <span className="pickup-option-sub">Transfer now & upload receipt</span>
                  </label>
                </div>
              </div>

              {paymentMethod === 'BANK_TRANSFER' && (
                <div style={{ marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--slate-light)', marginBottom: 16 }}>
                    <strong>Bank Transfer Details:</strong><br />
                    Bank: Sampath Bank<br />
                    Account Name: Migga Scooter Rentals (Pvt) Ltd<br />
                    Account Number: 1234 5678 9012<br />
                    Branch: Colombo Fort
                  </div>
                  <div className="form-group">
                    <label className="form-label">Upload Bank Transfer Slip *</label>
                    <div className="upload-area">
                      <input type="file" accept="image/*" onChange={e => setBankSlip(e.target.files?.[0] ?? null)} required />
                      <span className="upload-icon">🧾</span>
                      <div className="upload-label"><span>Tap to upload</span> payment receipt/slip</div>
                      {bankSlip && <div className="upload-name">✓ {bankSlip.name}</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Price summary */}
            <div className="price-summary fade-up">
              <div className="price-row">
                <span>Rental ({Math.max(days, 1)} days)</span>
                <span className="val">Rs. {rentalCost.toFixed(2)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="price-row">
                  <span>Delivery Fee</span>
                  <span className="val">Rs. {deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="price-row">
                <span>Security Deposit</span>
                <span className="val">Rs. {securityDeposit.toFixed(2)}</span>
              </div>
              {paymentMethod === 'CARD' && (
                <div className="price-row">
                  <span>Card Fee (3.5%)</span>
                  <span className="val">Rs. {cardFee.toFixed(2)}</span>
                </div>
              )}
              <div className="price-row total">
                <span>Total</span>
                <span className="val">Rs. {totalAmount.toFixed(2)}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--slate)', marginTop: 10 }}>
                Security deposit is refunded upon return of the scooter in good condition.
              </p>
            </div>

            <button type="submit" className="btn btn-primary btn-full fade-up" disabled={submitting || isAvailable === false || checkingAvailability} id="submit-booking">
              {submitting ? (
                <>
                  <div className="spinner spinner-sm" />
                  Creating Booking...
                </>
              ) : checkingAvailability ? (
                'Checking Availability...'
              ) : isAvailable === false ? (
                '❌ Scooter Unavailable'
              ) : (
                '📝 Continue to Agreement'
              )}
            </button>
          </form>

          <div style={{ height: 48 }} />
        </div>
      </div>
    </>
  )
}
