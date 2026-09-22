(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bg = document.getElementById('bg');
  const fx = document.getElementById('fx');
  const bctx = bg.getContext('2d');
  const fctx = fx.getContext('2d');
  const intro = document.getElementById('intro');
  const scene = document.getElementById('scene');
  const final = document.getElementById('final');
  const heroTitle = document.getElementById('heroTitle');
  const counterEl = document.getElementById('counter');
  const toasts = document.getElementById('toasts');

  let W = 0, H = 0, DPR = 1;
  let sent = 0;
  let started = false;
  let confettiOn = 0;
  let audioCtx = null;
  let masterGain = null;

  const GOLDS = [
    '#ffd668', '#ffd700', '#ffc94d', '#ffe08a', '#ffb84d',
    '#ffdda0', '#ffe9b0', '#f7c948', '#fff3b0', '#ffde6b'
  ];

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    for (const c of [bg, fx]) {
      c.width = W * DPR;
      c.height = H * DPR;
    }
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- Audio (volumen bajo) ---------------- */
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5];

  function ensureAudio() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.22;
    masterGain.connect(audioCtx.destination);
  }

  function bell(freq, when, dur = 1.6, vol = 1) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const g2 = audioCtx.createGain();
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.01;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.32 * vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.exponentialRampToValueAtTime(0.12 * vol, t0 + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.6);
    osc.connect(g);
    osc2.connect(g2);
    g.connect(lp);
    g2.connect(lp);
    lp.connect(masterGain);
    osc.start(t0);
    osc2.start(t0);
    osc.stop(t0 + dur + 0.1);
    osc2.stop(t0 + dur * 0.7);
  }

  function playBloomNote() {
    bell(pick(PENTA), 0, 1.4, rand(0.5, 0.9));
  }

  function playShower() {
    const base = [523.25, 659.25, 783.99];
    base.forEach((f, i) => bell(f, i * 0.12, 2.2, 0.9));
    for (let i = 0; i < 5; i++) bell(pick(PENTA), 0.4 + i * 0.18, 1.8, 0.5);
  }

  function playReveal() {
    [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1318.5, 1568.0]
      .forEach((f, i) => bell(f, i * 0.14, 3, 0.85));
  }

  /* ---------------- Ambient pétalos ---------------- */
  const petals = [];

  function drawPetal(ctx, size, rot, color, alpha) {
    ctx.save();
    ctx.translate(0, 0);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-size * 0.42, -size * 0.18, -size * 0.5, -size * 0.82, 0, -size);
    ctx.bezierCurveTo(size * 0.5, -size * 0.82, size * 0.42, -size * 0.18, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function spawnPetal(heavy = false) {
    const size = rand(6, heavy ? 18 : 13);
    const fromTop = Math.random() < 0.75;
    petals.push({
      x: rand(-20, W + 20),
      y: fromTop ? rand(-H * 0.3, -10) : rand(0, H),
      size,
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.03, 0.03),
      vx: rand(0.2, 0.7) * (Math.random() < 0.5 ? -1 : 1),
      vy: rand(0.85, 1.7),
      sway: rand(0.2, 0.9),
      phase: rand(0, Math.PI * 2),
      color: pick(GOLDS),
      alpha: rand(0.45, 0.95)
    });
  }

  function initPetals() {
    const target = reduceMotion ? 30 : clamp(Math.round((W * H) / 16000), 40, 130);
    for (let i = 0; i < target; i++) spawnPetal();
  }
  initPetals();

  function stepPetals(t) {
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      const wind = Math.sin(t * 0.0005 + p.phase) * p.sway * 1.3;
      p.x += p.vx + wind;
      p.y += p.vy;
      p.rot += p.vr * 0.6;
      if (p.y > H + 30 || p.x < -60 || p.x > W + 60) {
        petals[i] = {
          x: rand(-20, W + 20),
          y: rand(-H * 0.3, -14),
          size: rand(6, 13),
          rot: rand(0, Math.PI * 2),
          vr: rand(-0.03, 0.03),
          vx: rand(0.2, 0.7) * (Math.random() < 0.5 ? -1 : 1),
          vy: rand(0.85, 1.7),
          sway: rand(0.2, 0.9),
          phase: rand(0, Math.PI * 2),
          color: pick(GOLDS),
          alpha: rand(0.45, 0.95)
        };
      }
    }
  }

  function drawPetals() {
    for (const p of petals) {
      bctx.save();
      bctx.translate(p.x, p.y);
      bctx.rotate(p.rot);
      bctx.fillStyle = p.color;
      bctx.globalAlpha = p.alpha;
      bctx.beginPath();
      bctx.moveTo(0, 0);
      bctx.bezierCurveTo(-p.size * 0.42, -p.size * 0.18, -p.size * 0.5, -p.size * 0.82, 0, -p.size);
      bctx.bezierCurveTo(p.size * 0.5, -p.size * 0.82, p.size * 0.42, -p.size * 0.18, 0, 0);
      bctx.closePath();
      bctx.fill();
      bctx.restore();
    }
  }

  /* ---------------- FX: blooms y partículas ---------------- */
  const fxParts = [];
  const blooms = [];
  const TOAST_WORDS = ['Te amo', 'Eres mi sol', 'Eres única', 'Te quiero', 'Mi princesa', 'Siempre juntos'];

  function bloom(x, y) {
    blooms.push({ x, y, t: 0, life: reduceMotion ? 0.001 : 0.6 });
  }

  function drawBloom(b) {
    const p = clamp(b.t / b.life, 0, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const r = 6 + ease * 58;
    const petals = 9 + Math.round(ease * 4);
    fctx.save();
    fctx.translate(b.x, b.y);
    const glow = fctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.4);
    glow.addColorStop(0, 'rgba(255, 214, 104, 0.65)');
    glow.addColorStop(1, 'rgba(255, 214, 104, 0)');
    fctx.fillStyle = glow;
    fctx.beginPath();
    fctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
    fctx.fill();
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      const pr = r * ease;
      const s = 10 + ease * 22;
      fctx.save();
      fctx.translate(Math.cos(a) * pr * 0.55, Math.sin(a) * pr * 0.55);
      drawPetal(fctx, s, a + b.t * 0.5, pick(GOLDS), 0.95);
      fctx.restore();
    }
    fctx.fillStyle = 'rgba(255, 243, 176, 0.95)';
    fctx.beginPath();
    fctx.arc(0, 0, 7 + ease * 10, 0, Math.PI * 2);
    fctx.fill();
    fctx.restore();
  }

  function spark(x, y, kind) {
    const ang = rand(0, Math.PI * 2);
    const spd = rand(1.5, kind === 'petal' ? 6 : 7.5);
    fxParts.push({
      kind,
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - (kind === 'heart' ? 1.5 : 0.6),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.18, 0.18),
      size: rand(kind === 'petal' ? 5 : 2.5, kind === 'petal' ? 12 : 5),
      t: 0,
      life: rand(0.9, 1.7),
      color: kind === 'heart' ? ['#ff5d7e', '#ff8aa0', '#e8144e'] : GOLDS
    });
  }

  function burst(x, y, count = 26) {
    for (let i = 0; i < count; i++) spark(x, y, Math.random() < 0.7 ? 'petal' : 'spark');
    if (Math.random() < 0.5) spark(x, y, 'heart');
  }

  function drawFxParts(i) {
    const pt = fxParts[i];
    const a = 1 - pt.t / pt.life;
    if (pt.kind === 'petal') {
      fctx.save();
      fctx.translate(pt.x, pt.y);
      fctx.rotate(pt.rot);
      fctx.fillStyle = Array.isArray(pt.color) ? pick(pt.color) : pt.color;
      fctx.globalAlpha = clamp(a * 1.4, 0, 1);
      fctx.beginPath();
      fctx.moveTo(0, 0);
      fctx.bezierCurveTo(-pt.size * 0.42, -pt.size * 0.18, -pt.size * 0.5, -pt.size * 0.82, 0, -pt.size);
      fctx.bezierCurveTo(pt.size * 0.5, -pt.size * 0.82, pt.size * 0.42, -pt.size * 0.18, 0, 0);
      fctx.closePath();
      fctx.fill();
      fctx.restore();
    } else {
      fctx.save();
      fctx.globalAlpha = a;
      fctx.fillStyle = Array.isArray(pt.color) ? pick(pt.color) : pt.color;
      fctx.shadowColor = pt.color;
      fctx.shadowBlur = 14;
      fctx.translate(pt.x, pt.y);
      fctx.rotate(pt.rot);
      fctx.scale(pt.size, pt.size);
      if (pt.kind === 'heart') {
        fctx.beginPath();
        fctx.moveTo(0, 0.3);
        fctx.bezierCurveTo(0, 0.05, -0.5, -0.1, 0, -0.35);
        fctx.bezierCurveTo(0.5, -0.1, 0, 0.05, 0, 0.3);
        fctx.fill();
      } else {
        fctx.beginPath();
        fctx.arc(0, 0, 1, 0, Math.PI * 2);
        fctx.fill();
      }
      fctx.restore();
    }
  }

  function stepFx(dt) {
    for (let i = fxParts.length - 1; i >= 0; i--) {
      const pt = fxParts[i];
      pt.t += dt;
      if (pt.t >= pt.life) {
        fxParts.splice(i, 1);
        continue;
      }
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.045;
      pt.rot += pt.vr;
      drawFxParts(i);
    }
    for (let i = blooms.length - 1; i >= 0; i--) {
      const b = blooms[i];
      b.t += dt;
      if (b.life > 0.001 && b.t < b.life) {
        drawBloom(b);
      } else {
        burst(b.x, b.y, sent % 5 === 0 ? 40 : 26);
        blooms.splice(i, 1);
      }
    }
  }

  /* ---------------- Toasts ---------------- */
  function toast(text, cls = 'toast-heart') {
    const el = document.createElement('span');
    el.className = cls;
    el.textContent = text;
    el.style.left = rand(8, 82) + '%';
    el.style.bottom = '18vh';
    el.style.setProperty('--sway', rand(-60, 60) + 'px');
    el.style.setProperty('--spin', rand(-12, 12) + 'deg');
    toasts.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 4000);
  }

  /* ---------------- Acciones ---------------- */
  function sendFlower(x, y) {
    sent++;
    counterEl.textContent = sent;
    bloom(x, y);
    playBloomNote();
    if (sent % 4 === 0) toast(pick(TOAST_WORDS), 'toast-word');
    if (sent !== 0 && sent % 8 === 0) toast('❤');
    if (!reduceMotion && Math.random() < 0.4) toast('💛');
    if (sent >= 10) reveal();
  }

  function shower() {
    playShower();
    toast('¡Para la más linda! 💛', 'toast-word');
    confettiOn = 40;
    const n = reduceMotion ? 8 : 26;
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        bloom(rand(W * 0.08, W * 0.92), rand(H * 0.12, H * 0.6));
      }, i * 110);
    }
    setTimeout(() => {
      burst(W / 2, H / 2, 60);
    }, n * 110 + 80);
  }

  function reveal() {
    if (!final.classList.contains('hidden')) return;
    playReveal();
    final.classList.remove('hidden');
    for (let i = 0; i < 6; i++) {
      setTimeout(() => bloom(rand(W * 0.15, W * 0.85), rand(H * 0.2, H * 0.7)), i * 200);
    }
  }

  function closeFinal() {
    final.classList.add('hidden');
  }

  /* ---------------- Intro / título ---------------- */
  const TITLE_TEXT = 'Para María Isabel';
  function buildTitle() {
    heroTitle.innerHTML = '';
    [...TITLE_TEXT].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'letter';
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      s.style.animationDelay = (i * 0.05 + 0.1) + 's';
      heroTitle.appendChild(s);
    });
  }

  function start() {
    ensureAudio();
    intro.classList.add('leaving');
    scene.classList.remove('hidden');
    scene.classList.add('stage-in');
    buildTitle();
    setTimeout(() => {
      intro.style.display = 'none';
    }, 1300);
    setTimeout(() => shower(), 1200);
    started = true;
  }

  /* ---------------- Main loop ---------------- */
  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (confettiOn > 0) {
      for (let i = 0; i < 2; i++) spawnPetal(true);
      confettiOn--;
    }
    if (Math.random() < 0.25 || petals.length < 30) spawnPetal();
    stepPetals(now);
    bctx.clearRect(0, 0, W, H);
    drawPetals();
    fctx.clearRect(0, 0, W, H);
    stepFx(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------------- Interacción ---------------- */
  document.getElementById('startBtn').addEventListener('pointerdown', e => {
    e.preventDefault();
    start();
  });

  window.addEventListener('pointerdown', e => {
    if (!started) return;
    const x = e.clientX, y = e.clientY;
    sendFlower(x, y);
  }, { passive: true });

  document.getElementById('showerBtn').addEventListener('pointerdown', e => {
    e.stopPropagation();
    shower();
  });

  document.getElementById('heartBtn').addEventListener('pointerdown', e => {
    e.stopPropagation();
    reveal();
  });

  document.getElementById('againBtn').addEventListener('pointerdown', e => {
    e.stopPropagation();
    closeFinal();
  });
})();