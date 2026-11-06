/* Original procedural line field. No video, external renderer, or tracking. */
(() => {
  'use strict';
  const canvas = document.querySelector('#contours');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let width = 0, height = 0, frame = 0, lastTime = 0, elapsed = 0;
  let pointerX = 0, pointerY = 0, driftX = 0, driftY = 0;
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

  function segment(path, from, to, stroke, thickness) {
    const offset = path.vertical ? driftX * 12 : driftY * 9;
    const cross = path.position * (path.vertical ? width : height) + offset;
    ctx.beginPath();
    if (path.vertical) { ctx.moveTo(cross, from); ctx.lineTo(cross, to); }
    else { ctx.moveTo(from, cross); ctx.lineTo(to, cross); }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = thickness;
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const still = reducedMotion.matches;
    for (const path of paths) {
      const length = path.vertical ? height : width;
      const tailLength = Math.min(170, length * .22);
      if (still) {
        // A sparse, quiet composition when the visitor prefers no motion.
        if (path.index % 3 === 0) segment(path, length * .15, length * .85, 'rgba(117, 167, 189, .07)', .65);
        continue;
      }
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

      const head = (path.reverse ? 1 - travel : travel) * length;
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
    draw();
  }

  function animate(now) {
    if (reducedMotion.matches || document.hidden) { frame = 0; return; }
    const delta = now - lastTime;
    if (delta >= 1000 / 30) {
      const seconds = Math.min(delta / 1000, .1);
      elapsed += seconds;
      lastTime = now;
      const follow = 1 - Math.exp(-seconds * 3);
      driftX += (pointerX - driftX) * follow;
      driftY += (pointerY - driftY) * follow;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }

  function syncMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    document.body.classList.toggle('motion-paused', reducedMotion.matches);
    if (reducedMotion.matches) { driftX = driftY = 0; draw(); }
    else if (!document.hidden) { lastTime = performance.now(); frame = requestAnimationFrame(animate); }
  }
  reducedMotion.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('resize', resize, { passive:true });
  window.addEventListener('pointermove', event => {
    if (reducedMotion.matches || !finePointer.matches) return;
    pointerX = event.clientX / width * 2 - 1;
    pointerY = event.clientY / height * 2 - 1;
  }, { passive:true });
  document.documentElement.addEventListener('pointerleave', () => { pointerX = pointerY = 0; });
  resize();
  syncMotion();
})();
