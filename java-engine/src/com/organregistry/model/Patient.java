package com.organregistry.model;

import java.time.LocalDate;

/** INHERITANCE: Patient (recipient) IS-A Person. */
public class Patient extends Person {
    private String medicalCondition;

    public Patient(String id, String firstName, String lastName, LocalDate dob, String gender,
                   String bloodType, String phone, String medicalCondition) {
        super(id, firstName, lastName, dob, gender, bloodType, phone);
        this.medicalCondition = medicalCondition;
    }

    @Override public String getRole() { return "PATIENT"; }

    @Override public String describe() {
        return super.describe() + " condition=" + medicalCondition;
    }

    public String getMedicalCondition() { return medicalCondition; }
    public void setMedicalCondition(String c) { this.medicalCondition = c; }
}
