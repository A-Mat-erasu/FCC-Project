package com.organregistry.service;

import com.organregistry.exception.NoMatchFoundException;
import com.organregistry.model.*;
import com.organregistry.util.BloodCompatibility;

import java.util.*;

/** Ranks transplant candidates with a PriorityQueue. */
public class MatchingService {

    /**
     * Priority 1: higher urgency first (5 = critical).
     * Priority 2: earlier listing date first (tie-break, edge case 2).
     * Priority 3: request id (guarantees deterministic order on a total tie).
     */
    public static final Comparator<TransplantRequest> RANKING =
            Comparator.comparingInt(TransplantRequest::getUrgency).reversed()
                      .thenComparing(TransplantRequest::getListingDate)
                      .thenComparing(TransplantRequest::getId);

    private PriorityQueue<TransplantRequest> buildQueue(Organ organ, Collection<TransplantRequest> requests) {
        PriorityQueue<TransplantRequest> pq = new PriorityQueue<>(RANKING);
        for (TransplantRequest r : requests) {
            boolean waiting = r.getStatus() == RequestStatus.WAITING;
            boolean sameOrgan = r.getOrganType().equalsIgnoreCase(organ.getOrganType());
            boolean bloodOk = BloodCompatibility.canDonate(organ.getBloodType(), r.getPatientBloodType());
            if (waiting && sameOrgan && bloodOk) pq.offer(r);   // incompatible/ineligible never enter the queue
        }
        return pq;
    }

    /** @throws NoMatchFoundException when no compatible waiting patient exists. */
    public TransplantRequest findBestMatch(Organ organ, Collection<TransplantRequest> requests)
            throws NoMatchFoundException {
        TransplantRequest best = buildQueue(organ, requests).poll();
        if (best == null) {
            throw new NoMatchFoundException("No compatible waiting patient for " + organ.getOrganType()
                    + " (" + organ.getBloodType() + ") organ " + organ.getId());
        }
        return best;
    }

    /** Full ranked list (drains a PriorityQueue in priority order). */
    public List<TransplantRequest> rankCandidates(Organ organ, Collection<TransplantRequest> requests) {
        PriorityQueue<TransplantRequest> pq = buildQueue(organ, requests);
        List<TransplantRequest> ranked = new ArrayList<>(pq.size());
        while (!pq.isEmpty()) ranked.add(pq.poll());
        return ranked;
    }
}
