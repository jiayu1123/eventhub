
package com.eventhub.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "booking_seats")
public class BookingSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_id", nullable = false)
    private Long bookingId;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Column(name = "seat_label", nullable = false)
    private String seatLabel;

    @Column(name = "price_cents", nullable = false)
    private Integer priceCents;

    protected BookingSeat() {
    }

    public BookingSeat(
            Long bookingId,
            Long eventId,
            String seatLabel,
            Integer priceCents) {

        this.bookingId = bookingId;
        this.eventId = eventId;
        this.seatLabel = seatLabel;
        this.priceCents = priceCents;
    }

    public Long getId() {
        return id;
    }

    public Long getBookingId() {
        return bookingId;
    }

    public Long getEventId() {
        return eventId;
    }

    public String getSeatLabel() {
        return seatLabel;
    }

    public Integer getPriceCents() {
        return priceCents;
    }
}
