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
  const particlePool = [];
  const glowSprites = new Map();
  const petalSprites = new Map();
  let lastBurst = 0;
  let canvasContext = null;
  let audioContext = null;
  let sfxMasterGain = null;
  let musicGain = null;
  let audioAnalyser = null;
  let mediaSource = null;
  let frequencyData = null;
  let lastAnalyserSample = 0;
  let lastBassTrigger = 0;
  let nextFinaleRocketAt = 0;
  let ambientPulseTimer = 0;
  let canvasElement = null;
  let canvasWidth = 0;
  let canvasHeight = 0;
  const sceneIds = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11'];
  const riddleLevels = Array.isArray(C.riddles) ? C.riddles.slice(0, 3) : [];

  if (rotateCopy) rotateCopy.textContent = C.copy.rotate;
  const loadingLabel = document.getElementById('loading-state');
  if (loadingLabel) loadingLabel.setAttribute('aria-label', C.copy.loadingLabel);
  document.title = C.copy.documentTitle;
  document.documentElement.style.setProperty('--purple', C.colors.primary || '#a78bfa');
  document.documentElement.style.setProperty('--blue', C.colors.blue || '#7dd3fc');
  document.documentElement.style.setProperty('--gold', C.colors.gold || '#ffd69b');

  const makeTopline = (label, number) => `<div class="scene-topline"><span class="eyebrow">${formatted(label)}</span><span class="scene-number">${String(number + 1).padStart(2, '0')} / ${String(sceneIds.length).padStart(2, '0')}</span></div>`;
  const makeProgress = (active) => `<div class="progress-dots" aria-hidden="true">${sceneIds.map((_, i) => `<span class="${i === active ? 'active' : ''}"></span>`).join('')}</div>`;
  const button = (label, action, secondary = false, extra = '') => `<button type="button" class="${secondary ? 'secondary-btn' : 'primary-btn'}" data-action="${action}" ${extra}>${formatted(label)}</button>`;
  const makeScene = (id, content, num) => `<section id="${id}" class="scene${num === 0 ? ' is-active' : ''}" aria-label="${safe(id)}"><div class="scene-inner">${content}${makeProgress(num)}</div></section>`;

  function makeBouquetSVG() {
    const plants = [
      { x: 118, y: 112, type: 'lavender', color: '#9c80bb' },
      { x: 140, y: 96, type: 'aster', color: '#d6b3c6' },
      { x: 158, y: 137, type: 'wisteria', color: '#c1a2d3' },
      { x: 181, y: 76, type: 'peony', color: '#c9a2d7' },
      { x: 190, y: 101, type: 'aster', color: '#e8c4b0' },
      { x: 222, y: 70, type: 'peony', color: '#b8a3d5' },
      { x: 244, y: 118, type: 'wisteria', color: '#9f83bd' },
      { x: 263, y: 106, type: 'lavender', color: '#8c70ae' },
      { x: 300, y: 89, type: 'aster', color: '#f0d8c4' },
      { x: 318, y: 66, type: 'peony', color: '#e4bcb1' },
      { x: 337, y: 128, type: 'wisteria', color: '#bda0d3' },
      { x: 365, y: 117, type: 'baby', color: '#e7daca' },
    ];
    const stems = plants.map((plant, i) => {
      const baseX = 207 + i * 6.5;
      const tipX = plant.x;
      const tipY = plant.y + 29;
      const bend = (tipX - baseX) * .28;
      const path = `M ${baseX} 426 C ${baseX + bend} 325 ${tipX - bend} 245 ${tipX} ${tipY}`;
      const leaves = [0,1,2].map(j => {
        const yy = 335 - j * 45 - (i % 2) * 10;
        const xx = baseX + (tipX - baseX) * ((426 - yy) / (426 - tipY));
        const side = (j + i) % 2 ? 1 : -1;
        return `<path class="bouquet-leaf" d="M ${xx} ${yy} q ${side*21} -20 ${side*35} -5 q ${-side*12} 19 ${-side*35} 5 Z" fill="${i%2?'#8c9b78':'#a2ab87'}" opacity="0" transform-box="fill-box" transform-origin="center"/>`;
      }).join('');
      let bloom = '';
      if (plant.type === 'lavender') {
        bloom = Array.from({length:7}, (_,j) => {
          const yy = tipY + j * 8;
          const xx = tipX + Math.sin(j*.7+i) * 5;
          return `<ellipse class="bouquet-flower" cx="${xx}" cy="${yy}" rx="7.6" ry="12.1" transform="rotate(-26 ${xx} ${yy})" fill="${plant.color}" opacity="0"/>`;
        }).join('');
      } else if (plant.type === 'wisteria') {
        bloom = Array.from({length:11}, (_,j) => {
          const row = Math.floor(j/3);
          const col = j%3;
          const xx = tipX + (col-1)*9 + Math.sin(j+i)*2;
          const yy = tipY + row*11 + (col===1?0:5);
          return `<circle class="bouquet-flower" cx="${xx}" cy="${yy}" r="${7.1-row*.45}" fill="${j%3===0?'#d6b9e3':plant.color}" opacity="0"/>`;
        }).join('');
      } else if (plant.type === 'baby') {
        bloom = Array.from({length:15}, (_,j) => {
          const xx = tipX + Math.sin(j*2.4)*18;
          const yy = tipY + Math.cos(j*1.7)*23;
          return `<g class="bouquet-flower" opacity="0"><circle cx="${xx}" cy="${yy}" r="4.2" fill="#f5eadb"/><circle cx="${xx}" cy="${yy}" r="1.7" fill="#f0c6ad"/></g>`;
        }).join('');
      } else {
        const count = plant.type === 'peony' ? 12 : 9;
        const radius = plant.type === 'peony' ? 21 : 17;
        bloom = Array.from({length:count}, (_,j) => {
          const angle = Math.PI*2*j/count;
          const xx = tipX + Math.cos(angle)*radius*.68;
          const yy = tipY + Math.sin(angle)*radius*.68;
          return `<ellipse class="bouquet-flower" cx="${xx}" cy="${yy}" rx="${plant.type==='peony'?10.5:8.2}" ry="${plant.type==='peony'?18:13.5}" transform="rotate(${j*360/count} ${xx} ${yy})" fill="${j%3===0?'#f4dfcb':plant.color}" opacity="0"/>`;
        }).join('') + `<circle class="bouquet-flower" cx="${tipX}" cy="${tipY}" r="8.5" fill="#efc78f" opacity="0"/>`;
      }
      return `<g class="bouquet-stem-group"><path class="bouquet-stem" d="${path}" fill="none" stroke="${i%3===0?'#78876d':'#91a080'}" stroke-width="${i%2?3:3.3}" stroke-linecap="round" stroke-dasharray="520" stroke-dashoffset="520"/>${leaves}${bloom}</g>`;
    }).join('');
    const babyBreath = Array.from({length:14}, (_,i) => {
      const x = 122 + (i*37)%216;
      const y = 182 + (i*23)%122;
      return `<g class="bouquet-flower" opacity="0"><circle cx="${x}" cy="${y}" r="3.2" fill="#f4e8d7"/><circle cx="${x}" cy="${y}" r="1.2" fill="#f0c6ad"/></g>`;
    }).join('');
    return `<svg class="bouquet-svg" id="bouquet-svg" viewBox="0 0 460 520" role="img" aria-label="${safe(C.copy.flowerAria || 'Buket bunga untuk '+C.name)}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="kraft-paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d5b18a"/><stop offset=".55" stop-color="#b98f6d"/><stop offset="1" stop-color="#9c755f"/></linearGradient><linearGradient id="kraft-fold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ead2af"/><stop offset="1" stop-color="#c39a76"/></linearGradient></defs>
      <ellipse cx="228" cy="471" rx="116" ry="16" fill="#0f0a1d" opacity=".18"/>
      <g class="bouquet-blooms">${stems}${babyBreath}</g>
      <path d="M132 329 Q227 372 328 329 L260 480 Q230 497 200 480 Z" fill="url(#kraft-paper)" stroke="#9c755f" stroke-width="1.4"/>
      <path d="M132 329 Q230 391 328 329 L310 365 Q230 412 150 365 Z" fill="url(#kraft-fold)"/>
      <path d="M150 365 Q230 412 310 365" fill="none" stroke="#ead2af" stroke-width="2" opacity=".7"/>
      <path d="M230 418 C217 406 193 395 193 380 C193 360 219 360 230 382 C241 360 267 360 267 380 C267 395 243 406 230 418Z" fill="#7A89C2" stroke="#d7d8ee" stroke-width="1.5"/>
      <path d="M222 407 Q216 431 192 447 Q219 444 230 419 Q241 444 268 447 Q244 429 238 407Z" fill="#7A89C2" stroke="#d7d8ee" stroke-width="1.4"/>
      <path d="M145 344 Q230 395 315 344" fill="none" stroke="#f1d9ba" stroke-width="2.3" opacity=".75"/>
    </svg>`;
  }

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
      ${makeTopline(c.reasonsEyebrow, 6)}
      <p class="kicker">${formatted(c.reasonsKicker)}</p>
      <h2 class="section-title">${formatted(c.reasonsTitle)}</h2>
      <p class="body-copy">${formatted(c.reasonsBody)}</p>
      <div class="reason-grid">${reasons}</div>
      <div class="actions">${button(c.reasonsButton, 'next')}</div>`;

    const candles = ['1', '8'].map((digit, i) => `<span class="candle-number" data-candle-number="${digit}" style="--candle-delay:${i * 90}ms"><svg class="flame-svg" viewBox="0 0 24 34" aria-hidden="true"><path class="flame-path" d="M12 1 C10 7 3 12 4 19 C4 27 8 32 12 32 C18 32 21 26 20 19 C19 12 14 9 12 1Z" fill="url(#flame-fill-${i})"/><defs><linearGradient id="flame-fill-${i}" x1="0" y1="1" x2="1" y2="1"><stop offset="0" stop-color="#ff9b58"/><stop offset=".5" stop-color="#fff3be"/><stop offset="1" stop-color="#ffcf79"/></linearGradient></defs></svg><span class="candle-digit">${digit}</span></span>`).join('');
    const s5 = `
      ${makeTopline(c.cakeEyebrow, 4)}
      <div class="hero-copy">
        <p class="kicker">${formatted(c.cakeKicker)}</p>
        <h2 class="section-title">${formatted(c.cakeTitle)}</h2>
        <p class="body-copy cake-instruction">${formatted(c.cakeInstruction)}</p>
        <div class="cake-wrap"><div class="cake-stage" id="cake-stage"><div class="cake-light"></div><div class="candle-row">${candles}</div><div class="cake-top"></div><div class="cake-icing"></div><div class="cake-body"></div><div class="cake-plate"></div></div></div>
        <button id="blow-button" type="button" class="hold-button"><span>Tahan untuk meniup</span></button>
        <p id="wish-after" class="body-copy" hidden>${formatted(c.cakeAfter)}</p>
        <div class="actions" id="cake-actions" hidden>${button(c.cakeButton, 'next')}</div>
      </div>`;

    const sFlower = `
      ${makeTopline(c.flowerEyebrow || c.flowerKicker, 5)}
      <div class="hero-copy bouquet-copy">
        <p class="kicker">${formatted(c.flowerKicker)}</p>
        <h2 class="section-title">${formatted(c.flowerTitle)}</h2>
        <div class="bouquet-art" id="bouquet-art">${makeBouquetSVG()}</div>
        <p class="body-copy bouquet-body">${formatted(c.flowerBody)}</p>
        <div class="actions">${button(c.flowerButton, 'next')}</div>
      </div>`;

    const s6 = `
      ${makeTopline(c.interludeEyebrow, 7)}
      <div class="hero-copy">
        <div class="hero-orbit" aria-hidden="true"><span class="orbit-ring"></span><span class="orbit-ring ring-two"></span><div class="orbit-center">${BIG_HEART}</div></div>
        <p class="kicker">${formatted(c.interludeKicker)}</p>
        <h2 class="section-title">${formatted(c.interludeTitle)}</h2>
        <p class="body-copy">${formatted(c.interludeBody)}</p>
        <p class="fine-copy">${formatted(c.interludeNote)}</p>
        <div class="actions">${button(c.interludeButton, 'next')}</div>
      </div>`;

    const photos = C.photos.map((photo, i) => `<article class="gallery-card" style="--rot:${(-3 + Math.random() * 7).toFixed(2)}deg;--lift:${(-4 + Math.random() * 8).toFixed(1)}px" data-photo-index="${i}"><span class="polaroid-tape" aria-hidden="true"></span><div class="gallery-photo"><div class="photo-placeholder"><div class="frame-icon">${imageIcon}</div><p>${formatted(c.photoEmpty)}</p><small>${formatted(c.photoEmptyNote)}</small></div><img data-src="${safe(photo.src)}" loading="lazy" decoding="async" alt="${safe(c.photoAlt)} ${i + 1}"></div><div class="gallery-caption"><span class="caption-count">${String(i + 1).padStart(2, '0')}</span><span>${formatted(photo.caption)}</span></div></article>`).join('');
    const s7 = `
      ${makeTopline(c.galleryEyebrow, 8)}
      <p class="kicker">${String(C.photos.length).padStart(2, '0')} ${formatted(c.galleryKicker)}</p>
      <h2 class="section-title">${formatted(c.galleryTitle)}</h2>
      <p class="body-copy">${formatted(c.galleryBody)}</p>
      <div class="gallery-strip" id="gallery-strip" aria-label="${safe(c.galleryAria)}">${photos}</div>
      <div class="gallery-foot"><span>${formatted(c.gallerySwipe)}</span><span id="gallery-index">01 / ${String(C.photos.length).padStart(2, '0')}</span></div>
      <div class="actions">${button(c.galleryButton, 'next')}</div>`;

    const s8 = `
      ${makeTopline(c.preletterEyebrow, 9)}
      <div class="hero-copy">
        <div class="hero-orbit" aria-hidden="true"><span class="orbit-ring"></span><span class="orbit-ring ring-two"></span><div class="orbit-center">${BIG_HEART}</div></div>
        <p class="kicker">${formatted(c.preletterKicker)}</p>
        <h2 class="section-title">${formatted(c.preletterTitle)}</h2>
        <p class="body-copy">${formatted(c.preletterBody)}</p>
        <div class="actions">${button(c.preletterButton, 'next')}</div>
      </div>`;

    const paragraphs = C.letter.map((paragraph, i) => `<p class="letter-paragraph" data-letter-paragraph="${i}">${formatted(paragraph)}</p>`).join('');
    const s9 = `
      ${makeTopline(c.letterEyebrow, 10)}
      <div class="hero-copy" style="text-align:left"><p class="kicker">${formatted(c.letterKicker)}</p><h2 class="section-title">${formatted(c.letterTitle)}</h2></div>
      <article class="letter-paper" id="letter-paper">${paragraphs}</article>
      <div class="actions" style="justify-content:center">${button(c.letterButton, 'next')}</div>`;

    const s10 = `
      ${makeTopline(c.finaleEyebrow, 11)}
      <div class="hero-copy">
        <p class="kicker">${formatted(c.finaleKicker)}</p>
        <h2 class="section-title">${formatted(c.finaleTitle)}</h2>
      </div>
      <div class="finale-stage" id="finale-stage"><div class="gift-stage" id="gift-stage"><button type="button" class="gift-wrap" id="gift-wrap" aria-label="${safe(c.giftButton)}"><span class="gift-bow"></span><span class="gift-lid"></span><span class="gift-box"></span></button></div><div class="voucher" id="voucher"><div class="voucher-label">${formatted(c.voucherLabel)}</div><h3>${formatted(C.finale.title || c.voucherTitle)}</h3><p>${formatted(C.finale.body || c.voucherBody)}</p><div class="voucher-bottom"><span>${formatted(c.voucherFoot)}</span>${BIG_HEART}</div></div></div>
      <div class="hero-copy"><button type="button" class="primary-btn" id="gift-button">${formatted(c.giftButton)}</button><h2 class="closing-line" id="closing-line">${formatted(C.finale.message || C.finale.closing || c.closing)}</h2><div class="replay-row">${button(c.replay, 'replay', true)}</div></div>`;

    app.innerHTML = [s0,s1,s2,s3,s5,sFlower,s4,s6,s7,s8,s9,s10].map((html, i) => makeScene(sceneIds[i], html, i)).join('');
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
        setScene(Math.min(sceneIds.length - 1, currentScene + 1));
      } else if (action === 'replay') {
        particles = particles.filter(p => p.type === 'firefly');
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
        setTimeout(() => runBirthdayCountdown(), reducedMotion ? 80 : 560);
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
    setupBouquetInteractions();
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
      audioMuted = !audioMuted;
      audio.muted = audioMuted;
      if (sfxMasterGain && audioContext) {
        sfxMasterGain.gain.setTargetAtTime(audioMuted ? 0 : .3, audioContext.currentTime, .025);
      }
      toggle.textContent = audioAvailable
        ? (audioMuted ? C.copy.audioOn : C.copy.audioOff)
        : (audioMuted ? 'Nyalakan suara' : 'Matikan suara');
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

  function initAudioEngine() {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      if (!sfxMasterGain) {
        sfxMasterGain = audioContext.createGain();
        sfxMasterGain.gain.value = audioMuted ? 0 : .3;
        sfxMasterGain.connect(audioContext.destination);
      }
      if (audio && !mediaSource) {
        try {
          mediaSource = audioContext.createMediaElementSource(audio);
          audioAnalyser = audioContext.createAnalyser();
          audioAnalyser.fftSize = 256;
          audioAnalyser.smoothingTimeConstant = .78;
          frequencyData = new Uint8Array(audioAnalyser.frequencyBinCount);
          musicGain = audioContext.createGain();
          musicGain.gain.value = 1;
          mediaSource.connect(audioAnalyser);
          audioAnalyser.connect(musicGain);
          musicGain.connect(audioContext.destination);
        } catch (_) {
          audioAnalyser = null;
          frequencyData = null;
        }
      }
    } catch (_) {
      audioContext = null;
      sfxMasterGain = null;
    }
  }

  function playTone(startHz, duration = .14, type = 'sine', volume = .12, endHz = startHz) {
    if (!C.settings?.sfx || audioMuted || !audioContext || !sfxMasterGain || audioContext.state !== 'running') return;
    try {
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const envelope = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(20, startHz), now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), now + Math.max(.025, duration));
      envelope.gain.setValueAtTime(.0001, now);
      envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), now + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + Math.max(.04, duration));
      oscillator.connect(envelope);
      envelope.connect(sfxMasterGain);
      oscillator.start(now);
      oscillator.stop(now + duration + .025);
      oscillator.onended = () => { try { oscillator.disconnect(); envelope.disconnect(); } catch (_) {} };
    } catch (_) { /* Web Audio is optional; visual flow must never depend on audio. */ }
  }

  function playNoise(duration = .12, volume = .1, filterType = 'lowpass', frequency = 2600) {
    if (!C.settings?.sfx || audioMuted || !audioContext || !sfxMasterGain || audioContext.state !== 'running') return;
    try {
      const now = audioContext.currentTime;
      const frames = Math.max(1, Math.floor(audioContext.sampleRate * Math.min(1.5, duration)));
      const buffer = audioContext.createBuffer(1, frames, audioContext.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) channel[i] = (Math.random() * 2 - 1) * (1 - i / frames * .3);
      const source = audioContext.createBufferSource();
      const filter = audioContext.createBiquadFilter();
      const envelope = audioContext.createGain();
      source.buffer = buffer;
      filter.type = filterType;
      filter.frequency.value = frequency;
      envelope.gain.setValueAtTime(.0001, now);
      envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), now + .008);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
      source.connect(filter); filter.connect(envelope); envelope.connect(sfxMasterGain);
      source.start(now); source.stop(now + duration + .02);
      source.onended = () => { try { source.disconnect(); filter.disconnect(); envelope.disconnect(); } catch (_) {} };
    } catch (_) { /* Unsupported audio graph; effects remain visual. */ }
  }

  function playSfx(name, value = 0) {
    if (!C.settings?.sfx || audioMuted) return;
    if (!audioContext) initAudioEngine();
    if (name === 'rocket') {
      playTone(630, .42, 'sawtooth', .035, 125);
      playNoise(.22, .028, 'bandpass', 1050);
    } else if (name === 'boom') {
      playTone(105, .42, 'triangle', .17, 36);
      playNoise(.32, .13, 'lowpass', 850);
      window.setTimeout(() => playNoise(.1, .055, 'highpass', 3200), 90);
      if (musicGain && audioContext) {
        const now = audioContext.currentTime;
        musicGain.gain.cancelScheduledValues(now);
        musicGain.gain.setTargetAtTime(.48, now, .035);
        musicGain.gain.setTargetAtTime(1, now + .22, .1);
      }
    } else if (name === 'count') {
      const step = Math.max(0, Math.min(4, 5 - Number(value)));
      playTone(420 + step * 115, .11, 'sine', .085, 560 + step * 125);
    } else if (name === 'riser') {
      playTone(190, .42, 'sawtooth', .055, 780);
    } else if (name === 'pop') {
      playNoise(.075, .085, 'bandpass', 2200);
      playTone(570, .09, 'sine', .07, 210);
    } else if (name === 'blow') {
      playNoise(.46, .12, 'bandpass', 850);
    } else if (name === 'flower') {
      playTone(920 + Math.random() * 300, .25, 'sine', .055, 680 + Math.random() * 180);
      playTone(1380, .16, 'sine', .018, 1060);
    }
  }

  function unlockAudioOnGesture() {
    if (!audioUnlocked) {
      audioUnlocked = true;
      initAudioEngine();
    }
    if (!audioAvailable) return;
    try {
      audio.volume = 0;
      audio.muted = audioMuted;
      const playResult = audio.play();
      if (playResult?.catch) playResult.catch(() => {});
    } catch (_) {
      // Audio opsional: situs tetap berjalan saat file tidak ada atau browser menolak playback.
    }
  }

  function startMusicForHero() {
    const toggle = document.getElementById('audio-toggle');
    if (toggle) toggle.hidden = false;
    if (!audioAvailable) {
      if (toggle) {
        toggle.disabled = false;
        toggle.textContent = audioMuted ? 'Nyalakan suara' : 'Matikan suara';
        toggle.setAttribute('aria-label', toggle.textContent);
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

  function delay(ms) { return new Promise(resolve => window.setTimeout(resolve, ms)); }

  async function runBirthdayCountdown() {
    const overlay = document.createElement('div');
    overlay.className = 'countdown-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'assertive');
    const caption = document.createElement('p');
    caption.className = 'countdown-caption';
    caption.textContent = withName(C.copy.countdownCopy || 'Siap-siap, {{name}}.');
    overlay.appendChild(caption);
    document.body.appendChild(overlay);
    const countDuration = reducedMotion ? 380 : 640;
    for (const value of [5, 4, 3, 2, 1]) {
      const digit = document.createElement('span');
      digit.className = 'countdown-number';
      digit.textContent = String(value);
      overlay.appendChild(digit);
      const shockwave = document.createElement('span');
      shockwave.className = 'countdown-shockwave';
      shockwave.setAttribute('aria-hidden', 'true');
      overlay.appendChild(shockwave);
      overlay.classList.remove('countdown-beat');
      void overlay.offsetWidth;
      overlay.classList.add('countdown-beat');
      if (window.gsap && !reducedMotion) {
        window.gsap.fromTo(digit, { scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1, duration: .46, ease: 'expo.out' });
        const older = Array.from(overlay.querySelectorAll('.countdown-number')).filter(node => node !== digit);
        if (older.length) window.gsap.to(older, { opacity: 0, scale: .78, duration: .16, ease: 'power4.in' });
        window.gsap.fromTo(shockwave, { scale: .15, opacity: .82 }, { scale: 1.55, opacity: 0, duration: .56, ease: 'power2.out', onComplete: () => shockwave.remove() });
      } else {
        digit.style.opacity = '1';
        window.setTimeout(() => shockwave.remove(), 600);
      }
      playSfx('count', value);
      if (value === 1) playSfx('riser');
      if (canvasActive) spawnCelebrationBurst(canvasWidth * (.25 + Math.random() * .5), canvasHeight * (.22 + Math.random() * .32), 96);
      if (navigator.vibrate && /Android/i.test(navigator.userAgent)) {
        try { navigator.vibrate(value === 1 ? 30 : 14); } catch (_) { /* no-op */ }
      }
      await delay(countDuration);
    }
    const flash = document.createElement('div');
    flash.className = 'countdown-flash';
    overlay.appendChild(flash);
    playSfx('boom');
    await delay(reducedMotion ? 40 : 125);
    setScene(2);
    await delay(reducedMotion ? 20 : 90);
    overlay.remove();
  }

  function animateSceneDecorations(scene) {
    if (reducedMotion || !window.gsap) return;
    const targets = Array.from(scene.querySelectorAll('.scene-topline, .hero-orbit, .kicker, .hero-title, .section-title, .actions'));
    if (!targets.length) return;
    window.gsap.fromTo(targets, { y: 11, opacity: 0 }, {
      y: 0, opacity: 1, duration: .48, stagger: .045, delay: .045,
      ease: 'power4.out', clearProps: 'transform,opacity'
    });
  }

  function playSceneWipe(index) {
    if (reducedMotion) return;
    const modes = ['iris', 'curtain', 'cross'];
    const mode = modes[index % modes.length];
    const layer = document.createElement('div');
    layer.className = 'scene-wipe scene-wipe-' + mode;
    layer.setAttribute('aria-hidden', 'true');
    if (mode === 'iris') {
      const orb = document.createElement('span');
      orb.className = 'wipe-orb';
      layer.appendChild(orb);
    } else if (mode === 'curtain') {
      for (let i = 0; i < 3; i++) {
        const strip = document.createElement('span');
        strip.className = 'wipe-strip wipe-strip-' + i;
        layer.appendChild(strip);
      }
    } else {
      const horizontal = document.createElement('span');
      horizontal.className = 'wipe-band wipe-band-horizontal';
      const vertical = document.createElement('span');
      vertical.className = 'wipe-band wipe-band-vertical';
      layer.append(horizontal, vertical);
    }
    document.body.appendChild(layer);
    const remove = () => layer.remove();
    if (window.gsap) {
      const timeline = window.gsap.timeline({ onComplete: remove });
      if (mode === 'iris') {
        timeline.fromTo(layer.firstElementChild, { scale: 0, opacity: .96 }, { scale: 14, opacity: 0, duration: .72, ease: 'power4.inOut' });
      } else if (mode === 'curtain') {
        timeline.fromTo(layer.children, { yPercent: -110, opacity: 1 }, { yPercent: 110, opacity: 0, duration: .64, stagger: .07, ease: 'power4.inOut' });
      } else {
        timeline.fromTo(layer.children, { scale: 0, opacity: .94 }, { scale: 1, opacity: 0, duration: .56, stagger: .05, ease: 'power4.inOut' });
      }
    } else {
      layer.classList.add('is-running');
      window.setTimeout(remove, 900);
    }
  }

  function setScene(index) {
    index = Math.max(0, Math.min(sceneIds.length - 1, index));
    if (index === 1 && !unlocked) { /* riddle is the expected first gate */ }
    const previous = document.getElementById(sceneIds[currentScene]);
    const next = document.getElementById(sceneIds[index]);
    if (!next || index === currentScene) return;
    if (previous) {
      previous.classList.remove('is-active');
      previous.setAttribute('aria-hidden', 'true');
    }
    currentScene = index;
    clearSceneParticles();
    next.classList.add('is-active');
    next.setAttribute('aria-hidden', 'false');
    playSceneWipe(index);
    animateSceneDecorations(next);
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    if (!reducedMotion && window.gsap) {
      const inner = next.querySelector('.scene-inner');
      if (inner) window.gsap.fromTo(inner, { y: 24, rotateX: 1.4, opacity: 0.2, transformPerspective: 900 }, { y: 0, rotateX: 0, opacity: 1, duration: .9, ease: 'power4.out', clearProps: 'transform,opacity' });
    }
    if (index === 2) {
      startMusicForHero();
      launchFireworkSequence(8);
    }
    if (index === 3) animateBalloonEntrance();
    if (index === sceneIds.length - 1) launchFireworkSequence(8);
    if (index === 6) animateReasonCards();
    if (index === 5) animateBouquet();
    if (index === 10) revealVisibleLetterParagraphs();
    const audioToggle = document.getElementById('audio-toggle');
    if (audioToggle) audioToggle.hidden = index < 2;
  }

  function animateReasonCards() {
    const active = document.querySelector('.scene.is-active .reason-card');
    if (!active || reducedMotion || !window.gsap) return;
    const cards = Array.from(document.querySelectorAll('.scene.is-active .reason-card'));
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
    const phrase = `${phrasePrefix.trimEnd()} ${String(C.name).replace(/\s+/g, '').toUpperCase()}`;
    const charCount = Math.min(phrase.length, count);
    const coords = [
      [2,8], [19,3], [36,12], [54,4], [72,11], [88,5],
      [10,37], [27,31], [45,39], [63,32], [81,38], [1,65],
      [19,61], [37,70], [55,62], [72,69], [88,62], [43,81],
    ];
    const palettes = [
      ['#c0a6d9','#7c629b'], ['#d6bce7','#a783c4'], ['#f0c3aa','#b87576'],
      ['#bda2d6','#76618e'], ['#f5dfc4','#cb9d79'], ['#9f9ac4','#6d689d'],
    ];
    arena.innerHTML = Array.from({ length: count }, (_, i) => {
      const [x,y] = coords[i % coords.length];
      const [a,b] = palettes[i % palettes.length];
      const tilt = [-7,-4,4,7,1, -2][i % 6];
      const carrier = i < charCount;
      return `<button type="button" class="balloon" data-carrier="${carrier ? 'true' : 'false'}" style="--x:${x}%;--y:${y}%;--tilt:${tilt}deg;--balloon-a:${a};--balloon-b:${b};--float:${3 + Math.random() * 3}s;--phase:${-Math.random() * 3}s;animation:none" aria-label="${safe(withName(C.copy.balloonButtonLabel).replaceAll('{{count}}', i + 1))}"><svg class="balloon-svg" viewBox="0 0 80 118" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs><linearGradient id="balloon-grad-${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffaf4" stop-opacity=".88"/><stop offset=".22" stop-color="${a}"/><stop offset=".72" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><linearGradient id="balloon-edge-${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#3a2348" stop-opacity=".4"/></linearGradient></defs><path d="M40 5 C21 5 8 20 8 41 C8 61 23 77 36 84 L40 91 L44 84 C57 77 72 61 72 41 C72 20 59 5 40 5Z" fill="url(#balloon-grad-${i})" stroke="rgba(255,248,240,.76)" stroke-width="1.1"/><path d="M40 5 C21 5 8 20 8 41 C8 61 23 77 36 84 L40 91 L44 84 C57 77 72 61 72 41 C72 20 59 5 40 5Z" fill="url(#balloon-edge-${i})"/><path d="M24 20 C18 28 18 38 22 45" fill="none" stroke="#fffaf4" stroke-opacity=".85" stroke-width="4" stroke-linecap="round"/><ellipse cx="23" cy="17" rx="3.4" ry="5.5" fill="#fffaf4" fill-opacity=".78" transform="rotate(22 23 17)"/><path class="balloon-rope" d="M40 92 C34 99 47 102 39 110 C35 114 39 116 42 117" fill="none" stroke="#ead9e7" stroke-opacity=".82" stroke-width="1.2" stroke-linecap="round"/></svg><span class="balloon-mark" aria-hidden="true">${carrier ? TINY_HEART : ''}</span></button>`;
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
      if (!item || item.classList.contains('popped') || item.classList.contains('balloon-escape')) return;
      const balloonRect = item.getBoundingClientRect();
      const centerX = balloonRect.left + balloonRect.width / 2;
      const centerY = balloonRect.top + balloonRect.height / 2;
      const isCarrier = item.dataset.carrier === 'true';
      if (automatic && !isCarrier) {
        item.disabled = true;
        item.classList.add('balloon-escape');
        if (window.gsap && !reducedMotion) {
          window.gsap.to(item, { y: -arena.clientHeight - 140, x: (Math.random() - .5) * 70, opacity: 0, rotation: (Math.random() - .5) * 35, duration: 1.25 + Math.random() * .45, ease: 'power2.in', onComplete: () => { item.hidden = true; } });
        } else {
          item.style.transform = 'translateY(-140vh)';
          item.hidden = true;
        }
        popped++;
        return;
      }
      item.classList.add('popped');
      item.disabled = true;
      const balloonColor = getComputedStyle(item).getPropertyValue('--balloon-a').trim() || '#bba7db';
      spawnBalloonBurst(centerX, centerY, balloonColor);
      spawnConfettiBurst(centerX, centerY, isSmallScreen() ? 8 : 12);
      spawnBalloonPressure(arena, item, centerX, centerY, balloonColor);
      playSfx('pop');
      if (navigator.vibrate && /Android/i.test(navigator.userAgent)) {
        try { navigator.vibrate(12); } catch (_) { /* no-op */ }
      }
      popped++;
      if (isCarrier && letterCount < charCount) {
        const character = phrase[letterCount];
        letterCount++;
        const mark = item.querySelector('.balloon-mark');
        if (mark) { mark.textContent = character === ' ' ? '\u00a0' : character; mark.classList.add('revealed-character'); }
        item.setAttribute('aria-label', safe(withName(C.copy.balloonPoppedLabel)));
        reveal.textContent = phrase.slice(0, letterCount);
        if (counter) counter.textContent = String(letterCount);
        if (fill) fill.style.transform = `scaleX(${letterCount / charCount})`;
        if (character !== ' ' && window.gsap && !reducedMotion) {
          const flight = document.createElement('span');
          flight.className = 'letter-flight';
          flight.textContent = character;
          flight.style.left = centerX + 'px';
          flight.style.top = centerY + 'px';
          document.body.appendChild(flight);
          const target = reveal.getBoundingClientRect();
          const destinationX = target.left + target.width * ((letterCount - .5) / Math.max(1, charCount));
          const destinationY = target.top + target.height / 2;
          window.gsap.to(flight, { x: destinationX - centerX, y: destinationY - centerY, scale: .55, opacity: 0, duration: .58, ease: 'power3.inOut', onComplete: () => flight.remove() });
        }
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
        playTone(1040, .28, 'sine', .035, 1480);
        launchFireworkSequence(3);
        window.setTimeout(() => spawnFireworkRocket(canvasWidth * .5, canvasHeight * .24, 'heart'), 120);
        if (window.gsap && !reducedMotion) window.gsap.fromTo([reveal, actions], { y: 16, opacity: 0, scale: .97 }, { y: 0, opacity: 1, scale: 1, duration: .65, stagger: .06, ease: 'back.out(1.7)' });
      }
      if (popped >= buttons.length && letterCount >= charCount) actions.hidden = false;
    };
    buttons.forEach((item) => item.addEventListener('click', () => pop(item, false)));
  }

  function animateBalloonEntrance() {
    const arena = document.getElementById('balloon-arena');
    if (!arena) return;
    const buttons = Array.from(arena.querySelectorAll('.balloon:not(.is-floating):not(.popped)'));
    if (!buttons.length) return;
    const finish = () => buttons.forEach(item => {
      item.classList.add('is-floating');
      item.style.removeProperty('animation');
    });
    if (reducedMotion || !window.gsap) { finish(); return; }
    window.gsap.fromTo(buttons,
      { y: arena.clientHeight + 130, opacity: 0, scale: .91, rotation: (index, target) => Number.parseFloat(target.style.getPropertyValue('--tilt')) || 0 },
      { y: 0, opacity: 1, scale: 1, rotation: (index, target) => (Number.parseFloat(target.style.getPropertyValue('--tilt')) || 0) + (Math.random() - .5) * 2,
        duration: .72, ease: 'back.out(1.22)', stagger: () => .04 + Math.random() * .05,
        onComplete: () => { finish(); window.gsap.set(buttons, { clearProps: 'transform,opacity' }); } });
  }

  function spawnBalloonBurst(x, y, color) {
    if (!canvasActive || reducedMotion) return;
    const count = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 2 * i / count;
      const speed = 1.4 + Math.random() * 3.2;
      addParticle({
        type: 'rubber', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - .55,
        life: .9 + Math.random() * .35, decay: .012 + Math.random() * .009, gravity: .085,
        friction: .964, maxVy: 3.8, angle, spin: (Math.random() - .5) * .3, curve: (Math.random() - .5) * 10,
        span: 4 + Math.random() * 7, color, ageMs: 0
      });
    }
  }

  function spawnBalloonPressure(arena, poppedItem, x, y, color) {
    if (canvasActive && !reducedMotion) addParticle({ type: 'pressure', x, y, radius: 8, maxRadius: 92, life: 1, decay: .065, color });
    if (!window.gsap || reducedMotion) return;
    const others = Array.from(arena.querySelectorAll('.balloon:not(.popped):not(.balloon-escape)'));
    others.forEach(item => {
      const rect = item.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const dx = cx - x, dy = cy - y;
      const distance = Math.hypot(dx, dy);
      if (distance < 90 && distance > 1) {
        const force = (90 - distance) / 90 * 28;
        window.gsap.killTweensOf(item);
        window.gsap.to(item, {
          x: dx / distance * force, y: dy / distance * force, duration: .14, ease: 'power2.out',
          onComplete: () => window.gsap.to(item, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1,.42)', clearProps: 'x,y' })
        });
      }
    });
  }

  function autoPopWave(buttons, popFn) {
    const remaining = buttons.filter((item) => !item.classList.contains('popped') && !item.classList.contains('balloon-escape'));
    if (!remaining.length) return;
    remaining.forEach((item, index) => window.setTimeout(() => popFn(item, true), reducedMotion ? index * 12 : index * 75));
  }

  function isSmallScreen() { return window.matchMedia('(max-width: 600px)').matches; }

  function setupBouquetInteractions() {
    const art = document.getElementById('bouquet-art');
    if (!art) return;
    art.addEventListener('click', (event) => {
      const svg = art.querySelector('svg');
      const rect = svg ? svg.getBoundingClientRect() : art.getBoundingClientRect();
      const tappedBloom = event.target.closest && event.target.closest('.bouquet-flower');
      const tappedBouquetArea = event.clientY - rect.top < rect.height * .72;
      if (!tappedBloom && !tappedBouquetArea) return;
      spawnFlowerBurst(event.clientX, event.clientY);
      if (navigator.vibrate && /Android/i.test(navigator.userAgent)) {
        try { navigator.vibrate(10); } catch (_) { /* no-op */ }
      }
    });
  }

  function animateBouquet() {
    const scene = document.getElementById('s5');
    if (!scene) return;
    const svg = scene.querySelector('#bouquet-svg');
    if (!svg) return;
    const stems = Array.from(svg.querySelectorAll('.bouquet-stem'));
    const leaves = Array.from(svg.querySelectorAll('.bouquet-leaf'));
    const flowers = Array.from(svg.querySelectorAll('.bouquet-flower'));
    if (reducedMotion || !window.gsap) {
      stems.forEach(el => { el.style.strokeDashoffset = '0'; });
      leaves.forEach(el => { el.style.opacity = '1'; });
      flowers.forEach(el => { el.style.opacity = '1'; el.style.transform = 'scale(1)'; });
      return;
    }
    window.gsap.killTweensOf([stems, leaves, flowers]);
    const timeline = window.gsap.timeline();
    timeline.to(stems, { strokeDashoffset: 0, duration: .95, stagger: .075, ease: 'power2.out' });
    timeline.to(leaves, { opacity: 1, scale: 1, duration: .32, stagger: .045, ease: 'back.out(1.7)' }, '-=.48');
    timeline.to(flowers, { opacity: 1, scale: 1, rotate: (i) => (i % 2 ? 8 : -8), duration: .48, stagger: .027, ease: 'back.out(1.7)', transformOrigin: 'center center' }, '-=.28');
    timeline.call(() => releasePetals(34, canvasWidth * .5, canvasHeight * .18), null, '+=.12');
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
    const scene = document.getElementById('s4');
    const flames = Array.from(stage.querySelectorAll('.flame-svg'));
    const duration = reducedMotion ? 220 : 1350;
    const release = () => {
      if (holdRAF) cancelAnimationFrame(holdRAF);
      holdRAF = 0;
      startedAt = 0;
      stage.classList.remove('holding');
      if (!blown) {
        hold.style.setProperty('--hold-progress', '0');
        if (scene) scene.classList.remove('candle-dimming');
        flames.forEach(flame => {
          flame.style.setProperty('--flame-lean', '0deg');
          flame.style.setProperty('--flame-x', '1');
          flame.style.setProperty('--flame-y', '1');
          flame.style.setProperty('--flame-skew', '0deg');
          flame.style.filter = '';
        });
      }
    };
    const tick = (time) => {
      if (!startedAt || blown) return;
      const progress = Math.min(1, (time - startedAt) / duration);
      hold.style.setProperty('--hold-progress', String(progress));
      flames.forEach((flame, index) => {
        const noise = Math.sin(time * .019 + index * 2.4) * .045 + Math.sin(time * .031 + index) * .025;
        flame.style.setProperty('--flame-lean', `${(-progress * 34 + noise * 35).toFixed(2)}deg`);
        flame.style.setProperty('--flame-x', (1 - progress * .6 + noise).toFixed(3));
        flame.style.setProperty('--flame-y', (1 - progress * .45 + noise * .7).toFixed(3));
        flame.style.setProperty('--flame-skew', `${(noise * 50).toFixed(2)}deg`);
        flame.style.filter = `drop-shadow(0 0 ${Math.max(1, 11 * (1-progress))}px rgba(255,172,91,${.8-progress*.5}))`;
      });
      if (progress > .06 && scene) scene.classList.add('candle-dimming');
      if (progress >= 1) {
        blown = true;
        stage.classList.remove('holding');
        stage.classList.add('blown');
        hold.classList.add('complete');
        hold.querySelector('span').textContent = withName(C.copy.wishComplete);
        if (copy) copy.hidden = true;
        if (after) after.hidden = false;
        if (actions) actions.hidden = false;
        playSfx('blow');
        spawnCandleSmoke(stage);
        sprinkleCakeSparks(stage);
        if (navigator.vibrate && /Android/i.test(navigator.userAgent)) {
          try { navigator.vibrate(35); } catch (_) { /* no-op */ }
        }
        window.setTimeout(() => { if (scene) scene.classList.remove('candle-dimming'); }, 320);
        return;
      }
      holdRAF = requestAnimationFrame(tick);
    };
    hold.addEventListener('pointerdown', (event) => {
      if (blown || startedAt) return;
      event.preventDefault();
      startedAt = performance.now();
      stage.classList.add('holding');
      initAudioEngine();
      hold._activePointerId = event.pointerId;
      hold.setPointerCapture?.(event.pointerId);
      holdRAF = requestAnimationFrame(tick);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => hold.addEventListener(type, release));
    hold.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  function spawnCandleSmoke(stage) {
    if (reducedMotion) return;
    const row = stage.querySelector('.candle-row');
    if (!row) return;
    const rect = row.getBoundingClientRect();
    for (let i = 0; i < 6; i++) {
      const puff = document.createElement('span');
      puff.className = 'candle-smoke';
      puff.style.left = `${rect.left + rect.width * (.42 + i * .035)}px`;
      puff.style.top = `${rect.top - 5 + Math.random() * 6}px`;
      puff.style.setProperty('--smoke-drift', `${(Math.random() - .5) * 34}px`);
      puff.style.setProperty('--smoke-delay', `${i * 85}ms`);
      document.body.appendChild(puff);
      window.setTimeout(() => puff.remove(), 2800);
    }
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
        const signedOffset = (center - midpoint) / Math.max(1, strip.clientWidth / 2);
        card.style.setProperty('--parallax', `${Math.max(-5, Math.min(5, signedOffset * 5))}px`);
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

  let canvasDpr = 1;
  let lastFrameTime = 0;
  let averageFrameTime = 16;
  let particleBudget = 350;
  let attractionPoint = null;
  let lastFinaleRocket = 0;
  let globalPointerBound = false;

  function resizeCanvas() {
    if (!canvasElement || !canvasContext) return;
    const rect = { width: window.innerWidth, height: window.innerHeight };
    canvasDpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = Math.max(1, rect.width);
    canvasHeight = Math.max(1, rect.height);
    canvasElement.width = Math.round(canvasWidth * canvasDpr);
    canvasElement.height = Math.round(canvasHeight * canvasDpr);
    canvasElement.style.width = canvasWidth + 'px';
    canvasElement.style.height = canvasHeight + 'px';
    canvasContext.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
  }

  function startCanvas() {
    if (reducedMotion || document.hidden || canvasActive) return;
    canvasElement = document.getElementById('atmosphere-canvas');
    if (!canvasElement) return;
    canvasContext = canvasElement.getContext('2d', { alpha: true });
    if (!canvasContext) return;
    resizeCanvas();
    particleBudget = Math.max(80, Math.min(window.innerWidth <= 600 ? 350 : 520, Number(C.settings.canvasParticleMax) || 400));
    const starterCount = Math.min(window.innerWidth <= 600 ? 38 : 58, particleBudget);
    particles = particles.filter(p => p.type !== 'firefly');
    for (let i = 0; i < starterCount; i++) particles.push(makeFirefly());
    canvasActive = true;
    lastFrameTime = performance.now();
    averageFrameTime = 16;
    canvasRAF = requestAnimationFrame(drawCanvas);
    if (!globalPointerBound) bindCanvasGestures();
  }

  function stopCanvas() {
    canvasActive = false;
    if (canvasRAF) cancelAnimationFrame(canvasRAF);
    canvasRAF = 0;
  }

  function bindCanvasGestures() {
    globalPointerBound = true;
    document.addEventListener('pointerdown', (event) => {
      if (reducedMotion || document.hidden) return;
      if (currentScene === 0) {
        attractionPoint = { x: event.clientX, y: event.clientY, until: performance.now() + 1450 };
      }
      const finalSceneIndex = sceneIds.length - 1;
      const overControl = event.target && event.target.closest && event.target.closest('button, input, textarea, a');
      if (!overControl && (currentScene === 2 || currentScene === finalSceneIndex)) {
        spawnFireworkRocket(event.clientX, event.clientY, ['round', 'ring', 'heart'][Math.floor(Math.random() * 3)]);
      }
    }, { passive: true });
    document.addEventListener('pointermove', (event) => {
      if (currentScene === 0 && attractionPoint && performance.now() < attractionPoint.until) {
        attractionPoint.x = event.clientX;
        attractionPoint.y = event.clientY;
      }
    }, { passive: true });
  }

  const FIREWORK_PALETTE = ['#bba7db', '#d8c7f0', '#b76f74', '#f2c4aa', '#fff0d9', '#7A89C2', '#9d7ab5'];
  const EMBER_COLOR = '#ff9b58';
  const SPRITE_COLORS = [...FIREWORK_PALETTE, EMBER_COLOR, '#fff9ee', '#ffffff'];

  function hexToRgb(hex) {
    const value = String(hex || '#ffffff').replace('#', '');
    const full = value.length === 3 ? value.split('').map(ch => ch + ch).join('') : value;
    const number = Number.parseInt(full, 16);
    if (!Number.isFinite(number)) return [255, 255, 255];
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
  }

  function hexToRgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    return 'rgba(' + rgb.join(',') + ',' + alpha + ')';
  }

  function resolveSpriteColor(color) {
    const rgbMatch = String(color).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    const input = rgbMatch ? rgbMatch.slice(1).map(Number) : hexToRgb(color);
    let closest = SPRITE_COLORS[0], distance = Infinity;
    for (const candidate of SPRITE_COLORS) {
      const rgb = hexToRgb(candidate);
      const d = (rgb[0] - input[0]) ** 2 + (rgb[1] - input[1]) ** 2 + (rgb[2] - input[2]) ** 2;
      if (d < distance) { distance = d; closest = candidate; }
    }
    return closest;
  }

  function getGlowSprite(color) {
    color = resolveSpriteColor(color);
    if (glowSprites.has(color)) return glowSprites.get(color);
    const sprite = document.createElement('canvas');
    sprite.width = 64; sprite.height = 64;
    const ctx = sprite.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,.98)');
    gradient.addColorStop(.13, hexToRgba(color, .92));
    gradient.addColorStop(.42, hexToRgba(color, .48));
    gradient.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    glowSprites.set(color, sprite);
    return sprite;
  }

  function getPetalSprite(colorA, colorB) {
    const key = colorA + ':' + colorB;
    if (petalSprites.has(key)) return petalSprites.get(key);
    const sprite = document.createElement('canvas');
    sprite.width = 32; sprite.height = 48;
    const ctx = sprite.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 32, 48);
    gradient.addColorStop(0, colorA);
    gradient.addColorStop(.52, '#f4e8e0');
    gradient.addColorStop(1, colorB);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(16, 24, 9, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    petalSprites.set(key, sprite);
    return sprite;
  }

  function drawGlow(x, y, radius, color, alpha = 1) {
    const ctx = canvasContext;
    if (!ctx) return;
    const sprite = getGlowSprite(color);
    const size = Math.max(5, radius * 7);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
  }

  function releaseParticle(index) {
    if (index < 0 || index >= particles.length) return;
    const particle = particles.splice(index, 1)[0];
    if (!particle || particle.type === 'firefly') return;
    for (const key of Object.keys(particle)) delete particle[key];
    if (particlePool.length < particleBudget * 2) particlePool.push(particle);
  }

  function clearSceneParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].type !== 'firefly') releaseParticle(i);
    }
    if (canvasContext && canvasWidth && canvasHeight) canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
    nextFinaleRocketAt = performance.now() + 1400 + Math.random() * 900;
  }

  function addParticle(particle) {
    if (reducedMotion || !canvasActive) return;
    if (particles.length >= particleBudget) {
      let replaceAt = particles.findIndex(p => p.type !== 'firefly' && (p.type === 'petal' || p.type === 'confetti' || p.type === 'trail'));
      if (replaceAt < 0) replaceAt = particles.findIndex(p => p.type !== 'firefly');
      if (replaceAt < 0) return;
      releaseParticle(replaceAt);
    }
    const pooled = particlePool.pop();
    if (pooled) {
      Object.assign(pooled, particle);
      particles.push(pooled);
    } else {
      particles.push(particle);
    }
  }

  function colorMix(a, b, amount) {
    const aa = hexToRgb(a), bb = hexToRgb(b);
    const t = Math.max(0, Math.min(1, amount));
    return 'rgb(' + aa.map((v, i) => Math.round(v + (bb[i] - v) * t)).join(',') + ')';
  }

  function triggerAmbientFlash() {
    const ambient = Array.from(document.querySelectorAll('.ambient'));
    ambient.forEach(el => {
      el.style.transition = 'opacity 65ms ease-out';
      el.style.opacity = '.16';
    });
    if (ambientPulseTimer) window.clearTimeout(ambientPulseTimer);
    ambientPulseTimer = window.setTimeout(() => {
      ambient.forEach(el => {
        el.style.transition = 'opacity 160ms ease-out';
        el.style.opacity = '';
        window.setTimeout(() => { el.style.transition = ''; }, 220);
      });
      ambientPulseTimer = 0;
    }, 85);
  }

  function addFlash(x, y, color = '#fff0d9', radius = 118) {
    addParticle({ type: 'flash', x, y, vx: 0, vy: 0, color, life: 1, decay: .082, radius: 2, maxRadius: Math.min(radius, Math.max(70, canvasWidth * .42)) });
  }

  function makeFirefly() {
    return {
      type: 'firefly',
      x: Math.random() * Math.max(1, canvasWidth),
      y: Math.random() * Math.max(1, canvasHeight),
      vx: (Math.random() - .5) * .34,
      vy: (Math.random() - .5) * .3,
      radius: .8 + Math.random() * 1.8,
      life: .45 + Math.random() * .55,
      phase: Math.random() * Math.PI * 2,
      color: Math.random() < .72 ? '#f2c4aa' : '#ead9f3',
    };
  }

  function spawnFireworkRocket(targetX, targetY, shape = 'round') {
    if (!canvasActive || reducedMotion) return;
    const x = Math.max(24, Math.min(canvasWidth - 24, Number(targetX) || canvasWidth * .5));
    const y = Math.max(canvasHeight * .16, Math.min(canvasHeight * .48, Number(targetY) || canvasHeight * .29));
    const startX = Math.max(18, Math.min(canvasWidth - 18, x + (Math.random() - .5) * 86));
    const startY = canvasHeight + 10;
    const gravity = .082 + Math.random() * .012;
    const apexHeight = Math.max(100, startY - y);
    const baseSpeed = Math.sqrt(2 * gravity * apexHeight);
    addParticle({
      type: 'rocket', x: startX, y: startY, previousX: startX, previousY: startY,
      targetX: x, targetY: y, vx: (x - startX) / Math.max(45, baseSpeed / gravity), vy: -baseSpeed,
      gravity, curve: (Math.random() - .5) * .018, sway: Math.random() * Math.PI * 2,
      life: 1, shape, age: 0, trailClock: 0,
      color: FIREWORK_PALETTE[Math.floor(Math.random() * FIREWORK_PALETTE.length)]
    });
    playSfx('rocket');
  }

  function explodeFirework(x, y, shape = 'round', requestedCount = 96) {
    if (!canvasActive || reducedMotion) return;
    const count = Math.max(90, Math.min(120, requestedCount || 96));
    const palette = FIREWORK_PALETTE;
    addFlash(x, y, '#fff0d9', Math.min(canvasWidth * .42, 145));
    triggerAmbientFlash();
    playSfx('boom');
    for (let i = 0; i < count; i++) {
      const t = i / count * Math.PI * 2;
      const angle = t + (Math.random() - .5) * (shape === 'ring' ? .028 : .2);
      const speed = shape === 'willow' ? 1.05 + Math.random() * 2.25 : (shape === 'ring' ? 3.2 + Math.random() * 1.15 : 3.25 + Math.random() * 2.25);
      let vx, vy;
      if (shape === 'heart') {
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        vx = hx * (.24 + Math.random() * .07);
        vy = -hy * (.24 + Math.random() * .07);
      } else {
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed + (shape === 'willow' ? -.7 : 0);
      }
      const willow = shape === 'willow';
      const baseColor = palette[(i + Math.floor(Math.random() * palette.length)) % palette.length];
      addParticle({
        type: 'spark', x, y, previousX: x, previousY: y, vx, vy,
        radius: 1.5 + Math.random() * 2, life: willow ? 1.8 + Math.random() * .35 : 1.05 + Math.random() * .25,
        ageMs: 0, decay: willow ? .0028 + Math.random() * .0008 : .0045 + Math.random() * .002,
        gravity: willow ? .055 + Math.random() * .018 : .035 + Math.random() * .018,
        friction: willow ? .991 : .987 + Math.random() * .006, drag: willow ? .991 : .95,
        baseColor, color: baseColor,
        twinkle: Math.random() * Math.PI * 2, twinkleRate: 5 + Math.random() * 11, shape,
        crackled: false, initialDragUntil: .22
      });
    }
    for (let i = 0; i < 7; i++) {
      const t = Math.random() * Math.PI * 2;
      addParticle({
        type: 'spark', x, y, previousX: x, previousY: y,
        vx: Math.cos(t) * (3 + Math.random() * 2), vy: Math.sin(t) * (3 + Math.random() * 2),
        radius: 1.7 + Math.random(), life: 1.1, ageMs: 0, decay: .006,
        gravity: .02, friction: .975, drag: .975, color: '#fff4df', baseColor: '#fff4df',
        twinkle: t, twinkleRate: 9, crackled: true
      });
    }
  }

  function spawnCelebrationBurst(x, y, count = 64) {
    explodeFirework(x, y, ['round', 'ring', 'heart'][Math.floor(Math.random() * 3)], Math.min(120, Math.max(80, count)));
  }

  function launchFireworkSequence(count = 8) {
    if (reducedMotion || !canvasActive) return;
    const shapes = ['round', 'ring', 'heart', 'round', 'willow', 'ring', 'heart', 'round'];
    const sequenceCount = Math.max(1, Math.min(8, count));
    for (let i = 0; i < sequenceCount; i++) {
      window.setTimeout(() => {
        if (!canvasActive || document.hidden) return;
        const x = canvasWidth * (.14 + Math.random() * .72);
        const y = canvasHeight * (.16 + Math.random() * .27);
        spawnFireworkRocket(x, y, shapes[i % shapes.length]);
      }, i * (290 + Math.random() * 90));
    }
  }

  function scheduleFinaleRocket(time) {
    if (currentScene !== sceneIds.length - 1 || reducedMotion) return;
    if (!nextFinaleRocketAt) nextFinaleRocketAt = time + 1200 + Math.random() * 1000;
    let bassHit = false;
    if (audioAnalyser && frequencyData && time - lastAnalyserSample > 120) {
      lastAnalyserSample = time;
      audioAnalyser.getByteFrequencyData(frequencyData);
      const end = Math.min(12, frequencyData.length);
      let total = 0;
      for (let i = 1; i < end; i++) total += frequencyData[i];
      const bassEnergy = total / Math.max(1, end - 1);
      bassHit = bassEnergy > 112 && time - lastBassTrigger > 650;
      if (bassHit) lastBassTrigger = time;
    }
    if (time >= nextFinaleRocketAt || bassHit) {
      const salvo = Math.random() < .24 ? 2 + Math.floor(Math.random() * 2) : 1;
      for (let i = 0; i < salvo; i++) {
        window.setTimeout(() => {
          if (canvasActive && !document.hidden && currentScene === sceneIds.length - 1) {
            const shapePool = ['round', 'ring', 'heart', 'willow'];
            spawnFireworkRocket(canvasWidth * (.15 + Math.random() * .7), canvasHeight * (.16 + Math.random() * .28), shapePool[Math.floor(Math.random() * shapePool.length)]);
          }
        }, i * (150 + Math.random() * 110));
      }
      nextFinaleRocketAt = time + 1200 + Math.random() * 1000;
    }
  }

  function releasePetals(count = 24, originX = canvasWidth * .5, originY = canvasHeight * .24) {
    if (!canvasActive || reducedMotion) return;
    for (let i = 0; i < count; i++) {
      addParticle({
        type: 'petal', x: originX + (Math.random() - .5) * canvasWidth * .75,
        y: originY + Math.random() * 90, vx: (Math.random() - .5) * .58,
        vy: .26 + Math.random() * .55, rotation: Math.random() * Math.PI,
        spin: (Math.random() - .5) * .018, radius: 2.5 + Math.random() * 4.5,
        life: .9 + Math.random() * .1, decay: .0012 + Math.random() * .0018,
        color: ['#d9c6ed', '#f3d9ca', '#7A89C2', '#b79acb'][Math.floor(Math.random() * 4)],
        sway: Math.random() * Math.PI * 2
      });
    }
  }

  function spawnConfettiBurst(x, y, count = 14) {
    if (!canvasActive || reducedMotion) return;
    const amount = Math.max(4, Math.min(20, count));
    for (let i = 0; i < amount; i++) {
      const angle = Math.PI * 2 * i / amount + (Math.random() - .5) * .25;
      const speed = .8 + Math.random() * 2.3;
      addParticle({
        type: 'confetti', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - .45,
        radius: 2 + Math.random() * 4, rotation: Math.random() * 6.28, spin: (Math.random() - .5) * .22,
        life: .9 + Math.random() * .1, decay: .019 + Math.random() * .013,
        color: FIREWORK_PALETTE[Math.floor(Math.random() * FIREWORK_PALETTE.length)]
      });
    }
  }

  function spawnFlowerBurst(x, y) {
    if (!canvasActive || reducedMotion) return;
    for (let i = 0; i < 16; i++) {
      const angle = Math.PI * 2 * i / 16;
      addParticle({
        type: 'petal', x, y, vx: Math.cos(angle) * (1.1 + Math.random() * 1.25),
        vy: Math.sin(angle) * (1.1 + Math.random() * 1.25), rotation: angle, spin: .02 * (Math.random() - .5),
        radius: 2.2 + Math.random() * 2.6, life: 1, decay: .018 + Math.random() * .009,
        color: ['#d9c6ed', '#f3d9ca', '#7A89C2', '#b79acb'][i % 4], sway: 0
      });
    }
  }

  function drawCanvas(time) {
    if (!canvasActive || !canvasContext || document.hidden) { stopCanvas(); return; }
    const delta = Math.max(1, Math.min(70, time - (lastFrameTime || time)));
    const dt = delta / 16.667;
    lastFrameTime = time;
    averageFrameTime = averageFrameTime * .92 + delta * .08;
    if (averageFrameTime > 24 && particleBudget > 110) {
      particleBudget = Math.max(110, Math.floor(particleBudget * .78));
      while (particles.length > particleBudget) releaseParticle(particles.length - 1);
    }
    if (canvasElement && (canvasWidth !== window.innerWidth || canvasHeight !== window.innerHeight)) resizeCanvas();
    const trailsActive = currentScene === 2 || currentScene === sceneIds.length - 1 || !!document.querySelector('.countdown-overlay');
    if (trailsActive) {
      canvasContext.globalCompositeOperation = 'destination-out';
      canvasContext.globalAlpha = .19;
      canvasContext.fillStyle = '#000';
      canvasContext.fillRect(0, 0, canvasWidth, canvasHeight);
      canvasContext.globalAlpha = 1;
    } else {
      canvasContext.globalCompositeOperation = 'source-over';
      canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
    }
    canvasContext.globalCompositeOperation = 'lighter';
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.previousX = p.x; p.previousY = p.y;
      if (p.type === 'pressure') {
        p.life -= p.decay * dt;
        const progress = Math.max(0, Math.min(1, 1 - p.life));
        canvasContext.globalAlpha = Math.max(0, p.life) * .72;
        canvasContext.strokeStyle = p.color;
        canvasContext.lineWidth = 1.5 + (1 - progress) * 1.5;
        canvasContext.beginPath();
        canvasContext.arc(p.x, p.y, p.radius + (p.maxRadius - p.radius) * progress, 0, Math.PI * 2);
        canvasContext.stroke();
        if (p.life <= 0) releaseParticle(i);
        continue;
      }
      if (p.type === 'rubber') {
        p.ageMs = (p.ageMs || 0) + delta;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(p.friction || .964, dt);
        p.vy = Math.min(p.maxVy || 3.8, p.vy + (p.gravity || .085) * dt);
        p.angle += p.spin * dt;
        p.life -= p.decay * dt;
        canvasContext.globalAlpha = Math.max(0, p.life);
        canvasContext.strokeStyle = p.color;
        canvasContext.lineWidth = 1.7 + p.life;
        canvasContext.lineCap = 'round';
        canvasContext.beginPath();
        canvasContext.moveTo(p.x, p.y);
        canvasContext.quadraticCurveTo(p.x + Math.cos(p.angle) * p.curve, p.y - p.span, p.x + Math.sin(p.angle) * p.span, p.y + p.span);
        canvasContext.stroke();
        if (p.life <= 0 || p.y > canvasHeight + 20) releaseParticle(i);
        continue;
      }
      if (p.type === 'flash') {
        p.ageMs = (p.ageMs || 0) + delta;
        p.life -= p.decay * dt;
        const progress = Math.max(0, Math.min(1, 1 - p.life));
        const radius = 12 + p.maxRadius * progress;
        const sprite = getGlowSprite(p.color);
        canvasContext.globalAlpha = Math.max(0, p.life) * .82;
        canvasContext.drawImage(sprite, p.x - radius, p.y - radius, radius * 2, radius * 2);
        if (p.life <= 0) releaseParticle(i);
        continue;
      }
      if (p.type === 'rocket') {
        p.age += delta;
        p.trailClock = (p.trailClock || 0) + delta;
        p.vx += (p.curve || 0) * dt + Math.sin(p.age / 130 + p.sway) * .018 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.gravity || .085) * dt;
        const tailX = p.x - p.vx * 4.8;
        const tailY = p.y - p.vy * 4.8;
        canvasContext.strokeStyle = p.color;
        canvasContext.globalAlpha = .2;
        canvasContext.lineWidth = 4.6;
        canvasContext.beginPath(); canvasContext.moveTo(tailX, tailY); canvasContext.lineTo(p.x, p.y); canvasContext.stroke();
        canvasContext.globalAlpha = .86;
        canvasContext.lineWidth = 1.35;
        canvasContext.beginPath(); canvasContext.moveTo(tailX, tailY); canvasContext.lineTo(p.x, p.y); canvasContext.stroke();
        drawGlow(p.x, p.y, 2.2, '#fff0d9', .92);
        while (p.trailClock >= 32) {
          p.trailClock -= 32;
          addParticle({
            type: 'spark', x: p.x, y: p.y, previousX: p.x, previousY: p.y,
            vx: (Math.random() - .5) * 1.2, vy: .65 + Math.random() * 1.8,
            radius: .8 + Math.random() * 1.1, life: .38 + Math.random() * .18,
            ageMs: 0, decay: .022 + Math.random() * .01, gravity: .055, friction: .965, drag: .965,
            color: p.color, baseColor: p.color, twinkle: Math.random() * 6.28, twinkleRate: 12, crackled: true
          });
        }
        if ((p.vy >= -.22 && p.age > 160) || p.age > 3600) {
          explodeFirework(p.x, p.y, p.shape, p.shape === 'willow' ? 112 : 96);
          releaseParticle(i);
        }
        continue;
      }
      if (p.type === 'firefly') {
        if (attractionPoint && currentScene === 0 && time < attractionPoint.until) {
          p.vx += (attractionPoint.x - p.x) * .0009 * dt;
          p.vy += (attractionPoint.y - p.y) * .0009 * dt;
          p.vx *= Math.pow(.975, dt); p.vy *= Math.pow(.975, dt);
        } else {
          p.vx += Math.sin(time / 1800 + p.phase) * .004 * dt;
          p.vy += Math.cos(time / 1900 + p.phase) * .003 * dt;
          p.vx *= Math.pow(.994, dt); p.vy *= Math.pow(.994, dt);
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -4) p.x = canvasWidth + 4; if (p.x > canvasWidth + 4) p.x = -4;
        if (p.y < -4) p.y = canvasHeight + 4; if (p.y > canvasHeight + 4) p.y = -4;
        const pulse = .32 + (Math.sin(time / 360 + p.phase) + 1) * .31;
        drawGlow(p.x, p.y, p.radius * 1.9, p.color, pulse);
        continue;
      }
      if (p.type === 'confetti') {
        p.ageMs = (p.ageMs || 0) + delta;
        p.vx *= Math.pow(p.friction || .992, dt);
        p.vy = Math.min(p.maxVy || 3.2, p.vy + (p.gravity || .035) * dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rotation += p.spin * dt;
        p.flipPhase = (p.flipPhase || 0) + (p.flipSpeed || .18) * dt;
        p.life -= p.decay * dt;
        canvasContext.globalAlpha = Math.max(0, p.life);
        canvasContext.fillStyle = p.color;
        canvasContext.save();
        canvasContext.translate(p.x, p.y);
        canvasContext.rotate(p.rotation);
        canvasContext.scale(Math.max(.08, Math.abs(Math.cos(p.flipPhase))), 1);
        canvasContext.fillRect(-p.radius * .55, -p.radius * .8, p.radius * 1.1, p.radius * 1.6);
        canvasContext.restore();
        if (p.life <= 0 || p.y > canvasHeight + 15) releaseParticle(i);
        continue;
      }
      if (p.type === 'petal') {
        p.ageMs = (p.ageMs || 0) + delta;
        p.phase = (p.phase || 0) + (p.phaseSpeed || .075) * dt;
        const wind = Math.sin(time / 1700 + p.sway) * (p.swayAmplitude || .38);
        p.vx += ((p.wind || 0) + wind) * .01 * dt;
        p.vx *= Math.pow(p.friction || .992, dt);
        p.vy = Math.min(p.maxVy || 1.9, p.vy + (p.gravity || .012) * dt);
        p.x += (p.vx + Math.sin(p.phase) * (p.swayAmplitude || .38)) * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;
        p.life -= p.decay * dt;
        const scaleY = .15 + .85 * Math.abs(Math.cos(p.phase));
        const sprite = getPetalSprite(p.color || '#f3d9ca', p.color2 || '#7A89C2');
        canvasContext.globalAlpha = Math.max(0, p.life);
        canvasContext.save();
        canvasContext.translate(p.x, p.y);
        canvasContext.rotate(p.rotation);
        canvasContext.drawImage(sprite, -p.radius * .7, -p.radius * 1.6, p.radius * 1.4, p.radius * 3.2 * scaleY);
        canvasContext.restore();
        if (p.life <= 0 || p.y > canvasHeight + 15) releaseParticle(i);
        continue;
      }
      p.ageMs = (p.ageMs || 0) + delta;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = p.drag || p.friction || .987;
      const adjustedDrag = p.ageMs < (p.initialDragUntil || .22) * 1000 ? Math.min(.94, drag) : drag;
      p.vx *= Math.pow(adjustedDrag, dt);
      p.vy = Math.min(p.maxVy || 10, p.vy + (p.gravity || .035) * dt);
      p.life -= (p.decay || .006) * dt;
      if (!p.crackled && p.life < .18) {
        p.crackled = true;
        if (Math.random() < .15 && particles.length < particleBudget - 2) {
          const miniCount = 2 + Math.floor(Math.random() * 2);
          for (let n = 0; n < miniCount; n++) {
            addParticle({
              type: 'spark', x: p.x, y: p.y, previousX: p.x, previousY: p.y,
              vx: (Math.random() - .5) * 4, vy: (Math.random() - .5) * 4 - .3,
              radius: .75 + Math.random() * .65, life: .33 + Math.random() * .16, ageMs: 0,
              decay: .026 + Math.random() * .012, gravity: .045, friction: .972, drag: .972,
              color: EMBER_COLOR, baseColor: EMBER_COLOR, twinkle: Math.random() * 6.28, twinkleRate: 14, crackled: true
            });
          }
        }
      }
      const hot = p.ageMs < 160 ? 1 - p.ageMs / 160 : 0;
      const ember = Math.max(0, Math.min(1, (p.ageMs - 650) / 850));
      const core = colorMix(p.baseColor || p.color, EMBER_COLOR, ember);
      const color = hot > 0 ? colorMix(core, '#fff9ee', hot) : core;
      const twinkle = .68 + Math.random() * .32 * (.4 + .6 * Math.abs(Math.sin(time / 47 * (p.twinkleRate || 8) + (p.twinkle || 0))));
      drawGlow(p.x, p.y, p.radius * (p.life < .2 ? .8 : 1), color, Math.max(0, p.life) * twinkle);
      if (p.life > .28) {
        canvasContext.globalAlpha = Math.max(0, p.life) * .36;
        canvasContext.strokeStyle = resolveSpriteColor(color);
        canvasContext.lineWidth = Math.max(.5, p.radius * .65);
        canvasContext.beginPath();
        canvasContext.moveTo(p.previousX - p.vx * 1.4, p.previousY - p.vy * 1.4);
        canvasContext.lineTo(p.x, p.y);
        canvasContext.stroke();
      }
      if (p.life <= 0 || p.y > canvasHeight + 40) releaseParticle(i);
    }
    canvasContext.globalAlpha = 1;
    canvasContext.globalCompositeOperation = 'source-over';
    scheduleFinaleRocket(time);
    canvasRAF = requestAnimationFrame(drawCanvas);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCanvas();
    else startCanvas();
  });
  window.addEventListener('resize', () => resizeCanvas(), { passive: true });

  renderApp();
  startCanvas();
  const loading = document.getElementById('loading-state');
  if (loading) loading.hidden = true;
  document.getElementById('s0')?.setAttribute('aria-hidden', 'false');
})();
