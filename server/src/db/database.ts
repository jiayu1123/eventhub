
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const dataDirectory = join(process.cwd(), "data");

mkdirSync(dataDirectory, { recursive: true });

export const db = new DatabaseSync(
  join(dataDirectory, "eventhub.db")
);

// Enable foreign key constraints.
db.exec("PRAGMA foreign_keys = ON;");

// Initialize database tables.
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Sessions table
  -- Stores hashed session tokens for authentication.
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,

    FOREIGN KEY (user_id)
      REFERENCES users(user_id)
      ON DELETE CASCADE
  );

  -- Bookings table
  CREATE TABLE IF NOT EXISTS bookings (
    booking_id TEXT PRIMARY KEY,
    event_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    total_price INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Booking seats table
  CREATE TABLE IF NOT EXISTS booking_seats (
    booking_id TEXT NOT NULL,
    event_id INTEGER NOT NULL,
    seat_id TEXT NOT NULL,
    price INTEGER NOT NULL,

    FOREIGN KEY (booking_id)
      REFERENCES bookings(booking_id)
      ON DELETE CASCADE,

    PRIMARY KEY (event_id, seat_id)
  );

  -- Index for event booking lookup
  CREATE INDEX IF NOT EXISTS idx_bookings_event
    ON bookings(event_id);

  -- Index for booking history lookup
  CREATE INDEX IF NOT EXISTS idx_bookings_email
    ON bookings(customer_email COLLATE NOCASE);

  -- Index for user creation date
  CREATE INDEX IF NOT EXISTS idx_users_created_at
    ON users(created_at);

  -- Index for session lookup by user
  CREATE INDEX IF NOT EXISTS idx_sessions_user
    ON sessions(user_id);

  -- Index for session expiration
  CREATE INDEX IF NOT EXISTS idx_sessions_expires
    ON sessions(expires_at);
`);

const bookingColumns = db
  .prepare("PRAGMA table_info(bookings)")
  .all() as unknown as { name: string }[];

const hasUserId = bookingColumns.some(
  (column) => column.name === "user_id"
);

if (!hasUserId) {
  db.exec(`
    ALTER TABLE bookings
    ADD COLUMN user_id TEXT REFERENCES users(user_id)
  `);
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_bookings_user_id
  ON bookings(user_id);
`);
