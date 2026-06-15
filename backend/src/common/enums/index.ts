/**
 * Application-level enums — mirroring prisma/schema.prisma definitions.
 * Keeping these here avoids direct dependency on Prisma generated enum exports,
 * which changed behaviour in Prisma v7.
 */

export enum Role {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
}

export enum ScooterStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  RENTED = 'RENTED',
  MAINTENANCE = 'MAINTENANCE',
}

export enum BookingStatus {
  PENDING = 'PENDING',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  PICKED_UP = 'PICKED_UP',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

export enum ExtensionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PickupType {
  OFFICE = 'OFFICE',
  HOTEL = 'HOTEL',
}
