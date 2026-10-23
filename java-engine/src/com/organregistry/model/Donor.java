package com.organregistry.model;

import java.time.LocalDate;

/** INHERITANCE: Donor IS-A Person. */
public class Donor extends Person {
    public enum DonorType { LIVING, DECEASED }

    private final DonorType donorType;
    private boolean consentVerified;

    public Donor(String id, String firstName, String lastName, LocalDate dob, String gender,
                 String bloodType, String phone, DonorType donorType, boolean consentVerified) {
        super(id, firstName, lastName, dob, gender, bloodType, phone);
        this.donorType = donorType;
        this.consentVerified = consentVerified;
    }

    @Override public String getRole() { return "DONOR"; }

    @Override public String describe() {
        return super.describe() + " type=" + donorType + " consent=" + consentVerified;
    }

    public DonorType getDonorType() { return donorType; }
    public boolean isConsentVerified() { return consentVerified; }
    public void setConsentVerified(boolean v) { this.consentVerified = v; }
}
