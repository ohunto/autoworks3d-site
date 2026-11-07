/* Procedural night sky. All positions and effects are drawn on one canvas. */
(() => {
  'use strict';
  const canvas = document.querySelector('#contours');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const wordmark = document.querySelector('[data-star-wordmark]');
  const wordmarkLight = document.querySelector('.wordmark-impact-light');
  const wordmarkHits = [];
  const impactDuration = 1.84;
  const lightPadding = 28;
  const paths = [], stars = [], flashes = [];
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const random = (min, max) => min + Math.random() * (max - min);
  const firstEdge = Math.floor(random(0, 4));
  let width = 0, height = 0, pixelRatio = 0;
  let frame = 0, lastTime = 0, elapsed = 0;
  let pointer = null;
  let meteor = null, nextMeteor = random(25, 45);
  let logoDirty = true, logo = null, lightCtx = null;

  function fitPath(path) {
    path.x = path.from[0] * width;
    path.y = path.from[1] * height;
    const dx = path.to[0] * width - path.x;
    const dy = path.to[1] * height - path.y;
    path.length = Math.hypot(dx, dy);
    path.ux = dx / path.length;
    path.uy = dy / path.length;
    return path;
  }

  function edgePoint(edge) {
    const at = random(.06, .94);
    return [[at, 0], [1, at], [at, 1], [0, at]][edge];
  }

  function newPath(delay, first, entry = Math.floor(random(0, 4))) {
    const from = edgePoint(entry);
    const turn = Math.random() < .6 ? 2 : Math.random() < .5 ? 1 : 3;
    let to = edgePoint((entry + turn) % 4);
    if (Math.hypot((to[0] - from[0]) * width, (to[1] - from[1]) * height) < Math.min(width, height) * .65) {
      to = edgePoint((entry + 2) % 4);
    }
    const speed = 1 / random(7.4, 11.8);
    const intro = first ? 1 / (speed * 1.15) : 0;
    const fade = random(7, 9) * .75;
    const start = elapsed + delay;
    return fitPath({from, to, speed, intro, fade, start, live:null, wakes:[], stoppedAt:null,
      restartAt:start + (intro || 1 / speed) + fade + random(1.2, 4.2)});
  }

  function progressAt(path, age) {
    if (!path.intro) return age * path.speed;
    const t = Math.min(age, path.intro);
    return path.speed * (age + .3 * t - .15 * t * t / path.intro);
  }

  function ageAt(path, progress) {
    if (!path.intro) return progress / path.speed;
    return path.intro * (1.3 - Math.sqrt(Math.max(0, 1.69 - .6 * progress / (path.speed * path.intro)))) / .3;
  }

  function trailFade(path, age) {
    return (1 - ease((age - .9) / (path.fade - .9))) * path.live.opacity;
  }

  function makeStars() {
    const count = Math.min(150, Math.max(35, Math.round(width * height / 10500)));
    while (stars.length < count) stars.push({
      x:Math.random(), y:Math.random(), radius:random(.55, 1.15),
      opacity:random(.16, .38), phase:random(0, 18), period:random(9, 18),
      shimmer:Math.random() < .8
    });
    stars.length = count;
  }

  function glow(x, y, radius, stops) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    for (const [position, color] of stops) gradient.addColorStop(position, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function drawStars() {
    for (const star of stars) {
      const phase = (elapsed + star.phase) % star.period;
      const shimmer = !reducedMotion.matches && star.shimmer && phase < 4
        ? Math.pow(Math.sin(Math.PI * phase / 4), 2) : 0;
      const x = star.x * width, y = star.y * height;
      ctx.fillStyle = `rgba(180, 205, 226, ${Math.min(.9, star.opacity + shimmer * .58)})`;
      ctx.beginPath();
      ctx.arc(x, y, star.radius + shimmer * .3, 0, Math.PI * 2);
      ctx.fill();
      if (shimmer > .05) glow(x, y, 6, [
        [0, `rgba(151, 203, 232, ${shimmer * .22})`], [1, 'rgba(151, 203, 232, 0)']
      ]);
    }
  }

  function updatePaths() {
    for (let i = 0; i < paths.length; i++) {
      if (elapsed >= paths[i].restartAt) paths[i] = newPath(0, false);
      const path = paths[i];
      const age = elapsed - path.start;
      if (age < 0) continue;
      const stopped = path.stoppedAt !== null;
      const previous = path.live?.progress ?? 0;
      const progress = stopped ? previous : progressAt(path, age);
      path.live = {
        age, previous, progress,
        from:clamp(progressAt(path, Math.max(0, age - path.fade))) * path.length,
        to:clamp(progress) * path.length,
        opacity:stopped ? 1 - ease((elapsed - path.stoppedAt) / 1.65) : 1
      };
      for (let j = path.wakes.length - 1; j >= 0; j--) {
        const wake = path.wakes[j];
        const t = elapsed - wake.time;
        if (t >= 3.6) {
          path.wakes.splice(j, 1);
          continue;
        }
        wake.spread = 16 + 12 * t;
        wake.lift = 1 - Math.exp(-t * 7);
        wake.opacity = wake.lift * Math.exp(-1.15 * t) * (1 - ease((t - 2.6) / 1));
      }
    }
  }

  function sweep(path, from, to) {
    return {
      path, from, to,
      x0:path.x + path.ux * from, y0:path.y + path.uy * from,
      x1:path.x + path.ux * to, y1:path.y + path.uy * to
    };
  }

  function crossTrails(x0, y0, x1, y1, power, source) {
    const dx = x1 - x0, dy = y1 - y0;
    for (const path of paths) {
      const live = path.live;
      if (path === source || !live || live.to <= live.from || live.opacity < .05) continue;
      const nx = -path.uy, ny = path.ux;
      const across = dx * nx + dy * ny;
      if (Math.abs(across) < .15) continue;
      const t = -((x0 - path.x) * nx + (y0 - path.y) * ny) / across;
      if (t <= 0 || t > 1) continue;
      const along = (x0 + dx * t - path.x) * path.ux + (y0 + dy * t - path.y) * path.uy;
      if (along < live.from || along > live.to || live.progress * path.length - along < 7) continue;
      if (path.wakes.some(wake => elapsed - wake.time < .55 && Math.abs(wake.at - along) < 28)) continue;
      const age = Math.max(0, live.age - ageAt(path, along / path.length));
      const brightness = trailFade(path, age) * (.28 + .72 * Math.exp(-age / .9));
      if (brightness < .035) continue;
      if (path.wakes.length === 5) path.wakes.shift();
      path.wakes.push({at:along, time:elapsed, strength:Math.pow(brightness, .85) * power,
        direction:Math.sign(across), spread:16, lift:0, opacity:0});
    }
  }

  function stopShot(shot, t) {
    const {path} = shot;
    shot.to = shot.from + (shot.to - shot.from) * t;
    path.stoppedAt = elapsed;
    path.restartAt = elapsed + random(3.6, 6.4);
    path.live.progress = shot.to / path.length;
    path.live.to = clamp(path.live.progress) * path.length;
    shot.x1 = path.x + path.ux * shot.to;
    shot.y1 = path.y + path.uy * shot.to;
  }

  function collide(sweeps) {
    const contacts = [];
    for (let i = 0; i < sweeps.length; i++) {
      const a = sweeps[i];
      const surface = wordmarkContact(a);
      if (surface) contacts.push({a, t:surface.t, surface});
      for (let j = i + 1; j < sweeps.length; j++) {
        const b = sweeps[j];
        const x = a.x0 - b.x0, y = a.y0 - b.y0;
        const dx = a.x1 - b.x1 - x, dy = a.y1 - b.y1 - y;
        const motion = dx * dx + dy * dy;
        const t = motion > 0 ? clamp(-(x * dx + y * dy) / motion) : 0;
        if ((x + dx * t) ** 2 + (y + dy * t) ** 2 > 36) continue;
        const cx = (a.x0 + b.x0 + (a.x1 + b.x1 - a.x0 - b.x0) * t) * .5;
        const cy = (a.y0 + b.y0 + (a.y1 + b.y1 - a.y0 - b.y0) * t) * .5;
        if (cx < 8 || cy < 8 || cx > width - 8 || cy > height - 8) continue;
        contacts.push({a, b, t, x:cx, y:cy});
      }
    }
    contacts.sort((a, b) => a.t - b.t);
    for (const {a, b, t, x, y, surface} of contacts) {
      if (a.path.stoppedAt !== null || (b && b.path.stoppedAt !== null)) continue;
      stopShot(a, t);
      if (surface) {
        strikeWordmark(a, surface);
      } else {
        stopShot(b, t);
        flashes.push({x, y, time:elapsed});
      }
    }
  }

  function readWordmark() {
    logoDirty = false;
    const rect = wordmark.getBoundingClientRect();
    if (!rect.width || !rect.height || !wordmarkLight) { logo = null; return; }
    const style = getComputedStyle(wordmark);
    const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.ceil(rect.width * scale), h = Math.ceil(rect.height * scale);
    wordmarkLight.style.transform = `translate(${rect.left - lightPadding}px, ${rect.top - lightPadding}px)`;
    if (logo?.w === w && logo.h === h && logo.font === font && logo.scale === scale &&
      logo.rect.width === rect.width && logo.rect.height === rect.height) {
      logo.rect = rect;
      return;
    }
    const stencil = document.createElement('canvas');
    stencil.width = w;
    stencil.height = h;
    const ink = stencil.getContext('2d', {willReadFrequently:true});
    lightCtx ??= wordmarkLight.getContext('2d');
    if (!ink || !lightCtx) { logo = null; return; }
    ink.setTransform(scale, 0, 0, scale, 0, 0);
    ink.font = font;
    const size = parseFloat(style.fontSize);
    const metrics = ink.measureText(wordmark.textContent);
    const ascent = metrics.fontBoundingBoxAscent ?? size * .8;
    const descent = metrics.fontBoundingBoxDescent ?? size * .2;
    const baseline = (rect.height + ascent - descent) * .5;
    const nodes = document.createTreeWalker(wordmark, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    // Use the laid-out letter positions, including the colored 3D span.
    while (nodes.nextNode()) {
      const node = nodes.currentNode;
      for (let i = 0; i < node.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        ink.fillText(node.data[i], range.getBoundingClientRect().left - rect.left, baseline);
      }
    }
    logo = {rect, w, h, font, size, scale, pixels:ink.getImageData(0, 0, w, h).data};

    const layerWidth = rect.width + lightPadding * 2;
    const layerHeight = rect.height + lightPadding * 2;
    wordmarkLight.width = Math.ceil(layerWidth * scale);
    wordmarkLight.height = Math.ceil(layerHeight * scale);
    wordmarkLight.style.width = `${wordmarkLight.width / scale}px`;
    wordmarkLight.style.height = `${wordmarkLight.height / scale}px`;
    lightCtx.setTransform(scale, 0, 0, scale, lightPadding * scale, lightPadding * scale);
  }

  function inkAt(x, y) {
    const px = x * logo.scale - .5, py = y * logo.scale - .5;
    const col = Math.floor(px), row = Math.floor(py);
    const fx = px - col, fy = py - row;
    const sample = (cx, cy) => cx < 0 || cy < 0 || cx >= logo.w || cy >= logo.h
      ? 0 : logo.pixels[(cy * logo.w + cx) * 4 + 3] / 255;
    const top = sample(col, row) * (1 - fx) + sample(col + 1, row) * fx;
    const bottom = sample(col, row + 1) * (1 - fx) + sample(col + 1, row + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  }

  function wordmarkContact(shot) {
    if (!logo || shot.path.hitWordmark) return null;
    const {rect} = logo;
    const x0 = shot.x0 - rect.left, y0 = shot.y0 - rect.top;
    const x1 = shot.x1 - rect.left, y1 = shot.y1 - rect.top;
    if (Math.max(x0, x1) < 0 || Math.min(x0, x1) > rect.width ||
      Math.max(y0, y1) < 0 || Math.min(y0, y1) > rect.height) return null;
    const dx = shot.x1 - shot.x0, dy = shot.y1 - shot.y0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / .85));
    let inside = inkAt(x0, y0) >= .5;
    for (let i = 1; i <= steps; i++) {
      const next = inkAt(x0 + dx * i / steps, y0 + dy * i / steps) >= .5;
      if (!inside && next) {
        // Resolve the edge between samples so the star reaches the letter before it stops.
        let lo = (i - 1) / steps, hi = i / steps;
        for (let step = 0; step < 4; step++) {
          const mid = (lo + hi) * .5;
          if (inkAt(x0 + dx * mid, y0 + dy * mid) >= .5) hi = mid;
          else lo = mid;
        }
        const t = (lo + hi) * .5;
        const x = x0 + dx * t, y = y0 + dy * t;
        const gx = inkAt(x + 1.8, y) - inkAt(x - 1.8, y);
        const gy = inkAt(x, y + 1.8) - inkAt(x, y - 1.8);
        const magnitude = Math.hypot(gx, gy);
        const {ux, uy} = shot.path;
        const normal = magnitude > .04 && gx * ux + gy * uy > 0;
        const nx = normal ? gx / magnitude : ux, ny = normal ? gy / magnitude : uy;
        return {x, y, t, nx, ny, incidence:clamp(nx * ux + ny * uy)};
      }
      inside = next;
    }
    return null;
  }

  function strikeWordmark(shot, contact, amber = false) {
    shot.path.hitWordmark = true;
    if (wordmarkHits.length === 3) wordmarkHits.shift();
    wordmarkHits.push({...contact, time:elapsed, amber, size:Math.min(17, logo.size * .113)});
  }

  function hideWordmarkImpact() {
    if (wordmarkLight && !wordmarkLight.hidden) wordmarkLight.hidden = true;
  }

  function clearWordmarkHits() {
    wordmarkHits.length = 0;
    hideWordmarkImpact();
  }

  function paintChip(hit, age) {
    const open = .44 + .56 * ease(age / .06);
    const half = hit.size * (.94 + .10 * (1 - hit.incidence)) * open;
    const depth = hit.size * (.34 + .13 * hit.incidence) * open;
    const shoulder = Math.min(4, half * .62);
    const setback = hit.size * .18 * open;
    const rise = depth + setback;
    const rimAngle = Math.asin(Math.max(-1, (setback - shoulder) / rise));
    const rotation = Math.atan2(-hit.nx, hit.ny);
    const chip = new Path2D();
    // Keep the curved floor and close the oval just outside the letter edge.
    chip.ellipse(hit.x - hit.nx * setback, hit.y - hit.ny * setback,
      half, rise, rotation, rimAngle, Math.PI - rimAngle);
    chip.closePath();

    // The cut covers the original edge. A soft front reveals the letter from the inside out.
    const refill = ease((age - .16) / (impactDuration - .16));
    const curve = hit.size * 3;
    const feather = .75 + hit.size * .1;
    const x = hit.x - hit.nx * curve, y = hit.y - hit.ny * curve;
    const deep = Math.hypot(curve + depth, half) + feather;
    const edge = curve - shoulder - feather;
    const front = deep + (edge - deep) * refill;
    const recess = lightCtx.createRadialGradient(x, y, Math.max(0, front - feather), x, y, front + feather);
    const leftLight = clamp(1 - (logo.rect.left + hit.x) / (width * .51));
    const sky = width <= 600 ? '10, 17, 23' : `${5 + 5 * leftLight}, ${9 + 8 * leftLight}, ${14 + 9 * leftLight}`;
    recess.addColorStop(0, `rgba(${sky}, 1)`);
    recess.addColorStop(1, `rgba(${sky}, 0)`);
    lightCtx.fillStyle = recess;
    lightCtx.fill(chip);
  }

  function paintContactLight(hit, age) {
    const pulse = Math.exp(-age * 16) * (1 - ease(age / .24));
    if (pulse < .012) return;
    const x = hit.x - hit.nx * 2.6, y = hit.y - hit.ny * 2.6;
    const radius = Math.min(lightPadding - 2, 7 + hit.size * 1.14 + age * 21);
    const tint = hit.amber ? '255, 168, 72' : '89, 211, 255';
    const halo = lightCtx.createRadialGradient(x, y, 0, x, y, radius);
    halo.addColorStop(0, `rgba(249, 253, 255, ${pulse * .99})`);
    halo.addColorStop(.17, `rgba(211, 244, 255, ${pulse * .75})`);
    halo.addColorStop(.42, `rgba(${tint}, ${pulse * .29})`);
    halo.addColorStop(1, `rgba(${tint}, 0)`);
    lightCtx.fillStyle = halo;
    lightCtx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function drawWordmarkImpact() {
    if (!logo || !wordmarkHits.length) { hideWordmarkImpact(); return; }
    lightCtx.clearRect(-lightPadding, -lightPadding, wordmarkLight.width / logo.scale, wordmarkLight.height / logo.scale);
    lightCtx.save();
    for (const hit of wordmarkHits) paintChip(hit, elapsed - hit.time);
    lightCtx.globalCompositeOperation = 'lighter';
    for (const hit of wordmarkHits) paintContactLight(hit, elapsed - hit.time);
    lightCtx.restore();
    if (wordmarkLight.hidden) wordmarkLight.hidden = false;
  }

  function newMeteor() {
    const corner = Math.floor(random(0, 4));
    const left = corner < 2, top = corner % 2 === 0;
    const from = [left ? -.08 : 1.08, top ? -.08 : 1.08];
    const to = [left ? 1 + random(.04, .095) : -random(.04, .095), top ? 1.07 : -.07];
    return fitPath({from, to, start:elapsed, duration:random(1.36, 1.72), progress:0});
  }

  function updateMeteor() {
    if (!meteor && elapsed >= nextMeteor) {
      meteor = newMeteor();
      nextMeteor = elapsed + random(70, 125);
    }
    if (!meteor) return;
    const age = elapsed - meteor.start;
    if (age > meteor.duration + 2.7) { meteor = null; return; }
    const previous = meteor.progress;
    meteor.progress = clamp(age / meteor.duration);
    if (previous === meteor.progress) return;
    const shot = sweep(meteor, previous * meteor.length, meteor.progress * meteor.length);
    crossTrails(shot.x0, shot.y0, shot.x1, shot.y1, .95, meteor);
    const surface = wordmarkContact(shot);
    if (surface) strikeWordmark(shot, surface, true);
  }

  function advance() {
    if (!width || !height) return;
    if (wordmark && logoDirty && elapsed > 2.05) readWordmark();
    while (wordmarkHits.length && elapsed - wordmarkHits[0].time >= impactDuration) wordmarkHits.shift();
    updatePaths();
    const moving = [];
    for (const path of paths) {
      const live = path.live;
      if (!live || path.stoppedAt !== null || live.previous > 1 || live.progress <= live.previous) continue;
      moving.push(sweep(path, live.previous * path.length, live.progress * path.length));
    }
    collide(moving);
    for (const shot of moving) {
      crossTrails(shot.x0, shot.y0, shot.x1, shot.y1, 1, shot.path);
    }
    while (flashes.length && elapsed - flashes[0].time > .7) flashes.shift();
    updateMeteor();
  }

  function line(x0, y0, x1, y1) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function drawAfterimage(path) {
    const live = path.live;
    if (!live || live.to - live.from < .5 || live.opacity <= 0) return;
    const x0 = path.x + path.ux * live.from, y0 = path.y + path.uy * live.from;
    const x1 = path.x + path.ux * live.to, y1 = path.y + path.uy * live.to;
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    const stops = Math.max(8, Math.min(96, Math.ceil((live.to - live.from) / 11)));
    for (let i = 0; i <= stops; i++) {
      const along = live.from + (live.to - live.from) * i / stops;
      const position = along / path.length;
      let density = 1;
      for (const wake of path.wakes) {
        const d = (along - wake.at) / wake.spread;
        density *= 1 - Math.exp(-.5 * d * d) * wake.opacity * wake.strength * .96;
      }
      const edge = Math.min(1, position / .1, (1 - position) / .1);
      const alpha = trailFade(path, live.age - ageAt(path, position)) * (.045 + .19 * edge) * density;
      gradient.addColorStop(i / stops, `rgba(117, 167, 189, ${alpha})`);
    }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = .72;
    line(x0, y0, x1, y1);
  }

  function drawSmoke(path, wake) {
    const live = path.live;
    if (!live || wake.opacity < .012 || live.opacity <= 0) return;
    const {at, spread, direction, strength} = wake;
    const age = elapsed - wake.time;
    const from = Math.max(live.from, at - spread * 2.8);
    const to = Math.min(live.to, at + spread * 2.8);
    if (to - from < 3) return;
    const gradient = ctx.createLinearGradient(path.x + path.ux * from, path.y + path.uy * from,
      path.x + path.ux * to, path.y + path.uy * to);
    const alpha = wake.opacity * strength * live.opacity * .24;
    const center = clamp((at - from) / (to - from));
    gradient.addColorStop(0, 'rgba(103, 187, 222, 0)');
    gradient.addColorStop(center, `rgba(154, 217, 239, ${alpha})`);
    gradient.addColorStop(1, 'rgba(103, 187, 222, 0)');
    ctx.strokeStyle = gradient;
    // A displaced filament keeps drifting as it dissolves, with no spring-back.
    const drift = wake.lift * (11 + age * 5.5) * strength * direction;
    const steps = Math.max(6, Math.ceil((to - from) / 5));
    for (let layer = -1.5; layer <= 1.5; layer++) {
      ctx.beginPath();
      let lastX, lastY;
      for (let i = 0; i <= steps; i++) {
        const along = from + (to - from) * i / steps;
        const d = (along - at) / spread;
        const fold = Math.sin(d * 2.5 + layer * .63) * .32 + layer * .18;
        const offset = drift * (1 + fold) * Math.exp(-.5 * d * d);
        const x = path.x + path.ux * along - path.uy * offset;
        const y = path.y + path.uy * along + path.ux * offset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.quadraticCurveTo(lastX, lastY, (lastX + x) * .5, (lastY + y) * .5);
        lastX = x;
        lastY = y;
      }
      ctx.lineTo(lastX, lastY);
      ctx.globalAlpha = .27;
      ctx.lineWidth = 4.5 + age * 1.7;
      ctx.stroke();
      ctx.globalAlpha = .72;
      ctx.lineWidth = 1.1 + age * .6;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawHead(path, at, tailLength, strength, amber = false) {
    if (at - tailLength > path.length || strength <= 0) return;
    const x0 = path.x + path.ux * (at - tailLength), y0 = path.y + path.uy * (at - tailLength);
    const x1 = path.x + path.ux * at, y1 = path.y + path.uy * at;
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    if (amber) {
      gradient.addColorStop(0, 'rgba(218, 73, 23, 0)');
      gradient.addColorStop(.48, `rgba(242, 105, 39, ${strength * .22})`);
      gradient.addColorStop(.84, `rgba(255, 158, 66, ${strength * .67})`);
      gradient.addColorStop(.96, `rgba(255, 210, 144, ${strength})`);
      gradient.addColorStop(1, `rgba(255, 246, 223, ${strength})`);
    } else {
      gradient.addColorStop(0, 'rgba(53, 174, 225, 0)');
      gradient.addColorStop(.65, `rgba(66, 184, 235, ${strength * .35})`);
      gradient.addColorStop(.94, `rgba(130, 225, 255, ${strength})`);
      gradient.addColorStop(1, `rgba(210, 246, 255, ${strength})`);
    }
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.globalAlpha = amber ? .13 : .12;
    ctx.lineWidth = amber ? 22 : 9;
    ctx.stroke();
    ctx.globalAlpha = amber ? .32 : .2;
    ctx.lineWidth = amber ? 7 : 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = amber ? 2 : 1.2;
    ctx.stroke();
    if (amber) glow(x1, y1, 23, [
      [0, `rgba(255, 223, 167, ${strength * .48})`], [.23, `rgba(255, 152, 72, ${strength * .2})`], [1, 'rgba(255, 108, 36, 0)']
    ]);
  }

  function drawMeteor() {
    if (!meteor) return;
    const impactAge = elapsed - meteor.start - meteor.duration;
    drawHead(meteor, meteor.progress * meteor.length, Math.min(510, meteor.length * .38), 1 - ease(impactAge / .45), true);
    if (impactAge < 0) return;
    const x = meteor.to[0] * width, y = meteor.to[1] * height;
    const light = (1 - Math.exp(-impactAge * 24)) * Math.exp(-impactAge * 2.05);
    const radius = Math.max(245, Math.min(width, height) * .74) * (1 + impactAge * .19);
    glow(x, y, radius, [
      [0, `rgba(255, 206, 132, ${light * .86})`], [.25, `rgba(255, 139, 52, ${light * .67})`],
      [.58, `rgba(231, 84, 22, ${light * .25})`], [1, 'rgba(190, 55, 13, 0)']
    ]);
    glow(x, y, radius * .43, [
      [0, `rgba(255, 235, 192, ${light * .72})`], [.52, `rgba(255, 161, 81, ${light * .36})`], [1, 'rgba(250, 108, 38, 0)']
    ]);
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawStars();
    if (reducedMotion.matches) return;
    for (const path of paths) drawAfterimage(path);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const path of paths) {
      for (const wake of path.wakes) drawSmoke(path, wake);
      if (path.live && (path.stoppedAt === null || path.hitWordmark)) {
        const drain = path.stoppedAt === null ? 0 : ease((elapsed - path.stoppedAt) / .24);
        drawHead(path, path.live.progress * path.length, Math.min(170, path.length * .22) * (1 - drain * .56), .82 * (1 - drain));
      }
    }
    for (const flash of flashes) {
      const age = elapsed - flash.time;
      const strength = Math.exp(-age * 7.5) * (1 - ease(age / .7));
      glow(flash.x, flash.y, 17 + age * 23, [
        [0, `rgba(236, 251, 255, ${strength * .94})`], [.14, `rgba(163, 227, 255, ${strength * .62})`],
        [.39, `rgba(99, 190, 240, ${strength * .28})`], [1, 'rgba(80, 171, 232, 0)']
      ]);
    }
    drawMeteor();
    ctx.restore();
    drawWordmarkImpact();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const nextWidth = rect.width, nextHeight = rect.height;
    if (!nextWidth || !nextHeight) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6500000 / (nextWidth * nextHeight)));
    if (nextWidth === width && nextHeight === height && ratio === pixelRatio) return;
    width = nextWidth;
    height = nextHeight;
    pixelRatio = ratio;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = width < 600 ? 6 : 9;
    paths.length = Math.min(paths.length, count);
    for (const path of paths) { fitPath(path); path.wakes.length = 0; }
    while (paths.length < count) {
      const i = paths.length;
      const delay = i === 0 ? 0 : .6 + (i - 1) * 1.2 + random(0, .65);
      paths.push(newPath(delay, true, (firstEdge + [0, 2, 1, 3][i % 4]) % 4));
    }
    if (meteor) fitPath(meteor);
    makeStars();
    pointer = null;
    logoDirty = true;
    clearWordmarkHits();
    flashes.length = 0;
    updatePaths();
    draw();
  }

  function animate(now) {
    if (reducedMotion.matches || document.hidden) { frame = 0; return; }
    const delta = now - lastTime;
    if (delta >= 1000 / (finePointer.matches ? 60 : 30) - .5) {
      elapsed += Math.min(delta / 1000, .05);
      lastTime = now;
      advance();
      draw();
    }
    frame = requestAnimationFrame(animate);
  }

  function syncMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
    document.body.classList.toggle('motion-paused', reducedMotion.matches);
    if (reducedMotion.matches) {
      clearWordmarkHits();
      flashes.length = 0;
      for (const path of paths) path.wakes.length = 0;
      meteor = null;
      draw();
    } else if (!document.hidden) {
      lastTime = performance.now();
      frame = requestAnimationFrame(animate);
    }
  }

  reducedMotion.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('resize', resize, {passive:true});
  if (wordmark) {
    window.addEventListener('scroll', () => { logoDirty = true; }, {passive:true});
    wordmark.addEventListener('animationend', () => { logoDirty = true; });
    document.fonts?.ready.then(() => { logo = null; logoDirty = true; });
  }
  window.addEventListener('pointermove', event => {
    if (reducedMotion.matches || document.hidden || !finePointer.matches || event.pointerType === 'touch') return;
    const next = {x:event.clientX, y:event.clientY, time:performance.now()};
    if (pointer) {
      const dt = next.time - pointer.time;
      const distance = Math.hypot(next.x - pointer.x, next.y - pointer.y);
      if (dt < 125 && distance > .55 && distance / Math.max(1, dt) > .045) {
        const power = .59 + .24 * clamp(distance / Math.max(1, dt) / .9);
        crossTrails(pointer.x, pointer.y, next.x, next.y, power);
      }
    }
    pointer = next;
  }, {passive:true});
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; });
  resize();
  syncMotion();
})();
