package com.organregistry;

import com.organregistry.exception.*;
import com.organregistry.model.*;
import com.organregistry.service.AllocationService;
import com.organregistry.thread.ViabilityMonitorThread;

import java.time.*;

/** Console demo proving every rubric item + edge case. Step 3 will add the Node.js bridge. */
public class Main {
    public static void main(String[] args) throws Exception {
        AllocationService svc = new AllocationService();
        Instant now = Instant.now();

        ViabilityMonitorThread monitor = new ViabilityMonitorThread(
                svc::getOrgans, o -> System.out.println("  [ALERT] Organ EXPIRED: " + o), 200);
        monitor.start();

        // Polymorphism demo
        Person[] people = {
            new Donor("D1", "Asha", "Rao", LocalDate.of(1985, 3, 2), "FEMALE", "O-", "9876543210", Donor.DonorType.DECEASED, true),
            new Patient("P1", "Ravi", "Kumar", LocalDate.of(1970, 6, 9), "MALE", "A+", "9123456780", "Kidney failure")
        };
        for (Person p : people) System.out.println(p.describe());

        // Patients: P-A and P-B tie on urgency 5 (P-A listed earlier); P-C is lower urgency; P-D (O-) incompatible with A+ donor
        svc.addRequest(new TransplantRequest("R-C", "P-C", "A+",  "KIDNEY", 3, now.minus(Duration.ofDays(30))));
        svc.addRequest(new TransplantRequest("R-B", "P-B", "AB+", "KIDNEY", 5, now.minus(Duration.ofDays(5))));
        svc.addRequest(new TransplantRequest("R-A", "P-A", "AB+", "KIDNEY", 5, now.minus(Duration.ofDays(10))));
        svc.addRequest(new TransplantRequest("R-D", "P-D", "O-",  "KIDNEY", 5, now.minus(Duration.ofDays(40))));

        // Test 1: ranking + tie-break + blood compatibility. Donor A+ cannot give to B+ or O-.
        Organ k1 = new Organ("K1", "KIDNEY", "D1", "A+", now, 24);
        svc.addOrgan(k1);
        System.out.println("\nRanking for A+ kidney: ");
        svc.getMatching().rankCandidates(k1, svc.getRequests()).forEach(r -> System.out.println("  " + r));
        System.out.println("Allocate K1 -> " + svc.allocate("K1"));

        // Test 2: allocating again -> InvalidAllocationException
        try { svc.allocate("K1"); } catch (InvalidAllocationException e) { System.out.println("Expected: " + e.getMessage()); }

        // Test 3: no match (liver, nobody waiting)
        svc.addOrgan(new Organ("L1", "LIVER", "D1", "O-", now, 12));
        try { svc.allocate("L1"); } catch (NoMatchFoundException e) { System.out.println("Expected: " + e.getMessage()); }

        // Test 4: already-expired organ -> OrganExpiredException
        svc.addOrgan(new Organ("K2", "KIDNEY", "D1", "O-", now.minus(Duration.ofHours(30)), 24));
        try { svc.allocate("K2"); } catch (OrganExpiredException e) { System.out.println("Expected: " + e.getMessage()); }

        // Test 5: background thread expires an organ with ~1s viability
        svc.addOrgan(new Organ("H1", "HEART", "D1", "O-", now, 1.0 / 3600));
        Thread.sleep(1600);
        System.out.println("H1 status after wait: " + svc.getOrgans().stream().filter(o -> o.getId().equals("H1")).findFirst().get().getStatus());
        try { svc.allocate("H1"); } catch (OrganExpiredException e) { System.out.println("Expected: " + e.getMessage()); }

        // Test 6: transplant confirmation
        svc.confirmTransplant("K1");
        try { svc.allocate("K1"); } catch (InvalidAllocationException e) { System.out.println("Expected: " + e.getMessage()); }

        monitor.shutdown();
    }
}
