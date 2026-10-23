package com.organregistry.bridge;

import com.organregistry.exception.*;
import com.organregistry.model.*;
import com.organregistry.service.AllocationService;
import com.organregistry.service.MatchingService;
import com.organregistry.thread.ViabilityMonitorThread;
import com.organregistry.util.BloodCompatibility;
import com.organregistry.util.Json;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Line-oriented JSON bridge. Node.js writes one JSON request per line on stdin:
 *     {"id":1,"cmd":"allocate","data":{...}}
 * and receives one JSON line per response on stdout:
 *     {"id":1,"ok":true,"data":{...}}   or   {"id":1,"ok":false,"error":{"code":"NO_MATCH","message":"..."}}
 * The ViabilityMonitorThread pushes unsolicited event lines:
 *     {"event":"ORGAN_EXPIRED","organId":"...",...}
 * stdout carries ONLY protocol lines; diagnostics go to stderr.
 * MongoDB stays the source of truth; Java is a stateless compute engine except for the watch-list.
 */
public class EngineCli {
    private static final PrintStream OUT =
            new PrintStream(new FileOutputStream(FileDescriptor.out), false, StandardCharsets.UTF_8);
    private static final Object LOCK = new Object();
    private static final Map<String, Organ> WATCHED = new ConcurrentHashMap<>();
    private static final boolean DEBUG = "1".equals(System.getenv("ENGINE_DEBUG"));

    public static void main(String[] args) throws Exception {
        long interval = Long.parseLong(System.getenv().getOrDefault("ENGINE_MONITOR_INTERVAL_MS", "1000"));
        ViabilityMonitorThread monitor = new ViabilityMonitorThread(WATCHED::values, EngineCli::onExpired, interval);
        monitor.start();
        System.err.println("EngineCli ready (monitor interval " + interval + "ms)");

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        String line;
        while ((line = in.readLine()) != null) {
            if (!line.isBlank()) handle(line);
        }
        monitor.shutdown();   // stdin closed => parent gone => exit (no orphan processes)
    }

    // ---------- output ----------
    private static void send(Map<String, Object> msg) {
        synchronized (LOCK) { OUT.println(Json.write(msg)); OUT.flush(); }
    }

    private static void respond(Object id, boolean ok, Object data, String code, String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("ok", ok);
        if (ok) m.put("data", data);
        else {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("code", code);
            err.put("message", message);
            m.put("error", err);
        }
        send(m);
    }

    private static void onExpired(Organ o) {
        WATCHED.remove(o.getId());
        Map<String, Object> ev = new LinkedHashMap<>();
        ev.put("event", "ORGAN_EXPIRED");
        ev.put("organId", o.getId());
        ev.put("organType", o.getOrganType());
        ev.put("expiredAt", Instant.now().toString());
        send(ev);
    }

    // ---------- dispatch ----------
    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object o) { return (Map<String, Object>) o; }

    private static void handle(String line) {
        Object id = null;
        try {
            Map<String, Object> req = asMap(Json.parse(line));
            id = req.get("id");
            String cmd = (String) req.get("cmd");
            Map<String, Object> data = req.get("data") == null ? new HashMap<>() : asMap(req.get("data"));
            respond(id, true, dispatch(cmd, data), null, null);
        } catch (NoMatchFoundException e) { respond(id, false, null, "NO_MATCH", e.getMessage());
        } catch (OrganExpiredException e) { respond(id, false, null, "ORGAN_EXPIRED", e.getMessage());
        } catch (InvalidAllocationException e) { respond(id, false, null, "INVALID_ALLOCATION", e.getMessage());
        } catch (IllegalArgumentException | ClassCastException | NullPointerException e) {
            respond(id, false, null, "BAD_REQUEST", String.valueOf(e.getMessage()));
        } catch (Exception e) { respond(id, false, null, "INTERNAL", String.valueOf(e));
        }
    }

    private static Object dispatch(String cmd, Map<String, Object> data) throws Exception {
        if (cmd == null) throw new IllegalArgumentException("cmd is required");
        switch (cmd) {
            case "ping": {
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("pong", true); r.put("watched", WATCHED.size());
                return r;
            }
            case "compatible":
                return BloodCompatibility.canDonate((String) data.get("donorType"), (String) data.get("recipientType"));

            case "rank": {
                Organ organ = parseOrgan(asMap(data.get("organ")));
                List<TransplantRequest> ranked = new MatchingService().rankCandidates(organ, parseRequests(data.get("requests")));
                List<Object> out = new ArrayList<>();
                int pos = 1;
                for (TransplantRequest r : ranked) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("position", pos++);
                    m.put("requestId", r.getId());
                    m.put("patientId", r.getPatientId());
                    m.put("urgency", r.getUrgency());
                    m.put("listingDate", r.getListingDate().toString());
                    out.add(m);
                }
                return out;
            }

            case "allocate": {
                Organ organ = parseOrgan(asMap(data.get("organ")));
                AllocationService svc = new AllocationService();
                svc.addOrgan(organ);
                for (TransplantRequest r : parseRequests(data.get("requests"))) svc.addRequest(r);
                AllocationResult res = svc.allocate(organ.getId());   // may throw the 3 custom exceptions
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("organId", res.getOrganId());
                m.put("requestId", res.getRequestId());
                m.put("patientId", res.getPatientId());
                m.put("allocatedAt", res.getAllocatedAt().toString());
                return m;
            }

            case "watch": {
                int n = 0;
                for (Object o : (List<?>) data.get("organs")) {
                    Organ organ = parseOrgan(asMap(o));
                    OrganStatus st = organ.getStatus();
                    if (st == OrganStatus.AVAILABLE || st == OrganStatus.ALLOCATED) { WATCHED.put(organ.getId(), organ); n++; }
                    else WATCHED.remove(organ.getId());          // EXPIRED / TRANSPLANTED: stop watching
                }
                return Map.of("watching", WATCHED.size(), "updated", n);
            }
            case "unwatch": {
                for (Object id : (List<?>) data.get("ids")) WATCHED.remove(String.valueOf(id));
                return Map.of("watching", WATCHED.size());
            }

            // test hooks for timeout / crash recovery (only when ENGINE_DEBUG=1)
            case "sleep": if (!DEBUG) break; Thread.sleep(((Number) data.get("ms")).longValue()); return "slept";
            case "crash": if (!DEBUG) break; System.exit(1); return null;
            default: break;
        }
        throw new IllegalArgumentException("Unknown command: " + cmd);
    }

    // ---------- JSON -> model ----------
    private static Organ parseOrgan(Map<String, Object> m) {
        Organ o = new Organ((String) m.get("id"), (String) m.get("organType"), (String) m.get("donorId"),
                (String) m.get("bloodType"), Instant.parse((String) m.get("harvestTime")),
                ((Number) m.get("viabilityHours")).doubleValue());
        if (m.get("status") != null) o.setStatus(OrganStatus.valueOf((String) m.get("status")));
        return o;
    }

    private static List<TransplantRequest> parseRequests(Object raw) {
        List<TransplantRequest> list = new ArrayList<>();
        for (Object o : (List<?>) raw) {
            Map<String, Object> m = asMap(o);
            TransplantRequest r = new TransplantRequest((String) m.get("id"), (String) m.get("patientId"),
                    (String) m.get("bloodType"), (String) m.get("organType"),
                    ((Number) m.get("urgency")).intValue(), Instant.parse((String) m.get("listingDate")));
            if (m.get("status") != null) r.setStatus(RequestStatus.valueOf((String) m.get("status")));
            list.add(r);
        }
        return list;
    }
}
