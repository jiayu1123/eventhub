
package com.eventhub.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "event_seats")
public class EventSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Column(name = "seat_label", nullable = false)
    private String seatLabel;

    @Column(name = "price_cents", nullable = false)
    private Integer priceCents;

    protected EventSeat() {
    }

    public Long getId() {
        return id;
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
