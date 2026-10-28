
import express from "express";
import cors from "cors";
import eventsRouter from "./routes/events.js";
import bookingsRouter from "./routes/bookings.js";
import authRouter from "./routes/auth.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    credentials: true,
  })
);

app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "EventHub API is running",
  });
});

// Event routes
app.use("/api/events", eventsRouter);

// Booking routes
app.use("/api/bookings", bookingsRouter);

// Authentication routes
app.use("/api/auth", authRouter);

// Unknown API routes
app.use("/api", (_req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

app.listen(PORT, () => {
  console.log(
    `EventHub API running at http://localhost:${PORT}`
  );
});
