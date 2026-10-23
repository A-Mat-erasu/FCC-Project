package com.organregistry.exception;

/** Thrown on business-rule violations (unknown organ, already allocated/transplanted, etc.). */
public class InvalidAllocationException extends Exception {
    public InvalidAllocationException(String message) { super(message); }
}
