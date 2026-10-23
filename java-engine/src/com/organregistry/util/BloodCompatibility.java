package com.organregistry.util;

import java.util.*;

/**
 * Blood-type compatibility lookup table backed by a HashMap.
 * Key = DONOR blood type, Value = set of RECIPIENT blood types that can receive it.
 * Replaces nested if/else ladders with O(1) lookups.
 */
public final class BloodCompatibility {

    private static final Map<String, Set<String>> DONOR_TO_RECIPIENTS = new HashMap<>();

    static {
        DONOR_TO_RECIPIENTS.put("O-",  setOf("O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+")); // universal donor
        DONOR_TO_RECIPIENTS.put("O+",  setOf("O+", "A+", "B+", "AB+"));
        DONOR_TO_RECIPIENTS.put("A-",  setOf("A-", "A+", "AB-", "AB+"));
        DONOR_TO_RECIPIENTS.put("A+",  setOf("A+", "AB+"));
        DONOR_TO_RECIPIENTS.put("B-",  setOf("B-", "B+", "AB-", "AB+"));
        DONOR_TO_RECIPIENTS.put("B+",  setOf("B+", "AB+"));
        DONOR_TO_RECIPIENTS.put("AB-", setOf("AB-", "AB+"));
        DONOR_TO_RECIPIENTS.put("AB+", setOf("AB+"));                                              // universal recipient only
    }

    private BloodCompatibility() { }

    private static Set<String> setOf(String... types) {
        return Collections.unmodifiableSet(new HashSet<>(Arrays.asList(types)));
    }

    public static boolean isValid(String bloodType) {
        return bloodType != null && DONOR_TO_RECIPIENTS.containsKey(bloodType);
    }

    /** @return true if an organ from donorType can be given to recipientType. */
    public static boolean canDonate(String donorType, String recipientType) {
        Set<String> allowed = DONOR_TO_RECIPIENTS.get(donorType);
        return allowed != null && allowed.contains(recipientType);
    }

    public static Set<String> compatibleRecipients(String donorType) {
        return DONOR_TO_RECIPIENTS.getOrDefault(donorType, Collections.emptySet());
    }
}
