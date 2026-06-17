import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../lib/api'

interface Extension {
  id: string
  requestedUntil: string
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  extraAmount?: number
  paymentStatus?: string
  paymentMethod?: string
  createdAt: string
}

interface Booking {
  id: string
  bookingId: string
  customerName: string
  email: string
  phone: string
  nationality: string
  passportNumber: string
  pickupDate: string
  returnDate: string
  rentalDays: number
  totalAmount: number
  securityDeposit: number
  bookingStatus: string
  pickupType: string
  deliveryFee: number
  qrUsed: boolean
  agreementSigned: boolean
  paymentMethod?: string
  qrCode?: string
  scooter?: { title: string; brand: string; model: string; color: string; plateNumber: string }
  deliveryZone?: { zoneName: string; distanceKm: number; fee: number }
  payments?: { id: string; paymentId: string; paymentStatus: string; amount: number; paidAt?: string; createdAt: string }[]
  extensions?: Extension[]
}

const STATUS_STEPS = [
  { key: 'PENDING', label: 'Booking Received', sub: 'Your booking is being processed' },
  { key: 'AWAITING_PAYMENT', label: 'Awaiting Payment', sub: 'Present QR at pickup to pay cash/card' },
  { key: 'CONFIRMED', label: 'Confirmed', sub: 'Booking is confirmed and ready' },
  { key: 'PICKED_UP', label: 'Picked Up', sub: 'Scooter is with you — enjoy the ride!' },
  { key: 'RETURNED', label: 'Returned', sub: 'Scooter returned, deposit processing' },
]

const STATUS_ORDER = STATUS_STEPS.map(s => s.key)

function getStepState(stepKey: string, currentStatus: string) {
  const stepIdx = STATUS_ORDER.indexOf(stepKey)
  const currentIdx = STATUS_ORDER.indexOf(currentStatus)
  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'current'
  return 'pending'
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

export default function BookingStatusPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(!!bookingId)
  const [error, setError] = useState('')
  const [searchId, setSearchId] = useState('')
  const [googleReviewLink, setGoogleReviewLink] = useState('')
  const [tripAdvisorReviewLink, setTripAdvisorReviewLink] = useState('')

  // Rental extension states
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [extDate, setExtDate] = useState('')
  const [extReason, setExtReason] = useState('')
  const [extLoading, setExtLoading] = useState(false)
  const [extError, setExtError] = useState('')
  const [extSuccess, setExtSuccess] = useState(false)

  useEffect(() => {
    api.get('/settings')
      .then(res => {
        const data = res.data?.data ?? res.data
        setGoogleReviewLink(data.googleReviewLink || '')
        setTripAdvisorReviewLink(data.tripAdvisorReviewLink || '')
      })
      .catch(err => console.error('Failed to fetch review links', err))
  }, [])

  useEffect(() => {
    if (!bookingId) {
      setBooking(null)
      setError('')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    api.get(`/bookings/ref/${bookingId}`)
      .then(res => setBooking(res.data?.data ?? res.data))
      .catch(() => setError('Booking not found. Please check your reference number.'))
      .finally(() => setLoading(false))
  }, [bookingId, refreshTrigger])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchId.trim()) {
      navigate(`/booking/${searchId.trim().toUpperCase()}`)
    }
  }

  const handleRequestExtension = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!booking) return
    setExtLoading(true)
    setExtError('')
    setExtSuccess(false)
    try {
      await api.post(`/extensions/booking/${booking.id}`, {
        requestedUntil: new Date(extDate).toISOString(),
        reason: extReason,
      })
      setExtSuccess(true)
      setExtDate('')
      setExtReason('')
      setRefreshTrigger(c => c + 1)
    } catch (err: any) {
      setExtError(
        err?.response?.data?.message ||
          (Array.isArray(err?.response?.data?.message)
            ? err.response.data.message.join(', ')
            : 'Failed to submit extension request. Please try again.')
      )
    } finally {
      setExtLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="loading-screen">
          <div className="spinner" />
          <span>Loading booking...</span>
        </div>
      </>
    )
  }

  if (!bookingId || error || !booking) {
    return (
      <>
        <Navbar />
        <div className="form-page">
          <div className="form-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ paddingTop: 12, paddingBottom: 12, textAlign: 'center' }}>
              <div className="section-label">✦ Track Rental</div>
              <h1 className="page-title">Track Booking</h1>
              <p className="page-subtitle">Enter your booking reference to check status and details</p>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: 14, color: '#f87171', fontSize: 13, textAlign: 'center' }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Booking Reference Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. MS-001-20260613"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  style={{ textTransform: 'uppercase' }}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-full" id="track-booking-btn">
                🔍 Track Booking
              </button>
            </form>

            <button className="btn btn-outline btn-full" onClick={() => navigate('/')}>
              🏠 Back to Home
            </button>
          </div>
        </div>
      </>
    )
  }

  const latestPayment = booking.payments && booking.payments.length > 0
    ? [...booking.payments].sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())[0]
    : undefined
  const isPaid = latestPayment?.paymentStatus === 'COMPLETED' || booking.payments?.some(p => p.paymentStatus === 'COMPLETED')

  const hasPendingExtension = booking.extensions?.some(ext => ext.status === 'PENDING')
  const pendingExtension = booking.extensions?.find(ext => ext.status === 'PENDING')
  const historicalExtensions = booking.extensions?.filter(ext => ext.status !== 'PENDING') || []

  // Check for approved unpaid extension
  const approvedUnpaidExtension = booking.extensions?.find(ext => ext.status === 'APPROVED' && ext.paymentStatus === 'PENDING')

  // Rule: hide QR code if BANK_TRANSFER and not paid/confirmed yet
  const showQr = booking.qrCode && (booking.paymentMethod !== 'BANK_TRANSFER' || isPaid || booking.bookingStatus === 'CONFIRMED' || booking.bookingStatus === 'PICKED_UP')

  let minExtDate = ''
  if (booking.returnDate) {
    const returnDateObj = new Date(booking.returnDate)
    returnDateObj.setDate(returnDateObj.getDate() + 1)
    minExtDate = returnDateObj.toISOString().split('T')[0]
  }

  return (
    <>
      <Navbar />
      <div className="form-page">
        <div className="form-container">
          <div style={{ paddingTop: 12, paddingBottom: 24 }}>
            <div className="section-label">✦ Booking Status</div>
            <h1 className="page-title">{booking.bookingId}</h1>
            <p className="page-subtitle">Real-time status of your scooter rental</p>
          </div>

          {/* Approved Unpaid Extension Alert Banner */}
          {approvedUnpaidExtension && (
            <div 
              style={{ 
                background: 'rgba(245,158,11,0.12)', 
                border: '1.5px solid rgba(245,158,11,0.3)', 
                borderRadius: 16, 
                padding: '16px 20px', 
                color: '#f59e0b', 
                fontSize: 13, 
                marginBottom: 20, 
                lineHeight: '1.6',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              ⚠️ <strong>Extension Approved — Payment Pending</strong><br />
              Your rental extension request until <strong>{fmt(approvedUnpaidExtension.requestedUntil)}</strong> has been approved. <br />
              An extra amount of <strong>Rs. {Number(approvedUnpaidExtension.extraAmount).toFixed(2)}</strong> must be paid via <strong>Cash</strong> or <strong>Bank Transfer</strong> when you drop off the scooter.
            </div>
          )}

          {/* Status Timeline */}
          {booking.bookingStatus !== 'CANCELLED' ? (
            <div className="booking-detail-card" style={{ marginBottom: 16 }}>
              <div className="booking-detail-header">
                <div style={{ fontSize: 13, color: 'rgba(255,107,74,0.8)', fontWeight: 600, marginBottom: 4 }}>Current Status</div>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 22, fontWeight: 800, color: 'white' }}>
                  {STATUS_STEPS.find(s => s.key === booking.bookingStatus)?.label ?? booking.bookingStatus}
                </div>
              </div>
              <div className="booking-detail-body">
                <div className="status-timeline">
                  {STATUS_STEPS.map((step, idx) => {
                    const state = getStepState(step.key, booking.bookingStatus)
                    const isLast = idx === STATUS_STEPS.length - 1
                    return (
                      <div className="status-step" key={step.key}>
                        {!isLast && <div className={`status-step-line ${state === 'done' ? 'done' : ''}`} />}
                        <div className={`status-step-dot ${state}`}>
                          {state === 'done' ? '✓' : state === 'current' ? '●' : '○'}
                        </div>
                        <div className="status-step-content">
                          <div className="status-step-label" style={{ color: state === 'pending' ? 'var(--slate)' : 'white' }}>
                            {step.label}
                          </div>
                          <div className="status-step-sub">{step.sub}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="booking-detail-card" style={{ marginBottom: 16 }}>
              <div className="booking-detail-header" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f87171', fontFamily: 'Outfit' }}>❌ Booking Cancelled</div>
              </div>
            </div>
          )}

          {/* Write Reviews Card */}
          {booking.bookingStatus === 'RETURNED' && (googleReviewLink || tripAdvisorReviewLink) && (
            <div className="booking-detail-card fade-up" style={{ marginBottom: 16, background: 'linear-gradient(135deg, rgba(255,107,74,0.15) 0%, rgba(255,255,255,0.03) 100%)', border: '1.5px solid rgba(255,107,74,0.3)' }}>
              <div className="booking-detail-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 24, paddingBottom: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 32 }}>✨</div>
                <div>
                  <h3 style={{ fontFamily: 'Outfit', fontSize: 20, fontWeight: 800, color: 'white', margin: 0 }}>Thank you for riding with Migga!</h3>
                  <p style={{ color: 'var(--slate-light)', fontSize: 13, marginTop: 8, marginBottom: 0, maxWidth: 360, lineHeight: '1.5' }}>
                    We hope you had an amazing rental experience. Would you mind taking a moment to share your feedback?
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 380 }}>
                  {googleReviewLink && (
                    <a 
                      href={googleReviewLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-outline" 
                      style={{ 
                        flex: 1, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: 8, 
                        background: 'rgba(255,255,255,0.05)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 12,
                        color: 'white',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      id="google-review-btn"
                    >
                      Google Review
                    </a>
                  )}
                  
                  {tripAdvisorReviewLink && (
                    <a 
                      href={tripAdvisorReviewLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-outline" 
                      style={{ 
                        flex: 1, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: 8, 
                        background: 'rgba(255,255,255,0.05)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 12,
                        color: 'white',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      id="tripadvisor-review-btn"
                    >
                      TripAdvisor
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Booking QR Code Card */}
          {showQr && (
            <div className="booking-detail-card fade-up" style={{ marginBottom: 16 }}>
              <div className="booking-detail-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,107,74,0.8)', marginBottom: 4 }}>✦ Scooter Collection</div>
                <div style={{ fontFamily: 'Outfit', fontSize: 18, fontWeight: 700, color: 'white' }}>
                  Your Pickup QR Code
                </div>
              </div>
              <div className="booking-detail-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 20, paddingBottom: 20 }}>
                <div style={{ position: 'relative', background: 'white', padding: 12, borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', width: 224, height: 224, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <img 
                    src={booking.qrCode} 
                    alt="Booking QR Code" 
                    style={{ 
                      width: 200, 
                      height: 200, 
                      filter: booking.qrUsed ? 'blur(4px) grayscale(100%)' : 'none',
                      transition: 'all 0.3s ease'
                    }} 
                  />
                  {booking.qrUsed && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.65)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 12, textAlign: 'center' }}>
                      <div style={{ background: '#4ade80', color: '#000', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 20, marginBottom: 8, boxShadow: '0 4px 12px rgba(74, 222, 128, 0.4)' }}>
                        ✓
                      </div>
                      <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 14, fontFamily: 'Outfit' }}>QR Code Used</span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, marginTop: 4 }}>Scooter has been collected</span>
                    </div>
                  )}
                </div>
                
                <div style={{ textAlign: 'center', maxWidth: 320 }}>
                  {!booking.qrUsed ? (
                    <>
                      <p style={{ color: 'white', fontSize: 14, fontWeight: 500, margin: 0 }}>
                        Present this QR code to collect your scooter
                      </p>
                      <p style={{ color: 'var(--slate-light)', fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                        Our agent will scan this code at the pickup office or delivery location to verify your identity and release the scooter.
                      </p>
                    </>
                  ) : (
                    <p style={{ color: 'var(--slate-light)', fontSize: 13, margin: 0 }}>
                      This rental has already been picked up. Enjoy your ride!
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Booking Details */}
          <div className="booking-detail-card fade-up">
            <div className="booking-detail-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,107,74,0.8)', marginBottom: 4 }}>Scooter</div>
              <div style={{ fontFamily: 'Outfit', fontSize: 18, fontWeight: 700, color: 'white' }}>
                {booking.scooter?.title ?? '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--slate-light)', marginTop: 2 }}>
                {booking.scooter?.brand} {booking.scooter?.model} · {booking.scooter?.color} · {booking.scooter?.plateNumber}
              </div>
            </div>
            <div className="booking-detail-body">
              <div className="detail-row">
                <span className="detail-label">Customer</span>
                <span className="detail-value">{booking.customerName}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Passport</span>
                <span className="detail-value">{booking.passportNumber}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Pickup Date</span>
                <span className="detail-value">{fmt(booking.pickupDate)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Return Date</span>
                <span className="detail-value">{fmt(booking.returnDate)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Duration</span>
                <span className="detail-value">{booking.rentalDays} days</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Pickup Type</span>
                <span className="detail-value">
                  {booking.pickupType === 'HOTEL' ? '🏨 Hotel Delivery' : '🏢 Office Pickup'}
                </span>
              </div>
              {booking.deliveryZone && (
                <div className="detail-row">
                  <span className="detail-label">Delivery Zone</span>
                  <span className="detail-value">{booking.deliveryZone.zoneName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rental Extensions Section */}
          {(booking.bookingStatus === 'CONFIRMED' || booking.bookingStatus === 'PICKED_UP') && (
            <div className="booking-detail-card fade-up" style={{ marginBottom: 16 }}>
              <div className="booking-detail-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,107,74,0.8)', marginBottom: 4 }}>✦ Rental Duration</div>
                <div style={{ fontFamily: 'Outfit', fontSize: 18, fontWeight: 700, color: 'white' }}>
                  Extend Your Rental
                </div>
              </div>
              
              <div className="booking-detail-body" style={{ paddingTop: 16 }}>
                {hasPendingExtension ? (
                  <div style={{ background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: 14, color: '#f59e0b', fontSize: 13, textAlign: 'center' }}>
                    ⏳ <strong>Extension request pending</strong><br />
                    Requested until {fmt(pendingExtension!.requestedUntil)}<br />
                    <span style={{ fontSize: 12, color: 'rgba(245,158,11,0.7)', marginTop: 4, display: 'block' }}>Reason: "{pendingExtension!.reason}"</span>
                  </div>
                ) : (
                  <form onSubmit={handleRequestExtension} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {extError && (
                      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: 10, color: '#f87171', fontSize: 12 }}>
                        ⚠️ {extError}
                      </div>
                    )}
                    {extSuccess && (
                      <div style={{ background: 'rgba(74,222,128,0.1)', border: '1.5px solid rgba(74,222,128,0.25)', borderRadius: 12, padding: 10, color: '#4ade80', fontSize: 12 }}>
                        ✓ Extension requested successfully!
                      </div>
                    )}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Extend Return Date To</label>
                      <input
                        type="date"
                        className="form-input"
                        value={extDate}
                        min={minExtDate}
                        onChange={(e) => setExtDate(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1.5px solid rgba(255,255,255,0.1)',
                          borderRadius: 10,
                          color: 'white',
                          padding: '10px 14px',
                          fontSize: 13,
                          outline: 'none',
                        }}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Reason for Extension</label>
                      <textarea
                        className="form-input"
                        rows={2}
                        placeholder="e.g., I'd like to explore the south coast for 2 more days"
                        value={extReason}
                        onChange={(e) => setExtReason(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1.5px solid rgba(255,255,255,0.1)',
                          borderRadius: 10,
                          color: 'white',
                          padding: '10px 14px',
                          fontSize: 13,
                          outline: 'none',
                          resize: 'none',
                          minHeight: 60,
                          fontFamily: 'inherit',
                        }}
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ height: 40, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} disabled={extLoading}>
                      {extLoading ? 'Submitting...' : '🚀 Submit Extension Request'}
                    </button>
                  </form>
                )}

                {historicalExtensions.length > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Previous Extensions
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {historicalExtensions.map((ext) => (
                        <div key={ext.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Until {fmt(ext.requestedUntil)}</span>
                            {ext.extraAmount !== undefined && Number(ext.extraAmount) > 0 && (
                              <span style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 600 }}>Amount: Rs. {Number(ext.extraAmount).toFixed(2)} ({ext.paymentStatus})</span>
                            )}
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Reason: "{ext.reason}"</span>
                          </div>
                          <div>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 20,
                              textTransform: 'uppercase',
                              background: ext.status === 'APPROVED' ? 'rgba(74,222,128,0.1)' : ext.status === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                              color: ext.status === 'APPROVED' ? '#4ade80' : ext.status === 'REJECTED' ? '#f87171' : '#f59e0b',
                              border: ext.status === 'APPROVED' ? '1px solid rgba(74,222,128,0.2)' : ext.status === 'REJECTED' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(245,158,11,0.2)'
                            }}>
                              {ext.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Details */}
          <div className="booking-detail-card fade-up">
            <div className="booking-detail-header">
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,107,74,0.8)', marginBottom: 4 }}>Payment Details</div>
              <div style={{ fontFamily: 'Outfit', fontSize: 20, fontWeight: 800, color: isPaid ? '#4ade80' : 'var(--coral)' }}>
                {isPaid ? '✅ Confirmed / Paid' : booking.paymentMethod === 'BANK_TRANSFER' ? '🏛️ Verification Pending' : '⏳ Pay at Pickup'}
              </div>
            </div>
            <div className="booking-detail-body">
              <div className="detail-row">
                <span className="detail-label">Rental Cost</span>
                <span className="detail-value">Rs. {Math.max(0, Number(booking.totalAmount) - Number(booking.securityDeposit) - Number(booking.deliveryFee)).toFixed(2)}</span>
              </div>
              {Number(booking.deliveryFee) > 0 && (
                <div className="detail-row">
                  <span className="detail-label">Delivery Fee</span>
                  <span className="detail-value">Rs. {Number(booking.deliveryFee).toFixed(2)}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Security Deposit</span>
                <span className="detail-value">Rs. {Number(booking.securityDeposit).toFixed(2)}</span>
              </div>
              <div className="detail-row" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                <span style={{ fontWeight: 700, color: 'white', fontFamily: 'Outfit', fontSize: 16 }}>Total Amount</span>
                <span style={{ fontWeight: 800, color: 'var(--coral)', fontFamily: 'Outfit', fontSize: 18 }}>
                  Rs. {Number(booking.totalAmount).toFixed(2)}
                </span>
              </div>
              {approvedUnpaidExtension && (
                <>
                  <div className="detail-row" style={{ borderTop: '1.5px dashed rgba(245, 158, 11, 0.3)', paddingTop: 14, marginTop: 4 }}>
                    <span style={{ fontWeight: 700, color: '#f59e0b', fontFamily: 'Outfit', fontSize: 15 }}>Extension Due Balance</span>
                    <span style={{ fontWeight: 800, color: '#f59e0b', fontFamily: 'Outfit', fontSize: 17 }}>
                      Rs. {Number(approvedUnpaidExtension.extraAmount).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(245, 158, 11, 0.8)', textAlign: 'right', marginTop: -6, marginBottom: 8 }}>
                    * Payable at drop-off via Cash, Bank Transfer, or Card (+3.5% fee)
                  </div>
                </>
              )}
              <div className="detail-row">
                <span className="detail-label">Payment Method</span>
                <span className="detail-value" style={{ textTransform: 'uppercase' }}>{booking.paymentMethod || 'CASH'}</span>
              </div>
              {latestPayment?.paidAt && (
                <div className="detail-row">
                  <span className="detail-label">Paid At</span>
                  <span className="detail-value">{fmt(latestPayment.paidAt)}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 48 }}>
            <button className="btn btn-primary btn-full" onClick={() => navigate('/')} id="status-home-btn">
              🏠 Back to Home
            </button>
            <a href="tel:+94761794522" className="btn btn-outline btn-full" id="call-support-btn">
              📞 Contact Support
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
