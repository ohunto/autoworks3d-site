(() => {
  'use strict';

  const video = document.querySelector('#background-video');
  const toggle = document.querySelector('.motion-toggle');
  if (!video || !toggle) return;

  const label = toggle.querySelector('span');
  const icon = toggle.querySelector('path');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let wantsMotion = !reducedMotion.matches && !connection?.saveData;
  let failed = false;
  let playRequest = 0;

  function updateControl() {
    const playing = !video.paused && !failed;
    label.textContent = playing ? 'Pause motion' : 'Play motion';
    icon.setAttribute('d', playing ? 'M5 4v8M11 4v8' : 'M5 3l7 5-7 5V3Z');
    toggle.hidden = failed;
  }

  async function syncPlayback() {
    const request = ++playRequest;
    if (failed || !wantsMotion || document.hidden) {
      video.pause();
      updateControl();
      return;
    }
    // Keep the video download optional for reduced-motion and data-saving visitors.
    if (!video.getAttribute('src')) video.src = '/assets/media/factory-loop.mp4';
    video.muted = true;
    try {
      await video.play();
      if (request !== playRequest && (!wantsMotion || document.hidden)) video.pause();
    } catch {
      // Autoplay can be blocked by the browser; leave an explicit play control.
      if (request === playRequest) wantsMotion = false;
    }
    updateControl();
  }

  toggle.addEventListener('click', () => {
    wantsMotion = !wantsMotion;
    syncPlayback();
  });
  document.addEventListener('visibilitychange', syncPlayback);
  reducedMotion.addEventListener('change', () => {
    wantsMotion = !reducedMotion.matches && !connection?.saveData;
    syncPlayback();
  });
  connection?.addEventListener('change', () => {
    if (connection.saveData) {
      wantsMotion = false;
      syncPlayback();
    }
  });
  video.addEventListener('playing', updateControl);
  video.addEventListener('pause', updateControl);
  video.addEventListener('error', () => {
    failed = true;
    wantsMotion = false;
    video.pause();
    video.removeAttribute('src');
    video.load();
    updateControl();
  });

  updateControl();
  syncPlayback();
})();
