import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../lib/api'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.css'

function ModernDatePicker({
  value,
  onChange,
  placeholder,
  className,
  minDate,
  disabled,
  style
}: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  minDate?: string
  disabled?: boolean
  style?: React.CSSProperties
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
      style={style}
    />
  )
}

interface Scooter {
  id: string
  scooterCode: string
  title: string
  brand: string
  model: string
  year: number
  color: string
  plateNumber: string
  dailyRate: number
  weeklyRate: number
  monthlyRate: number
  status: 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'MAINTENANCE'
  description?: string
  images: string[]
}

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000'



export default function ScootersPage() {
  const navigate = useNavigate()
  const [scooters, setScooters] = useState<Scooter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [pickupDate, setPickupDate] = useState('')
  const [returnDate, setReturnDate] = useState('')

  useEffect(() => {
    setLoading(true)
    const params: Record<string, any> = { limit: 50 }
    if (pickupDate && returnDate) {
      params.pickupDate = new Date(pickupDate).toISOString()
      params.returnDate = new Date(returnDate).toISOString()
    }
    api.get('/scooters', { params })
      .then(res => {
        const data = res.data?.data ?? res.data
        setScooters(Array.isArray(data) ? data : data?.data ?? [])
        setError('')
      })
      .catch(() => setError('Failed to load scooters. Please try again.'))
      .finally(() => setLoading(false))
  }, [pickupDate, returnDate])

  const imageUrl = (scooter: Scooter) => {
    if (scooter.images?.length > 0) return `${API_BASE}${scooter.images[0]}`
    return null
  }

  return (
    <>
      <Navbar />
      <div className="form-page">
        <div className="form-container scooters-list-container" style={{ paddingTop: 0 }}>
          <div style={{ paddingTop: 12, paddingBottom: 24 }}>
            <div className="section-label">✦ Our Fleet</div>
            <h1 className="page-title">Choose Your Scooter</h1>
            <p className="page-subtitle">Select from our fleet of well-maintained scooters</p>
          </div>

          {/* Date Selector for availability checking */}
          <div className="form-card fade-up" style={{ padding: '16px 20px', marginBottom: 24, border: '1px solid rgba(255,107,74,0.15)', background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(255,107,74,0.02))' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📅</span> Check Date-Based Availability
            </div>
            <div className="form-row" style={{ gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 10, marginBottom: 6 }}>Pickup Date</label>
                <ModernDatePicker
                  className="form-input"
                  placeholder="Select pickup date"
                  value={pickupDate}
                  minDate={new Date().toISOString().split('T')[0]}
                  onChange={(val) => {
                    setPickupDate(val)
                    if (returnDate && val > returnDate) {
                      setReturnDate('')
                    }
                  }}
                  style={{ padding: '10px 14px', fontSize: 14 }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 10, marginBottom: 6 }}>Return Date</label>
                <ModernDatePicker
                  className="form-input"
                  placeholder="Select return date"
                  value={returnDate}
                  minDate={pickupDate || new Date().toISOString().split('T')[0]}
                  onChange={(val) => setReturnDate(val)}
                  style={{ padding: '10px 14px', fontSize: 14 }}
                />
              </div>
            </div>
            {pickupDate && returnDate && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✓</span> Showing scooters available from {new Date(pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to {new Date(returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            )}
          </div>

          {loading && (
            <div className="loading-screen" style={{ minHeight: 'unset', padding: '60px 0' }}>
              <div className="spinner" />
              <span>Loading fleet...</span>
            </div>
          )}

          {error && (
            <div className="empty-state">
              <span className="empty-icon">⚠️</span>
              <div className="empty-title">Something went wrong</div>
              <div className="empty-desc">{error}</div>
            </div>
          )}

          {!loading && !error && scooters.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">🛵</span>
              <div className="empty-title">No scooters available</div>
              <div className="empty-desc">{pickupDate && returnDate ? 'All scooters are booked during this range. Try different dates!' : 'Check back soon or contact us directly'}</div>
            </div>
          )}

          <div className="scooter-grid">
            {scooters.map((s, i) => (
              <div
                className="scooter-card fade-up"
                style={{ animationDelay: `${i * 0.06}s` }}
                key={s.id}
                id={`scooter-card-${s.id}`}
                onClick={() => navigate(`/scooter/${s.id}${pickupDate && returnDate ? `?pickupDate=${pickupDate}&returnDate=${returnDate}` : ''}`)}
              >
                {imageUrl(s) ? (
                  <img src={imageUrl(s)!} alt={s.title} className="scooter-card-img" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div className="scooter-card-img-placeholder">🛵</div>
                )}

                <div className="scooter-card-body">
                  <div className="scooter-card-header">
                    <div>
                      <div className="scooter-card-title">{s.title}</div>
                      <div className="scooter-card-subtitle">{s.brand} {s.model} · {s.year}</div>
                    </div>
                    {/* Hiding scooter status badge */}
                  </div>

                  <div className="scooter-rates">
                    <div className="rate-item">
                      <span className="rate-value">${Number(s.dailyRate).toFixed(0)}</span>
                      <span className="rate-label">/ day</span>
                    </div>
                    <div className="rate-divider" />
                    <div className="rate-item">
                      <span className="rate-value">${Number(s.weeklyRate).toFixed(0)}</span>
                      <span className="rate-label">/ week</span>
                    </div>
                    <div className="rate-divider" />
                    <div className="rate-item">
                      <span className="rate-value">${Number(s.monthlyRate).toFixed(0)}</span>
                      <span className="rate-label">/ month</span>
                    </div>
                  </div>

                  <div className="scooter-meta">
                    <span className="meta-tag">🎨 {s.color}</span>
                    <span className="meta-tag">🔖 {s.plateNumber}</span>
                    <span className="meta-tag">🏷️ {s.scooterCode}</span>
                  </div>

                  {s.description && (
                    <p style={{ fontSize: 13, color: 'var(--slate-light)', marginBottom: 16, lineHeight: 1.5 }}>
                      {s.description}
                    </p>
                  )}

                  <button
                    className="btn btn-primary btn-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/scooter/${s.id}${pickupDate && returnDate ? `?pickupDate=${pickupDate}&returnDate=${returnDate}` : ''}`)
                    }}
                    id={`book-scooter-${s.id}`}
                  >
                    {s.status === 'MAINTENANCE' ? '⏳ Under Maintenance' : '🔎 View Details & Book'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ height: 48 }} />
        </div>
      </div>
    </>
  )
}
