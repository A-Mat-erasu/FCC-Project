package com.organregistry.model;

import com.organregistry.util.BloodCompatibility;
import java.time.LocalDate;
import java.time.Period;

/**
 * ABSTRACTION: cannot be instantiated; defines the shared contract for Donor and Patient.
 * ENCAPSULATION: all fields private, exposed through validated accessors.
 */
public abstract class Person {
    private final String id;
    private String firstName;
    private String lastName;
    private LocalDate dob;
    private String gender;
    private String bloodType;
    private String phone;

    protected Person(String id, String firstName, String lastName, LocalDate dob,
                     String gender, String bloodType, String phone) {
        if (id == null || id.isBlank()) throw new IllegalArgumentException("id is required");
        if (!BloodCompatibility.isValid(bloodType))
            throw new IllegalArgumentException("Invalid blood type: " + bloodType);
        this.id = id;
        this.firstName = firstName;
        this.lastName = lastName;
        this.dob = dob;
        this.gender = gender;
        this.bloodType = bloodType;
        this.phone = phone;
    }

    /** POLYMORPHISM: each subclass supplies its own role label. */
    public abstract String getRole();

    public String getFullName() { return firstName + " " + lastName; }
    public int getAge() { return Period.between(dob, LocalDate.now()).getYears(); }

    /** Overridable; subclasses extend the description. */
    public String describe() {
        return String.format("[%s] %s (%s, age %d, blood %s)", getRole(), getFullName(), id, getAge(), bloodType);
    }

    public String getId() { return id; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public LocalDate getDob() { return dob; }
    public String getGender() { return gender; }
    public String getBloodType() { return bloodType; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
}
