'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('poster');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const formats = {
    poster: { width: 1051, height: 1496, window: { x: 132, y: 363, w: 786, h: 788 } },
    snapshot: { width: 1080, height: 1350, window: { x: 110, y: 184, w: 860, h: 860 } },
  };
  let frame = formats.poster.window;
  const photoLayer = document.createElement('canvas');
  photoLayer.width = frame.w;
  photoLayer.height = frame.h;
  const photoCtx = photoLayer.getContext('2d', { willReadFrequently: true });
  const template = new Image();
  const characterImage = new Image();
  const scenes = { corridor: new Image(), classroom: new Image() };
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const state = { source: null, sample: true, format: 'poster', scene: 'corridor', character: true, side: 'right', characterSize: 90, showDate: true, date: localDate, filter: 'missing', intensity: 70, zoom: 1, x: 0, y: 0, flip: false, ready: false };
  $('date').value = localDate;
  let scheduled = false;
  let saving = false;
  let loadingPhoto = false;
  let downloadUrl = null;
  let dragging = null;
  let cameraStream = null;
  let cameraRequest = 0;
  let facing = 'user';
  let timer = null;
  let timerResolve = null;
  let capturing = false;

  function status(message, error = false) {
    $('status').textContent = message;
    $('status').classList.toggle('error', error);
  }

  function randomGenerator(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }

  function dimensions() {
    const source = state.source;
    const cover = Math.max(frame.w / source.width, frame.h / source.height) * state.zoom;
    const width = source.width * cover;
    const height = source.height * cover;
    const maxX = Math.max(0, (width - frame.w) / 2);
    const maxY = Math.max(0, (height - frame.h) / 2);
    return { width, height, maxX, maxY, left: (frame.w - width) / 2 + state.x / 100 * maxX, top: (frame.h - height) / 2 + state.y / 100 * maxY };
  }

  function render() {
    if (!state.ready || !state.source) return;
    const amount = state.intensity / 100;
    const { width, height, left, top } = dimensions();
    photoCtx.save();
    photoCtx.clearRect(0, 0, frame.w, frame.h);
    photoCtx.fillStyle = '#9b9b91'; photoCtx.fillRect(0, 0, frame.w, frame.h);
    photoCtx.filter = `grayscale(1) contrast(${1.04 + .12 * amount}) brightness(${1.04 + .06 * amount}) blur(${.3 + .2 * amount}px)`;
    if (state.flip) { photoCtx.translate(frame.w, 0); photoCtx.scale(-1, 1); }
    photoCtx.drawImage(state.source, left, top, width, height);
    photoCtx.restore();

    if (state.character) {
      const h = frame.h * .73 * state.characterSize / 100;
      const w = h * characterImage.width / characterImage.height;
      const x = state.side === 'right' ? frame.w - w + 8 : -8;
      photoCtx.save();
      photoCtx.filter = 'grayscale(1) contrast(1.08)';
      photoCtx.drawImage(characterImage, x, frame.h - h + 10, w, h);
      photoCtx.restore();
    }

    const pixels = photoCtx.getImageData(0, 0, frame.w, frame.h);
    const rng = randomGenerator(7319);
    for (let p = 0; p < pixels.data.length; p += 4) {
      const grain = (rng() - .5) * (10 + amount * 10);
      const luminance = pixels.data[p] * .2126 + pixels.data[p + 1] * .7152 + pixels.data[p + 2] * .0722;
      let value = luminance + grain;
      if (state.filter === 'found') value = 23 * amount + value * (1 - .18 * amount);
      const v = Math.max(0, Math.min(255, value));
      pixels.data[p] = v;
      pixels.data[p + 1] = v;
      pixels.data[p + 2] = v;
    }
    photoCtx.putImageData(pixels, 0, 0);

    if (state.filter === 'found') {
      photoCtx.save();
      const light = photoCtx.createLinearGradient(0, 0, frame.w, frame.h * .15);
      light.addColorStop(0, `rgba(255,224,163,${.55 * amount})`); light.addColorStop(.4, `rgba(255,229,190,${.12 * amount})`); light.addColorStop(1, 'rgba(255,224,163,0)');
      photoCtx.fillStyle = light; photoCtx.fillRect(0, 0, frame.w, frame.h);
      photoCtx.strokeStyle = `rgba(255,245,218,${.23 * amount})`; photoCtx.lineWidth = 1;
      const scratchRng = randomGenerator(86);
      for (let i = 0; i < 38; i++) { const x = scratchRng() * frame.w; const y = scratchRng() * frame.h; photoCtx.beginPath(); photoCtx.moveTo(x, y); photoCtx.lineTo(x + 1, y + 12 + scratchRng() * 85); photoCtx.stroke(); }
      photoCtx.fillStyle = `rgba(245,233,201,${.25 * amount})`; photoCtx.fillRect(frame.w * .61, 0, 2, frame.h);
      photoCtx.fillStyle = `rgba(40,37,28,${.12 * amount})`; photoCtx.fillRect(frame.w * .61 + 2, 0, 2, frame.h);
      photoCtx.restore();
    }
    if (state.filter === 'beyond' && amount > 0) {
      // Shift actual portrait pixels, preserving the source photo's crop and aspect ratio.
      photoCtx.save();
      photoCtx.globalAlpha = .25 * amount;
      photoCtx.globalCompositeOperation = 'screen';
      photoCtx.drawImage(photoLayer, 16 + amount * 21, -4);
      photoCtx.globalCompositeOperation = 'source-over'; photoCtx.globalAlpha = 1;
      const shadow = photoCtx.createLinearGradient(0, 0, frame.w, 0);
      shadow.addColorStop(0, 'rgba(14,24,22,0)'); shadow.addColorStop(.55, `rgba(14,24,22,${.08 * amount})`); shadow.addColorStop(1, `rgba(8,17,17,${.56 * amount})`);
      photoCtx.fillStyle = shadow; photoCtx.fillRect(0, 0, frame.w, frame.h);
      photoCtx.globalAlpha = .24 * amount;
      photoCtx.drawImage(photoLayer, 0, 277, frame.w, 3, -12 * amount, 277, frame.w, 3);
      photoCtx.drawImage(photoLayer, 0, 513, frame.w, 2, 19 * amount, 513, frame.w, 2);
      photoCtx.restore();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.format === 'poster') ctx.drawImage(template, 0, 0, canvas.width, canvas.height);
    else drawSnapshotBackground();
    ctx.save();
    ctx.beginPath(); ctx.rect(frame.x, frame.y, frame.w, frame.h); ctx.clip();
    ctx.globalCompositeOperation = state.format === 'poster' ? 'multiply' : 'source-over';
    ctx.globalAlpha = state.format === 'poster' ? (state.filter === 'found' ? .82 : .86) : .96;
    ctx.drawImage(photoLayer, frame.x, frame.y);
    ctx.restore();
    if (state.showDate && /^\d{4}-\d{2}-\d{2}$/.test(state.date)) drawDate();
  }

  function drawCover(context, image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    context.drawImage(image, x + (width - image.width * scale) / 2, y + (height - image.height * scale) / 2, image.width * scale, image.height * scale);
  }

  function drawSnapshotBackground() {
    ctx.save();
    ctx.filter = 'saturate(.5) brightness(.62)';
    drawCover(ctx, scenes[state.scene], 0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = '#0007'; ctx.shadowBlur = 32; ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#eee9dc'; ctx.fillRect(86, 160, 908, 1018);
    ctx.restore();
    ctx.fillStyle = '#d4c9b3'; ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
    ctx.fillStyle = '#f5f1e5'; ctx.font = '32px serif'; ctx.fillText('誘界', 55, 78);
    ctx.fillStyle = '#e6e2d4'; ctx.textAlign = 'right'; ctx.font = '19px sans-serif';
    ctx.fillText(state.scene === 'corridor' ? '北廊下' : '201教室', 1025, 75); ctx.textAlign = 'left';
    ctx.fillStyle = '#4c4a40'; ctx.font = '25px serif'; ctx.fillText('校内スナップ', 125, 1124);
  }

  function drawDate() {
    ctx.save();
    ctx.font = '25px ui-monospace, SFMono-Regular, Consolas, monospace'; ctx.textAlign = 'right';
    let x = frame.x + frame.w - 20;
    let y = frame.y + frame.h - 20;
    if (state.format === 'poster') {
      ctx.beginPath(); ctx.rect(frame.x, frame.y, frame.w, frame.h); ctx.clip();
      ctx.fillStyle = '#e9ba83'; ctx.shadowColor = '#352613'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
    } else { y = 1123; ctx.fillStyle = '#80543b'; }
    ctx.fillText(state.date.replaceAll('-', '.'), x, y);
    ctx.restore();
  }

  function setFormat(format) {
    state.format = format;
    const definition = formats[format];
    frame = definition.window;
    canvas.width = definition.width; canvas.height = definition.height;
    photoLayer.width = frame.w; photoLayer.height = frame.h;
    $('poster-wrap').style.aspectRatio = `${canvas.width} / ${canvas.height}`;
    $('output-size').textContent = `${canvas.width} × ${canvas.height} px`;
    $('location-row').hidden = format !== 'snapshot';
    document.querySelectorAll('[data-frame]').forEach((button) => {
      const selected = button.dataset.frame === format;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    syncControls(); scheduleRender();
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; render(); });
  }

  function syncControls() {
    $('zoom').value = Math.round(state.zoom * 100);
    $('zoom-value').textContent = `${state.zoom.toFixed(1)}×`;
    $('position-x').value = state.x; $('position-y').value = state.y;
    $('position-x-value').textContent = Math.round(state.x); $('position-y-value').textContent = Math.round(state.y);
    $('flip').setAttribute('aria-pressed', String(state.flip));
    const d = state.source ? dimensions() : null;
    $('position-x').disabled = !d || d.maxX < 1;
    $('position-y').disabled = !d || d.maxY < 1;
    $('date').disabled = !state.showDate;
    $('character-size').disabled = !state.character;
    document.querySelectorAll('[data-side]').forEach((button) => {
      button.disabled = !state.character;
      button.classList.toggle('selected', button.dataset.side === state.side);
      button.setAttribute('aria-pressed', String(button.dataset.side === state.side));
    });
  }

  function resetComposition() {
    Object.assign(state, { zoom: 1, x: 0, y: 0, flip: false });
    syncControls(); scheduleRender();
  }

  function setSource(source, label) {
    state.source = source;
    state.sample = false;
    $('source-label').textContent = label;
    $('download-fallback').hidden = true;
    resetComposition();
  }

  function fitSource(image) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) throw new Error('画像のサイズを読み取れませんでした。');
    const scale = Math.min(1, 2560 / Math.max(width, height));
    const reduced = document.createElement('canvas');
    reduced.width = Math.max(1, Math.round(width * scale)); reduced.height = Math.max(1, Math.round(height * scale));
    reduced.getContext('2d').drawImage(image, 0, 0, reduced.width, reduced.height);
    return reduced;
  }

  $('photo-input').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file || loadingPhoto) return;
    if (file.size > 40 * 1024 * 1024) { status('写真が大きすぎます。40MB以下の画像を選んでください。', true); event.target.value = ''; return; }
    loadingPhoto = true;
    status('写真を読み込んでいます…');
    try {
      const image = new Image();
      const url = URL.createObjectURL(file);
      try { image.src = url; await image.decode(); setSource(fitSource(image), '選んだ写真'); }
      finally { URL.revokeObjectURL(url); }
      status('写真を読み込みました。');
    } catch { status('この画像を読み込めませんでした。JPEG・PNG・WebP形式などで選び直してください。', true); }
    finally { loadingPhoto = false; event.target.value = ''; }
  });

  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((b) => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
      scheduleRender();
    });
  });
  $('intensity').addEventListener('input', (event) => { state.intensity = Number(event.target.value); $('intensity-value').textContent = state.intensity; scheduleRender(); });
  $('zoom').addEventListener('input', (event) => { state.zoom = Number(event.target.value) / 100; syncControls(); scheduleRender(); });
  for (const axis of ['x', 'y']) $('position-' + axis).addEventListener('input', (event) => { state[axis] = Number(event.target.value); syncControls(); scheduleRender(); });
  $('reset').addEventListener('click', resetComposition);
  $('flip').addEventListener('click', () => { state.flip = !state.flip; syncControls(); scheduleRender(); });
  document.querySelectorAll('[data-frame]').forEach((button) => button.addEventListener('click', () => setFormat(button.dataset.frame)));
  document.querySelectorAll('[data-side]').forEach((button) => button.addEventListener('click', () => { state.side = button.dataset.side; syncControls(); scheduleRender(); }));
  $('character').addEventListener('change', (event) => { state.character = event.target.checked; syncControls(); scheduleRender(); });
  $('show-date').addEventListener('change', (event) => { state.showDate = event.target.checked; syncControls(); scheduleRender(); });
  $('date').addEventListener('input', (event) => { state.date = event.target.validity.valid ? event.target.value : ''; scheduleRender(); });
  $('character-size').addEventListener('input', (event) => { state.characterSize = Number(event.target.value); $('character-size-value').textContent = state.characterSize; scheduleRender(); });
  $('location').addEventListener('change', (event) => {
    state.scene = event.target.value;
    if (state.sample) state.source = scenes[state.scene];
    scheduleRender();
  });
  $('open-help').addEventListener('click', () => $('help-dialog').showModal());
  $('close-help').addEventListener('click', () => $('help-dialog').close());

  const wrap = $('poster-wrap');
  wrap.addEventListener('pointerdown', (event) => {
    if (!state.source || (event.pointerType === 'mouse' && event.button !== 0)) return;
    wrap.setPointerCapture(event.pointerId);
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: state.x, startY: state.y };
  });
  wrap.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    const d = dimensions();
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    const dx = (event.clientX - dragging.x) * scale;
    const dy = (event.clientY - dragging.y) * scale;
    if (d.maxX > 0) state.x = Math.max(-100, Math.min(100, dragging.startX + dx / d.maxX * 100 * (state.flip ? -1 : 1)));
    if (d.maxY > 0) state.y = Math.max(-100, Math.min(100, dragging.startY + dy / d.maxY * 100));
    syncControls(); scheduleRender();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) wrap.addEventListener(type, () => { dragging = null; });
  wrap.addEventListener('keydown', (event) => {
    const keys = { ArrowLeft: ['x', -5], ArrowRight: ['x', 5], ArrowUp: ['y', -5], ArrowDown: ['y', 5] };
    if (!keys[event.key]) return;
    event.preventDefault();
    const [axis, delta] = keys[event.key];
    state[axis] = Math.max(-100, Math.min(100, state[axis] + delta * (axis === 'x' && state.flip ? -1 : 1)));
    syncControls(); scheduleRender();
  });

  $('save').addEventListener('click', async () => {
    if (!state.ready || saving) return;
    saving = true; $('save').disabled = true;
    status('保存用の画像を作っています…');
    try {
      render();
      const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNGの生成に失敗しました。')), 'image/png'));
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(blob);
      const date = new Date();
      const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
      const link = document.createElement('a'); link.href = downloadUrl; link.download = `yukai-${state.format}-${state.filter}-${stamp}.png`;
      document.body.append(link); link.click(); link.remove();
      const fallback = $('download-fallback'); fallback.href = downloadUrl; fallback.target = '_blank'; fallback.rel = 'noopener'; fallback.hidden = false;
      status('PNGを保存しました。ダウンロード先を確認してください。');
    } catch { status('画像を保存できませんでした。もう一度お試しください。', true); }
    finally { saving = false; $('save').disabled = false; }
  });

  $('share').addEventListener('click', async () => {
    if (!state.ready || saving) return;
    saving = true; $('share').disabled = true;
    try {
      render();
      const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG error')), 'image/png'));
      const file = new File([blob], `yukai-${state.format}.png`, { type: 'image/png' });
      if (!navigator.canShare?.({ files: [file] })) throw new Error('File share unavailable');
      await navigator.share({ files: [file], title: '誘界カメラ' });
    } catch (error) { if (error.name !== 'AbortError') status('この端末では共有できません。「画像を保存」をお使いください。', true); }
    finally { saving = false; $('share').disabled = false; }
  });

  function cancelCountdown() {
    clearTimeout(timer); timer = null;
    if (timerResolve) { timerResolve(false); timerResolve = null; }
    capturing = false; $('countdown').textContent = '';
  }

  function stopStream() {
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null; $('camera-video').srcObject = null;
  }

  function closeCamera() {
    cameraRequest++;
    cancelCountdown(); stopStream();
    if ($('camera-dialog').open) $('camera-dialog').close();
  }

  function cameraError(error) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'カメラを使用できません。ブラウザのカメラ許可を確認するか、「写真を選ぶ」をお使いください。';
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return '利用できるカメラが見つかりません。「写真を選ぶ」からも作れます。';
    if (error.name === 'NotReadableError') return 'カメラが別のアプリで使用中の可能性があります。閉じてから撮り直してください。';
    return 'カメラを起動できませんでした。「写真を選ぶ」からも作れます。';
  }

  async function startCamera() {
    const request = ++cameraRequest;
    cancelCountdown(); stopStream();
    $('capture').disabled = true; $('switch-camera').disabled = true;
    $('camera-status').textContent = 'カメラを準備しています…';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1600 }, height: { ideal: 1600 } } });
      if (request !== cameraRequest || !$('camera-dialog').open) { stream.getTracks().forEach((track) => track.stop()); return; }
      cameraStream = stream;
      const video = $('camera-video'); video.srcObject = stream; video.classList.toggle('mirrored', facing === 'user');
      await video.play();
      if (request !== cameraRequest || !$('camera-dialog').open) return;
      $('capture').disabled = false; $('switch-camera').disabled = false;
      $('camera-status').textContent = '顔や上半身を枠に合わせてください。撮影後に位置を調整できます。';
    } catch (error) {
      if (request !== cameraRequest) return;
      stopStream();
      $('camera-status').textContent = cameraError(error);
      $('switch-camera').disabled = false;
    }
  }

  $('open-camera').addEventListener('click', () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status('カメラはHTTPSまたはlocalhostで開いたときに使えます。「写真を選ぶ」でも作れます。', true); return;
    }
    $('camera-dialog').showModal(); startCamera();
  });
  $('close-camera').addEventListener('click', closeCamera);
  $('camera-dialog').addEventListener('cancel', (event) => { event.preventDefault(); closeCamera(); });
  $('camera-dialog').addEventListener('close', () => { cameraRequest++; cancelCountdown(); stopStream(); });
  $('switch-camera').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; startCamera(); });
  $('capture').addEventListener('click', async () => {
    const video = $('camera-video');
    if (capturing || !cameraStream || !video.videoWidth) return;
    capturing = true; $('capture').disabled = true; $('switch-camera').disabled = true;
    for (let i = 3; i > 0; i--) {
      $('countdown').textContent = i;
      const elapsed = await new Promise((resolve) => { timerResolve = resolve; timer = setTimeout(() => { timerResolve = null; resolve(true); }, 1000); });
      if (!elapsed || !$('camera-dialog').open || !cameraStream) return;
    }
    try {
      // Match the square viewfinder and its selfie mirror exactly.
      const shot = document.createElement('canvas');
      const side = Math.min(video.videoWidth, video.videoHeight);
      shot.width = Math.min(2560, side); shot.height = shot.width;
      const c = shot.getContext('2d');
      if (facing === 'user') { c.translate(shot.width, 0); c.scale(-1, 1); }
      c.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, shot.width, shot.height);
      setSource(shot, '撮影した写真');
      status('撮影しました。');
      closeCamera();
    } catch { closeCamera(); status('撮影できませんでした。もう一度お試しください。', true); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && $('camera-dialog').open) closeCamera(); });
  window.addEventListener('pagehide', () => { closeCamera(); if (downloadUrl) URL.revokeObjectURL(downloadUrl); });

  $('save').disabled = true;
  function loadImage(image, path) {
    return new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = path; });
  }
  Promise.all([
    loadImage(template, './assets/missing-poster.png'),
    loadImage(characterImage, './assets/yukai-chan.png'),
    loadImage(scenes.corridor, './assets/school-corridor.jpg'),
    loadImage(scenes.classroom, './assets/school-classroom.jpg'),
  ]).then(() => {
    state.ready = true;
    if (!state.source) { state.source = scenes.corridor; state.sample = true; }
    if ($('status').textContent === '読み込み中…') status('');
    syncControls(); scheduleRender(); $('save').disabled = false;
    try { $('share').hidden = !navigator.canShare?.({ files: [new File([''], 'yukai.png', { type: 'image/png' })] }); }
    catch { $('share').hidden = true; }
  }).catch(() => status('素材を読み込めませんでした。再読み込みしてください。', true));
})();
