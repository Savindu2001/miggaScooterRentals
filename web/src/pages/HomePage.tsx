import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

const STEPS = [
  { num: '1', title: 'Choose Your Scooter', desc: 'Browse our fleet and pick the scooter that suits your adventure.' },
  { num: '2', title: 'Book & Fill Details', desc: 'Enter your info, passport and preferred pickup method.' },
  { num: '3', title: 'Pay Securely via PayPal', desc: 'Pay online with PayPal — zero hassle, fully protected.' },
  { num: '4', title: 'Hit the Road!', desc: 'Pick up your scooter and explore Sri Lanka your way.' },
]

const FEATURES = [
  { icon: '🛵', title: 'Modern Fleet', desc: 'Well-maintained scooters serviced regularly' },
  { icon: '🔒', title: 'Safe & Secure', desc: 'PayPal protected payments, always' },
  { icon: '📍', title: 'Hotel Delivery', desc: 'We bring the scooter to your hotel' },
  { icon: '📞', title: '24/7 Support', desc: 'We\'re always here if you need help' },
]

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <>
      <Navbar />

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="hero">
        <img
          src="/scooter-hero.png"
          alt="Migga Scooter Rentals"
          className="hero-img"
        />
        <div className="hero-bg" />
        <div className="hero-content fade-up">
          <div className="hero-badge">
            ⭐ 4.9 Rating · 500+ Happy Riders
          </div>

          <h1 className="hero-title">
            Explore Sri Lanka<br />
            <span>Your Way</span>
          </h1>

          <p className="hero-subtitle">
            Rent a premium scooter and discover hidden beaches, jungle roads, and coastal towns at your own pace.
          </p>

          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">$12</span>
              <span className="hero-stat-label">From per day</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">20+</span>
              <span className="hero-stat-label">Scooters ready</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">Free</span>
              <span className="hero-stat-label">Hotel delivery</span>
            </div>
          </div>

          <div className="hero-cta">
            <button className="btn btn-primary" onClick={() => navigate('/scooters')} id="hero-book-now">
              🛵 Book Now
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/scooters')} id="hero-view-scooters">
              View Scooters
            </button>
          </div>
        </div>
      </section>

      {/* ─── How it Works ─────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-header fade-up">
          <div className="section-label">✦ Simple Process</div>
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">Get on the road in just a few steps</p>
        </div>
        <div className="steps-grid">
          {STEPS.map((s, i) => (
            <div className="step-card fade-up" style={{ animationDelay: `${i * 0.07}s` }} key={s.num}>
              <div className="step-num">{s.num}</div>
              <div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Why Migga ─────────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-header fade-up">
          <div className="section-label">✦ Why Choose Us</div>
          <h2 className="section-title">The Migga Experience</h2>
        </div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div className="feature-card fade-up" style={{ animationDelay: `${i * 0.07}s` }} key={f.title}>
              <span className="feature-icon">{f.icon}</span>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Bottom CTA ────────────────────────────────────────────────── */}
      <div className="cta-strip fade-up">
        <div className="cta-strip-title">Ready to Ride? 🏝️</div>
        <div className="cta-strip-sub">Book today and explore Sri Lanka on two wheels</div>
        <button className="btn btn-outline" onClick={() => navigate('/scooters')} id="cta-book-btn">
          Browse Scooters →
        </button>
      </div>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-logo">Migga<span>.</span></div>
        <p className="footer-desc">Premium scooter rentals in Sri Lanka. Explore the island the way it was meant to be experienced.</p>
        <div className="footer-links">
          <a href="mailto:support@migga.lk" className="footer-link">support@migga.lk</a>
          <a href="tel:+94761794522" className="footer-link">+94 76 179 4522</a>
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} Migga Scooter Rentals. All rights reserved.</div>
      </footer>
    </>
  )
}
