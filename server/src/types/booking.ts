 
export interface BookingSeat {
  id: string;
  price: number;
}

export interface Booking {
  bookingId: string;
  eventId: number;
  seats: BookingSeat[];
  customerName: string;
  customerEmail: string;
  totalPrice: number;
  createdAt: string;
}
