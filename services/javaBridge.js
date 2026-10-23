const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

const STATUS_BY_CODE = { NO_MATCH: 404, ORGAN_EXPIRED: 410, INVALID_ALLOCATION: 409, BAD_REQUEST: 400 };

class BridgeError extends Error {
  constructor(code, message, status) { super(message); this.name = 'BridgeError'; this.code = code; this.status = status || STATUS_BY_CODE[code] || 500; }
}

/**
 * Node.js <-> Java bridge over a long-lived child process (JSON lines on stdin/stdout).
 * Edge case 6: every call has a timeout; a hung or crashed JVM is killed/respawned with
 * exponential backoff, and all in-flight calls are rejected cleanly (never left hanging).
 * Emits: 'event' (pushed by Java, e.g. ORGAN_EXPIRED), 'restarted', 'exit'.
 */
class JavaBridge extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.javaBin = opts.javaBin || process.env.JAVA_BIN || 'java';
    this.jar = path.resolve(opts.jar || process.env.JAVA_ENGINE_JAR || 'java-engine/out/organ-engine.jar');
    this.timeoutMs = opts.timeoutMs || Number(process.env.JAVA_TIMEOUT_MS) || 5000;
    this.restartBaseMs = opts.restartBaseMs || 1000;
    this.maxRestarts = opts.maxRestarts || 10;
    this.proc = null; this.pending = new Map(); this.nextId = 1; this.restarts = 0; this.stopping = false;
  }

  start() {
    if (this.proc) return true;
    if (!fs.existsSync(this.jar)) {
      console.error(`[JavaBridge] Jar not found at ${this.jar}. Build it: java-engine\\build.bat (Windows) or sh java-engine/build.sh`);
      return false;
    }
    this.stopping = false;
    const proc = spawn(this.javaBin, ['-cp', this.jar, 'com.organregistry.bridge.EngineCli'], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc = proc;
    proc.on('error', (err) => { console.error('[JavaBridge] spawn error:', err.message); this._onExit(proc, null, err.message); });
    proc.on('exit', (code, sig) => this._onExit(proc, code, sig));
    proc.stderr.on('data', (d) => process.stderr.write('[java] ' + d));
    proc.stdin.on('error', () => { /* EPIPE when JVM dies; handled by exit */ });
    readline.createInterface({ input: proc.stdout }).on('line', (l) => this._onLine(l));
    return true;
  }

  _onLine(line) {
    let msg;
    try { msg = JSON.parse(line); } catch { console.error('[JavaBridge] non-JSON line from engine:', line); return; }
    if (msg.event) return this.emit('event', msg);
    const p = this.pending.get(msg.id);
    if (!p) return;                        // already timed out
    this.pending.delete(msg.id); clearTimeout(p.timer);
    this.restarts = 0;                     // healthy response => reset backoff
    if (msg.ok) p.resolve(msg.data);
    else p.reject(new BridgeError(msg.error.code, msg.error.message));
  }

  _onExit(proc, code, sig) {
    if (this.proc !== proc) return;        // stale / duplicate notification
    this.proc = null;
    for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new BridgeError('ENGINE_CRASHED', `Java engine exited (code=${code}, signal=${sig})`, 503)); }
    this.pending.clear();
    this.emit('exit', code);
    if (this.stopping) return;
    if (this.restarts >= this.maxRestarts) { console.error('[JavaBridge] too many restarts; giving up'); return; }
    const delay = Math.min(this.restartBaseMs * 2 ** this.restarts, 15000);
    this.restarts++;
    console.warn(`[JavaBridge] engine down; restarting in ${delay}ms (attempt ${this.restarts})`);
    setTimeout(() => { if (!this.stopping && this.start()) this.emit('restarted'); }, delay).unref();
  }

  call(cmd, data = {}, timeoutMs = this.timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!this.proc) return reject(new BridgeError('ENGINE_DOWN', 'Java engine is not running', 503));
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new BridgeError('ENGINE_TIMEOUT', `Java engine did not answer '${cmd}' within ${timeoutMs}ms`, 504));
        if (this.proc) this.proc.kill();   // presumed hung -> exit handler respawns it
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.proc.stdin.write(JSON.stringify({ id, cmd, data }) + '\n');
    });
  }

  stop() { this.stopping = true; if (this.proc) this.proc.kill(); }
  status() { return { running: !!this.proc, pendingRequests: this.pending.size, restarts: this.restarts, jar: this.jar }; }
}

module.exports = { JavaBridge, BridgeError };
