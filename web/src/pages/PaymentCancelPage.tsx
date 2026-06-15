import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function PaymentCancelPage() {
  const navigate = useNavigate()

  return (
    <>
      <Navbar />
      <div className="result-page">
        <div className="result-icon">😕</div>
        <h1 className="result-title">Payment Cancelled</h1>
        <p className="result-subtitle">
          Your booking was saved but payment was not completed. You can retry payment anytime.
          We've also emailed you a payment link for convenience.
        </p>

        <div className="booking-ref-card" style={{ width: '100%', maxWidth: 360 }}>
          <div className="booking-ref-label">What happened?</div>
          <div style={{ fontSize: 14, color: 'var(--slate-light)', lineHeight: 1.8 }}>
            💾 Your booking details are saved<br />
            📧 A payment link was sent to your email<br />
            🔁 You can retry payment from the email link<br />
            📞 Need help? Call +94 76 179 4522
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 360 }}>
          <button className="btn btn-primary btn-full" onClick={() => navigate('/scooters')} id="retry-booking-btn">
            🛵 Try Again
          </button>
          <button className="btn btn-outline btn-full" onClick={() => navigate('/')} id="cancel-home-btn">
            Back to Home
          </button>
        </div>
      </div>
    </>
  )
}
