export interface Event {
  id: number;
  title: string;
  category: "Concert" | "Sports" | "Festival";
  location: string;
  date: string;
  price: number;
}