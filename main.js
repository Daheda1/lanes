(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
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
        toggle.setAttribute("aria-label", paused ? "Play animation" : "Pause animation");
      };
      sync();
      toggle.addEventListener("click", () => { paused = !paused; sync(); start(); });
    }
  };
  $$("canvas.pool").forEach(initPool);

  /* ---------- Examples: each step in its lane, run one by one ---------- */
  const list = $("#lane-steps");
  if (list) {
    // [kind, lane, text]
    const LANES = {
      inbound: {
        note: "Research and routing used to sit in the sales lane. Now the system does them, and the rep still writes the reply, just not from a blank page.",
        steps: [
          ["trigger", "Customer", "A lead comes in"],
          ["auto", "System", "Company and contact enriched"],
          ["auto", "System", "Scored and routed to the right rep"],
          ["auto", "System", "Brief and draft reply sent to Slack"],
          ["human", "Sales", "Rep edits and sends"],
          ["auto", "System", "CRM updated, follow-up booked"],
        ],
      },
      meetings: {
        note: "Prep and notes move into the system lane. The one step left in the sales lane is the one that matters: the conversation.",
        steps: [
          ["trigger", "Customer", "A meeting is booked"],
          ["auto", "System", "Account history and news gathered"],
          ["auto", "System", "Briefing lands an hour before"],
          ["human", "Sales", "The conversation itself"],
          ["auto", "System", "Notes and next steps logged to CRM"],
          ["auto", "System", "Follow-up email drafted"],
        ],
      },
      proposals: {
        note: "AI reads and drafts, rules set the price, and the seller signs off. The price never depends on a language model's guess.",
        steps: [
          ["trigger", "Sales", "Discovery call ends"],
          ["auto", "System", "Scope pulled from the call notes"],
          ["auto", "System", "Price calculated from your rules"],
          ["auto", "System", "Proposal drafted in your template"],
          ["human", "Sales", "Seller reviews and approves"],
          ["auto", "System", "Sent, tracked, nudged when opened"],
        ],
      },
      pipeline: {
        note: "Clean-up moves out of everyone's Friday afternoon and into a nightly run, so forecast meetings are about deals instead of data.",
        steps: [
          ["trigger", "System", "Every night at 02:00"],
          ["auto", "System", "Stale and incomplete deals found"],
          ["auto", "System", "Owners get a one-click fix"],
          ["auto", "System", "Forecast summary sent to managers"],
          ["human", "Management", "Forecast meeting about the deals"],
        ],
      },
    };

    const tabs = $$('.lane-tabs [role="tab"]');
    const panel = $("#lane-panel");
    const note = $("#lane-note");
    const status = $("#run-status");
    const again = $("#run-again");
    let current = "inbound", token = 0, timer = 0, seen = false;

    const summary = (lane) => {
      const count = (k) => lane.steps.filter(([kind]) => kind === k).length;
      const lanes = new Set(lane.steps.map(([, l]) => l)).size;
      return `Complete · ${count("auto")} automated · ${count("human")} by a person · ${lanes} lanes`;
    };

    const render = (key) => {
      const lane = LANES[key];
      list.replaceChildren(...lane.steps.map(([kind, laneName, text], i) => {
        const li = document.createElement("li");
        li.dataset.kind = kind;
        li.innerHTML = `<span class="n">${i + 1}</span><span class="leader" aria-hidden="true"><i class="runner"></i></span><span class="t"></span><span class="k"></span>`;
        li.querySelector(".t").textContent = text;
        li.querySelector(".k").textContent = laneName;
        return li;
      }));
      note.textContent = lane.note;
      status.textContent = summary(lane);
    };

    const run = () => {
      const lane = LANES[current];
      const items = [...list.children];
      const my = ++token;
      clearTimeout(timer);
      if (reduceMotion) { panel.classList.remove("running"); status.textContent = summary(lane); return; }
      items.forEach((li) => li.classList.remove("active", "done"));
      panel.classList.add("running");
      let i = 0;
      const step = () => {
        if (my !== token) return;
        if (i > 0) items[i - 1].classList.replace("active", "done");
        if (i >= items.length) {
          panel.classList.remove("running");
          status.textContent = summary(lane);
          return;
        }
        const li = items[i];
        const dur = li.dataset.kind === "human" ? 1900 : li.dataset.kind === "trigger" ? 800 : 1000;
        li.style.setProperty("--dur", `${dur}ms`);
        li.classList.add("active");
        status.textContent = li.dataset.kind === "human"
          ? `Step ${i + 1} of ${items.length} · waiting for a person`
          : `Running · step ${i + 1} of ${items.length}`;
        i++;
        timer = setTimeout(step, dur);
      };
      step();
    };

    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
      });
      panel.setAttribute("aria-labelledby", tab.id);
      current = tab.dataset.lane;
      render(current);
      if (focus) tab.focus();
      if (seen) run();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (e) => {
        const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in map)) return;
        e.preventDefault();
        select(tabs[(map[e.key] + tabs.length) % tabs.length], true);
      });
    });
    again.addEventListener("click", run);
    if (reduceMotion) again.hidden = true;

    render(current);
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !seen) { seen = true; run(); }
    }, { threshold: 0.45 }).observe(list);
  }

  /* ---------- Sound familiar? Each problem opens into an as-is and a to-be swimlane ---------- */
  // step: [lane index, "line 1|line 2", kind]  kind: p = a person does it, w = manual work or waiting, a = automated
  const FAMILIAR = {
    quotes: {
      lanes: ["Customer", "Seller", "Pricing owner", "Systems"],
      asis: [[0, "Asks for|a quote", "p"], [1, "Emails the|pricing owner", "w"], [2, "Works out|the price", "w"], [1, "Waits, then|chases", "w"], [1, "Copies it|into Word", "w"], [0, "Gets the|quote", "p"]],
      tobe: [[0, "Asks for|a quote", "p"], [3, "Drafts quote|from call notes", "a"], [3, "Applies the|price rules", "a"], [1, "Checks|and sends", "p"], [0, "Gets the|quote", "p"]],
      empty: { tobe: { 2: "Only keeps the price rules up to date" } },
    },
    leads: {
      lanes: ["Customer", "Seller", "Systems"],
      asis: [[0, "Sends an|enquiry", "p"], [1, "Unread all|weekend", "w"], [1, "Looks up|the company", "w"], [1, "Decides who|should reply", "w"], [1, "Replies on|Monday", "p"]],
      tobe: [[0, "Sends an|enquiry", "p"], [2, "Looks up|the company", "a"], [2, "Routes to the|right seller", "a"], [1, "Replies the|same day", "p"]],
    },
    crm: {
      lanes: ["Seller", "Manager", "CRM"],
      asis: [[0, "Calls and|emails", "p"], [0, "Notes on|paper", "w"], [0, "Types it all|in on Friday", "w"], [2, "Up to date|once a week", "w"], [1, "Forecasts on|old numbers", "w"]],
      tobe: [[0, "Calls and|emails", "p"], [2, "Logged|automatically", "a"], [2, "Pipeline|always current", "a"], [1, "Forecasts on|live numbers", "p"]],
    },
    orders: {
      lanes: ["Customer", "Seller", "Back office", "ERP"],
      asis: [[0, "Emails an|order", "p"], [1, "Types it|into the CRM", "w"], [2, "Types it again|into the ERP", "w"], [2, "Fixes the|typos", "w"], [3, "Order|created", "p"], [0, "Gets a|confirmation", "p"]],
      tobe: [[0, "Emails an|order", "p"], [3, "Reads the|order", "a"], [3, "Proposes it|in the ERP", "a"], [2, "Approves with|one click", "p"], [0, "Gets a|confirmation", "p"]],
      empty: { tobe: { 1: "No longer types orders in" } },
    },
    research: {
      lanes: ["Seller", "Websites and CRM", "Systems"],
      asis: [[0, "Picks the|next account", "p"], [1, "Searches|the website", "w"], [1, "Checks|LinkedIn", "w"], [1, "Reads old|CRM notes", "w"], [0, "Writes their|own notes", "w"], [0, "Finally|calls", "p"]],
      tobe: [[2, "Builds a brief|overnight", "a"], [0, "Reads the|brief", "p"], [0, "Calls", "p"], [2, "Logs the|call", "a"]],
      empty: { tobe: { 1: "Searched for the seller, not by them" } },
    },
    knowledge: {
      lanes: ["Team", "Kim", "Systems"],
      asis: [[0, "Hits an|unusual case", "p"], [1, "Gets|interrupted again", "w"], [0, "Waits for|an answer", "w"], [1, "Explains it|again", "w"], [0, "Carries on", "p"]],
      tobe: [[0, "Hits an|unusual case", "p"], [2, "Shows the|written process", "a"], [0, "Carries on", "p"]],
      empty: { tobe: { 1: "Finally gets to do their own work" } },
    },
  };

  const LANE_STYLE = {
    asis: { bg: "#BCD1CA", line: "#141413", rule: "rgba(20,20,19,.28)", label: "#30302E", note: "rgba(20,20,19,.55)" },
    tobe: { bg: "#788C5D", line: "#FAF9F5", rule: "rgba(250,249,245,.38)", label: "#FAF9F5", note: "rgba(250,249,245,.75)" },
  };
  let laneUid = 0;

  const drawSwimlane = (ex, mode, cols) => {
    const st = LANE_STYLE[mode];
    const steps = ex[mode];
    const uid = ++laneUid;
    const W = 1000, labelW = 150, laneH = 66, top = 6;
    const H = top * 2 + ex.lanes.length * laneH;
    const colW = (W - labelW - 24) / cols;
    const bw = Math.min(132, colW - 30), bh = 40;
    const cx = (i) => labelW + 12 + i * colW + colW / 2;
    const cy = (l) => top + l * laneH + laneH / 2;

    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    const title = svgEl("title");
    title.textContent = `${mode === "asis" ? "As-is" : "To-be"}: ${steps.map((s) => s[1].replace("|", " ")).join(", then ")}`;
    svg.append(title);

    const defs = svgEl("defs");
    const pat = svgEl("pattern", { id: `fh-${uid}`, width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    pat.append(svgEl("path", { d: "M0 0V5", stroke: "#141413", "stroke-width": 1 }));
    defs.append(pat);
    svg.append(defs);

    svg.append(svgEl("rect", { width: W, height: H, fill: st.bg }));

    // lanes: rules and labels
    let rules = `M${labelW} ${top}V${H - top}`;
    ex.lanes.forEach((name, l) => {
      if (l > 0) rules += `M0 ${top + l * laneH}H${W}`;
      const t = svgEl("text", { x: 18, y: cy(l) + 4.5, fill: st.label, "font-family": "Figtree, sans-serif", "font-size": 13.5 });
      t.textContent = name;
      svg.append(t);
      const note = ex.empty && ex.empty[mode] && ex.empty[mode][l];
      if (note && !steps.some((s) => s[0] === l)) {
        const n = svgEl("text", { x: W - 24, y: cy(l) + 4.5, fill: st.note, "font-family": "Figtree, sans-serif", "font-size": 13, "font-style": "italic", "text-anchor": "end" });
        n.textContent = note;
        svg.append(n);
      }
    });
    svg.append(svgEl("path", { d: rules, stroke: st.rule, "stroke-width": 1, fill: "none" }));

    // connectors
    let d = "", heads = "";
    steps.forEach((s, i) => {
      if (!i) return;
      const p = steps[i - 1];
      const x1 = cx(i - 1) + bw / 2, y1 = cy(p[0]);
      const x2 = cx(i) - bw / 2, y2 = cy(s[0]);
      const mx = (x1 + x2) / 2;
      d += y1 === y2 ? `M${x1} ${y1}H${x2 - 6}` : `M${x1} ${y1}H${mx}V${y2}H${x2 - 6}`;
      heads += `M${x2 - 7} ${y2 - 4}L${x2} ${y2}L${x2 - 7} ${y2 + 4}Z`;
    });
    svg.append(svgEl("path", { d, stroke: st.line, "stroke-width": 1.6, fill: "none", "stroke-linejoin": "round" }));
    svg.append(svgEl("path", { d: heads, fill: st.line }));

    // steps
    steps.forEach(([l, label, kind], i) => {
      const x = cx(i) - bw / 2, y = cy(l) - bh / 2;
      const g = svgEl("g");
      const auto = kind === "a";
      g.append(svgEl("rect", { x, y, width: bw, height: bh, rx: 4, fill: auto ? "#D97757" : "#FAF9F5", stroke: auto ? "#D97757" : "#141413", "stroke-width": 1.3 }));
      if (kind === "w") {
        g.append(svgEl("rect", { x: x + 1, y: y + 1, width: 11, height: bh - 2, fill: `url(#fh-${uid})` }));
        g.append(svgEl("path", { d: `M${x + 12} ${y + 1}V${y + bh - 1}`, stroke: "#141413", "stroke-width": 1 }));
      }
      const lines = label.split("|");
      const t = svgEl("text", { "font-family": "Figtree, sans-serif", "font-size": 13, fill: "#141413", "text-anchor": "middle" });
      lines.forEach((line, k) => {
        const ts = svgEl("tspan", { x: x + bw / 2 + (kind === "w" ? 6 : 0), y: cy(l) + (lines.length === 1 ? 4.5 : k === 0 ? -2.5 : 13) });
        ts.textContent = line;
        t.append(ts);
      });
      g.append(t);
      svg.append(g);
    });
    return svg;
  };

  const laneStats = (steps, mode) => {
    const handoffs = steps.reduce((n, s, i) => (i && s[0] !== steps[i - 1][0] ? n + 1 : n), 0);
    const waste = steps.filter((s) => s[2] === "w").length;
    const auto = steps.filter((s) => s[2] === "a").length;
    const parts = [`${steps.length} steps`, `${handoffs} handoff${handoffs === 1 ? "" : "s"}`];
    if (mode === "asis") parts.push(`${waste} manual or waiting`);
    else parts.push(`${auto} automated`);
    return parts.join(" · ");
  };

  const buildFamiliar = (details) => {
    const ex = FAMILIAR[details.dataset.example];
    const host = $(".fam-lanes", details);
    if (!ex || host.childElementCount) return;
    const cols = Math.max(ex.asis.length, ex.tobe.length, 5);
    ["asis", "tobe"].forEach((mode) => {
      const card = document.createElement("div");
      card.className = "lane-card";
      const head = document.createElement("p");
      head.className = "lane-head";
      head.innerHTML = `<strong>${mode === "asis" ? "As-is" : "To-be"}</strong><span></span>`;
      head.querySelector("span").textContent = laneStats(ex[mode], mode);
      const scroll = document.createElement("div");
      scroll.className = "lane-scroll";
      const paper = document.createElement("div");
      paper.className = "lane-paper grain";
      paper.append(drawSwimlane(ex, mode, cols));
      scroll.append(paper);
      card.append(head, scroll);
      host.append(card);
    });
    const key = document.createElement("p");
    key.className = "lane-key";
    key.innerHTML = '<span><i class="k-w"></i>Manual work or waiting</span><span><i class="k-p"></i>Done by a person</span><span><i class="k-a"></i>Done automatically</span><span class="lane-key-note">Example of a typical case</span>';
    host.append(key);
  };

  $$("details.fam").forEach((det) => {
    det.addEventListener("toggle", () => { if (det.open) buildFamiliar(det); });
  });

  /* ---------- Contact form ---------- */
  const form = $("#contact-form");
  if (form) {
    const status = $("#cf-status");
    const done = $("#cf-done");
    const button = $("button[type=submit]", form);
    const buttonLabel = button.innerHTML;
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const RULES = {
      name: (v) => (v.trim() ? "" : "Enter your name."),
      email: (v) => (!v.trim() ? "Enter your work email." : EMAIL.test(v.trim()) ? "" : "That email doesn't look right. Check it and try again."),
      message: (v) => (v.trim().length >= 10 ? "" : "Tell us a little about what you'd like to fix."),
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
      const subject = `Intro call${data.company ? ` · ${data.company}` : ""}`;
      const lines = [data.message, "", `Name: ${data.name}`, `Email: ${data.email}`];
      if (data.company) lines.push(`Company: ${data.company}`);
      if (data.team_size) lines.push(`People in sales: ${data.team_size}`);
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
      if (form.elements.website.value) { finish("Thanks, your message is on its way.", "Danni will get back to you to set up a short call."); return; }

      const data = values();
      const endpoint = form.dataset.endpoint.trim();

      if (!endpoint) {
        openEmailApp(data);
        finish("Your email app should open now.", `The message is written for you. Just press send. If nothing opened, email ${form.dataset.fallbackEmail} directly.`);
        return;
      }

      button.disabled = true;
      button.textContent = "Sending…";
      try {
        const payload = { ...data, subject: `New enquiry from ${data.name}${data.company ? `, ${data.company}` : ""}` };
        if (form.dataset.accessKey) payload.access_key = form.dataset.accessKey;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        form.reset();
        finish("Thanks, your message is on its way.", "Danni will get back to you to set up a short call.");
      } catch (err) {
        setStatus(`Your message couldn't be sent. Try again, or email <a href="mailto:${form.dataset.fallbackEmail}">${form.dataset.fallbackEmail}</a>.`, true);
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
