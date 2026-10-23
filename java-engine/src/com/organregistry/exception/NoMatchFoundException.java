package com.organregistry.exception;

/** Thrown when no compatible, waiting patient exists for a donated organ. */
public class NoMatchFoundException extends Exception {
    public NoMatchFoundException(String message) { super(message); }
}
