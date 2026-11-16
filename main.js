(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const da = document.documentElement.lang === "da";
  const tr = (en, dk) => (da ? dk : en);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs = {}) => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  /* ---------- Year ---------- */
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Header: compact brand on scroll, dark over dark heroes ---------- */
  const header = $(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("compact", window.scrollY > 140);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const darkHero = $("[data-header-dark]");
  if (darkHero && header) {
    // dark header while the dark hero sits directly under it
    const syncDark = () => {
      const r = darkHero.getBoundingClientRect();
      const line = header.offsetHeight + 1;
      header.classList.toggle("on-dark", r.top <= line && r.bottom > line);
    };
    syncDark();
    window.addEventListener("scroll", syncDark, { passive: true });
    window.addEventListener("resize", syncDark);
  }

  /* ---------- Mobile menu ---------- */
  const menuBtn = $(".menu-btn");
  const menu = $("#mobile-menu");
  const setMenu = (open) => {
    if (!menuBtn || !menu) return;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? tr("Close menu", "Luk menu") : tr("Open menu", "Åbn menu"));
    menu.hidden = !open;
  };
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", () => setMenu(menu.hidden));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
    window.matchMedia("(min-width: 961px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });
  }

  /* ---------- Services dropdown ---------- */
  const ddBtn = $(".dd-btn");
  const ddPanel = ddBtn && document.getElementById(ddBtn.getAttribute("aria-controls"));
  const setDd = (open) => {
    if (!ddBtn) return;
    ddBtn.setAttribute("aria-expanded", String(open));
    ddPanel.hidden = !open;
  };
  if (ddBtn) {
    ddBtn.addEventListener("click", () => setDd(ddPanel.hidden));
    ddPanel.addEventListener("click", (e) => { if (e.target.closest("a")) setDd(false); });
    document.addEventListener("click", (e) => { if (!e.target.closest(".dd")) setDd(false); });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (ddBtn && !ddPanel.hidden) { setDd(false); ddBtn.focus(); }
    setMenu(false);
  });

  /* ---------- Hero collage: clock ticks ---------- */
  const ticks = $("#m-ticks");
  if (ticks && !ticks.childElementCount) {
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, major = i % 5 === 0;
      const r1 = major ? 112 : 122, r2 = 130;
      ticks.append(svgEl("line", {
        x1: 200 + Math.sin(a) * r1, y1: 200 - Math.cos(a) * r1,
        x2: 200 + Math.sin(a) * r2, y2: 200 - Math.cos(a) * r2,
        "stroke-width": major ? 3 : 1.2,
      }));
    }
  }

  /* ---------- Article hero clock: ticks around the origin ---------- */
  const heroTicks = $("#eh-ticks");
  if (heroTicks && !heroTicks.childElementCount) {
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, major = i % 5 === 0;
      const r1 = major ? 210 : 228, r2 = 240;
      heroTicks.append(svgEl("line", {
        x1: Math.sin(a) * r1, y1: -Math.cos(a) * r1,
        x2: Math.sin(a) * r2, y2: -Math.cos(a) * r2,
        "stroke-width": major ? 3.5 : 1.5,
      }));
    }
  }

  /* ---------- Pool: an aerial view of swimming lanes ---------- */
  const POOL = {
    day: {
      lanes: 3,
      deep: "#1d5258", mid: "#29696f", shallow: "#3f8c8e",
      sun: "rgba(214, 246, 236, .16)",
      grout: "rgba(230, 250, 245, .07)",
      stripe: "rgba(10, 36, 44, .34)",
      light: [226, 248, 240],
      caustic: 0.3,
      ring: "230, 250, 245",
      ropes: ["#D97757", "#F4F1EA"],
      floatAlpha: 1,
      glints: 0.55,
      lamps: false,
      swimmer: true,
    },
    night: {
      lanes: 4,
      deep: "#081719", mid: "#0d2327", shallow: "#143338",
      sun: "rgba(150, 214, 206, .05)",
      grout: "rgba(180, 230, 225, .035)",
      stripe: "rgba(0, 6, 8, .45)",
      light: [150, 210, 204],
      caustic: 0.12,
      ring: "170, 226, 220",
      ropes: ["#A85A3A", "#B9B5AA"],
      floatAlpha: 0.7,
      glints: 0.18,
      lamps: true,
      swimmer: false,
    },
  };

  const RIPPLE_LIFE = 1.6;   // seconds
  const RIPPLE_SPEED = 120;  // px per second
  const RIPPLE_MAX = 120;

  // Swimmer colours
  const SKIN = "#CF9873", SKIN_SHADE = "#B27D5C", CAP = "#D97757", SUIT = "#1F2C37";

  const initPool = (canvas) => {
    const ds = canvas.dataset;
    const pal = { ...(POOL[ds.variant] || POOL.day) };
    if (ds.lanes) pal.lanes = Math.max(1, parseInt(ds.lanes, 10));
    if (ds.swimmer) pal.swimmer = ds.swimmer === "true";
    const ctx = canvas.getContext("2d");
    const host = canvas.parentElement;
    const toggle = $(".pool-toggle", host);
    const off = document.createElement("canvas");
    const octx = off.getContext("2d");
    let w = 0, h = 0, dpr = 1, img = null, sprites = [], glints = [];
    let pad = 0, laneH = 0;
    const ripples = [];

    // swimmer state: x position, direction, stroke phase, turn progress
    const sw = { x: 0, dir: 1, phase: 0, turn: -1, placed: false };

    const makeSprites = (d) => {
      const L = d * 1.25;
      sprites = pal.ropes.map((col) => {
        const c = document.createElement("canvas");
        c.width = Math.ceil(L * dpr); c.height = Math.ceil(d * dpr);
        const x = c.getContext("2d");
        x.scale(dpr, dpr);
        x.beginPath();
        if (x.roundRect) x.roundRect(0, 0, L, d, d / 2); else x.rect(0, 0, L, d);
        x.fillStyle = col;
        x.fill();
        const g = x.createLinearGradient(0, 0, 0, d);
        g.addColorStop(0, "rgba(255,255,255,.55)");
        g.addColorStop(0.35, "rgba(255,255,255,.08)");
        g.addColorStop(0.7, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,.28)");
        x.fillStyle = g;
        x.fill();
        x.strokeStyle = "rgba(0,0,0,.18)";
        x.lineWidth = 0.75;
        x.stroke();
        return { c, L, d };
      });
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      off.width = 260;
      off.height = Math.max(70, Math.round((260 * h) / Math.max(w, 1)));
      img = octx.createImageData(off.width, off.height);
      const d = Math.min(15, Math.max(8, (h / pal.lanes) * 0.055));
      makeSprites(d);
      pad = Math.round(d * 1.6);
      laneH = (h - pad * 2) / pal.lanes;
      glints = Array.from({ length: Math.round((w * h) / 9000) }, () => ({
        x: Math.random() * w, y: Math.random() * h, p: Math.random() * 6.28, s: 0.6 + Math.random() * 1.4,
      }));
      if (!sw.placed) { sw.x = w * 0.28; sw.placed = true; }
    };

    const liveRipples = (now) => {
      while (ripples.length && now - ripples[0].t0 > RIPPLE_LIFE) ripples.shift();
      return ripples.map((rp) => {
        const age = now - rp.t0;
        return { x: rp.x, y: rp.y, age, fade: (1 - age / RIPPLE_LIFE) * rp.s, rad: age * RIPPLE_SPEED * (rp.big ? 1.4 : 1) };
      });
    };

    // Light on the floor; only the newest few ripples bend it, to keep it smooth
    const caustics = (t, rips) => {
      const cw = off.width, ch = off.height, d = img.data;
      const unit = 21;
      const sx = w / unit / cw, sy = h / unit / ch;
      const px = w / cw, py = h / ch;
      const [r, g, b] = pal.light;
      const bend = rips.slice(-3);
      let p = 0;
      for (let j = 0; j < ch; j++) {
        const y = j * sy, Y = j * py;
        for (let i = 0; i < cw; i++) {
          const x = i * sx;
          const wx = x + 0.6 * Math.sin(y * 0.9 + t * 0.5);
          const wy = y + 0.6 * Math.sin(x * 0.8 - t * 0.4);
          let v = Math.sin(wx * 1.6 + t * 0.8) + Math.sin(wy * 1.7 - t * 0.6) + Math.sin((wx - wy) * 1.1 + t * 0.3);
          for (let k = 0; k < bend.length; k++) {
            const rp = bend[k];
            const dx = i * px - rp.x, dy = Y - rp.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const band = dist - rp.rad;
            if (band > 50 || band < -110) continue;
            v += 1.1 * rp.fade * Math.exp(-Math.abs(band) / 40) * Math.sin(dist * 0.09 - rp.age * 9);
          }
          const c = Math.max(0, 1 - Math.abs(v) / 0.55);
          const patch = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(x * 0.21 + t * 0.12) * Math.sin(y * 0.27 - t * 0.09));
          d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = c * c * patch * 255 * pal.caustic;
          p += 4;
        }
      }
      octx.putImageData(img, 0, 0);
    };

    const lift = (x, y, rips) => {
      let s = 0;
      for (let k = 0; k < rips.length; k++) {
        const rp = rips[k];
        const dx = x - rp.x, dy = y - rp.y;
        if (dx > rp.rad + 40 || dx < -rp.rad - 40 || dy > rp.rad + 40 || dy < -rp.rad - 40) continue;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const band = dist - rp.rad;
        if (band > 40 || band < -80) continue;
        s += rp.fade * Math.exp(-Math.abs(band) / 30) * Math.sin(dist * 0.09 - rp.age * 9);
      }
      return s;
    };

    /* ---- the swimmer, drawn in metres with x pointing forward ---- */
    const armPos = (p, side) => {
      if (p < 0.55) { // pull, under water
        const u = p / 0.55;
        return { x: 0.74 - 1.22 * u, y: side * (0.2 - 0.09 * Math.sin(Math.PI * u)), under: true };
      }
      const u = (p - 0.55) / 0.45; // recovery, over the water
      return { x: -0.48 + 1.22 * u, y: side * (0.19 + 0.2 * Math.sin(Math.PI * u)), under: false };
    };

    const drawArm = (p, side, sh, alpha) => {
      const a = armPos(p, side);
      const ex = (0 + a.x) / 2 + (a.under ? 0 : -0.05);
      const ey = (side * sh + a.y) / 2 + side * (a.under ? 0.03 : 0.1);
      ctx.globalAlpha = alpha * (a.under ? 0.55 : 1);
      ctx.strokeStyle = a.under ? SKIN_SHADE : SKIN;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 0.095;
      ctx.beginPath(); ctx.moveTo(0, side * sh); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.lineWidth = 0.075;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(a.x, a.y); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.ellipse(a.x + 0.03, a.y, 0.065, 0.045, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha;
    };

    const drawBody = (t, alpha) => {
      const roll = Math.sin(sw.phase * Math.PI * 2);
      const sh = 0.215 * (1 - 0.14 * Math.abs(roll));          // shoulder half-width shrinks as she rolls
      const pL = sw.phase % 1, pR = (sw.phase + 0.5) % 1;

      ctx.globalAlpha = alpha;
      // arms under water go first, under the body
      if (armPos(pL, -1).under) drawArm(pL, -1, sh, alpha);
      if (armPos(pR, 1).under) drawArm(pR, 1, sh, alpha);

      // legs, a little deeper so a little fainter
      ctx.globalAlpha = alpha * 0.82;
      ctx.strokeStyle = SKIN_SHADE;
      ctx.lineCap = "round";
      [-1, 1].forEach((side) => {
        const kick = Math.sin(t * 13 + (side > 0 ? 0 : Math.PI)) * 0.018;
        ctx.lineWidth = 0.13;
        ctx.beginPath(); ctx.moveTo(-0.6, side * 0.085); ctx.lineTo(-1.0, side * 0.075 + kick); ctx.stroke();
        ctx.lineWidth = 0.085;
        ctx.beginPath(); ctx.moveTo(-1.0, side * 0.075 + kick); ctx.lineTo(-1.38, side * 0.07 + kick * 1.8); ctx.stroke();
        ctx.fillStyle = SKIN_SHADE;
        ctx.beginPath(); ctx.ellipse(-1.45, side * 0.07 + kick * 2, 0.075, 0.04, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = alpha;

      // torso
      ctx.fillStyle = SKIN;
      ctx.beginPath();
      ctx.moveTo(0.07, 0);
      ctx.quadraticCurveTo(0.06, sh * 0.5, 0.0, sh);
      ctx.quadraticCurveTo(-0.14, sh * 0.98, -0.2, sh * 0.82);
      ctx.quadraticCurveTo(-0.36, 0.13, -0.42, 0.135);
      ctx.quadraticCurveTo(-0.56, 0.17, -0.66, 0.1);
      ctx.lineTo(-0.66, -0.1);
      ctx.quadraticCurveTo(-0.56, -0.17, -0.42, -0.135);
      ctx.quadraticCurveTo(-0.36, -0.13, -0.2, -sh * 0.82);
      ctx.quadraticCurveTo(-0.14, -sh * 0.98, 0.0, -sh);
      ctx.quadraticCurveTo(0.06, -sh * 0.5, 0.07, 0);
      ctx.fill();

      // one-piece swimsuit with a racer back
      ctx.fillStyle = SUIT;
      ctx.beginPath();
      ctx.moveTo(-0.03, 0.05);
      ctx.quadraticCurveTo(-0.12, sh * 0.62, -0.21, sh * 0.78);
      ctx.quadraticCurveTo(-0.36, 0.135, -0.42, 0.14);
      ctx.quadraticCurveTo(-0.56, 0.175, -0.68, 0.08);
      ctx.lineTo(-0.68, -0.08);
      ctx.quadraticCurveTo(-0.56, -0.175, -0.42, -0.14);
      ctx.quadraticCurveTo(-0.36, -0.135, -0.21, -sh * 0.78);
      ctx.quadraticCurveTo(-0.12, -sh * 0.62, -0.03, -0.05);
      ctx.closePath();
      ctx.fill();
      // light along the spine
      ctx.strokeStyle = "rgba(255,255,255,.12)";
      ctx.lineWidth = 0.03;
      ctx.beginPath(); ctx.moveTo(-0.08, 0); ctx.lineTo(-0.6, 0); ctx.stroke();

      // head with swim cap; turns a little with the roll
      const hy = roll * 0.02;
      ctx.fillStyle = SKIN_SHADE;
      ctx.beginPath(); ctx.ellipse(0.12, hy * 0.5, 0.06, 0.065, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = CAP;
      ctx.beginPath(); ctx.ellipse(0.21, hy, 0.125, 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.28)";
      ctx.beginPath(); ctx.ellipse(0.25, hy - 0.03, 0.05, 0.025, 0, 0, Math.PI * 2); ctx.fill();

      // arms over the water go last, on top
      if (!armPos(pL, -1).under) drawArm(pL, -1, sh, alpha);
      if (!armPos(pR, 1).under) drawArm(pR, 1, sh, alpha);
    };

    const swimmerFrame = () => {
      const s = laneH / 2.3;                       // px per metre, roughly a 2.3 m lane
      // she keeps to the lower side of the lane, like a real swimmer, clear of the text
      const yc = pad + Math.floor(pal.lanes / 2) * laneH + laneH * 0.74;
      return { s, yc };
    };

    const drawSwimmerShadow = () => {
      const { s, yc } = swimmerFrame();
      const fade = sw.turn >= 0 ? 1 - Math.sin(Math.PI * Math.min(1, sw.turn / 0.9)) * 0.7 : 1;
      ctx.save();
      ctx.translate(sw.x - 0.25 * s, yc + 0.32 * s);
      ctx.scale(s, s);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `rgba(4, 20, 24, ${0.24 * fade})`);
      g.addColorStop(1, "rgba(4, 20, 24, 0)");
      ctx.fillStyle = g;
      ctx.translate(-0.4 * sw.dir, 0);
      ctx.scale(1.25, 0.32);
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const drawSwimmer = (t) => {
      const { s, yc } = swimmerFrame();
      // dips under at the wall while she turns
      const alpha = sw.turn >= 0 ? 1 - Math.sin(Math.PI * Math.min(1, sw.turn / 0.9)) * 0.92 : 1;
      ctx.save();
      ctx.translate(sw.x, yc);
      ctx.scale(sw.dir * s, s);

      // wake: a soft V behind the head, and foam at the feet
      if (alpha > 0.2) {
        const wake = ctx.createLinearGradient(0.3, 0, -2.6, 0);
        wake.addColorStop(0, `rgba(240, 252, 248, ${0.28 * alpha})`);
        wake.addColorStop(1, "rgba(240, 252, 248, 0)");
        ctx.strokeStyle = wake;
        ctx.lineWidth = 0.035;
        ctx.beginPath();
        ctx.moveTo(-2.6, 0.75); ctx.quadraticCurveTo(-0.6, 0.38, 0.32, 0.1);
        ctx.moveTo(-2.6, -0.75); ctx.quadraticCurveTo(-0.6, -0.38, 0.32, -0.1);
        ctx.stroke();
        // bow wave in front of the head
        ctx.strokeStyle = `rgba(245, 253, 250, ${0.4 * alpha})`;
        ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.arc(0.2, 0, 0.2, -1.1, 1.1); ctx.stroke();
        // kick foam
        for (let k = 0; k < 7; k++) {
          const fx = -1.45 - 0.1 * k - 0.05 * Math.sin(t * 9 + k);
          const fy = Math.sin(t * 11 + k * 1.7) * 0.11;
          const fr = 0.05 + 0.03 * Math.sin(t * 13 + k);
          ctx.fillStyle = `rgba(245, 253, 250, ${(0.32 - k * 0.04) * alpha})`;
          ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
        }
      }

      drawBody(t, alpha);
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    const stepSwimmer = (dt, now) => {
      const { s, yc } = swimmerFrame();
      const before = sw.phase;
      if (sw.turn >= 0) {
        sw.turn += dt;
        sw.x += sw.dir * 0.4 * s * dt;
        if (sw.turn > 0.45 && !sw.flipped) {
          sw.dir *= -1; sw.flipped = true;
          ripples.push({ x: sw.x, y: yc, t0: now, s: 1.1, big: true });
        }
        if (sw.turn > 0.9) { sw.turn = -1; sw.flipped = false; }
        return;
      }
      sw.phase += dt / 1.35;                        // one full stroke cycle
      sw.x += sw.dir * 1.5 * s * dt;               // about 1.5 m per second
      const wallNear = sw.dir > 0 ? sw.x > w * 0.95 - 0.9 * s : sw.x < w * 0.05 + 0.9 * s;
      if (wallNear) { sw.turn = 0; return; }
      // a small splash each time a hand goes in
      [0, 0.5].forEach((o, i) => {
        if (Math.floor(before + o) !== Math.floor(sw.phase + o)) {
          const side = i === 0 ? -1 : 1;
          ripples.push({ x: sw.x + sw.dir * 0.74 * s, y: yc + side * 0.2 * s, t0: now, s: 0.45 });
        }
      });
    };

    const draw = (t, now) => {
      const rips = liveRipples(now);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      const water = ctx.createLinearGradient(0, h, w, 0);
      water.addColorStop(0, pal.deep);
      water.addColorStop(0.55, pal.mid);
      water.addColorStop(1, pal.shallow);
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, w, h);
      const sun = ctx.createRadialGradient(w * 0.78, h * 0.1, 0, w * 0.78, h * 0.1, Math.max(w, h) * 0.7);
      sun.addColorStop(0, pal.sun);
      sun.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, w, h);

      // floor tiles
      const T = Math.max(16, laneH / 12);
      const shiftX = Math.sin(t * 0.7) * 1.2, shiftY = Math.cos(t * 0.6) * 1.2;
      ctx.strokeStyle = pal.grout;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = (shiftX % T) - T; x < w + T; x += T) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = (shiftY % T) - T; y < h + T; y += T) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();

      if (pal.lamps) {
        for (let k = 0; k < pal.lanes; k++) {
          const yc = pad + (k + 0.5) * laneH;
          [0, w].forEach((x) => {
            const g = ctx.createRadialGradient(x, yc, 0, x, yc, laneH * 1.5);
            g.addColorStop(0, "rgba(160, 226, 220, .22)");
            g.addColorStop(1, "rgba(160, 226, 220, 0)");
            ctx.fillStyle = g;
            ctx.fillRect(x - laneH * 1.5, yc - laneH * 1.5, laneH * 3, laneH * 3);
          });
        }
      }

      // lane stripes
      ctx.strokeStyle = pal.stripe;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const x0 = w * 0.05, x1 = w * 0.95;
      for (let k = 0; k < pal.lanes; k++) {
        const yc = pad + (k + 0.5) * laneH;
        const wob = (x) => Math.sin(x * 0.009 + t * 0.9 + k * 1.7) * 2.2 + Math.sin(x * 0.023 - t * 1.3) * 1.1 + lift(x, yc, rips) * 5;
        ctx.lineWidth = Math.min(12, Math.max(5, laneH * 0.045));
        ctx.beginPath();
        ctx.moveTo(x0, yc + wob(x0));
        for (let x = x0 + 16; x < x1; x += 16) ctx.lineTo(x, yc + wob(x));
        ctx.lineTo(x1, yc + wob(x1));
        [x0, x1].forEach((x) => { ctx.moveTo(x, yc - laneH * 0.14 + wob(x)); ctx.lineTo(x, yc + laneH * 0.14 + wob(x)); });
        ctx.stroke();
      }

      if (pal.swimmer) drawSwimmerShadow();

      caustics(t, rips);
      ctx.globalCompositeOperation = "screen";
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";

      // ripple rings
      rips.forEach((rp) => {
        if (rp.rad < 2 || rp.fade <= 0) return;
        ctx.lineWidth = 5;
        ctx.strokeStyle = `rgba(${pal.ring}, ${0.08 * rp.fade})`;
        ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.rad, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = `rgba(${pal.ring}, ${0.15 * rp.fade})`;
        ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.rad, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 4;
        ctx.strokeStyle = `rgba(3, 18, 22, ${0.09 * rp.fade})`;
        ctx.beginPath(); ctx.arc(rp.x, rp.y, Math.max(0, rp.rad - 6), 0, Math.PI * 2); ctx.stroke();
      });

      if (pal.swimmer) drawSwimmer(t);

      // lane ropes
      const { L, d } = sprites[0];
      const gap = Math.max(1, d * 0.1), step = L + gap;
      for (let r = 0; r <= pal.lanes; r++) {
        const y = pad + r * laneH;
        const sy = y + d * 1.8;
        const sh = ctx.createLinearGradient(0, sy - d, 0, sy + d * 1.4);
        sh.addColorStop(0, "rgba(4, 22, 26, 0)");
        sh.addColorStop(0.45, "rgba(4, 22, 26, .22)");
        sh.addColorStop(1, "rgba(4, 22, 26, 0)");
        ctx.fillStyle = sh;
        ctx.fillRect(0, sy - d, w, d * 2.4);

        const n = Math.ceil(w / step) + 2;
        const shift = (r * 13) % step;
        ctx.globalAlpha = pal.floatAlpha;
        for (let k = 0; k < n; k++) {
          const x = k * step - shift;
          const bob = Math.sin(k * 0.45 + t * 1.6 + r * 1.3) * d * 0.07 + lift(x, y, rips) * d * 0.45;
          const near = k < 6 || k > n - 8;
          const s = sprites[near ? 0 : Math.floor(k / 6) % 2];
          ctx.drawImage(s.c, x, y - d / 2 + bob, L, d);
        }
        ctx.globalAlpha = 1;
      }

      if (pal.glints) {
        ctx.fillStyle = "#ffffff";
        glints.forEach((g) => {
          const a = Math.pow(Math.max(0, Math.sin(t * 2.2 * g.s + g.p)), 12) * pal.glints;
          if (a < 0.02) return;
          ctx.globalAlpha = a;
          ctx.fillRect(g.x, g.y, 2.2 * g.s, 1);
        });
        ctx.globalAlpha = 1;
      }

      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
      v.addColorStop(0, "rgba(3, 14, 16, 0)");
      v.addColorStop(1, "rgba(3, 14, 16, .42)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    };

    // The cursor leaves a trail of small ripples: at most one per frame, never cut short
    let pointer = null, lastDrop = null;
    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const dropTrail = (now) => {
      if (!pointer || pointer.x < 0 || pointer.y < 0 || pointer.x > w || pointer.y > h) return;
      if (lastDrop && Math.hypot(pointer.x - lastDrop.x, pointer.y - lastDrop.y) < 22) return;
      ripples.push({ x: pointer.x, y: pointer.y, t0: now, s: 0.5 });
      lastDrop = { x: pointer.x, y: pointer.y };
      while (ripples.length > RIPPLE_MAX) ripples.shift();
    };
    if (!reduceMotion) {
      host.addEventListener("pointermove", (e) => { pointer = local(e); }, { passive: true });
      host.addEventListener("pointerleave", () => { pointer = null; lastDrop = null; });
      host.addEventListener("pointerdown", (e) => {
        const p = local(e);
        ripples.push({ x: p.x, y: p.y, t0: performance.now() / 1000, s: 1.1, big: true });
      }, { passive: true });
    }

    let t = 3, last = 0, raf = 0, visible = false, paused = reduceMotion;
    const clock = () => performance.now() / 1000;
    const frame = (nowMs) => {
      const dt = last ? Math.min(0.05, (nowMs - last) / 1000) : 0;
      last = nowMs;
      const now = nowMs / 1000;
      t += dt * 0.5;
      dropTrail(now);
      if (pal.swimmer) stepSwimmer(dt, now);
      draw(t, now);
      raf = visible && !paused ? requestAnimationFrame(frame) : 0;
    };
    const start = () => { if (!raf && visible && !paused) { last = 0; raf = requestAnimationFrame(frame); } };

    resize();
    sw.phase = 0.2;
    draw(t, clock());
    new ResizeObserver(() => { resize(); draw(t, clock()); }).observe(canvas);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(canvas);

    if (toggle) {
      const sync = () => {
        toggle.setAttribute("aria-pressed", String(paused));
        toggle.setAttribute("aria-label", paused ? tr("Play animation", "Afspil animation") : tr("Pause animation", "Sæt animation på pause"));
      };
      sync();
      toggle.addEventListener("click", () => { paused = !paused; sync(); start(); });
    }
  };
  $$("canvas.pool").forEach(initPool);

  /* ---------- Contact form ---------- */
  const form = $("#contact-form");
  if (form) {
    const status = $("#cf-status");
    const done = $("#cf-done");
    const button = $("button[type=submit]", form);
    const buttonLabel = button.innerHTML;
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const RULES = {
      name: (v) => (v.trim() ? "" : tr("Enter your name.", "Skriv dit navn.")),
      email: (v) => (!v.trim() ? tr("Enter your work email.", "Skriv din arbejdsmail.") : EMAIL.test(v.trim()) ? "" : tr("That email doesn't look right. Check it and try again.", "Mailadressen ser ikke rigtig ud. Tjek den, og prøv igen.")),
      message: (v) => (v.trim().length >= 10 ? "" : tr("Tell us a little about what you'd like to fix.", "Skriv lidt om, hvad I gerne vil have løst.")),
    };

    const showError = (field, msg) => {
      const el = form.elements[field];
      const err = document.getElementById(`cf-${field}-error`);
      el.setAttribute("aria-invalid", msg ? "true" : "false");
      if (err) err.textContent = msg;
    };

    Object.keys(RULES).forEach((field) => {
      const el = form.elements[field];
      el.addEventListener("input", () => { if (el.getAttribute("aria-invalid") === "true") showError(field, RULES[field](el.value)); });
      el.addEventListener("blur", () => { if (el.value) showError(field, RULES[field](el.value)); });
    });

    const setStatus = (html, isError) => {
      status.innerHTML = html;
      status.classList.toggle("is-error", !!isError);
    };

    const finish = (title, text) => {
      $("#cf-done-title").textContent = title;
      $("#cf-done-text").textContent = text;
      form.hidden = true;
      done.hidden = false;
      done.focus();
    };

    const values = () => ({
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      company: form.elements.company.value.trim(),
      team_size: form.elements.team_size.value,
      message: form.elements.message.value.trim(),
    });

    const openEmailApp = (data) => {
      const to = form.dataset.fallbackEmail;
      const subject = `${tr("Intro call", "Indledende opkald")}${data.company ? ` · ${data.company}` : ""}`;
      const lines = [data.message, "", `${tr("Name", "Navn")}: ${data.name}`, `Email: ${data.email}`];
      if (data.company) lines.push(`${tr("Company", "Virksomhed")}: ${data.company}`);
      if (data.team_size) lines.push(`${tr("People in sales", "Antal i salg")}: ${data.team_size}`);
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setStatus("");

      // validate, then focus the first problem
      let first = null;
      Object.keys(RULES).forEach((field) => {
        const msg = RULES[field](form.elements[field].value);
        showError(field, msg);
        if (msg && !first) first = form.elements[field];
      });
      if (first) { first.focus(); return; }

      // bots fill the hidden field; pretend it worked and stop
      if (form.elements.website.value) { finish(tr("Thanks, your message is on its way.", "Tak, din besked er på vej."), tr("Danni will get back to you to set up a short call.", "Danni vender tilbage for at aftale et kort opkald.")); return; }

      const data = values();
      const endpoint = form.dataset.endpoint.trim();

      if (!endpoint) {
        openEmailApp(data);
        finish(tr("Your email app should open now.", "Dit mailprogram åbner nu."), tr(`The message is written for you. Just press send. If nothing opened, email ${form.dataset.fallbackEmail} directly.`, `Beskeden er skrevet for dig. Du skal bare trykke send. Skete der ikke noget, så skriv direkte til ${form.dataset.fallbackEmail}.`));
        return;
      }

      button.disabled = true;
      button.textContent = tr("Sending…", "Sender…");
      try {
        const payload = { ...data, subject: `${tr("New enquiry from", "Ny henvendelse fra")} ${data.name}${data.company ? `, ${data.company}` : ""}` };
        if (form.dataset.accessKey) payload.access_key = form.dataset.accessKey;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        form.reset();
        finish(tr("Thanks, your message is on its way.", "Tak, din besked er på vej."), tr("Danni will get back to you to set up a short call.", "Danni vender tilbage for at aftale et kort opkald."));
      } catch (err) {
        setStatus(tr("Your message couldn't be sent. Try again, or email", "Beskeden kunne ikke sendes. Prøv igen, eller skriv til") + ` <a href="mailto:${form.dataset.fallbackEmail}">${form.dataset.fallbackEmail}</a>.`, true);
      } finally {
        button.disabled = false;
        button.innerHTML = buttonLabel;
      }
    });
  }

  /* ---------- Article: highlight the current section ---------- */
  const sideLinks = $$(".side-toc a");
  if (sideLinks.length) {
    const byId = new Map(sideLinks.map((a) => [a.hash.slice(1), a]));
    const setActive = (id) => sideLinks.forEach((a) => a.classList.toggle("is-active", a === byId.get(id)));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: "-25% 0px -65% 0px" });
    $$(".prose section[id]").forEach((s) => io.observe(s));
  }
})();
