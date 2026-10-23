package com.organregistry.service;

import com.organregistry.exception.*;
import com.organregistry.model.*;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.List;
import java.util.Map;

/** Holds in-memory registries and performs safe allocation. */
public class AllocationService {
    private final Map<String, Organ> organs = new ConcurrentHashMap<>();
    private final List<TransplantRequest> requests = new CopyOnWriteArrayList<>();
    private final MatchingService matching = new MatchingService();
    private final Clock clock;

    public AllocationService() { this(Clock.systemUTC()); }
    public AllocationService(Clock clock) { this.clock = clock; }

    public void addOrgan(Organ o) { organs.put(o.getId(), o); }
    public void addRequest(TransplantRequest r) { requests.add(r); }
    public Collection<Organ> getOrgans() { return organs.values(); }
    public List<TransplantRequest> getRequests() { return requests; }
    public MatchingService getMatching() { return matching; }

    /**
     * Allocate an organ to the top-ranked compatible patient.
     * Synchronized on the organ so the monitor thread and concurrent API calls cannot race.
     */
    public AllocationResult allocate(String organId)
            throws NoMatchFoundException, OrganExpiredException, InvalidAllocationException {
        Organ organ = organs.get(organId);
        if (organ == null) throw new InvalidAllocationException("Unknown organ id: " + organId);

        synchronized (organ) {
            organ.expireIfNeeded(clock.instant());                      // edge case 5

            switch (organ.getStatus()) {
                case EXPIRED:
                    throw new OrganExpiredException("Organ " + organId + " has expired");
                case TRANSPLANTED:
                case ALLOCATED:
                    throw new InvalidAllocationException("Organ " + organId + " is already " + organ.getStatus());
                default: break;
            }

            TransplantRequest best = matching.findBestMatch(organ, requests);   // edges 1, 2, 4

            // Edge case 3: organ may have expired while matching ran - re-check before committing.
            Instant commitTime = clock.instant();
            if (organ.expireIfNeeded(commitTime)) {
                throw new OrganExpiredException("Organ " + organId + " expired during allocation");
            }

            organ.setStatus(OrganStatus.ALLOCATED);
            best.setStatus(RequestStatus.MATCHED);
            return new AllocationResult(organId, best.getId(), best.getPatientId(), commitTime);
        }
    }

    /** Mark an allocated organ as transplanted (final state). */
    public void confirmTransplant(String organId) throws InvalidAllocationException, OrganExpiredException {
        Organ organ = organs.get(organId);
        if (organ == null) throw new InvalidAllocationException("Unknown organ id: " + organId);
        synchronized (organ) {
            if (organ.expireIfNeeded(clock.instant()))
                throw new OrganExpiredException("Organ " + organId + " expired before transplant");
            if (organ.getStatus() != OrganStatus.ALLOCATED)
                throw new InvalidAllocationException("Organ must be ALLOCATED, was " + organ.getStatus());
            organ.setStatus(OrganStatus.TRANSPLANTED);
        }
    }
}
