export type SeatStatus = "available" | "sold";

export interface Seat {
  id: string;
  row: string;
  number: number;
  price: number;
  status: SeatStatus;
}