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
  paymentMethod?: string
  scooter?: { title: string; brand: string; model: string }
}

export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const bookingId = params.get('bookingId') ?? params.get('token') ?? ''

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(!!bookingId)

  useEffect(() => {
    if (bookingId && bookingId.startsWith('MS-')) {
      api.get(`/bookings/ref/${bookingId}`)
        .then(res => setBooking(res.data?.data ?? res.data))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [bookingId, params])

  // Tailor messages based on payment method
  let title = 'Booking Created!'
  let subtitle = "Your booking is received. We've sent confirmation details to your email."
  let icon = '🎉'

  if (booking) {
    if (booking.paymentMethod === 'BANK_TRANSFER') {
      title = 'Receipt Uploaded!'
      subtitle = "Your bank transfer slip has been uploaded for verification. Once our team verifies your transfer, your booking will be fully confirmed. We've sent the invoice to your email."
      icon = '🏛️'
    } else if (booking.paymentMethod === 'CARD') {
      title = 'Booking Received!'
      subtitle = "Your booking is received. You have chosen to pay via Card Payment (+3.5% fee) at pickup. We've sent your digital rental invoice and pickup instructions to your email."
      icon = '💳'
    } else {
      title = 'Booking Received!'
      subtitle = "Your booking is received. You have chosen to pay via Cash (At Pickup). We've sent your digital rental invoice and pickup instructions to your email."
      icon = '💵'
    }
  }

  return (
    <>
      <Navbar />
      <div className="result-page">
        <div className="result-icon">{icon}</div>
        <h1 className="result-title">{title}</h1>
        <p className="result-subtitle">{subtitle}</p>

        {loading ? (
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
            <div style={{ marginTop: 12, fontWeight: 700, color: 'white' }}>
              Total Amount: Rs. {Number(booking.totalAmount).toFixed(2)}
            </div>
          </div>
        ) : (
          <div className="booking-ref-card" style={{ width: '100%', maxWidth: 360 }}>
            <div className="booking-ref-label">What's next?</div>
            <div style={{ fontSize: 14, color: 'var(--slate-light)', lineHeight: 1.6 }}>
              ✅ Check your email for booking confirmation & details<br />
              🛵 Present your QR code at pickup to collect your scooter<br />
              📞 Contact us at +94 76 179 4522 for any questions
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 360 }}>
          {booking && (
            <Link to={`/booking/${booking.bookingId}`} className="btn btn-outline btn-full" id="view-booking-btn">
              View Booking Details & QR
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
