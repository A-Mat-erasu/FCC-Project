package com.organregistry.model;

import java.time.Instant;

/** Thread-safe organ entity: state transitions are synchronized because the
 *  ViabilityMonitorThread and request-handling threads both touch it. */
public class Organ {
    private final String id;
    private final String organType;
    private final String donorId;
    private final String bloodType;
    private final Instant harvestTime;
    private final double viabilityHours;
    private OrganStatus status = OrganStatus.AVAILABLE;

    public Organ(String id, String organType, String donorId, String bloodType,
                 Instant harvestTime, double viabilityHours) {
        if (viabilityHours <= 0) throw new IllegalArgumentException("viabilityHours must be > 0");
        this.id = id; this.organType = organType; this.donorId = donorId;
        this.bloodType = bloodType; this.harvestTime = harvestTime; this.viabilityHours = viabilityHours;
    }

    /** harvest + viability */
    public Instant getExpiryTime() {
        return harvestTime.plusMillis((long) (viabilityHours * 3_600_000L));
    }

    /** Rubric condition: Harvest + ViabilityHours <= Now  => expired. */
    public boolean isExpiredAt(Instant now) { return !getExpiryTime().isAfter(now); }

    public long secondsRemaining(Instant now) {
        return Math.max(0, java.time.Duration.between(now, getExpiryTime()).getSeconds());
    }

    /** Atomically flips AVAILABLE/ALLOCATED -> EXPIRED when past viability. @return true if state changed. */
    public synchronized boolean expireIfNeeded(Instant now) {
        if ((status == OrganStatus.AVAILABLE || status == OrganStatus.ALLOCATED) && isExpiredAt(now)) {
            status = OrganStatus.EXPIRED;
            return true;
        }
        return false;
    }

    public synchronized OrganStatus getStatus() { return status; }
    public synchronized void setStatus(OrganStatus s) { this.status = s; }

    public String getId() { return id; }
    public String getOrganType() { return organType; }
    public String getDonorId() { return donorId; }
    public String getBloodType() { return bloodType; }
    public Instant getHarvestTime() { return harvestTime; }
    public double getViabilityHours() { return viabilityHours; }

    @Override public String toString() {
        return String.format("Organ{%s %s %s status=%s expires=%s}", id, organType, bloodType, getStatus(), getExpiryTime());
    }
}
