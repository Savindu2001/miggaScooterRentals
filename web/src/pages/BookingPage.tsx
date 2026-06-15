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
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'
import Navbar from '../components/Navbar'
import api from '../lib/api'

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID ?? ''
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000'
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL ?? window.location.origin

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
  if (fullMonths > 0) parts.push(`${fullMonths}mo × $${monthly}`)
  if (fullWeeks > 0) parts.push(`${fullWeeks}wk × $${weekly}`)
  if (remainingDays > 0) parts.push(`${remainingDays}d × $${daily}`)
  return parts.join(' + ')
}

// Initial default value for security deposit
const DEFAULT_SECURITY_DEPOSIT = 100

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
  const [step, setStep] = useState<'form' | 'agreement' | 'sign' | 'confirm_sign' | 'payment'>('form')
  const [localSignature, setLocalSignature] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [booking, setBooking] = useState<{ id: string; bookingId: string; totalAmount: number } | null>(null)
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null)
  const [paymentOption, setPaymentOption] = useState<'NOW' | 'LATER'>('NOW')

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
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
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
  const totalAmount = rentalCost + deliveryFee + securityDeposit

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
      if (passportPhoto) fd.append('passportPhoto', passportPhoto)
      if (idpPhoto) fd.append('idpPhoto', idpPhoto)

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
              <div className="section-label">✦ Step 2 of 5</div>
              <h1 className="page-title">Rental Agreement</h1>
              <p className="page-subtitle">Please review the terms and conditions of your rental</p>
            </div>

            <div className="form-card" style={{ padding: '24px', maxHeight: '400px', overflowY: 'auto', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }}>
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
                      <td style={{ padding: '8px 12px', color: 'var(--coral)', fontWeight: 700 }}>${booking.totalAmount.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                <h4 style={{ color: 'white', margin: '8px 0 2px 0', fontSize: 14 }}>1. Operating Conditions</h4>
                <p>The Renter agrees that they possess a valid driver's license and International Driving Permit (IDP) suitable for operating a motor scooter. Renter warrants they will wear a protective helmet at all times when riding the scooter.</p>

                <h4 style={{ color: 'white', margin: '8px 0 2px 0', fontSize: 14 }}>2. Scooter Maintenance & Care</h4>
                <p>The Renter acknowledges receipt of the scooter in excellent mechanical and aesthetic condition. The Renter agrees to return the scooter in the same condition, normal wear and tear excepted. Any damage will be charged from the Security Deposit or billed separately if expenses exceed the deposit.</p>

                <h4 style={{ color: 'white', margin: '8px 0 2px 0', fontSize: 14 }}>3. Security Deposit</h4>
                <p>A Security Deposit of ${securityDeposit.toFixed(2)} is charged. This deposit is fully refundable upon the return of the scooter in undamaged and clean condition.</p>

                <h4 style={{ color: 'white', margin: '8px 0 2px 0', fontSize: 14 }}>4. Liability & Insurance</h4>
                <p>The Renter assumes full responsibility for all risks associated with operating the scooter, including third-party liability, personal injury, property damage, and traffic citations. Owner is not liable for any claims resulting from the operation of the vehicle by Renter.</p>
              </div>
            </div>

            <button className="btn btn-primary btn-full" onClick={() => setStep('sign')} style={{ marginTop: 24 }}>
              ✍️ Proceed to Digital Signature
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
              <div className="section-label">✦ Step 3 of 5</div>
              <h1 className="page-title">Digital Signature</h1>
              <p className="page-subtitle">Please draw your signature inside the box to sign the contract</p>
            </div>

            <div className="form-card" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div style={{ width: '100%' }}>
                <label className="form-label" style={{ marginBottom: 8 }}>Draw Signature *</label>
                <div style={{ background: '#0f172a', border: '2px dashed rgba(255, 107, 74, 0.4)', borderRadius: 16, overflow: 'hidden', touchAction: 'none' }}>
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
                  <span style={{ fontSize: 12, color: 'var(--slate)' }}>Draw with your mouse or finger</span>
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
    return (
      <>
        <Navbar />
        <div className="form-page">
          <div className="form-container">
            <div style={{ paddingTop: 12, paddingBottom: 24 }}>
              <div className="section-label">✦ Step 4 of 5</div>
              <h1 className="page-title">Signature Confirmed</h1>
              <p className="page-subtitle">Your agreement is signed and verified</p>
            </div>

            <div className="form-card" style={{ padding: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }}>
              <h3 style={{ fontFamily: 'Outfit', color: 'white', fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 20 }}>MIGGA SCOOTER RENTAL AGREEMENT</h3>
              
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: 14, color: '#4ade80', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
                ✓ <strong>Digital Contract Executed Successfully</strong><br />
                Signed on {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>

              <div style={{ fontSize: 13, color: 'var(--slate-light)', lineHeight: '1.6', opacity: 0.65, maxHeight: '120px', overflowY: 'auto', marginBottom: 20, padding: 10, background: 'rgba(0,0,0,0.1)', borderRadius: 8 }}>
                <p style={{ margin: 0 }}>Renter <strong>{form.customerName}</strong> (Passport: {form.passportNumber}) agrees to all operating conditions, scooter maintenance policies, liability limits, and payments related to renting scooter {scooter.brand} {scooter.model} for the period {form.pickupDate} to {form.returnDate}.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 11, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Renter Signature</span>
                {localSignature && (
                  <img src={localSignature} alt="Renter Signature" style={{ maxHeight: 80, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 6 }} />
                )}
                <span style={{ fontSize: 13, color: 'white', fontWeight: 600, marginTop: 4 }}>{form.customerName}</span>
              </div>
            </div>

            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 24 }}
              onClick={async () => {
                if (paymentOption === 'LATER') {
                  toast.success(`Booking ${booking.bookingId} created!`)
                  navigate(`/payments/success?bookingId=${booking.bookingId}&payLater=true`)
                } else {
                  setSubmitting(true)
                  try {
                    const payRes = await api.post('/payments/create-order-public', {
                      bookingId: booking.id,
                      returnUrl: `${FRONTEND_URL}/payments/success`,
                      cancelUrl: `${FRONTEND_URL}/payments/cancel`,
                    })
                    const orderData = payRes.data?.data ?? payRes.data
                    setPaypalOrderId(orderData.paypalOrderId)
                    setStep('payment')
                  } catch (err) {
                    console.error('Failed to pre-create PayPal order:', err)
                    setStep('payment')
                  } finally {
                    setSubmitting(false)
                  }
                }
              }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="spinner spinner-sm" />
                  Preparing Payment...
                </>
              ) : paymentOption === 'NOW' ? (
                '💳 Proceed to Payment (Step 5 of 5)'
              ) : (
                '📅 Confirm Booking & Pay Later'
              )}
            </button>
          </div>
        </div>
      </>
    )
  }

  if (step === 'payment' && booking) {
    console.log('PAYPAL_CLIENT_ID used in script:', PAYPAL_CLIENT_ID)
    return (
      <>
        <Navbar />
        <div className="form-page">
          <div className="form-container">
            <div style={{ paddingTop: 12, paddingBottom: 24 }}>
              <div className="section-label">✦ Step 5 of 5</div>
              <h1 className="page-title">Complete Payment</h1>
              <p className="page-subtitle">Pay securely via PayPal to confirm your booking</p>
            </div>

            <div className="booking-ref-card" style={{ width: '100%', maxWidth: '100%', marginBottom: 24 }}>
              <div className="booking-ref-label">Booking Reference</div>
              <div className="booking-ref-value">{booking.bookingId}</div>
              <div style={{ fontSize: 12, color: 'var(--slate-light)', marginTop: 8 }}>
                Check your email for booking details. A PayPal email was also sent.
              </div>
            </div>

            <div className="price-summary" style={{ marginBottom: 24 }}>
              <div className="price-row">
                <span>Rental Total</span>
                <span className="val">${rentalCost.toFixed(2)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="price-row">
                  <span>Delivery Fee</span>
                  <span className="val">${deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="price-row">
                <span>Security Deposit</span>
                <span className="val">${securityDeposit.toFixed(2)}</span>
              </div>
              <div className="price-row total">
                <span>Total</span>
                <span className="val">${booking.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {PAYPAL_CLIENT_ID ? (
              <div className="paypal-wrapper">
                <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'USD' }}>
                  <PayPalButtons
                    style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
                    createOrder={async () => {
                      if (paypalOrderId) return paypalOrderId
                      const payRes = await api.post('/payments/create-order-public', {
                        bookingId: booking.id,
                        returnUrl: `${FRONTEND_URL}/payments/success`,
                        cancelUrl: `${FRONTEND_URL}/payments/cancel`,
                      })
                      const od = payRes.data?.data ?? payRes.data
                      return od.paypalOrderId
                    }}
                    onApprove={async (data) => {
                      try {
                        await api.post(`/payments/capture/${data.orderID}`)
                        navigate(`/payments/success?bookingId=${booking.bookingId}`)
                      } catch (err: any) {
                        console.error('PayPal capture error:', err)
                        const errMsg = err?.response?.data?.message ?? 'Payment capture failed. Please contact support.'
                        toast.error(errMsg)
                      }
                    }}
                    onError={(err) => {
                      console.error('PayPal Smart Buttons error:', err)
                      toast.error('PayPal error. Please try again.')
                    }}
                    onCancel={() => toast('Payment cancelled. You can retry anytime.')}
                  />
                </PayPalScriptProvider>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,107,74,0.1)', border: '1px solid rgba(255,107,74,0.3)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 14, color: '#ff9e85', marginBottom: 8 }}>⚠️ PayPal not configured</div>
                <div style={{ fontSize: 12, color: 'var(--slate-light)' }}>
                  Set VITE_PAYPAL_CLIENT_ID in your .env file.<br />
                  Your booking <strong style={{ color: 'white' }}>{booking.bookingId}</strong> is saved — we'll email you a payment link.
                </div>
              </div>
            )}

            <button className="btn btn-outline btn-full" onClick={() => navigate(`/booking/${booking.bookingId}`)} style={{ marginTop: 8 }}>
              View Booking Status
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
            <div className="section-label">✦ Step 1 of 5</div>
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
                From ${Number(scooter.dailyRate).toFixed(0)}/day · ${Number(scooter.weeklyRate).toFixed(0)}/week · ${Number(scooter.monthlyRate).toFixed(0)}/month
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
                  📊 <strong style={{ color: 'white' }}>{days} day{days !== 1 ? 's' : ''}</strong> · {describeRate(scooter, days)} = <strong style={{ color: 'var(--coral)' }}>${rentalCost.toFixed(2)}</strong>
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
                        {z.zoneName} ({Number(z.distanceKm).toFixed(1)} km) — ${Number(z.fee).toFixed(2)}
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

            {/* Payment Option */}
            <div className="form-card fade-up fade-up-6">
              <div className="form-card-title">💳 Payment Option</div>
              <div className="pickup-options">
                <div className="pickup-option">
                  <input type="radio" id="pay-now" name="paymentOption" value="NOW" checked={paymentOption === 'NOW'} onChange={() => setPaymentOption('NOW')} />
                  <label htmlFor="pay-now" className="pickup-option-label">
                    <span className="pickup-option-icon">⚡</span>
                    <span className="pickup-option-text">Pay Now</span>
                    <span className="pickup-option-sub">Secure via PayPal</span>
                  </label>
                </div>
                <div className="pickup-option">
                  <input type="radio" id="pay-later" name="paymentOption" value="LATER" checked={paymentOption === 'LATER'} onChange={() => setPaymentOption('LATER')} />
                  <label htmlFor="pay-later" className="pickup-option-label">
                    <span className="pickup-option-icon">🤝</span>
                    <span className="pickup-option-text">Pay Later</span>
                    <span className="pickup-option-sub">Pay at pickup / office</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Price summary */}
            <div className="price-summary fade-up">
              <div className="price-row">
                <span>Rental ({Math.max(days, 1)} days)</span>
                <span className="val">${rentalCost.toFixed(2)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="price-row">
                  <span>Delivery Fee</span>
                  <span className="val">${deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="price-row">
                <span>Security Deposit</span>
                <span className="val">${securityDeposit.toFixed(2)}</span>
              </div>
              <div className="price-row total">
                <span>Total</span>
                <span className="val">${totalAmount.toFixed(2)}</span>
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
                paymentOption === 'NOW' ? '💳 Continue to Payment' : '📅 Book & Pay Later'
              )}
            </button>
          </form>

          <div style={{ height: 48 }} />
        </div>
      </div>
    </>
  )
}
