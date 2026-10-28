import { Router } from "express";
import { events } from "../data/events.js";
import { getBookedSeatIds } from "../db/bookings.js";

const router = Router();

// GET /api/events
router.get("/", (_req, res) => {
  res.json({
    success: true,
    count: events.length,
    data: events,
  });
});

// GET /api/events/:id
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      success: false,
      message: "Invalid event ID",
    });
    return;
  }

  const event = events.find((item) => item.id === id);

  if (!event) {
    res.status(404).json({
      success: false,
      message: "Event not found",
    });
    return;
  }

  res.json({
    success: true,
    data: event,
  });
});


router.get("/:id/seats", (req, res) => {
  const eventId = Number(req.params.id);

  const event = events.find(
    (item) => item.id === eventId
  );

  if (!event) {
    res.status(404).json({
      success: false,
      message: "Event not found",
    });
    return;
  }

  const bookedSeatIds = new Set(
    getBookedSeatIds(eventId)
  );

  const seats = ["A", "B", "C", "D"].flatMap((row) =>
    Array.from({ length: 8 }, (_, index) => {
      const id = `${row}${index + 1}`;

      const initiallySold =
        (index + row.charCodeAt(0)) % 7 === 0;

      const isSold =
        initiallySold || bookedSeatIds.has(id);

      return {
        id,
        row,
        number: index + 1,
        price:
          event.price +
          (row === "A" ? 40 : row === "B" ? 20 : 0),
        status: isSold ? "sold" : "available",
      };
    })
  );

  res.json({
    success: true,
    data: seats,
  });
});

export default router;