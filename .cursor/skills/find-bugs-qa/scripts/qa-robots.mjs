#!/usr/bin/env node
// Play one or more watched Shangdaren bot games in a single Chrome window.
//
// Each process owns its debug port and its Chrome profile, so several
// invocations can run at the same time. Do not point two processes at the
// same --port.
//
//   node .cursor/skills/find-bugs-qa/scripts/qa-robots.mjs \
//     --games 1 \
//     --index 3 \
//     --url http://127.0.0.1:8000/ \
//     --out qa-runs/<stamp>/games/3 \
//     --port 9403
//
// --games 1 writes capture.json, console.txt, and board.png directly into
// --out. --games greater than 1 writes those files into --out/<index>/.
// Page delays come from the loaded GAME_SPEEDS. This script does not edit
// source files and does not scale timers.
//
// Exit 0: every game reached an ending.
// Exit 1: a game stalled, or Chrome or the page failed.
// Exit 2: the first draw still used production delays (stale cached constants).

import { spawn, execFileSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const STALL_MS = 3 * 60 * 1000;
const GAME_TIMEOUT_MS = 5 * 60 * 1000;
const SLOW_DRAW_MS = 1000;

function usage() {
  console.log(`Usage: qa-robots.mjs --out <dir> [options]

Options:
  --games <n>     Hands to play in this Chrome window (default 1)
  --index <n>     Index of the first hand (default 1)
  --url <url>     Page URL (default http://127.0.0.1:8000/)
  --out <dir>     Where this invocation writes its capture
  --port <n>      Chrome DevTools port, unique per concurrent process (default 9333)
  --chrome <path> Chrome binary (default: CHROME_PATH or google-chrome)
  --help          Show this help
`);
}

function parseArgs(argv) {
  const opts = {
    games: 1,
    index: 1,
    url: 'http://127.0.0.1:8000/',
    out: '',
    port: 9333,
    chrome: process.env.CHROME_PATH || ''
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (arg === '--games') opts.games = Number(next());
    else if (arg === '--index') opts.index = Number(next());
    else if (arg === '--url') opts.url = next();
    else if (arg === '--out') opts.out = next();
    else if (arg === '--port') opts.port = Number(next());
    else if (arg === '--chrome') opts.chrome = next();
    else throw new Error(`Unknown argument ${arg}`);
  }
  if (!opts.out) throw new Error('--out is required');
  if (!Number.isInteger(opts.games) || opts.games < 1) throw new Error('--games must be a positive integer');
  if (!Number.isInteger(opts.index) || opts.index < 1) throw new Error('--index must be a positive integer');
  if (!Number.isInteger(opts.port) || opts.port < 1) throw new Error('--port must be a positive integer');
  return opts;
}

function findChrome(explicit) {
  if (explicit) return explicit;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      return execFileSync('which', [name], { encoding: 'utf8' }).trim();
    } catch {
      // try the next name
    }
  }
  throw new Error('Chrome not found. Set CHROME_PATH or pass --chrome.');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function dedupeLog(lines) {
  const out = [];
  for (const line of lines) {
    if (line.startsWith('[GAME] ')) {
      const bare = line.slice('[GAME] '.length);
      if (out[out.length - 1] === bare) continue;
      out.push(bare);
    } else if (out[out.length - 1] !== line) {
      out.push(line);
    }
  }
  return out;
}

function classifyEnding(alert, lines) {
  const blob = `${alert || ''}\n${lines.join('\n')}`;
  if (/BAO-ZI|包子/.test(blob)) return 'bao-zi';
  if (/Deck empty|Winner:\s*None/.test(blob)) return 'draw';
  if (/declares HARMONY|Winner:/.test(blob)) return 'harmony';
  return 'error';
}

const SNAP = String.raw`(() => {
  const textOf = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : '');
  const cardsIn = (root, sel) => [...(root ? root.querySelectorAll(sel) : [])].map((c) => ({
    id: c.dataset.id || '',
    type: c.dataset.type || '',
    red: c.classList.contains('red'),
    glyph: (c.querySelector('.top-char') || c.querySelector('.center-char'))?.textContent || ''
  }));
  const players = [...document.querySelectorAll('.player-area:not(.clone)')].map((el) => {
    const sections = [...el.querySelectorAll(':scope > .section')];
    const exposedSec = el.querySelector('.exposed-section');
    return {
      info: textOf(el.querySelector('.player-info')),
      current: el.classList.contains('current-turn'),
      hand: cardsIn(sections[0], '.hand-cards .card'),
      exposed: [...(exposedSec ? exposedSec.querySelectorAll('.meld-item') : [])].map((m) => ({
        label: textOf(m.querySelector('.meld-label')),
        cards: cardsIn(m, '.card')
      })),
      discard: cardsIn(sections[2], '.mini-cards-grid .card'),
      passed: cardsIn(sections[3], '.mini-cards-grid .card')
    };
  });
  const center = cardsIn(document, '#center-discard .card');
  const deckText = textOf(document.getElementById('deck-area'));
  const deckMatch = deckText.match(/\((\d+)\)/);
  const drawBtn = document.getElementById('btn-draw');
  const bubbles = [...document.querySelectorAll('.speech-bubble')].map((b) => {
    const r = b.getBoundingClientRect();
    return { text: b.textContent, top: Math.round(r.top), left: Math.round(r.left) };
  });
  return {
    players,
    center,
    deckText,
    deckCount: deckMatch ? Number(deckMatch[1]) : null,
    drawEnabled: !!(drawBtn && !drawBtn.disabled),
    alerts: (window.__alerts || []).slice(),
    bubbles,
    bodyHasNan: /\bNaN\b|undefined/.test(document.body.innerText),
    viewport: { w: window.innerWidth, h: window.innerHeight }
  };
})()`;

function analyze(snap) {
  const issues = [];
  if (!snap?.players?.length) return issues;
  const locs = [];
  snap.players.forEach((player, playerIndex) => {
    const push = (zone, card) => locs.push({ player: playerIndex, zone, ...card });
    player.hand.forEach((card) => push('hand', card));
    player.exposed.forEach((meld) => meld.cards.forEach((card) => push('exposed', card)));
    player.discard.forEach((card) => push('discard', card));
    player.passed.forEach((card) => push('passed', card));
    const count = player.info.match(/\[(?:Cards|牌数):\s*(\d+)\]/);
    if (count && Number(count[1]) !== player.hand.length) {
      issues.push(`hand count label ${count[1]} but ${player.hand.length} cards rendered`);
    }
  });
  snap.center.forEach((card) => locs.push({ player: 'center', zone: 'center', ...card }));

  const byId = new Map();
  for (const loc of locs) {
    if (!loc.id) {
      issues.push(`card without id in ${loc.zone}`);
      continue;
    }
    if (!byId.has(loc.id)) byId.set(loc.id, []);
    byId.get(loc.id).push(loc);
  }
  for (const [id, group] of byId) {
    if (group.length === 1) continue;
    const passedAndCenter = group.length === 2
      && group.some((item) => item.zone === 'center')
      && group.some((item) => item.zone === 'passed');
    if (!passedAndCenter) {
      const zones = group.map((item) => `${item.player}:${item.zone}`).join(', ');
      issues.push(`card id ${id} appears ${group.length} times (${zones})`);
    }
  }
  if (snap.deckCount === null) issues.push(`deck count unreadable: ${snap.deckText}`);
  else if (byId.size + snap.deckCount !== 96) {
    issues.push(`card conservation ${byId.size} unique + deck ${snap.deckCount} = ${byId.size + snap.deckCount}, expected 96`);
  }
  const turns = snap.players.filter((player) => player.current).length;
  if (turns !== 1) issues.push(`${turns} players marked current turn`);
  if (snap.bodyHasNan) issues.push('page text contains NaN or undefined');
  for (const loc of locs) {
    if (!loc.type) continue;
    const suite = Math.floor(Number(loc.type) / 3);
    if ((suite % 2 === 0) !== loc.red) issues.push(`card id ${loc.id} glyph ${loc.glyph} color class mismatch`);
  }
  for (const bubble of snap.bubbles || []) {
    if (bubble.top < 0 || bubble.left < 0 || bubble.top > snap.viewport.h || bubble.left > snap.viewport.w) {
      issues.push(`speech bubble "${bubble.text}" offscreen at ${bubble.left},${bubble.top}`);
    }
  }
  return [...new Set(issues)];
}

function connectCdp(wsUrl, logs, exceptions) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('Chrome DevTools socket failed')));
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const waiter = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)));
      else waiter.resolve(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ');
      logs.push({ t: Date.now(), level: msg.params.type, text });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const details = msg.params.exceptionDetails;
      exceptions.push(details.exception?.description || details.text || 'exception');
    }
  });
  function send(method, params = {}) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  return { ws, opened, send };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const chromeBin = findChrome(opts.chrome);
  try {
    await fetch(`http://127.0.0.1:${opts.port}/json/version`);
    throw new Error(`Port ${opts.port} is already in use. Pick another --port.`);
  } catch (err) {
    if (String(err.message || err).includes('already in use')) throw err;
  }
  const profile = path.join(tmpdir(), `shang-qa-${opts.port}-${process.pid}`);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });

  const chrome = spawn(chromeBin, [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1280,900',
    '--window-position=20,20',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-infobars',
    '--mute-audio',
    `--remote-debugging-port=${opts.port}`,
    `--user-data-dir=${profile}`,
    '--lang=en-US',
    'about:blank'
  ], { env: { ...process.env }, stdio: 'ignore' });

  const logs = [];
  const exceptions = [];
  let ws = null;
  let exitCode = 1;

  const stopChrome = () => new Promise((resolve) => {
    if (chrome.exitCode !== null || chrome.killed) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      try { chrome.kill('SIGKILL'); } catch { /* already gone */ }
      resolve();
    }, 2000);
    chrome.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    try { chrome.kill('SIGTERM'); } catch { resolve(); }
  });

  try {
    try {
    let wsUrl = '';
    for (let attempt = 0; attempt < 40 && !wsUrl; attempt++) {
      if (chrome.exitCode !== null) {
        throw new Error(`Chrome exited before DevTools was ready. Port ${opts.port} may already be in use.`);
      }
      try {
        const list = await (await fetch(`http://127.0.0.1:${opts.port}/json/list`)).json();
        const page = list.find((target) => target.type === 'page');
        if (page) wsUrl = page.webSocketDebuggerUrl;
      } catch {
        // Chrome is still starting.
      }
      if (!wsUrl) await sleep(250);
    }
    if (!wsUrl) throw new Error(`Chrome DevTools did not open on port ${opts.port}`);

    const cdp = connectCdp(wsUrl, logs, exceptions);
    await cdp.opened;
    ws = cdp.ws;
    const send = cdp.send;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        window.__alerts = [];
        window.alert = (msg) => {
          window.__alerts.push(String(msg));
          console.log('[ALERT] ' + msg);
        };
        try {
          localStorage.setItem('language', 'en');
          localStorage.setItem('soundVoice', 'none');
        } catch (e) {}
      })();`
    });

    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || 'page evaluate failed');
      }
      return result.result.value;
    }

    await send('Page.navigate', { url: opts.url });
    await evaluate(`(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      return true;
    })()`);
    await send('Page.reload', { ignoreCache: true });

    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      ready = await evaluate(`!!document.getElementById('btn-watch')`);
      if (ready) break;
      await sleep(250);
    }
    if (!ready) throw new Error(`Watch button did not appear at ${opts.url}`);
    await evaluate(`(() => {
      const lang = document.getElementById('lang-select');
      if (lang && lang.value !== 'en') {
        lang.value = 'en';
        lang.dispatchEvent(new Event('change'));
      }
      const sound = document.getElementById('sound-select');
      if (sound && sound.value !== 'none') {
        sound.value = 'none';
        sound.dispatchEvent(new Event('change'));
      }
      return true;
    })()`);

    async function saveBoard(dir) {
      const metrics = await send('Page.getLayoutMetrics');
      const size = metrics.cssContentSize || metrics.contentSize;
      const shot = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: {
          x: 0,
          y: 0,
          width: Math.max(1, Math.ceil(size.width)),
          height: Math.max(1, Math.ceil(size.height)),
          scale: 1
        }
      });
      const file = path.join(dir, 'board.png');
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
      return file;
    }

    function gameDir(index) {
      const dir = opts.games === 1 ? opts.out : path.join(opts.out, String(index));
      mkdirSync(dir, { recursive: true });
      return dir;
    }

    function writeCapture(dir, capture) {
      const excerpt = dedupeLog(capture.logLines);
      const seedLine = excerpt.find((line) => line.includes('Initializing with seed:')) || '';
      const seedMatch = seedLine.match(/seed:\s*(\d+)/);
      const body = {
        index: capture.index,
        url: opts.url,
        seed: seedMatch ? seedMatch[1] : '',
        alert: capture.alert,
        ending: capture.ending,
        elapsedMs: capture.elapsedMs,
        stalled: capture.stalled,
        staleConstants: capture.staleConstants,
        anomalies: capture.anomalies,
        drawEnabledDuringWatch: capture.drawEnabledDuringWatch,
        suspicious: capture.suspicious,
        exceptions: capture.exceptions,
        screenshots: capture.screenshots,
        consoleExcerpt: excerpt.join('\n'),
        error: capture.error
      };
      writeFileSync(path.join(dir, 'capture.json'), JSON.stringify(body, null, 2));
      writeFileSync(path.join(dir, 'console.txt'), body.consoleExcerpt + (body.consoleExcerpt ? '\n' : ''));
      return body;
    }

    let failed = 0;
    for (let offset = 0; offset < opts.games; offset++) {
      const index = opts.index + offset;
      const dir = gameDir(index);
      const logStart = logs.length;
      const excStart = exceptions.length;
      const seen = new Set();
      const anomalies = [];
      let drawEnabledDuringWatch = false;
      let staleConstants = false;
      let stalled = false;
      let error = null;
      const started = Date.now();

      await evaluate(`document.getElementById('btn-watch').click()`);

      let gameStartedAt = 0;
      let drawAt = 0;
      let alertText = null;
      let snap = null;

      while (Date.now() - started < GAME_TIMEOUT_MS) {
        await sleep(200);
        const fresh = logs.slice(logStart);
        if (!gameStartedAt) {
          const startedLine = fresh.find((line) => line.text.includes('Game started'));
          if (startedLine) gameStartedAt = startedLine.t;
        }
        if (gameStartedAt && !drawAt) {
          const drewLine = fresh.find((line) => line.t >= gameStartedAt && / drew /.test(line.text));
          if (drewLine) drawAt = drewLine.t;
          else if (Date.now() - gameStartedAt >= SLOW_DRAW_MS + 400) {
            staleConstants = true;
            error = 'stale cached constants';
            break;
          }
        }
        if (drawAt && drawAt - gameStartedAt >= SLOW_DRAW_MS) {
          staleConstants = true;
          error = 'stale cached constants';
          break;
        }

        try {
          snap = await evaluate(SNAP);
        } catch (err) {
          error = String(err.message || err);
          break;
        }
        if (snap.drawEnabled) drawEnabledDuringWatch = true;
        for (const issue of analyze(snap)) {
          if (seen.has(issue)) continue;
          seen.add(issue);
          anomalies.push(issue);
          console.log(`ANOMALY game ${index}: ${issue}`);
        }
        if (snap.alerts.length > 0) {
          alertText = snap.alerts[snap.alerts.length - 1];
          break;
        }
        const lastLog = fresh.length ? fresh[fresh.length - 1].t : started;
        if (Date.now() - lastLog >= STALL_MS && snap.players.length > 0) {
          stalled = true;
          error = 'no console output for 3 minutes';
          break;
        }
      }
      if (!alertText && !staleConstants && !stalled && !error) {
        stalled = true;
        error = 'no ending within 5 minutes';
      }

      const logLines = logs.slice(logStart).map((line) => line.text);
      const ending = staleConstants ? 'error' : (stalled ? 'stuck' : classifyEnding(alertText, logLines));
      let boardSaved = false;
      try {
        await saveBoard(dir);
        boardSaved = true;
      } catch (err) {
        error = error || `screenshot failed: ${err.message || err}`;
      }
      const suspicious = [...new Set(logLines.filter((line) => /Ignored illegal|Ignored repeat|Cannot discard|Card not found|Invalid KOU|Discard required|Failed to/i.test(line)))];
      const capture = writeCapture(dir, {
        index,
        alert: alertText || '',
        ending,
        elapsedMs: Date.now() - started,
        stalled,
        staleConstants,
        anomalies,
        drawEnabledDuringWatch,
        suspicious,
        exceptions: exceptions.slice(excStart).slice(0, 10),
        logLines,
        error,
        screenshots: boardSaved ? ['board.png'] : []
      });
      console.log(`GAME ${index} ${capture.ending} ${capture.elapsedMs}ms anomalies=${capture.anomalies.length} ${path.join(dir, 'capture.json')}`);

      if (staleConstants) {
        exitCode = 2;
        console.log('EXIT 2');
        return;
      }
      if (stalled || ending === 'error' || error) failed += 1;
      if (offset + 1 < opts.games) await evaluate(`window.__alerts = []`);
    }

    exitCode = failed === 0 ? 0 : 1;
    console.log(`EXIT ${exitCode}`);
    } catch (err) {
      console.error(err.message || err);
      exitCode = 1;
    }
  } finally {
    if (ws) {
      try { ws.close(); } catch { /* socket already closed */ }
    }
    await stopChrome();
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chrome can still be releasing the profile directory.
    }
    process.exit(exitCode);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
