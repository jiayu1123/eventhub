
package com.eventhub.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "active_seat_reservations")
public class ActiveSeatReservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_id", nullable = false)
    private Long bookingId;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Column(name = "seat_label", nullable = false)
    private String seatLabel;

    protected ActiveSeatReservation() {
    }

    public ActiveSeatReservation(
            Long bookingId,
            Long eventId,
            String seatLabel) {

        this.bookingId = bookingId;
        this.eventId = eventId;
        this.seatLabel = seatLabel;
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
}
