import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <div className="navbar-logo">M</div>
        <span className="navbar-name">Migga</span>
      </Link>
      <div className="navbar-nav">
        <Link to="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>Home</Link>
        <Link to="/scooters" className={`nav-link ${pathname.startsWith('/scooters') || pathname.startsWith('/book') ? 'active' : ''}`}>Book</Link>
        <Link to="/booking" className={`nav-link ${pathname.startsWith('/booking') ? 'active' : ''}`}>Track Booking</Link>
      </div>
    </nav>
  )
}
