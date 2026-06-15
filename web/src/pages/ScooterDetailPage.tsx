import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../lib/api'

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



export default function ScooterDetailPage() {
  const { scooterId } = useParams<{ scooterId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [scooter, setScooter] = useState<Scooter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const pickupDate = searchParams.get('pickupDate') || ''
  const returnDate = searchParams.get('returnDate') || ''

  useEffect(() => {
    if (!scooterId) return
    setLoading(true)
    api.get(`/scooters/${scooterId}`)
      .then(res => {
        setScooter(res.data?.data ?? res.data)
        setError('')
      })
      .catch(() => setError('Scooter details could not be found.'))
      .finally(() => setLoading(false))
  }, [scooterId])

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="loading-screen">
          <div className="spinner" />
          <span>Loading scooter details...</span>
        </div>
      </>
    )
  }

  if (error || !scooter) {
    return (
      <>
        <Navbar />
        <div className="form-page">
          <div className="form-container">
            <div className="empty-state">
              <span className="empty-icon">⚠️</span>
              <div className="empty-title">Scooter Not Found</div>
              <div className="empty-desc">{error || 'The requested scooter does not exist.'}</div>
              <button className="btn btn-primary" onClick={() => navigate('/scooters')} style={{ marginTop: 20 }}>
                🛵 Back to Fleet
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  const handleBook = () => {
    if (scooter.status === 'MAINTENANCE') return
    const datesQuery = pickupDate && returnDate ? `?pickupDate=${pickupDate}&returnDate=${returnDate}` : ''
    navigate(`/book/${scooter.id}${datesQuery}`)
  }

  const getFullImageUrl = (path: string) => `${API_BASE}${path}`

  return (
    <>
      <Navbar />
      <div className="form-page">
        {/* Detail Container - Custom wider container for detail view */}
        <div className="form-container detail-layout-container" style={{ padding: '24px 20px', maxWidth: 1000, margin: '0 auto' }}>
          
          <button 
            onClick={() => navigate(`/scooters${pickupDate && returnDate ? `?pickupDate=${pickupDate}&returnDate=${returnDate}` : ''}`)}
            className="btn btn-outline btn-sm"
            style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 13 }}
          >
            ← Back to Fleet
          </button>

          {/* Details Main Section - Flex/Grid based on Screen Size */}
          <div className="scooter-detail-wrapper">
            
            {/* Left side: Images gallery */}
            <div className="scooter-detail-gallery">
              <div className="scooter-detail-main-img-wrap">
                {scooter.images && scooter.images.length > 0 ? (
                  <img 
                    src={getFullImageUrl(scooter.images[activeImageIndex])} 
                    alt={scooter.title} 
                    className="scooter-detail-main-img" 
                  />
                ) : (
                  <div className="scooter-card-img-placeholder" style={{ height: 320, borderRadius: 20 }}>🛵</div>
                )}
              </div>

              {/* Thumbnails */}
              {scooter.images && scooter.images.length > 1 && (
                <div className="scooter-thumbnails-strip">
                  {scooter.images.map((img, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`scooter-thumbnail-btn ${activeImageIndex === idx ? 'active' : ''}`}
                    >
                      <img src={getFullImageUrl(img)} alt={`Thumbnail ${idx + 1}`} className="scooter-thumbnail-img" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right side: Scooter details & action */}
            <div className="scooter-detail-info">
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <div>
                  <h1 className="scooter-detail-title">{scooter.title}</h1>
                  <p className="scooter-detail-subtitle">{scooter.brand} {scooter.model} · {scooter.year}</p>
                </div>
                {/* Hiding scooter status badge */}
              </div>

              {/* Specifications tags */}
              <div className="scooter-meta" style={{ gap: 10, marginBottom: 20 }}>
                <span className="meta-tag" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: 8 }}>
                  🎨 Color: <strong style={{ color: 'white', marginLeft: 4 }}>{scooter.color}</strong>
                </span>
                <span className="meta-tag" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: 8 }}>
                  🔖 Plate: <strong style={{ color: 'white', marginLeft: 4 }}>{scooter.plateNumber}</strong>
                </span>
                <span className="meta-tag" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: 8 }}>
                  🏷️ Code: <strong style={{ color: 'white', marginLeft: 4 }}>{scooter.scooterCode}</strong>
                </span>
              </div>

              {/* Rates display block */}
              <div className="booking-detail-card" style={{ marginBottom: 20, background: 'rgba(255, 255, 255, 0.02)' }}>
                <div className="booking-detail-header" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-light)' }}>💲 RENTAL TARIFFS</span>
                </div>
                <div className="booking-detail-body" style={{ padding: 16 }}>
                  <div className="scooter-rates" style={{ margin: 0, padding: 0, background: 'none' }}>
                    <div className="rate-item">
                      <span className="rate-value" style={{ fontSize: 22 }}>${Number(scooter.dailyRate).toFixed(0)}</span>
                      <span className="rate-label">Daily</span>
                    </div>
                    <div className="rate-divider" />
                    <div className="rate-item">
                      <span className="rate-value" style={{ fontSize: 22 }}>${Number(scooter.weeklyRate).toFixed(0)}</span>
                      <span className="rate-label">Weekly</span>
                    </div>
                    <div className="rate-divider" />
                    <div className="rate-item">
                      <span className="rate-value" style={{ fontSize: 22 }}>${Number(scooter.monthlyRate).toFixed(0)}</span>
                      <span className="rate-label">Monthly</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {scooter.description && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 13, color: 'var(--slate-light)', fontWeight: 700, marginBottom: 8, letterSpacing: '0.5px' }}>DESCRIPTION</h4>
                  <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.6, margin: 0 }}>
                    {scooter.description}
                  </p>
                </div>
              )}

              {/* Booking CTA Button */}
              <button
                className={`btn btn-primary btn-full ${scooter.status === 'MAINTENANCE' ? 'btn-disabled' : ''}`}
                disabled={scooter.status === 'MAINTENANCE'}
                onClick={handleBook}
                id="book-detail-cta"
                style={{ padding: '16px 24px', fontSize: 16, fontWeight: 700 }}
              >
                {scooter.status === 'MAINTENANCE' ? '⏳ Under Maintenance' : '📅 Book This Scooter Now'}
              </button>

            </div>

          </div>

        </div>
      </div>
    </>
  )
}
