package com.organregistry.util;

import java.util.*;

/** Minimal dependency-free JSON parser/writer used by the Node.js <-> Java bridge.
 *  Parsed types: Map, List, String, Double, Boolean, null. */
public final class Json {
    private Json() { }

    public static Object parse(String s) {
        Parser p = new Parser(s);
        Object v = p.readValue();
        p.skipWs();
        if (p.pos != s.length()) throw new IllegalArgumentException("Trailing content in JSON");
        return v;
    }

    public static String write(Object o) {
        StringBuilder sb = new StringBuilder();
        w(sb, o);
        return sb.toString();
    }

    private static void w(StringBuilder sb, Object o) {
        if (o == null) sb.append("null");
        else if (o instanceof String) quote(sb, (String) o);
        else if (o instanceof Boolean) sb.append(o);
        else if (o instanceof Number) {
            double d = ((Number) o).doubleValue();
            if (d == Math.rint(d) && Math.abs(d) < 1e15) sb.append((long) d); else sb.append(d);
        } else if (o instanceof Map) {
            sb.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> e : ((Map<?, ?>) o).entrySet()) {
                if (!first) sb.append(',');
                first = false;
                quote(sb, String.valueOf(e.getKey()));
                sb.append(':');
                w(sb, e.getValue());
            }
            sb.append('}');
        } else if (o instanceof Collection) {
            sb.append('[');
            boolean first = true;
            for (Object x : (Collection<?>) o) {
                if (!first) sb.append(',');
                first = false;
                w(sb, x);
            }
            sb.append(']');
        } else quote(sb, String.valueOf(o));
    }

    private static void quote(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c)); else sb.append(c);
            }
        }
        sb.append('"');
    }

    private static final class Parser {
        final String s; int pos = 0;
        Parser(String s) { this.s = s; }

        IllegalArgumentException err(String m) { return new IllegalArgumentException("JSON error at " + pos + ": " + m); }
        void skipWs() { while (pos < s.length() && Character.isWhitespace(s.charAt(pos))) pos++; }
        char peek() { if (pos >= s.length()) throw err("unexpected end"); return s.charAt(pos); }
        char next() { char c = peek(); pos++; return c; }
        void consume(char c) { if (next() != c) throw err("expected '" + c + "'"); }
        void expect(String lit) { if (!s.startsWith(lit, pos)) throw err("expected " + lit); pos += lit.length(); }

        Object readValue() {
            skipWs();
            switch (peek()) {
                case '{': return readObject();
                case '[': return readArray();
                case '"': return readString();
                case 't': expect("true"); return Boolean.TRUE;
                case 'f': expect("false"); return Boolean.FALSE;
                case 'n': expect("null"); return null;
                default: return readNumber();
            }
        }

        Map<String, Object> readObject() {
            consume('{');
            Map<String, Object> m = new LinkedHashMap<>();
            skipWs();
            if (peek() == '}') { pos++; return m; }
            while (true) {
                skipWs();
                String k = readString();
                skipWs(); consume(':');
                m.put(k, readValue());
                skipWs();
                char c = next();
                if (c == ',') continue;
                if (c == '}') return m;
                throw err("expected , or }");
            }
        }

        List<Object> readArray() {
            consume('[');
            List<Object> l = new ArrayList<>();
            skipWs();
            if (peek() == ']') { pos++; return l; }
            while (true) {
                l.add(readValue());
                skipWs();
                char c = next();
                if (c == ',') continue;
                if (c == ']') return l;
                throw err("expected , or ]");
            }
        }

        String readString() {
            consume('"');
            StringBuilder sb = new StringBuilder();
            while (true) {
                char c = next();
                if (c == '"') return sb.toString();
                if (c != '\\') { sb.append(c); continue; }
                char e = next();
                switch (e) {
                    case 'n': sb.append('\n'); break;
                    case 't': sb.append('\t'); break;
                    case 'r': sb.append('\r'); break;
                    case 'b': sb.append('\b'); break;
                    case 'f': sb.append('\f'); break;
                    case 'u':
                        sb.append((char) Integer.parseInt(s.substring(pos, pos + 4), 16));
                        pos += 4; break;
                    default: sb.append(e);   // \" \\ \/
                }
            }
        }

        Double readNumber() {
            int start = pos;
            while (pos < s.length() && "+-0123456789.eE".indexOf(s.charAt(pos)) >= 0) pos++;
            if (start == pos) throw err("unexpected character '" + peek() + "'");
            return Double.valueOf(s.substring(start, pos));
        }
    }
}
