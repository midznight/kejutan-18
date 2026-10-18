(() => {
  'use strict';

  const C = window.SURPRISE_CONTENT;
  if (!C) return;

  const app = document.getElementById('app');
  const audio = document.getElementById('birthday-audio');
  const rotateCopy = document.getElementById('rotate-copy');
  const reducedMotion = !!(C.settings.reducedMotionRespect && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const HEART = '<svg class="heart-mark" aria-hidden="true"><use href="#heart-blue"></use></svg>';
  const BIG_HEART = '<svg class="heart-mark big" aria-hidden="true"><use href="#heart-blue"></use></svg>';
  const TINY_HEART = '<svg class="heart-mark tiny" aria-hidden="true"><use href="#heart-blue"></use></svg>';
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const withName = (value) => String(value ?? '').replaceAll('{{name}}', C.name);
  const formatted = (value) => safe(withName(value)).replaceAll('{{heart}}', HEART).replaceAll('\n', '<br>');
  const imageIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="3.5" width="17" height="17" rx="2.6"/><circle cx="9" cy="9" r="1.7"/><path d="m4.5 17 5-5 3.5 3 2.2-2.1 4.3 4.1"/></svg>';
  const lockIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.3a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15" r="1"/></svg>';
  let currentScene = 0;
  let unlocked = false;
  let balloonTimer = null;
  let audioAvailable = false;
  let audioUnlocked = false;
  let audioMuted = false;
  let canvasRAF = 0;
  let canvasActive = false;
  let particles = [];
  let lastBurst = 0;
  let canvasContext = null;
  let canvasElement = null;
  let canvasWidth = 0;
  let canvasHeight = 0;
  const sceneIds = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'];
  const riddleLevels = Array.isArray(C.riddles) ? C.riddles.slice(0, 3) : [];

  if (rotateCopy) rotateCopy.textContent = C.copy.rotate;
  const loadingLabel = document.getElementById('loading-state');
  if (loadingLabel) loadingLabel.setAttribute('aria-label', C.copy.loadingLabel);
  document.title = C.copy.documentTitle;
  document.documentElement.style.setProperty('--purple', C.colors.primary || '#a78bfa');
  document.documentElement.style.setProperty('--blue', C.colors.blue || '#7dd3fc');
  document.documentElement.style.setProperty('--gold', C.colors.gold || '#ffd69b');

  const makeTopline = (label, number) => `<div class="scene-topline"><span class="eyebrow">${formatted(label)}</span><span class="scene-number">${String(number).padStart(2, '0')} / 11</span></div>`;
  const makeProgress = (active) => `<div class="progress-dots" aria-hidden="true">${sceneIds.map((_, i) => `<span class="${i === active ? 'active' : ''}"></span>`).join('')}</div>`;
  const button = (label, action, secondary = false, extra = '') => `<button type="button" class="${secondary ? 'secondary-btn' : 'primary-btn'}" data-action="${action}" ${extra}>${formatted(label)}</button>`;
  const makeScene = (id, content, num) => `<section id="${id}" class="scene${num === 0 ? ' is-active' : ''}" aria-label="${safe(id)}"><div class="scene-inner">${content}${makeProgress(num)}</div></section>`;

  function renderApp() {
    const c = C.copy;
    const s0 = `
      <div class="hero-copy">
        <div class="hero-orbit" aria-hidden="true"><span class="orbit-ring"></span><span class="orbit-ring ring-two"></span><div class="orbit-center">${BIG_HEART}</div></div>
        ${makeTopline(c.startEyebrow, 0)}
        <p class="kicker">${formatted(c.startKicker)}</p>
        <h1 class="hero-title"><span class="accent">${formatted(c.startTitle)}</span></h1>
        <p class="body-copy">${formatted(c.startBody)}</p>
        <div class="actions">${button(c.startButton, 'start')}</div>
        <p class="fine-copy" style="margin-top:22px">${formatted(c.startFooter)}</p>
      </div>`;

    const riddle = riddleLevels[0] || { question: "", hint: "" };
    const riddleTotal = Math.max(1, riddleLevels.length);
    const s1 = `
      ${makeTopline(c.lockEyebrow, 1)}
      <div class="glass-card lock-panel">
        <div class="lock-symbol">${lockIcon}</div>
        <p class="kicker">${formatted(c.lockKicker)}</p>
        <p class="fine-copy lock-level" id="lock-level-progress">${formatted(c.lockLevelProgress).replaceAll('{{current}}', '1').replaceAll('{{total}}', String(riddleTotal))}</p>
        <h2 class="lock-question" id="lock-question">${formatted(riddle.question)}</h2>
        <p class="body-copy">${formatted(c.lockBody)}</p>
        <form id="answer-form" class="answer-form">
          <input class="answer-input" id="answer-input" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${safe(c.lockPlaceholder)}" aria-label="${safe(c.lockPlaceholder)}">
          <button class="primary-btn" type="submit">${formatted(c.lockButton)}</button>
        </form>
        <p class="lock-feedback" id="lock-feedback" role="status" aria-live="polite"></p>
        <p class="hint" id="lock-hint">${formatted(riddle.hint)}</p>
      </div>`;

    const s2 = `
      ${makeTopline(c.heroEyebrow, 2)}
      <div class="hero-copy">
        <div class="hero-orbit" aria-hidden="true"><span class="orbit-ring"></span><span class="orbit-ring ring-two"></span><div class="orbit-center"><span class="big-number">18</span></div></div>
        <p class="kicker">${formatted(c.heroEyebrow)}</p>
        <h1 class="hero-title"><span class="accent">${formatted(c.heroTitle)}</span></h1>
        <p class="body-copy">${formatted(c.heroAge)}</p>
        <p class="body-copy">${formatted(c.heroBody)}</p>
        <div class="actions">${button(c.heroButton, 'next')}</div>
      </div>`;

    const s3 = `
      ${makeTopline(c.balloonsEyebrow, 3)}
      <h2 class="section-title">${formatted(c.balloonsTitle)}</h2>
      <p class="body-copy">${formatted(c.balloonsBody)}</p>
      <div class="balloon-arena" id="balloon-arena" aria-label="${safe(c.balloonsAria)}"></div>
      <div class="balloon-string-note"><span id="balloon-progress-label">${formatted(c.balloonsProgress)}</span>: <strong id="balloon-counter">0</strong> / <strong id="balloon-total">0</strong></div>
      <div class="balloon-progress"><span id="balloon-progress-fill"></span></div>
      <p id="balloon-reveal" class="closing-line" aria-live="polite" style="font-size:clamp(17px,4.4vw,25px);min-height:28px"></p>
      <div class="actions" id="balloon-actions" hidden>${button(c.balloonsButton, 'next')}</div>`;

    const reasons = C.reasons.map((reason, i) => `<article class="reason-card" style="--glow:${i % 3 === 0 ? '#bca6ff' : i % 3 === 1 ? '#7dd3fc' : '#ffd69b'}"><span class="reason-index">0${i + 1} / ${String(C.reasons.length).padStart(2, '0')}</span><h3>${formatted(reason.title)}</h3><p>${formatted(reason.body)}</p></article>`).join('');
    const s4 = `
      ${makeTopline(c.reasonsEyebrow, 4)}
      <p class="kicker">${formatted(c.reasonsKicker)}</p>
      <h2 class="section-title">${formatted(c.reasonsTitle)}</h2>
      <p class="body-copy">${formatted(c.reasonsBody)}</p>
      <div class="reason-grid">${reasons}</div>
      <div class="actions">${button(c.reasonsButton, 'next')}</div>`;

    const candles = Array.from({ length: Math.max(1, Math.min(18, Number(C.age) || 18)) }, (_, i) => `<span class="candle" style="--delay:${i * 24}ms"><span class="flame"></span></span>`).join('');
    const s5 = `
      ${makeTopline(c.cakeEyebrow, 5)}
      <div class="hero-copy">
        <p class="kicker">${formatted(c.cakeKicker)}</p>
        <h2 class="section-title">${formatted(c.cakeTitle)}</h2>
        <p class="body-copy">${formatted(c.cakeInstruction)}</p>
        <div class="glass-card cake-wrap"><div class="cake-stage" id="cake-stage"><div class="candle-row">${candles}</div><div class="cake-top"></div><div class="cake-icing"></div><div class="cake-body"></div></div></div>
        <button id="blow-button" type="button" class="hold-button" aria-describedby="blow-help"><span>${formatted(c.cakeInstruction)}</span></button>
        <p class="fine-copy" id="blow-help" style="margin-top:12px">${formatted(c.cakeInstruction)}</p>
        <p id="wish-after" class="body-copy" hidden>${formatted(c.cakeAfter)}</p>
        <div class="actions" id="cake-actions" hidden>${button(c.cakeButton, 'next')}</div>
      </div>`;

    const s6 = `
      ${makeTopline(c.interludeEyebrow, 6)}
      <div class="hero-copy">
        <div class="hero-orbit" aria-hidden="true"><span class="orbit-ring"></span><span class="orbit-ring ring-two"></span><div class="orbit-center">${BIG_HEART}</div></div>
        <p class="kicker">${formatted(c.interludeKicker)}</p>
        <h2 class="section-title">${formatted(c.interludeTitle)}</h2>
        <p class="body-copy">${formatted(c.interludeBody)}</p>
        <p class="fine-copy">${formatted(c.interludeNote)}</p>
        <div class="actions">${button(c.interludeButton, 'next')}</div>
      </div>`;

    const photos = C.photos.map((photo, i) => `<article class="gallery-card" style="--rot:${i % 2 ? '1.5deg' : '-1.5deg'};--lift:${i % 3 ? '3px' : '-3px'}" data-photo-index="${i}"><div class="gallery-photo"><div class="photo-placeholder"><div class="frame-icon">${imageIcon}</div><p>${formatted(c.photoEmpty)}</p><small>${formatted(c.photoEmptyNote)}</small></div><img data-src="${safe(photo.src)}" loading="lazy" decoding="async" alt="${safe(c.photoAlt)} ${i + 1}"></div><div class="gallery-caption"><span class="caption-count">${String(i + 1).padStart(2, '0')}</span><span>${formatted(photo.caption)}</span></div></article>`).join('');
    const s7 = `
      ${makeTopline(c.galleryEyebrow, 7)}
      <p class="kicker">${String(C.photos.length).padStart(2, '0')} ${formatted(c.galleryKicker)}</p>
      <h2 class="section-title">${formatted(c.galleryTitle)}</h2>
      <p class="body-copy">${formatted(c.galleryBody)}</p>
      <div class="gallery-strip" id="gallery-strip" aria-label="${safe(c.galleryAria)}">${photos}</div>
      <div class="gallery-foot"><span>${formatted(c.gallerySwipe)}</span><span id="gallery-index">01 / ${String(C.photos.length).padStart(2, '0')}</span></div>
      <div class="actions">${button(c.galleryButton, 'next')}</div>`;

    const s8 = `
      ${makeTopline(c.preletterEyebrow, 8)}
      <div class="hero-copy">
        <div class="hero-orbit" aria-hidden="true"><span class="orbit-ring"></span><span class="orbit-ring ring-two"></span><div class="orbit-center">${BIG_HEART}</div></div>
        <p class="kicker">${formatted(c.preletterKicker)}</p>
        <h2 class="section-title">${formatted(c.preletterTitle)}</h2>
        <p class="body-copy">${formatted(c.preletterBody)}</p>
        <div class="actions">${button(c.preletterButton, 'next')}</div>
      </div>`;

    const paragraphs = C.letter.map((paragraph, i) => `<p class="letter-paragraph" data-letter-paragraph="${i}">${formatted(paragraph)}</p>`).join('');
    const s9 = `
      ${makeTopline(c.letterEyebrow, 9)}
      <div class="hero-copy" style="text-align:left"><p class="kicker">${formatted(c.letterKicker)}</p><h2 class="section-title">${formatted(c.letterTitle)}</h2></div>
      <article class="letter-paper" id="letter-paper">${paragraphs}</article>
      <div class="actions" style="justify-content:center">${button(c.letterButton, 'next')}</div>`;

    const s10 = `
      ${makeTopline(c.finaleEyebrow, 10)}
      <div class="hero-copy">
        <p class="kicker">${formatted(c.finaleKicker)}</p>
        <h2 class="section-title">${formatted(c.finaleTitle)}</h2>
        <p class="body-copy">${formatted(c.closing)}</p>
      </div>
      <div class="finale-stage" id="finale-stage"><canvas id="finale-canvas" aria-hidden="true"></canvas><div class="gift-stage" id="gift-stage"><button type="button" class="gift-wrap" id="gift-wrap" aria-label="${safe(c.giftButton)}"><span class="gift-bow"></span><span class="gift-lid"></span><span class="gift-box"></span></button></div><div class="voucher" id="voucher"><div class="voucher-label">${formatted(c.voucherLabel)}</div><h3>${formatted(C.finale.title || c.voucherTitle)}</h3><p>${formatted(C.finale.body || c.voucherBody)}</p><div class="voucher-bottom"><span>${formatted(c.voucherFoot)}</span>${BIG_HEART}</div></div></div>
      <div class="hero-copy"><button type="button" class="primary-btn" id="gift-button">${formatted(c.giftButton)}</button><h2 class="closing-line" id="closing-line">${formatted(C.finale.message || C.finale.closing || c.closing)}</h2><div class="replay-row">${button(c.replay, 'replay', true)}</div></div>`;

    app.innerHTML = [s0,s1,s2,s3,s4,s5,s6,s7,s8,s9,s10].map((html, i) => makeScene(sceneIds[i], html, i)).join('');
    installEventHandlers();
    observePhotos();
    setupLetterReveal();
    setupGalleryProgress();
  }

  function installEventHandlers() {
    app.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      const action = actionButton.dataset.action;
      if (action === 'start') {
        unlockAudioOnGesture();
        setScene(1);
      } else if (action === 'next') {
        setScene(Math.min(10, currentScene + 1));
      } else if (action === 'replay') {
        stopCanvas();
        setScene(0);
      }
    });

    const form = document.getElementById('answer-form');
    const answer = document.getElementById('answer-input');
    const feedback = document.getElementById('lock-feedback');
    const hint = document.getElementById('lock-hint');
    const question = document.getElementById('lock-question');
    const progress = document.getElementById('lock-level-progress');
    let activeRiddleIndex = 0;
    let incorrectAttempts = 0;
    if (form) form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (unlocked) return;
      const level = riddleLevels[activeRiddleIndex];
      if (!level) return;
      const typed = normalizeAnswer(answer.value);
      if (!typed) {
        feedback.textContent = C.copy.lockWrong;
        answer.focus();
        return;
      }
      let hash;
      try {
        hash = await sha256(typed);
      } catch (_) {
        feedback.textContent = C.copy.lockCryptoUnavailable;
        return;
      }
      const validHashes = Array.isArray(level.acceptedHashes) ? level.acceptedHashes : [];
      const accepted = validHashes.some(value => constantTimeEqual(value, hash));
      if (accepted && activeRiddleIndex < riddleLevels.length - 1) {
        activeRiddleIndex += 1;
        incorrectAttempts = 0;
        const nextLevel = riddleLevels[activeRiddleIndex];
        question.textContent = withName(nextLevel.question);
        hint.textContent = withName(nextLevel.hint);
        hint.classList.remove('visible');
        progress.textContent = withName(C.copy.lockLevelProgress).replaceAll('{{current}}', String(activeRiddleIndex + 1)).replaceAll('{{total}}', String(riddleLevels.length));
        feedback.textContent = C.copy.lockLevelSuccess;
        feedback.classList.add('success');
        answer.value = '';
        answer.focus();
      } else if (accepted) {
        unlocked = true;
        feedback.textContent = C.copy.lockSuccess;
        feedback.classList.add('success');
        answer.disabled = true;
        form.querySelector('button').disabled = true;
        setTimeout(() => setScene(2), reducedMotion ? 100 : 750);
      } else {
        incorrectAttempts += 1;
        const messages = Array.isArray(level.wrongMessages) && level.wrongMessages.length ? level.wrongMessages : [C.copy.lockWrong];
        feedback.textContent = withName(messages[Math.min(incorrectAttempts - 1, messages.length - 1)]);
        feedback.classList.remove('success');
        if (incorrectAttempts >= 2) hint.classList.add('visible');
        answer.value = '';
        answer.focus();
        answer.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: reducedMotion ? 1 : 260 });
      }
    });

    setupBalloons();
    setupCakeHold();
    setupFinale();
    createAudioToggle();
  }

  function createAudioToggle() {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'audio-toggle';
    toggle.hidden = true;
    toggle.id = 'audio-toggle';
    toggle.textContent = C.copy.audioOn;
    toggle.title = C.music.title;
    toggle.setAttribute('aria-label', C.copy.audioOn);
    toggle.addEventListener('click', () => {
      if (!audioAvailable) {
        toggle.textContent = C.copy.audioUnavailable;
        return;
      }
      audioMuted = !audioMuted;
      audio.muted = audioMuted;
      toggle.textContent = audioMuted ? C.copy.audioOn : C.copy.audioOff;
      toggle.setAttribute('aria-label', toggle.textContent);
    });
    document.body.appendChild(toggle);
    verifyAudio();
  }

  async function verifyAudio() {
    if (!C.music?.enabled || !C.music?.src) return;
    try {
      const response = await fetch(C.music.src, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) return;
      const type = response.headers.get('content-type') || '';
      if (type && !type.includes('audio') && !type.includes('octet-stream')) return;
      audio.src = C.music.src;
      audio.load();
      audioAvailable = true;
    } catch (_) {
      audioAvailable = false;
    }
  }

  async function unlockAudioOnGesture() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    if (!audioAvailable) return;
    try {
      audio.volume = 0;
      audio.muted = audioMuted;
      await audio.play();
    } catch (_) {
      // Audio opsional: situs tetap berjalan saat file tidak ada atau browser menolak playback.
    }
  }

  function startMusicForHero() {
    const toggle = document.getElementById('audio-toggle');
    if (toggle) toggle.hidden = false;
    if (!audioAvailable) {
      if (toggle) {
        toggle.disabled = true;
        toggle.textContent = C.copy.audioUnavailable;
        toggle.setAttribute('aria-label', C.copy.audioUnavailable);
      }
      return;
    }
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;
      audio.muted = audioMuted;
      const playResult = audio.play();
      if (playResult?.catch) playResult.catch(() => {});
      if (!audioMuted) fadeAudio(0, 1, Math.max(0.1, Number(C.music.fadeSeconds) || 3) * 1000);
    } catch (_) {
      // Gagal audio tidak menghentikan alur kejutan.
    }
  }

  function fadeAudio(from, to, duration) {
    if (reducedMotion) { audio.volume = to; return; }
    const started = performance.now();
    const frame = (time) => {
      const progress = Math.min(1, (time - started) / duration);
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * progress));
      if (progress < 1 && currentScene === 2 && !audioMuted) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function setScene(index) {
    index = Math.max(0, Math.min(10, index));
    if (index === 1 && !unlocked) { /* riddle is the expected first gate */ }
    const previous = document.getElementById(sceneIds[currentScene]);
    const next = document.getElementById(sceneIds[index]);
    if (!next || index === currentScene) return;
    if (currentScene === 10) stopCanvas();
    if (previous) {
      previous.classList.remove('is-active');
      previous.setAttribute('aria-hidden', 'true');
    }
    currentScene = index;
    next.classList.add('is-active');
    next.setAttribute('aria-hidden', 'false');
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    if (!reducedMotion && window.gsap) {
      const inner = next.querySelector('.scene-inner');
      if (inner) window.gsap.fromTo(inner, { y: 24, rotateX: 1.4, opacity: 0.2, transformPerspective: 900 }, { y: 0, rotateX: 0, opacity: 1, duration: .9, ease: 'power4.out', clearProps: 'transform,opacity' });
    }
    if (index === 2) startMusicForHero();
    if (index === 3) animateReasonCards();
    if (index === 4) animateReasonCards();
    if (index === 9) revealVisibleLetterParagraphs();
    if (index === 10) startCanvas();
    const audioToggle = document.getElementById('audio-toggle');
    if (audioToggle) audioToggle.hidden = index < 2;
  }

  function animateReasonCards() {
    const active = document.querySelector('#s4 .reason-card');
    if (!active || reducedMotion || !window.gsap) return;
    const cards = Array.from(document.querySelectorAll('#s4 .reason-card'));
    window.gsap.fromTo(cards, { opacity: .2, y: 26, rotateX: -8, scale: .97 }, { opacity: 1, y: 0, rotateX: 0, scale: 1, duration: .7, stagger: .075, ease: 'power4.out', clearProps: 'transform,opacity' });
  }

  function normalizeAnswer(value) {
    return String(value || '').toLocaleLowerCase('id-ID').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function constantTimeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return result === 0;
  }

  function setupBalloons() {
    const arena = document.getElementById('balloon-arena');
    if (!arena) return;
    const count = Math.max(1, Math.min(18, Number(C.settings.balloonCount) || 18));
    const phrasePrefix = C.copy.balloonPhrasePrefix || 'HAPPY 18';
    const phrase = `${phrasePrefix}${String(C.name).replace(/\s+/g, '')}`;
    const charCount = Math.min(phrase.length, count);
    const coords = [
      [2,8], [19,3], [36,12], [54,4], [72,11], [88,5],
      [10,37], [27,31], [45,39], [63,32], [81,38], [1,65],
      [19,61], [37,70], [55,62], [72,69], [88,62], [43,81],
    ];
    const palettes = [
      ['#a98aff','#714fd0'], ['#82dfff','#3689c7'], ['#f6bde9','#bd66b5'],
      ['#c3a5ff','#7351c6'], ['#ffe0a6','#dd9b62'], ['#89e6d4','#39a99d'],
    ];
    arena.innerHTML = Array.from({ length: count }, (_, i) => {
      const [x,y] = coords[i % coords.length];
      const [a,b] = palettes[i % palettes.length];
      const tilt = [-7,-4,4,7,1, -2][i % 6];
      const carrier = i < charCount;
      return `<button type="button" class="balloon" data-carrier="${carrier ? 'true' : 'false'}" style="--x:${x}%;--y:${y}%;--tilt:${tilt}deg;--balloon-a:${a};--balloon-b:${b};--float:${3.2 + (i%4)*.48}s" aria-label="${safe(withName(C.copy.balloonButtonLabel).replaceAll('{{count}}', i + 1))}"><span class="balloon-mark" aria-hidden="true">${carrier ? TINY_HEART : ''}</span></button>`;
    }).join('');
    const counter = document.getElementById('balloon-counter');
    const total = document.getElementById('balloon-total');
    const fill = document.getElementById('balloon-progress-fill');
    const reveal = document.getElementById('balloon-reveal');
    const actions = document.getElementById('balloon-actions');
    const buttons = Array.from(arena.querySelectorAll('.balloon'));
    let popped = 0;
    let letterCount = 0;
    let autoStarted = false;
    total.textContent = String(charCount);

    const pop = (item, automatic = false) => {
      if (!item || item.classList.contains('popped')) return;
      item.classList.add('popped');
      item.disabled = true;
      popped++;
      const isCarrier = item.dataset.carrier === 'true';
      if (isCarrier && letterCount < charCount) {
        const mark = item.querySelector('.balloon-mark');
        const character = phrase[letterCount];
        letterCount++;
        if (mark) mark.textContent = character === ' ' ? '\u00a0' : character;
        if (mark) mark.classList.add('revealed-character');
        item.setAttribute('aria-label', safe(withName(C.copy.balloonPoppedLabel)));
        const gotPhrase = phrase.slice(0, letterCount);
        reveal.textContent = gotPhrase;
        if (counter) counter.textContent = String(letterCount);
        if (fill) fill.style.width = `${(letterCount / charCount) * 100}%`;
      } else {
        burstConfetti(arena, item);
      }
      if (automatic && isCarrier) {
        const mark = item.querySelector('.balloon-mark');
        if (mark) mark.textContent = phrase[Math.max(0, letterCount - 1)] || '';
      }
      if (!autoStarted) {
        autoStarted = true;
        balloonTimer = window.setTimeout(() => autoPopWave(buttons, pop), Math.max(1000, Number(C.settings.balloonAutoPopMs) || 25000));
      }
      if (letterCount >= charCount) {
        if (balloonTimer) clearTimeout(balloonTimer);
        reveal.textContent = withName(C.copy.balloonsDone);
        reveal.classList.add('revealed');
        actions.hidden = false;
        if (window.gsap && !reducedMotion) window.gsap.fromTo(actions, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .65, ease: 'back.out(1.7)' });
      }
      if (popped >= buttons.length && letterCount >= charCount) actions.hidden = false;
    };
    buttons.forEach((item) => item.addEventListener('click', () => pop(item, false)));
  }

  function autoPopWave(buttons, popFn) {
    const remaining = buttons.filter((item) => !item.classList.contains('popped'));
    if (!remaining.length) return;
    remaining.forEach((item, index) => window.setTimeout(() => popFn(item, true), reducedMotion ? index * 12 : index * 125));
  }

  function burstConfetti(parent, source) {
    const originRect = source.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const x = originRect.left - parentRect.left + originRect.width / 2;
    const y = originRect.top - parentRect.top + originRect.height / 2;
    const colors = ['#bba6ff','#7dd3fc','#ffd69b','#f4c3ea'];
    for (let i = 0; i < (reducedMotion ? 3 : 7); i++) {
      const bit = document.createElement('span');
      bit.className = 'burst-heart';
      bit.style.left = `${x}px`;
      bit.style.top = `${y}px`;
      bit.style.setProperty('--burst-color', colors[(i + Math.floor(x)) % colors.length]);
      bit.style.setProperty('--dx', `${Math.cos(i * Math.PI / 3.5) * (24 + i*5)}px`);
      bit.style.setProperty('--dy', `${Math.sin(i * Math.PI / 3.5) * (23 + i*5)}px`);
      parent.appendChild(bit);
      window.setTimeout(() => bit.remove(), 950);
    }
  }

  function setupCakeHold() {
    const hold = document.getElementById('blow-button');
    const stage = document.getElementById('cake-stage');
    const copy = document.getElementById('blow-help');
    const after = document.getElementById('wish-after');
    const actions = document.getElementById('cake-actions');
    if (!hold || !stage) return;
    let startedAt = 0;
    let holdRAF = 0;
    let blown = false;
    const duration = reducedMotion ? 220 : 1350;
    const release = () => {
      if (holdRAF) cancelAnimationFrame(holdRAF);
      holdRAF = 0;
      startedAt = 0;
      if (!blown) hold.style.setProperty('--hold-progress', '0%');
    };
    const tick = (time) => {
      if (!startedAt || blown) return;
      const progress = Math.min(1, (time - startedAt) / duration);
      hold.style.setProperty('--hold-progress', `${progress * 100}%`);
      if (progress >= 1) {
        blown = true;
        stage.classList.add('blown');
        hold.classList.add('complete');
        hold.setPointerCapture?.(hold._activePointerId);
        hold.querySelector('span').textContent = withName(C.copy.wishComplete);
        if (copy) copy.hidden = true;
        if (after) after.hidden = false;
        if (actions) actions.hidden = false;
        sprinkleCakeSparks(stage);
        if (navigator.vibrate && /Android/i.test(navigator.userAgent)) {
          try { navigator.vibrate(35); } catch (_) { /* no-op */ }
        }
        return;
      }
      holdRAF = requestAnimationFrame(tick);
    };
    hold.addEventListener('pointerdown', (event) => {
      if (blown) return;
      event.preventDefault();
      startedAt = performance.now();
      hold._activePointerId = event.pointerId;
      hold.setPointerCapture?.(event.pointerId);
      holdRAF = requestAnimationFrame(tick);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => hold.addEventListener(type, release));
    hold.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  function sprinkleCakeSparks(stage) {
    if (reducedMotion) return;
    for (let i = 0; i < 25; i++) {
      const spark = document.createElement('span');
      spark.className = 'cake-spark';
      spark.style.left = `${18 + Math.random() * 64}%`;
      spark.style.top = `${35 + Math.random() * 46}%`;
      spark.style.setProperty('--dx', `${(Math.random() - .5) * 90}px`);
      stage.appendChild(spark);
      window.setTimeout(() => spark.remove(), 1100);
    }
  }

  function observePhotos() {
    const photos = Array.from(document.querySelectorAll('.gallery-card img'));
    const load = async (img) => {
      if (img.dataset.checked === 'true') return;
      img.dataset.checked = 'true';
      const src = img.dataset.src;
      try {
        const result = await fetch(src, { method: 'HEAD', cache: 'force-cache', credentials: 'same-origin' });
        if (!result.ok) return;
        img.src = src;
        img.addEventListener('load', () => {
          img.classList.add('loaded');
          const placeholder = img.parentElement.querySelector('.photo-placeholder');
          if (placeholder) placeholder.hidden = true;
        }, { once: true });
        img.addEventListener('error', () => { img.hidden = true; }, { once: true });
      } catch (_) {
        // Placeholder sengaja dipertahankan kalau foto belum di-upload.
      }
    };
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) { load(entry.target); observer.unobserve(entry.target); }
        });
      }, { root: document.getElementById('gallery-strip'), rootMargin: '80px' });
      photos.forEach(img => observer.observe(img));
    } else {
      photos.slice(0, 2).forEach(load);
      document.getElementById('gallery-strip')?.addEventListener('scroll', () => photos.forEach(load), { passive: true });
    }
  }

  function setupGalleryProgress() {
    const strip = document.getElementById('gallery-strip');
    const index = document.getElementById('gallery-index');
    if (!strip || !index) return;
    const update = () => {
      const cards = Array.from(strip.querySelectorAll('.gallery-card'));
      if (!cards.length) return;
      const midpoint = strip.scrollLeft + strip.clientWidth / 2;
      let nearest = 0;
      let distance = Infinity;
      cards.forEach((card, i) => {
        const center = card.offsetLeft + card.offsetWidth / 2;
        const currentDistance = Math.abs(midpoint - center);
        if (currentDistance < distance) { distance = currentDistance; nearest = i; }
      });
      index.textContent = `${String(nearest + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    };
    strip.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  let letterObserver = null;
  function setupLetterReveal() {
    const paragraphs = Array.from(document.querySelectorAll('[data-letter-paragraph]'));
    if (!paragraphs.length) return;
    if (!('IntersectionObserver' in window) || reducedMotion) {
      paragraphs.forEach(p => p.classList.add('revealed'));
      return;
    }
    letterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          letterObserver.unobserve(entry.target);
        }
      });
    }, { root: null, rootMargin: '0px 0px -8% 0px', threshold: .12 });
    paragraphs.forEach(p => letterObserver.observe(p));
  }

  function revealVisibleLetterParagraphs() {
    const paragraphs = Array.from(document.querySelectorAll('[data-letter-paragraph]'));
    if (reducedMotion) paragraphs.forEach(p => p.classList.add('revealed'));
    else paragraphs.forEach((p, index) => {
      if (p.getBoundingClientRect().top < window.innerHeight * .95) window.setTimeout(() => p.classList.add('revealed'), index * 130);
    });
  }

  function setupFinale() {
    const buttonElement = document.getElementById('gift-button');
    const wrap = document.getElementById('gift-wrap');
    const voucher = document.getElementById('voucher');
    const giftStage = document.getElementById('gift-stage');
    if (!buttonElement || !wrap || !voucher || !giftStage) return;
    let opened = false;
    const openGift = () => {
      if (opened) return;
      opened = true;
      wrap.classList.add('open');
      if (navigator.vibrate && /Android/i.test(navigator.userAgent)) {
        try { navigator.vibrate([20, 35, 20]); } catch (_) { /* no-op */ }
      }
      if (reducedMotion) {
        giftStage.hidden = true;
        voucher.classList.add('visible');
      } else {
        window.setTimeout(() => {
          giftStage.hidden = true;
          voucher.classList.add('visible');
          spawnCelebrationBurst(canvasWidth * .5, canvasHeight * .48, 95);
        }, 560);
      }
      buttonElement.textContent = C.copy.voucherLabel;
      buttonElement.disabled = true;
      const closing = document.getElementById('closing-line');
      if (closing && window.gsap && !reducedMotion) window.gsap.fromTo(closing, { opacity: 0, y: 18, scale: .96 }, { opacity: 1, y: 0, scale: 1, duration: 1, delay: .2, ease: 'power4.out' });
    };
    buttonElement.addEventListener('click', openGift);
    wrap.addEventListener('click', openGift);
  }

  function resizeCanvas() {
    if (!canvasElement || !canvasContext) return;
    const rect = canvasElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = Math.max(1, rect.width);
    canvasHeight = Math.max(1, rect.height);
    canvasElement.width = Math.round(canvasWidth * dpr);
    canvasElement.height = Math.round(canvasHeight * dpr);
    canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function startCanvas() {
    canvasElement = document.getElementById('finale-canvas');
    if (!canvasElement || reducedMotion || canvasActive) return;
    canvasContext = canvasElement.getContext('2d', { alpha: true });
    if (!canvasContext) return;
    resizeCanvas();
    const budget = Math.max(60, Math.min(Number(C.settings.canvasParticleMax) || 400, Math.floor((canvasWidth * canvasHeight) / 1800), 400));
    particles = Array.from({ length: Math.min(budget, 155) }, () => makeAmbientParticle());
    canvasActive = true;
    lastBurst = performance.now();
    canvasRAF = requestAnimationFrame(drawCanvas);
  }

  function stopCanvas() {
    canvasActive = false;
    if (canvasRAF) cancelAnimationFrame(canvasRAF);
    canvasRAF = 0;
  }

  function makeAmbientParticle() {
    return {
      x: Math.random() * Math.max(1, canvasWidth),
      y: Math.random() * Math.max(1, canvasHeight),
      vx: (Math.random() - .5) * .34,
      vy: -.12 - Math.random() * .42,
      radius: .5 + Math.random() * 1.8,
      life: 1,
      decay: .0018 + Math.random() * .004,
      color: ['#bba6ff','#7dd3fc','#ffd69b','#ffffff'][Math.floor(Math.random() * 4)],
      type: 'dust',
      previousX: 0,
      previousY: 0,
    };
  }

  function spawnCelebrationBurst(x, y, count = 50) {
    if (!canvasActive) return;
    const max = Math.max(1, Math.min(Number(C.settings.canvasParticleMax) || 400, 400));
    const room = Math.max(0, max - particles.length);
    const amount = Math.min(count, room);
    const palette = ['#bba6ff','#7dd3fc','#ffd69b','#ffffff','#e9b7ff'];
    for (let i = 0; i < amount; i++) {
      const angle = (Math.PI * 2 * i / amount) + Math.random() * .15;
      const speed = 1.1 + Math.random() * 2.8;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: .8 + Math.random() * 2.4, life: 1, decay: .006 + Math.random() * .012, color: palette[i % palette.length], type: 'spark', previousX: x, previousY: y });
    }
  }

  function drawCanvas(time) {
    if (!canvasActive || !canvasContext || document.hidden || currentScene !== 10) { stopCanvas(); return; }
    if (canvasElement && (canvasWidth !== canvasElement.getBoundingClientRect().width || canvasHeight !== canvasElement.getBoundingClientRect().height)) resizeCanvas();
    canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
    if (time - lastBurst > 1550 && particles.length < Math.min(Number(C.settings.canvasParticleMax) || 400, 400) - 40) {
      spawnCelebrationBurst(canvasWidth * (.23 + Math.random() * .54), canvasHeight * (.2 + Math.random() * .45), 26 + Math.floor(Math.random() * 20));
      lastBurst = time;
    }
    const max = Math.max(1, Math.min(Number(C.settings.canvasParticleMax) || 400, 400));
    if (particles.length > max) particles = particles.slice(particles.length - max);
    particles.forEach((p, index) => {
      p.previousX = p.x;
      p.previousY = p.y;
      p.x += p.vx;
      p.y += p.vy;
      if (p.type === 'spark') p.vy += .018;
      else {
        p.x += Math.sin(time / 1500 + index) * .09;
        if (p.y < -7 || p.x < -8 || p.x > canvasWidth + 8) Object.assign(p, makeAmbientParticle(), { y: canvasHeight + Math.random() * 24 });
      }
      p.life -= p.decay;
      if (p.life <= 0) {
        Object.assign(p, makeAmbientParticle(), { y: canvasHeight + Math.random() * 30 });
      }
      canvasContext.globalAlpha = Math.max(0, Math.min(1, p.life));
      canvasContext.fillStyle = p.color;
      canvasContext.beginPath();
      canvasContext.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      canvasContext.fill();
      if (p.type === 'spark' && p.life > .22) {
        canvasContext.globalAlpha = p.life * .42;
        canvasContext.strokeStyle = p.color;
        canvasContext.lineWidth = p.radius * .7;
        canvasContext.beginPath();
        canvasContext.moveTo(p.previousX, p.previousY);
        canvasContext.lineTo(p.x, p.y);
        canvasContext.stroke();
      }
    });
    canvasContext.globalAlpha = 1;
    canvasRAF = requestAnimationFrame(drawCanvas);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCanvas();
    else if (currentScene === 10) startCanvas();
  });
  window.addEventListener('resize', () => { if (currentScene === 10) resizeCanvas(); }, { passive: true });

  renderApp();
  const loading = document.getElementById('loading-state');
  if (loading) loading.hidden = true;
  document.getElementById('s0')?.setAttribute('aria-hidden', 'false');
})();
