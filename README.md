# EventHub

**A full-stack event discovery and ticket booking application built with React, TypeScript, Node.js, Express, and SQLite.**

EventHub allows users to explore events, select available seats, make reservations, manage bookings, and update their account information through a responsive web interface.

The project demonstrates end-to-end full-stack development, including frontend state management, RESTful API design, relational data modeling, session-based authentication, and server-side booking validation.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express 5, TypeScript |
| Database | SQLite |
| Authentication | Session-based authentication, HttpOnly cookies, scrypt password hashing |
| Routing | React Router |
| State Management | React Hooks, Context API |
| Development Tools | Git, GitHub, ESLint, npm |

## Key Features

### Event Discovery
- Browse available events through a responsive event listing.
- Search and filter events to find relevant experiences.
- View event details, including venue information and ticket pricing.

### Interactive Seat Selection
- Select seats using an interactive seating layout.
- View seat availability before proceeding to checkout.
- Prevent duplicate reservations through server-side validation and database constraints.

### Ticket Booking and Management
- Complete a booking through a dedicated checkout flow.
- View booking confirmation and reservation details.
- Access personal booking history.
- Cancel existing bookings and release reserved seats.

### Authentication and Account Security
- Register and log in using email and password.
- Store passwords using salted scrypt hashes.
- Authenticate users through server-managed sessions and HttpOnly cookies.
- Restrict booking operations to authenticated users and enforce booking ownership.
- Log out and manage personal account information.

### User Profile
- View account information and membership date.
- Update the account display name.
- Change passwords after verifying the current password.

## System Architecture

EventHub uses a client-server architecture.

```text
React + TypeScript Frontend
          |
          | HTTP / REST APIs
          v
Node.js + Express Backend
          |
          | SQL Queries
          v
      SQLite Database
```

The frontend handles event browsing, navigation, form interactions, seat selection, and user-facing booking workflows.

The backend handles authentication, session validation, booking authorization, seat availability, reservation creation, and database persistence.

SQLite stores user accounts, sessions, booking records, and reserved seat information.

## Project Structure

```text
eventhub/
├── public/
├── src/
│   ├── api/                 # Frontend API clients
│   ├── components/          # Reusable React components
│   ├── context/             # Authentication context
│   ├── data/                # Frontend event data
│   ├── pages/               # Application pages
│   ├── types/               # TypeScript definitions
│   ├── App.tsx
│   └── main.tsx
├── server/
│   ├── src/
│   │   ├── api/             # Backend API helpers
│   │   ├── data/            # Event data
│   │   ├── db/              # SQLite operations
│   │   ├── middleware/      # Authentication middleware
│   │   ├── routes/          # Express routes
│   │   ├── types/           # Backend TypeScript definitions
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── package.json
├── vite.config.ts
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/jiayu1123/eventhub.git
cd eventhub
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
cd server
npm install
```

### 4. Start the backend

From the `server` directory:

```bash
npm run dev
```

The backend runs locally at:

`http://localhost:3001`

The SQLite database is stored locally and excluded from version control.

### 5. Start the frontend

Open another terminal and run from the project root:

```bash
npm run dev
```

Open:

`http://localhost:5173`

## Available Scripts

### Frontend

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build the frontend |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production frontend build |

### Backend

Run these commands from `server/`.

| Command | Description |
|---|---|
| `npm run dev` | Start the backend with automatic reload |
| `npm run build` | Compile the TypeScript backend |
| `npm start` | Run the compiled backend |

## Engineering Highlights

**Type-safe full-stack development:** Uses TypeScript in both the React frontend and Express backend, with defined types for events, seats, and bookings.

**Database integrity:** Enforces unique seat reservations at the database level to prevent the same event seat from being booked twice.

**Authentication and authorization:** Uses password hashing, server-managed sessions, HttpOnly cookies, and ownership checks to protect account and booking operations.

**Separation of concerns:** Organizes the application into frontend components, API clients, backend routes, middleware, and database modules.

**Responsive user experience:** Builds reusable React components and mobile-friendly interfaces for browsing, booking, and managing events.

## Screenshots

Screenshots of the event listing, event details, seat selection, booking confirmation, booking history, and user profile will be added here.

## Future Improvements

- Add automated unit and integration tests for authentication and booking workflows.
- Introduce session management and the ability to revoke sessions on other devices.
- Deploy the frontend and backend for an accessible live demo.
- Expand event management capabilities.

## Author

Developed by [Jiayu Zou](https://github.com/jiayu1123).

GitHub: https://github.com/jiayu1123/eventhub
