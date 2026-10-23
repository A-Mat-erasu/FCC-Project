package com.organregistry.model;

import java.time.Instant;

public class AllocationResult {
    private final String organId, requestId, patientId;
    private final Instant allocatedAt;

    public AllocationResult(String organId, String requestId, String patientId, Instant allocatedAt) {
        this.organId = organId; this.requestId = requestId;
        this.patientId = patientId; this.allocatedAt = allocatedAt;
    }
    public String getOrganId() { return organId; }
    public String getRequestId() { return requestId; }
    public String getPatientId() { return patientId; }
    public Instant getAllocatedAt() { return allocatedAt; }
    @Override public String toString() {
        return "Allocation{organ=" + organId + " -> patient=" + patientId + " via " + requestId + " at " + allocatedAt + "}";
    }
}
