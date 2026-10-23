package com.organregistry.model;

import java.time.Instant;

public class TransplantRequest {
    private final String id;
    private final String patientId;
    private final String patientBloodType;
    private final String organType;
    private final int urgency;            // 1..5, 5 = critical
    private final Instant listingDate;
    private RequestStatus status = RequestStatus.WAITING;

    public TransplantRequest(String id, String patientId, String patientBloodType,
                             String organType, int urgency, Instant listingDate) {
        if (urgency < 1 || urgency > 5) throw new IllegalArgumentException("urgency must be 1..5");
        this.id = id; this.patientId = patientId; this.patientBloodType = patientBloodType;
        this.organType = organType; this.urgency = urgency; this.listingDate = listingDate;
    }

    public String getId() { return id; }
    public String getPatientId() { return patientId; }
    public String getPatientBloodType() { return patientBloodType; }
    public String getOrganType() { return organType; }
    public int getUrgency() { return urgency; }
    public Instant getListingDate() { return listingDate; }
    public synchronized RequestStatus getStatus() { return status; }
    public synchronized void setStatus(RequestStatus s) { this.status = s; }

    @Override public String toString() {
        return String.format("Request{%s patient=%s %s %s urgency=%d listed=%s}",
                id, patientId, patientBloodType, organType, urgency, listingDate);
    }
}
