package com.organregistry.thread;

import com.organregistry.model.Organ;

import java.time.Instant;
import java.util.Collection;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Background thread that continuously checks:
 *     harvestTime + viabilityHours <= now   =>  organ EXPIRED
 * and fires an alert callback (later forwarded to WebSocket clients).
 */
public class ViabilityMonitorThread extends Thread {
    private final Supplier<Collection<Organ>> organSource;
    private final Consumer<Organ> onExpired;
    private final long intervalMillis;
    private volatile boolean running = true;

    public ViabilityMonitorThread(Supplier<Collection<Organ>> organSource,
                                  Consumer<Organ> onExpired, long intervalMillis) {
        super("ViabilityMonitorThread");
        this.organSource = organSource;
        this.onExpired = onExpired;
        this.intervalMillis = intervalMillis;
        setDaemon(true);                       // never blocks JVM shutdown
    }

    @Override public void run() {
        while (running) {
            Instant now = Instant.now();
            for (Organ organ : organSource.get()) {
                if (organ.expireIfNeeded(now)) {          // atomic state change
                    try { onExpired.accept(organ); }
                    catch (RuntimeException e) { System.err.println("Alert handler failed: " + e.getMessage()); }
                }
            }
            try { Thread.sleep(intervalMillis); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); return; }
        }
    }

    public void shutdown() { running = false; interrupt(); }
}
