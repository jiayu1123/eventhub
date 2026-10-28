export interface BookingSeat {
  id: string;
  price: number;
}

export interface BookingDraft {
  eventId: number;
  seats: BookingSeat[];
}

export interface Booking extends BookingDraft {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  totalPrice: number;
  createdAt: string;
}