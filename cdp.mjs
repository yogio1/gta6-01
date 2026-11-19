// cdp.mjs — minimal Chrome DevTools Protocol driver: hand-rolled WebSocket over net.Socket
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// --- tiny WebSocket client (text frames, masking, no fragmentation) ---
class MiniWS {
  constructor(socket) {
    this.sock = socket;
    this.buf = Buffer.alloc(0);
    this.handlers = { message: [], close: [] };
    socket.on('data', (d) => { this.buf = Buffer.concat([this.buf, d]); this._parse(); });
    socket.on('error', () => {});
    socket.on('close', () => this.handlers.close.forEach((f) => f()));
  }
  static connect(url) {
    return new Promise((res, rej) => {
      const u = new URL(url);
      const key = crypto.randomBytes(16).toString('base64');
      const sock = net.connect(Number(u.port), u.hostname, () => {
        sock.write(
          `GET ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      });
      sock.once('error', rej);
      let upgraded = false;
      sock.on('data', function onData(d) {
        if (upgraded) return;
        upgraded = true;
        sock.off('data', onData);
        const s = d.toString('latin1');
        if (!/ 101 /.test(s.split('\r\n')[0])) { rej(new Error('upgrade failed: ' + s.split('\r\n')[0])); return; }
        const idx = s.indexOf('\r\n\r\n');
        const ws = new MiniWS(sock);
        // header bytes vs frame bytes: header length in bytes may differ from latin1 length? it doesn't for ASCII headers.
        const headerLen = idx + 4;
        const rest = d.subarray(headerLen);
        if (rest.length) ws.buf = Buffer.concat([ws.buf, rest]);
        res(ws);
      });
    });
  }
  _parse() {
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const opcode = b0 & 0x0f;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (this.buf.length < off + len) return;
      const payload = this.buf.subarray(off, off + len);
      this.buf = this.buf.subarray(off + len);
      if (opcode === 0x1) this.handlers.message.forEach((f) => f(payload.toString('utf8')));
      else if (opcode === 0x8) { this.handlers.close.forEach((f) => f()); try { this.sock.end(); } catch {} }
    }
  }
  _send(payload, opcode) {
    const data = Buffer.from(payload);
    const mask = crypto.randomBytes(4);
    let header;
    if (data.length < 126) header = Buffer.from([0x80 | opcode, 0x80 | data.length]);
    else if (data.length < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 0x80 | 126; header.writeUInt16BE(data.length, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(data.length), 2); }
    const masked = Buffer.from(data.map((b, i) => b ^ mask[i % 4]));
    this.sock.write(Buffer.concat([header, mask, masked]));
  }
  sendText(s) { this._send(s, 0x1); }
}

export class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async launch() {
    const exe = '/home/agentuser/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
    const profile = mkdtempSync(join(tmpdir(), 'cdp-prof-'));
    const proc = spawn(exe, [
      '--headless=new', '--no-sandbox', '--disable-gpu',
      `--user-data-dir=${profile}`, '--remote-debugging-port=9222',
      '--window-size=1300,760', 'about:blank',
    ], { stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try { const r = await fetch('http://127.0.0.1:9222/json/version'); if (r.ok) break; } catch {}
      await new Promise((res) => setTimeout(res, 200));
    }
    const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
    const page = list.find((t) => t.type === 'page');
    const ws = await MiniWS.connect(page.webSocketDebuggerUrl);
    const cdp = new CDP(ws);
    cdp.proc = proc;
    ws.handlers.message.push((data) => {
      const msg = JSON.parse(data);
      if (msg.id && cdp.pending.has(msg.id)) {
        const { res, rej } = cdp.pending.get(msg.id);
        cdp.pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled' || msg.method === 'Runtime.exceptionThrown') {
        cdp.onConsole?.(msg);
      }
    });
    return cdp;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.sendText(JSON.stringify({ id, method, params }));
    });
  }
  async init() {
    await this.send('Runtime.enable');

    await this.send('Page.enable');
    await this.send('Log.enable');
  }
  async goto(url) { await this.send('Page.navigate', { url }); await sleep(1200); }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('page eval error: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value;
  }
  async key(code, dur = 120) { await this.holdKey(code); await sleep(dur); await this.releaseKey(code); }
  async holdKey(code) { await this.send('Input.dispatchKeyEvent', { type: 'keyDown', code, windowsVirtualKeyCode: vcode(code) }); }
  async releaseKey(code) { await this.send('Input.dispatchKeyEvent', { type: 'keyUp', code, windowsVirtualKeyCode: vcode(code) }); }
  async mouseMove(x, y) { await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); }
  async mouseDown(x, y) { await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); }
  async mouseUp(x, y) { await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); }
  async shot(path) {
    const r = await this.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: 1280, height: 720, scale: 1 },
      captureBeyondViewport: false,
    });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
  }
  async fixViewport() {
    await this.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  }
  close() { try { this.proc.kill(); } catch {} }
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VKEYS = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyF: 70, Enter: 13, Escape: 27, KeyP: 80, KeyL: 76, KeyQ: 81, Space: 32, KeyE: 69 };
function vcode(code) { return VKEYS[code] ?? 0; }
