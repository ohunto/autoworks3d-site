/* A procedural contour sculpture: no libraries, textures, tracking, or model files. */
(() => {
  'use strict';
  const canvas = document.querySelector('#contours');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const toggle = document.querySelector('.motion-toggle');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let width = 0, height = 0, frame = 0, lastTime = 0, phase = 0;
  let paused = reducedMotion.matches;
  let pointerX = 0, pointerY = 0, driftX = 0, driftY = 0;

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const scale = Math.max(width * .51, height * .57);
    const centerX = width * .53 + driftX * 15;
    const centerY = height * .52 + driftY * 12;
    const rotation = -.52 + Math.sin(phase * .19) * .07;
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    const lines = width < 600 ? 43 : 64;
    const points = width < 600 ? 170 : 230;
    for (let i = 0; i < lines; i++) {
      const layer = i / (lines - 1);
      const tube = (layer - .5) * 2;
      ctx.beginPath();
      for (let j = 0; j <= points; j++) {
        const angle = j / points * Math.PI * 2;
        const ripple = Math.sin(angle * 3 + phase * .25) * .065;
        const radius = 1 + tube * .24 + ripple;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius * .68 + Math.sin(angle * 2 + phase * .2) * .10 + tube * .13;
        const px = centerX + (x * cos - y * sin) * scale;
        const py = centerY + (x * sin + y * cos) * scale;
        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const light = Math.sin(layer * Math.PI);
      const gradient = ctx.createLinearGradient(width * .1, 0, width * .9, height);
      gradient.addColorStop(0, `rgba(58, 174, 202, ${.09 + light * .22})`);
      gradient.addColorStop(.36, `rgba(113, 222, 240, ${.13 + light * .33})`);
      gradient.addColorStop(.6, `rgba(25, 122, 155, ${.07 + light * .14})`);
      gradient.addColorStop(1, `rgba(85, 219, 231, ${.15 + light * .42})`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = i % 9 === 0 ? 1.15 : .65;
      ctx.stroke();
    }
  }
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  function animate(now) {
    if (paused || document.hidden) { frame = 0; return; }
    // Cap drawing at 30 fps; large displays do not need a full-rate background.
    if (now - lastTime >= 1000 / 30) {
      phase += Math.min((now - lastTime) / 1000, .06);
      lastTime = now;
      driftX += (pointerX - driftX) * .045;
      driftY += (pointerY - driftY) * .045;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }
  function syncMotion() {
    document.body.classList.toggle('motion-paused', paused);
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.querySelector('span').textContent = paused ? 'Resume motion' : 'Pause motion';
    toggle.querySelector('path').setAttribute('d', paused ? 'M5 3l7 5-7 5V3Z' : 'M5 4v8M11 4v8');
    cancelAnimationFrame(frame);
    frame = 0;
    if (!paused && !document.hidden) { lastTime = performance.now(); frame = requestAnimationFrame(animate); }
  }
  toggle.hidden = false;
  toggle.addEventListener('click', () => { paused = !paused; syncMotion(); });
  reducedMotion.addEventListener('change', () => { paused = reducedMotion.matches; syncMotion(); });
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', event => {
    if (paused || !finePointer.matches) return;
    pointerX = event.clientX / width * 2 - 1;
    pointerY = event.clientY / height * 2 - 1;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  resize();
  syncMotion();
})();
