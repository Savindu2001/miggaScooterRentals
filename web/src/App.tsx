import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ScootersPage from './pages/ScootersPage'
import ScooterDetailPage from './pages/ScooterDetailPage'
import BookingPage from './pages/BookingPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import PaymentCancelPage from './pages/PaymentCancelPage'
import BookingStatusPage from './pages/BookingStatusPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/scooters" element={<ScootersPage />} />
      <Route path="/scooter/:scooterId" element={<ScooterDetailPage />} />
      <Route path="/book/:scooterId" element={<BookingPage />} />
      <Route path="/payments/success" element={<PaymentSuccessPage />} />
      <Route path="/payments/cancel" element={<PaymentCancelPage />} />
      <Route path="/booking" element={<BookingStatusPage />} />
      <Route path="/booking/:bookingId" element={<BookingStatusPage />} />
    </Routes>
  )
}
