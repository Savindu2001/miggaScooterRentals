import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../lib/api'

interface Booking {
  bookingId: string
  customerName: string
  email: string
  pickupDate: string
  returnDate: string
  rentalDays: number
  totalAmount: number
  bookingStatus: string
  scooter?: { title: string; brand: string; model: string }
}

export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const bookingId = params.get('bookingId') ?? params.get('token') ?? ''
  const orderId = params.get('PayerID') ? params.get('token') : null
  const isPayLater = params.get('payLater') === 'true'

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(!!bookingId)
  const [capturing, setCapturing] = useState(false)

  // If we arrive with token+PayerID from PayPal redirect (legacy flow), capture now
  useEffect(() => {
    const token = params.get('token')
    const payerId = params.get('PayerID')
    if (token && payerId && !bookingId.startsWith('MS-')) {
      setCapturing(true)
      api.post(`/payments/capture/${token}`)
        .then(() => {
          // After capture, load booking by bookingId from query
          if (bookingId) {
            return api.get(`/bookings/ref/${bookingId}`)
          }
        })
        .then(res => { if (res) setBooking(res.data?.data ?? res.data) })
        .catch(() => {})
        .finally(() => { setCapturing(false); setLoading(false) })
      return
    }

    if (bookingId && bookingId.startsWith('MS-')) {
      api.get(`/bookings/ref/${bookingId}`)
        .then(res => setBooking(res.data?.data ?? res.data))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [bookingId, orderId, params])

  return (
    <>
      <Navbar />
      <div className="result-page">
        <div className="result-icon">{isPayLater ? '📅' : '🎉'}</div>
        <h1 className="result-title">{isPayLater ? 'Booking Created!' : 'Payment Successful!'}</h1>
        <p className="result-subtitle">
          {isPayLater
            ? "Your booking is received. You have chosen to pay later at pickup. We've sent confirmation details to your email."
            : "Your booking is confirmed. We'll send all details to your email. Get ready to explore!"}
        </p>

        {loading || capturing ? (
          <div className="spinner" style={{ marginBottom: 32 }} />
        ) : booking ? (
          <div className="booking-ref-card" style={{ width: '100%', maxWidth: 360 }}>
            <div className="booking-ref-label">Booking Reference</div>
            <div className="booking-ref-value">{booking.bookingId}</div>
            {booking.scooter && (
              <div style={{ fontSize: 13, color: 'var(--slate-light)', marginTop: 8 }}>
                {booking.scooter.title} · {booking.rentalDays} days
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--slate-light)' }}>
              📅 {new Date(booking.pickupDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} →{' '}
              {new Date(booking.returnDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}
            </div>
          </div>
        ) : (
          <div className="booking-ref-card" style={{ width: '100%', maxWidth: 360 }}>
            <div className="booking-ref-label">What's next?</div>
            <div style={{ fontSize: 14, color: 'var(--slate-light)', lineHeight: 1.6 }}>
              ✅ Check your email for booking confirmation<br />
              🛵 Pick up your scooter on the scheduled date<br />
              📞 Contact us at +94 76 179 4522 for any questions
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 360 }}>
          {booking && (
            <Link to={`/booking/${booking.bookingId}`} className="btn btn-outline btn-full" id="view-booking-btn">
              View Booking Details
            </Link>
          )}
          <button className="btn btn-primary btn-full" onClick={() => navigate('/')} id="back-home-btn">
            Back to Home 🏠
          </button>
        </div>
      </div>
    </>
  )
}
