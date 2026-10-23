package com.organregistry.exception;

/** Thrown when allocation is attempted on an organ past its viability window. */
public class OrganExpiredException extends Exception {
    public OrganExpiredException(String message) { super(message); }
}
