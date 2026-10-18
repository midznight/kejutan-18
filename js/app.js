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
      { x: 118, y: 110, type: 'lavender', color: '#9c80bb' },
      { x: 158, y: 145, type: 'wisteria', color: '#c1a2d3' },
      { x: 190, y: 91, type: 'aster', color: '#e8c4b0' },
      { x: 222, y: 70, type: 'peony', color: '#b8a3d5' },
      { x: 263, y: 106, type: 'lavender', color: '#8c70ae' },
      { x: 300, y: 89, type: 'aster', color: '#f0d8c4' },
      { x: 337, y: 135, type: 'wisteria', color: '#bda0d3' },
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
        return `<path class="bouquet-leaf" d="M ${xx} ${yy} q ${side*21} -20 ${side*35} -5 q -${side*12} 19 -${side*35} 5 Z" fill="${i%2?'#8c9b78':'#a2ab87'}" opacity="0" transform-box="fill-box" transform-origin="center"/>`;
      }).join('');
      let bloom = '';
      if (plant.type === 'lavender') {
        bloom = Array.from({length:7}, (_,j) => {
          const yy = tipY + j * 8;
          const xx = tipX + Math.sin(j*.7+i) * 5;
          return `<ellipse class="bouquet-flower" cx="${xx}" cy="${yy}" rx="5.2" ry="8.2" transform="rotate(-26 ${xx} ${yy})" fill="${plant.color}" opacity="0"/>`;
        }).join('');
      } else if (plant.type === 'wisteria') {
        bloom = Array.from({length:11}, (_,j) => {
          const row = Math.floor(j/3);
          const col = j%3;
          const xx = tipX + (col-1)*9 + Math.sin(j+i)*2;
          const yy = tipY + row*11 + (col===1?0:5);
          return `<circle class="bouquet-flower" cx="${xx}" cy="${yy}" r="${5.2-row*.35}" fill="${j%3===0?'#d6b9e3':plant.color}" opacity="0"/>`;
        }).join('');
      } else if (plant.type === 'baby') {
        bloom = Array.from({length:15}, (_,j) => {
          const xx = tipX + Math.sin(j*2.4)*18;
          const yy = tipY + Math.cos(j*1.7)*23;
          return `<g class="bouquet-flower" opacity="0"><circle cx="${xx}" cy="${yy}" r="4.2" fill="#f5eadb"/><circle cx="${xx}" cy="${yy}" r="1.7" fill="#f0c6ad"/></g>`;
        }).join('');
      } else {
        const count = plant.type === 'peony' ? 12 : 9;
        const radius = plant.type === 'peony' ? 18 : 14;
        bloom = Array.from({length:count}, (_,j) => {
          const angle = Math.PI*2*j/count;
          const xx = tipX + Math.cos(angle)*radius*.68;
          const yy = tipY + Math.sin(angle)*radius*.68;
          return `<ellipse class="bouquet-flower" cx="${xx}" cy="${yy}" rx="${plant.type==='peony'?7:5.5}" ry="${plant.type==='peony'?13:9}" transform="rotate(${j*360/count} ${xx} ${yy})" fill="${j%3===0?'#f4dfcb':plant.color}" opacity="0"/>`;
        }).join('') + `<circle class="bouquet-flower" cx="${tipX}" cy="${tipY}" r="7" fill="#efc78f" opacity="0"/>`;
      }
      return `<g class="bouquet-stem-group"><path class="bouquet-stem" d="${path}" fill="none" stroke="${i%3===0?'#78876d':'#91a080'}" stroke-width="${i%2?2.4:3}" stroke-linecap="round" stroke-dasharray="520" stroke-dashoffset="520"/>${leaves}${bloom}</g>`;
    }).join('');
    const babyBreath = Array.from({length:21}, (_,i) => {
      const x = 120 + (i*37)%220;
      const y = 175 + (i*23)%135;
      return `<g class="bouquet-flower" opacity="0"><path d="M 225 426 Q ${x} ${y+20} ${x} ${y}" fill="none" stroke="#9aa586" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="3.3" fill="#f4e8d7"/><circle cx="${x}" cy="${y}" r="1.2" fill="#f0c6ad"/></g>`;
    }).join('');
    return `<svg class="bouquet-svg" id="bouquet-svg" viewBox="0 0 460 520" role="img" aria-label="${safe(C.copy.flowerAria || 'Buket bunga untuk '+C.name)}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="kraft-paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d5b18a"/><stop offset=".55" stop-color="#b98f6d"/><stop offset="1" stop-color="#9c755f"/></linearGradient><linearGradient id="kraft-fold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ead2af"/><stop offset="1" stop-color="#c39a76"/></linearGradient></defs>
      <ellipse cx="228" cy="471" rx="116" ry="16" fill="#0f0a1d" opacity=".18"/>
      <g class="bouquet-blooms">${stems}${babyBreath}</g>
      <path d="M142 330 Q221 370 318 326 L278 472 Q227 494 176 471 Z" fill="url(#kraft-paper)" stroke="#9c755f" stroke-width="1.4"/>
      <path d="M142 330 Q225 385 318 326 L304 368 Q230 405 157 365 Z" fill="url(#kraft-fold)"/>
      <path d="M153 365 Q228 406 306 365" fill="none" stroke="#ead2af" stroke-width="2" opacity=".7"/>
      <path d="M194 395 C168 377 153 400 177 418 C194 429 213 411 225 402 C237 411 256 429 274 418 C299 399 281 377 256 395 C243 403 237 406 225 402 C213 406 207 403 194 395Z" fill="#7A89C2" stroke="#d7d8ee" stroke-width="1.5"/>
      <path d="M225 401 Q218 421 199 443 Q224 440 229 414 Q247 437 252 438 Q240 414 225 401Z" fill="#7A89C2" stroke="#d7d8ee" stroke-width="1.4"/>
      <path d="M150 344 Q230 386 310 340" fill="none" stroke="#f1d9ba" stroke-width="2.3" opacity=".75"/>
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

    const candles = Array.from({ length: Math.max(1, Math.min(18, Number(C.age) || 18)) }, (_, i) => `<span class="candle" style="--delay:${i * 24}ms"><span class="flame"></span></span>`).join('');
    const s5 = `
      ${makeTopline(c.cakeEyebrow, 4)}
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

    const photos = C.photos.map((photo, i) => `<article class="gallery-card" style="--rot:${i % 2 ? '1.5deg' : '-1.5deg'};--lift:${i % 3 ? '3px' : '-3px'}" data-photo-index="${i}"><div class="gallery-photo"><div class="photo-placeholder"><div class="frame-icon">${imageIcon}</div><p>${formatted(c.photoEmpty)}</p><small>${formatted(c.photoEmptyNote)}</small></div><img data-src="${safe(photo.src)}" loading="lazy" decoding="async" alt="${safe(c.photoAlt)} ${i + 1}"></div><div class="gallery-caption"><span class="caption-count">${String(i + 1).padStart(2, '0')}</span><span>${formatted(photo.caption)}</span></div></article>`).join('');
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
        <p class="body-copy">${formatted(c.closing)}</p>
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
      if (window.gsap && !reducedMotion) {
        window.gsap.fromTo(digit, { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: .29, ease: 'power4.out' });
        const older = Array.from(overlay.querySelectorAll('.countdown-number')).filter(node => node !== digit);
        if (older.length) window.gsap.to(older, { opacity: 0, scale: .78, duration: .18, ease: 'power4.in' });
      } else {
        digit.style.opacity = '1';
      }
      if (canvasActive) spawnCelebrationBurst(canvasWidth * (.25 + Math.random() * .5), canvasHeight * (.22 + Math.random() * .32), 52);
      if (navigator.vibrate && /Android/i.test(navigator.userAgent)) {
        try { navigator.vibrate(value === 1 ? 30 : 14); } catch (_) { /* no-op */ }
      }
      await delay(countDuration);
    }
    const flash = document.createElement('div');
    flash.className = 'countdown-flash';
    overlay.appendChild(flash);
    await delay(reducedMotion ? 40 : 135);
    setScene(2);
    launchFireworkSequence(6);
    await delay(reducedMotion ? 20 : 90);
    overlay.remove();
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
    next.classList.add('is-active');
    next.setAttribute('aria-hidden', 'false');
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    if (!reducedMotion && window.gsap) {
      const inner = next.querySelector('.scene-inner');
      if (inner) window.gsap.fromTo(inner, { y: 24, rotateX: 1.4, opacity: 0.2, transformPerspective: 900 }, { y: 0, rotateX: 0, opacity: 1, duration: .9, ease: 'power4.out', clearProps: 'transform,opacity' });
    }
    if (index === 2) startMusicForHero();
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
      const balloonRect = item.getBoundingClientRect();
      spawnConfettiBurst(balloonRect.left + balloonRect.width / 2, balloonRect.top + balloonRect.height / 2, isSmallScreen() ? 10 : 15);
      if (navigator.vibrate && /Android/i.test(navigator.userAgent)) {
        try { navigator.vibrate(12); } catch (_) { /* no-op */ }
      }
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
        launchFireworkSequence(3);
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

  function isSmallScreen() { return window.matchMedia('(max-width: 600px)').matches; }

  function setupBouquetInteractions() {
    const art = document.getElementById('bouquet-art');
    if (!art) return;
    art.addEventListener('click', (event) => {
      if (!event.target.closest || !event.target.closest('.bouquet-flower')) return;
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
    particleBudget = Math.min(window.innerWidth <= 600 ? 350 : 520, Number(C.settings.canvasParticleMax) || 350);
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

  function addParticle(particle) {
    if (reducedMotion || !canvasActive) return;
    if (particles.length >= particleBudget) {
      let replaceAt = particles.findIndex(p => p.type === 'firefly' || p.type === 'petal' || p.type === 'confetti');
      if (replaceAt < 0) replaceAt = 0;
      particles.splice(replaceAt, 1);
    }
    particles.push(particle);
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
    const x = Math.max(18, Math.min(canvasWidth - 18, Number(targetX) || canvasWidth * .5));
    const y = Math.max(canvasHeight * .12, Math.min(canvasHeight * .72, Number(targetY) || canvasHeight * .3));
    const startX = Math.max(15, Math.min(canvasWidth - 15, x + (Math.random() - .5) * 90));
    addParticle({
      type: 'rocket', x: startX, y: canvasHeight + 10, previousX: startX, previousY: canvasHeight + 10,
      targetX: x, targetY: y, vx: (x - startX) / 42, vy: -Math.max(4.3, (canvasHeight + 10 - y) / 42),
      life: 1, shape, age: 0, color: FIREWORK_PALETTE[Math.floor(Math.random() * FIREWORK_PALETTE.length)]
    });
  }

  function explodeFirework(x, y, shape = 'round', requestedCount = 64) {
    if (!canvasActive || reducedMotion) return;
    const count = Math.max(50, Math.min(80, requestedCount || 64));
    const palette = FIREWORK_PALETTE;
    for (let i = 0; i < count; i++) {
      const t = i / count * Math.PI * 2;
      let vx, vy;
      if (shape === 'heart') {
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        vx = hx * (.16 + Math.random() * .055);
        vy = -hy * (.16 + Math.random() * .055);
      } else {
        const angle = t + (Math.random() - .5) * (shape === 'ring' ? .035 : .18);
        const speed = shape === 'ring' ? 2.6 + Math.random() * .4 : 1.35 + Math.random() * 2.35;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }
      addParticle({
        type: 'spark', x, y, previousX: x, previousY: y, vx, vy,
        radius: .7 + Math.random() * 1.75, life: .76 + Math.random() * .24,
        decay: .008 + Math.random() * .009, gravity: .035 + Math.random() * .025,
        friction: .984 + Math.random() * .008,
        color: palette[(i + Math.floor(Math.random() * palette.length)) % palette.length],
        twinkle: Math.random() * Math.PI * 2, shape
      });
    }
    for (let i = 0; i < 9; i++) {
      const t = Math.random() * Math.PI * 2;
      addParticle({
        type: 'spark', x, y, previousX: x, previousY: y, vx: Math.cos(t) * (3 + Math.random() * 2),
        vy: Math.sin(t) * (3 + Math.random() * 2), radius: 1.2 + Math.random(), life: .98,
        decay: .02, gravity: .02, friction: .97, color: '#fff4df', twinkle: t
      });
    }
  }

  function spawnCelebrationBurst(x, y, count = 64) {
    explodeFirework(x, y, ['round', 'ring', 'heart'][Math.floor(Math.random() * 3)], Math.min(80, Math.max(50, count)));
  }

  function launchFireworkSequence(count = 6) {
    if (reducedMotion || !canvasActive) return;
    const shapes = ['round', 'ring', 'heart', 'round', 'ring', 'round'];
    for (let i = 0; i < Math.max(1, Math.min(6, count)); i++) {
      window.setTimeout(() => {
        if (!canvasActive || document.hidden) return;
        const x = canvasWidth * (.16 + Math.random() * .68);
        const y = canvasHeight * (.16 + Math.random() * .33);
        spawnFireworkRocket(x, y, shapes[i % shapes.length]);
      }, i * 360);
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
    lastFrameTime = time;
    averageFrameTime = averageFrameTime * .92 + delta * .08;
    if (averageFrameTime > 24 && particleBudget > 110) {
      particleBudget = Math.max(110, Math.floor(particleBudget * .78));
      if (particles.length > particleBudget) particles.length = particleBudget;
    }
    if (canvasElement && (canvasWidth !== window.innerWidth || canvasHeight !== window.innerHeight)) resizeCanvas();
    canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
    canvasContext.globalCompositeOperation = 'lighter';
    const dt = delta / 16.67;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.previousX = p.x; p.previousY = p.y;
      if (p.type === 'rocket') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.age += delta;
        p.vy += .035 * dt;
        canvasContext.globalAlpha = .82;
        canvasContext.strokeStyle = p.color;
        canvasContext.lineWidth = 1.6;
        canvasContext.beginPath(); canvasContext.moveTo(p.previousX, p.previousY); canvasContext.lineTo(p.x, p.y); canvasContext.stroke();
        canvasContext.globalAlpha = .95;
        canvasContext.fillStyle = '#fff4df';
        canvasContext.beginPath(); canvasContext.arc(p.x, p.y, 1.8, 0, Math.PI * 2); canvasContext.fill();
        if (p.y <= p.targetY || p.age > 1250) {
          explodeFirework(p.x, p.y, p.shape, 62);
          particles.splice(i, 1);
        }
        continue;
      }
      if (p.type === 'firefly') {
        if (attractionPoint && currentScene === 0 && time < attractionPoint.until) {
          p.vx += (attractionPoint.x - p.x) * .0009;
          p.vy += (attractionPoint.y - p.y) * .0009;
          p.vx *= .975; p.vy *= .975;
        } else {
          p.vx += Math.sin(time / 1800 + p.phase) * .004;
          p.vy += Math.cos(time / 1900 + p.phase) * .003;
          p.vx *= .994; p.vy *= .994;
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -4) p.x = canvasWidth + 4; if (p.x > canvasWidth + 4) p.x = -4;
        if (p.y < -4) p.y = canvasHeight + 4; if (p.y > canvasHeight + 4) p.y = -4;
        const pulse = .35 + (Math.sin(time / 360 + p.phase) + 1) * .29;
        canvasContext.globalAlpha = pulse;
        canvasContext.fillStyle = p.color;
        canvasContext.beginPath(); canvasContext.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2); canvasContext.fill();
        canvasContext.globalAlpha = pulse * .55;
        canvasContext.beginPath(); canvasContext.arc(p.x, p.y, p.radius * 4.2, 0, Math.PI * 2); canvasContext.fill();
        continue;
      }
      if (p.type === 'confetti') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += .035 * dt; p.rotation += p.spin * dt;
        p.vx *= .992; p.life -= p.decay * dt;
        canvasContext.globalAlpha = Math.max(0, p.life);
        canvasContext.fillStyle = p.color;
        canvasContext.save(); canvasContext.translate(p.x, p.y); canvasContext.rotate(p.rotation);
        canvasContext.fillRect(-p.radius * .55, -p.radius * .8, p.radius * 1.1, p.radius * 1.6);
        canvasContext.restore();
        if (p.life <= 0 || p.y > canvasHeight + 15) particles.splice(i, 1);
        continue;
      }
      if (p.type === 'petal') {
        p.x += (p.vx + Math.sin(time / 620 + p.sway) * .18) * dt;
        p.y += p.vy * dt;
        p.vy += .006 * dt;
        p.rotation += p.spin * dt;
        p.life -= p.decay * dt;
        canvasContext.globalAlpha = Math.max(0, p.life);
        canvasContext.fillStyle = p.color;
        canvasContext.save(); canvasContext.translate(p.x, p.y); canvasContext.rotate(p.rotation);
        canvasContext.beginPath(); canvasContext.ellipse(0, 0, p.radius * .62, p.radius * 1.25, 0, 0, Math.PI * 2); canvasContext.fill();
        canvasContext.restore();
        if (p.life <= 0 || p.y > canvasHeight + 15) particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= p.friction || .989; p.vy = p.vy * (p.friction || .989) + (p.gravity || .026) * dt;
      p.life -= p.decay * dt;
      const twinkle = .65 + .35 * Math.abs(Math.sin(time / 55 + p.twinkle));
      canvasContext.globalAlpha = Math.max(0, p.life) * twinkle;
      canvasContext.fillStyle = p.color;
      canvasContext.beginPath(); canvasContext.arc(p.x, p.y, p.radius, 0, Math.PI * 2); canvasContext.fill();
      if (p.life > .2 && p.radius > 1.1) {
        canvasContext.globalAlpha = Math.max(0, p.life) * .56;
        canvasContext.strokeStyle = p.color; canvasContext.lineWidth = Math.max(.5, p.radius * .46);
        canvasContext.beginPath(); canvasContext.moveTo(p.previousX, p.previousY); canvasContext.lineTo(p.x, p.y); canvasContext.stroke();
      }
      if (p.life <= 0 || p.y > canvasHeight + 25) particles.splice(i, 1);
    }
    canvasContext.globalAlpha = 1;
    canvasContext.globalCompositeOperation = 'source-over';
    const finalSceneIndex = sceneIds.length - 1;
    if (currentScene === finalSceneIndex && time - lastFinaleRocket > 1750) {
      spawnFireworkRocket(canvasWidth * (.2 + Math.random() * .6), canvasHeight * (.18 + Math.random() * .33), ['round','ring','heart'][Math.floor(Math.random() * 3)]);
      lastFinaleRocket = time;
    }
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
