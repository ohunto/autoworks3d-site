/* Original procedural line field. No video, external renderer, or tracking. */
(() => {
  'use strict';
  const canvas = document.querySelector('#contours');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let width = 0, height = 0, frame = 0, lastTime = 0, elapsed = 0;
  let pointer = null;
  let field = null;
  const crossings = [];
  let stars = [];
  const cellSize = 30;
  let paths = [], mobileLayout;
  const clamp = value => Math.max(0, Math.min(1, value));
  const random = (min, max) => min + Math.random() * (max - min);

  function makePaths() {
    const mobile = width < 600;
    const columns = mobile ? [.08, .29, .71, .92] : [.065, .19, .345, .5, .655, .81, .935];
    const rows = mobile ? [.12, .25, .49, .73, .88] : [.115, .255, .435, .615, .795, .91];
    if (paths.length && mobileLayout === mobile) return;
    mobileLayout = mobile;
    // Keep an early light in each region; vary the timing on every visit.
    const columnArrivals = [1.8, .9, 7.2, 4.5, 10.8, 5.4, 8.1];
    const rowArrivals = [0, 2.7, 3.6, 1.35, 6.3, 9.9];
    paths = [
      ...columns.map((position, i) => ({vertical:true, position, delay:columnArrivals[i], duration:9 + i * 1.1, reverse:i % 2 === 0})),
      ...rows.map((position, i) => ({vertical:false, position, delay:rowArrivals[i], duration:11 + i * 1.3, reverse:i % 2 !== 0}))
    ].map((path, i) => ({
      ...path,
      start:elapsed + (path.delay === 0 ? 0 : Math.max(.5, path.delay + random(-.65, .65))),
      duration:path.duration * random(.92, 1.08),
      fade:random(7, 9),
      rest:random(1, 5),
      first:true,
      index:i
    }));
  }

  function resetInteraction() {
    const cols = Math.ceil(width / cellSize) + 2;
    const rows = Math.ceil(height / cellSize) + 2;
    field = { cols, rows, x:new Float32Array(cols * rows), y:new Float32Array(cols * rows), vx:new Float32Array(cols * rows), vy:new Float32Array(cols * rows) };
    pointer = null;
    crossings.length = 0;
  }

  function displacement(x, y) {
    if (!field || reducedMotion.matches) return [0, 0];
    const gx = Math.max(0, Math.min(field.cols - 2, x / cellSize));
    const gy = Math.max(0, Math.min(field.rows - 2, y / cellSize));
    const col = Math.floor(gx), row = Math.floor(gy);
    const fx = gx - col, fy = gy - row, i = row * field.cols + col;
    const a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
    return [field.x[i] * a + field.x[i + 1] * b + field.x[i + field.cols] * c + field.x[i + field.cols + 1] * d,
      field.y[i] * a + field.y[i + 1] * b + field.y[i + field.cols] * c + field.y[i + field.cols + 1] * d];
  }

  function stir(x, y, dx, dy) {
    const radius = 88;
    const speed = Math.min(32, Math.hypot(dx, dy));
    for (let row = Math.max(1, Math.floor((y - radius) / cellSize)); row < Math.min(field.rows - 1, (y + radius) / cellSize); row++) {
      for (let col = Math.max(1, Math.floor((x - radius) / cellSize)); col < Math.min(field.cols - 1, (x + radius) / cellSize); col++) {
        const ox = col * cellSize - x, oy = row * cellSize - y;
        const distance = Math.hypot(ox, oy);
        if (distance >= radius) continue;
        const weight = Math.pow(1 - distance / radius, 2);
        // Drag with the hand and roll the edges of its wake into a small curl.
        const curl = (ox * dy - oy * dx) / (radius * Math.max(1, speed));
        const i = row * field.cols + col;
        field.vx[i] = Math.max(-300, Math.min(300, field.vx[i] + (dx * 11 - oy * curl * .7) * weight));
        field.vy[i] = Math.max(-300, Math.min(300, field.vy[i] + (dy * 11 + ox * curl * .7) * weight));
      }
    }
  }

  function trailAge(path, distance, live) {
    const passedAt = path.first
      ? live.introDuration * (1.3 - Math.sqrt(Math.max(0, 1.69 - .6 * distance / (live.steadySpeed * live.introDuration)))) / .3
      : distance / live.steadySpeed;
    return live.age - passedAt;
  }

  function makeStars() {
    const count = Math.min(150, Math.max(35, Math.round(width * height / 10500)));
    while (stars.length < count) stars.push({
      x:Math.random(), y:Math.random(), radius:random(.45, 1),
      opacity:random(.12, .34), phase:random(0, 40), period:random(19, 41),
      shimmer:Math.random() < .55
    });
    stars.length = count;
  }

  function drawStars() {
    for (const star of stars) {
      const phase = (elapsed + star.phase) % star.period;
      const shimmer = !reducedMotion.matches && star.shimmer && phase < 3.4
        ? Math.pow(Math.sin(Math.PI * phase / 3.4), 2) : 0;
      const x = star.x * width, y = star.y * height;
      ctx.fillStyle = `rgba(180, 205, 226, ${star.opacity + shimmer * .19})`;
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fill();
      if (shimmer > .05) {
        const halo = ctx.createRadialGradient(x, y, 0, x, y, 3.5);
        halo.addColorStop(0, `rgba(151, 203, 232, ${shimmer * .065})`);
        halo.addColorStop(1, 'rgba(151, 203, 232, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
      }
    }
  }

  function updateCrossings() {
    for (let i = crossings.length - 1; i >= 0; i--) {
      if (elapsed - crossings[i].time > 3.2) crossings.splice(i, 1);
    }
    for (const moving of paths) {
      const live = moving.live;
      if (!live || live.previousHead === null) continue;
      for (const crossed of paths) {
        const other = crossed.live;
        if (moving.vertical === crossed.vertical || !other) continue;
        const along = crossed.position * live.length;
        if ((live.previousHead - along) * (live.head - along) > 0 || live.previousHead === live.head) continue;
        const across = moving.position * other.length;
        if (across < other.from || across > other.to) continue;
        const distance = crossed.reverse ? 1 - across / other.length : across / other.length;
        const freshness = clamp(1 - trailAge(crossed, distance, other) / crossed.fade);
        if (freshness < .15) continue;
        const vertical = moving.vertical ? moving : crossed;
        const horizontal = moving.vertical ? crossed : moving;
        if (crossings.some(c => c.vertical === vertical && c.horizontal === horizontal && elapsed - c.time < 1.2)) continue;
        crossings.push({vertical, horizontal, target:crossed, x:vertical.position * width, y:horizontal.position * height,
          time:elapsed, strength:.5 + freshness * .5, direction:moving.reverse ? -1 : 1});
      }
    }
  }

  function crossingBend(path, along) {
    let offset = 0;
    for (const crossing of crossings) {
      // Only the existing trail yields; the passing light keeps its course.
      if (path !== crossing.target) continue;
      const age = elapsed - crossing.time;
      const distance = along - (path.vertical ? crossing.y : crossing.x);
      const spread = 22 + age * 17;
      const envelope = Math.exp(-distance * distance / (2 * spread * spread));
      const settle = (1 - Math.exp(-age * 12)) * Math.exp(-age * 2.2);
      offset += envelope * settle * 3 * crossing.strength * crossing.direction;
    }
    return offset;
  }

  function updateInteraction(dt) {
    if (!field) return;
    const {cols, rows, x, y, vx, vy} = field;
    const damping = Math.exp(-3.4 * dt);
    // A damped displacement field spreads each disturbance locally and settles
    // back to rest. No camera or page element ever follows the pointer.
    for (let row = 1; row < rows - 1; row++) {
      for (let col = 1; col < cols - 1; col++) {
        const i = row * cols + col;
        vx[i] = (vx[i] + ((x[i-1] + x[i+1] + x[i-cols] + x[i+cols] - 4*x[i]) * 22 - x[i] * 4) * dt) * damping;
        vy[i] = (vy[i] + ((y[i-1] + y[i+1] + y[i-cols] + y[i+cols] - 4*y[i]) * 22 - y[i] * 4) * dt) * damping;
      }
    }
    for (let i = 0; i < x.length; i++) {
      x[i] = Math.max(-65, Math.min(65, x[i] + vx[i] * dt));
      y[i] = Math.max(-65, Math.min(65, y[i] + vy[i] * dt));
    }
  }

  function strokeCurve(points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length - 1; i++) {
      ctx.quadraticCurveTo(points[i][0],points[i][1],(points[i][0]+points[i+1][0])/2,(points[i][1]+points[i+1][1])/2);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last[0],last[1]);
    ctx.stroke();
  }

  function segment(path, from, to, stroke, thickness) {
    const cross = path.position * (path.vertical ? width : height);
    const steps = Math.max(1, Math.ceil(Math.abs(to - from) / 9));
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const along = from + (to - from) * i / steps;
      const x = path.vertical ? cross : along, y = path.vertical ? along : cross;
      const bend = displacement(x, y);
      const ripple = crossingBend(path, along);
      points.push([x + bend[0] + (path.vertical ? ripple : 0), y + bend[1] + (path.vertical ? 0 : ripple)]);
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = thickness;
    strokeCurve(points);
  }

  function preparePaths() {
    for (const path of paths) {
      const previousHead = path.live?.head ?? null;
      path.live = null;
      const length = path.vertical ? height : width;
      const steadySpeed = 1.55 / path.duration;
      const introDuration = 1 / (steadySpeed * 1.15);
      const crossingDuration = path.first ? introDuration : 1 / steadySpeed;
      const age = elapsed - path.start;
      if (age < 0) continue;
      // A trail disappears completely before this path receives another light.
      if (age > crossingDuration + path.fade + path.rest) {
        path.start = elapsed;
        path.duration = random(10, 18);
        path.reverse = Math.random() < .5;
        path.fade = random(7, 9);
        path.rest = random(1, 5);
        path.first = false;
        continue;
      }
      const drawingTime = Math.min(age, introDuration);
      const travel = path.first
        ? steadySpeed * (1.3 * drawingTime - .15 * drawingTime * drawingTime / introDuration + Math.max(0, age - introDuration))
        : age * steadySpeed;
      const reveal = clamp(travel);
      if (!reveal) continue;
      const from = path.reverse ? length * (1 - reveal) : 0;
      const to = path.reverse ? length : length * reveal;
      const head = (path.reverse ? 1 - travel : travel) * length;
      path.live = {from, to, head, length, age, steadySpeed, introDuration, travel, previousHead};
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawStars();
    const still = reducedMotion.matches;
    if (!still) { preparePaths(); updateCrossings(); }
    for (const path of paths) {
      if (still) {
        const length = path.vertical ? height : width;
        if (path.index % 3 === 0) segment(path, length * .15, length * .85, 'rgba(117, 167, 189, .07)', .65);
        continue;
      }
      if (!path.live) continue;
      const {from, to, head, length, age, steadySpeed, introDuration} = path.live;
      const tailLength = Math.min(170, length * .22);
      const cross = path.position * (path.vertical ? width : height);
      const base = path.vertical ? ctx.createLinearGradient(cross, from, cross, to) : ctx.createLinearGradient(from, cross, to, cross);
      // Each part of the line remembers when the light passed it: it lingers,
      // then fades gently, rather than leaving a permanent grid behind.
      for (let step = 0; step <= 20; step++) {
        const fraction = step / 20;
        const position = (from + (to - from) * fraction) / length;
        const distance = path.reverse ? 1 - position : position;
        const passedAt = path.first
          ? introDuration * (1.3 - Math.sqrt(Math.max(0, 1.69 - .6 * distance / (steadySpeed * introDuration)))) / .3
          : distance / steadySpeed;
        const fadeProgress = clamp((age - passedAt - 1.2) / (path.fade - 1.2));
        const fade = 1 - fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
        const edge = Math.min(1, position / .14, (1 - position) / .14);
        base.addColorStop(fraction, `rgba(117, 167, 189, ${fade * (.04 + .19 * edge)})`);
      }
      segment(path, from, to, base, .65);

      const tail = head + (path.reverse ? tailLength : -tailLength);
      const strength = path.first ? .8 + .15 * (1 - clamp(age / introDuration)) : .8;
      if (Math.max(head, tail) < 0 || Math.min(head, tail) > length) continue;
      const gradient = path.vertical ? ctx.createLinearGradient(cross, tail, cross, head) : ctx.createLinearGradient(tail, cross, head, cross);
      gradient.addColorStop(0, 'rgba(53, 174, 225, 0)');
      gradient.addColorStop(.65, `rgba(66, 184, 235, ${strength * .35})`);
      gradient.addColorStop(.94, `rgba(130, 225, 255, ${strength})`);
      gradient.addColorStop(1, `rgba(210, 246, 255, ${strength})`);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .12;
      segment(path, tail, head, gradient, 9);
      ctx.globalAlpha = .2;
      segment(path, tail, head, gradient, 3);
      ctx.globalAlpha = 1;
      segment(path, tail, head, gradient, 1.2);
      ctx.restore();
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    makePaths();
    makeStars();
    for (const path of paths) path.live = null;
    resetInteraction();
    draw();
  }

  function animate(now) {
    if (reducedMotion.matches || document.hidden) { frame = 0; return; }
    const delta = now - lastTime;
    if (delta >= 1000 / (finePointer.matches ? 60 : 30) - .5) {
      const seconds = Math.min(delta / 1000, .05);
      elapsed += seconds;
      lastTime = now;
      updateInteraction(seconds);
      draw();
    }
    frame = requestAnimationFrame(animate);
  }

  function syncMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    document.body.classList.toggle('motion-paused', reducedMotion.matches);
    if (reducedMotion.matches) { resetInteraction(); draw(); }
    else if (!document.hidden) { lastTime = performance.now(); frame = requestAnimationFrame(animate); }
  }
  reducedMotion.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('resize', resize, { passive:true });
  window.addEventListener('pointermove', event => {
    if (reducedMotion.matches || !finePointer.matches || event.pointerType === 'touch') return;
    const now = performance.now();
    const next = {x:event.clientX, y:event.clientY, time:now};
    if (pointer && now - pointer.time < 140) {
      const dx = next.x - pointer.x, dy = next.y - pointer.y;
      const distance = Math.hypot(dx,dy);
      if (distance > .5) {
        // Sweep the whole movement, so fast crossings cannot jump over a trail.
        const steps = Math.min(16, Math.max(1, Math.ceil(distance / 12)));
        for (let i = 1; i <= steps; i++) {
          const x = pointer.x + dx * i / steps, y = pointer.y + dy * i / steps;
          stir(x,y,dx / steps,dy / steps);
        }
      }
    }
    pointer = next;
  }, { passive:true });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; });
  resize();
  syncMotion();
})();
