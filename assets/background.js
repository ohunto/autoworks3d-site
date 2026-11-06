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
  let paths = [];
  const clamp = value => Math.max(0, Math.min(1, value));

  function makePaths() {
    const mobile = width < 600;
    const columns = mobile ? [.08, .29, .71, .92] : [.065, .19, .345, .5, .655, .81, .935];
    const rows = mobile ? [.12, .25, .49, .73, .88] : [.115, .255, .435, .615, .795, .91];
    paths = [
      ...columns.map((position, i) => ({vertical:true, position, delay:.12 + i * .07, duration:9 + i * 1.1, offset:i * .173, reverse:i % 2 === 0})),
      ...rows.map((position, i) => ({vertical:false, position, delay:i * .1, duration:11 + i * 1.3, offset:.24 + i * .217, reverse:i % 2 !== 0}))
    ];
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
      const introDuration = (path.vertical ? 2.2 : 2.6) + path.position * .6;
      const introProgress = Math.max(0, (elapsed - path.delay) / introDuration);
      const reveal = still ? 1 : clamp(introProgress);
      if (!reveal) continue;
      // The first light pass is the pen: nothing is drawn ahead of its leading tip.
      const from = path.reverse ? length * (1 - reveal) : 0;
      const to = path.reverse ? length : length * reveal;
      const cross = path.position * (path.vertical ? width : height);
      const base = path.vertical ? ctx.createLinearGradient(0, 0, 0, height) : ctx.createLinearGradient(0, 0, width, 0);
      base.addColorStop(0, 'rgba(117, 167, 189, 0.035)');
      base.addColorStop(.18, 'rgba(117, 167, 189, 0.23)');
      base.addColorStop(.5, 'rgba(117, 167, 189, 0.14)');
      base.addColorStop(.82, 'rgba(117, 167, 189, 0.23)');
      base.addColorStop(1, 'rgba(117, 167, 189, 0.035)');
      segment(path, from, to, base, .65);
      if (still) continue;

      // Let the drawing light's entire tail leave before starting the ambient passes.
      const introEnd = path.delay + introDuration * (1 + tailLength / length);
      const repeatStart = introEnd + .9 + path.offset * 2;
      let travel;
      if (elapsed <= introEnd) travel = introProgress;
      else if (elapsed < repeatStart) continue;
      else travel = ((elapsed - repeatStart) / path.duration % 1) * 1.55 - .25;
      const head = (path.reverse ? 1 - travel : travel) * length;
      const tail = head + (path.reverse ? tailLength : -tailLength);
      const strength = elapsed <= introEnd ? .95 : .8;
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
