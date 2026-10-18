(() => {
  'use strict';

  const C = window.SURPRISE_CONTENT;
  if (!C) return;

  const app = document.getElementById('app');
  const audio = document.getElementById('birthday-audio');
  const rotateCopy = document.getElementById('rotate-copy');
  const reducedMotion = !!(C.settings.reducedMotionRespect && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const HEART = '<svg class="heart-mark" aria-hidden="true"><use href="#heart-libra"></use></svg>';
  const BIG_HEART = '<svg class="heart-mark big" aria-hidden="true"><use href="#heart-libra"></use></svg>';
  const TINY_HEART = '<svg class="heart-mark tiny" aria-hidden="true"><use href="#heart-libra"></use></svg>';
  const LIBRA_SIGIL = '<svg class="libra-sigil-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M16 29a16 16 0 0 1 32 0" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M9 35h46M16 47h32" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>';
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const withName = (value) => String(value ?? '').replaceAll('{{name}}', C.name);
  const formatted = (value) => safe(withName(value)).replaceAll('{{heart}}', HEART).replaceAll('\n', '<br>');
  const imageIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="3.5" width="17" height="17" rx="2.6"/><circle cx="9" cy="9" r="1.7"/><path d="m4.5 17 5-5 3.5 3 2.2-2.1 4.3 4.1"/></svg>';
  const lockIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.3a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15" r="1"/></svg>';
  let currentScene = 0;
  let sceneTransitioning = false;
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
  let musicDuckGain = null;
  let musicMuteGain = null;
  let musicFadeRaf = 0;
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
  const sceneIds = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 'zodiac-slide', 's8', 's9', 's10', 's11'];
  const riddleLevels = Array.isArray(C.riddles) ? C.riddles.slice(0, 3) : [];

  if (rotateCopy) rotateCopy.textContent = C.copy.rotate;
  const loadingLabel = document.getElementById('loading-state');
  if (loadingLabel) loadingLabel.setAttribute('aria-label', C.copy.loadingLabel);
  document.title = withName(C.copy.documentTitle);
  document.documentElement.style.setProperty('--purple', C.colors.primary || '#a78bfa');
  document.documentElement.style.setProperty('--blue', C.colors.blue || '#7dd3fc');
  document.documentElement.style.setProperty('--gold', C.colors.gold || '#ffd69b');

  const makeTopline = (label, number) => `<div class="scene-topline"><span class="eyebrow">${formatted(label)}</span><span class="scene-number">${String(number + 1).padStart(2, '0')} / ${String(sceneIds.length).padStart(2, '0')}</span></div>`;
  const makeProgress = (active) => `<div class="progress-dots" aria-hidden="true">${sceneIds.map((_, i) => `<span class="${i === active ? 'active' : ''}"></span>`).join('')}</div>`;
  const button = (label, action, secondary = false, extra = '') => `<button type="button" class="${secondary ? 'secondary-btn' : 'primary-btn'}" data-action="${action}" ${extra}>${formatted(label)}</button>`;
  const makeScene = (id, content, num) => `<section id="${id}" class="scene${num === 0 ? ' is-active' : ''}" aria-label="${safe(id)}"><span class="scene-zodiac-mark" aria-hidden="true">${LIBRA_SIGIL}</span><div class="scene-inner">${content}${makeProgress(num)}</div></section>`;

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
      return `<g class="bouquet-stem-group"><path class="bouquet-stem" d="${path}" fill="none" stroke="${i%3===0?'#78876d':'#91a080'}" stroke-width="${i%2?3:3.3}" stroke-linecap="round" stroke-dasharray="520" stroke-dashoffset="520"/>${leaves}<g class="bouquet-flower-cluster" data-cx="${tipX}" data-cy="${tipY}" opacity="0">${bloom}</g></g>`;
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
      <path d="M230 418 C217 406 193 395 193 380 C193 360 219 360 230 382 C241 360 267 360 267 380 C267 395 243 406 230 418Z" fill="#d9b779" stroke="#d7d8ee" stroke-width="1.5"/>
      <path d="M222 407 Q216 431 192 447 Q219 444 230 419 Q241 444 268 447 Q244 429 238 407Z" fill="#d9b779" stroke="#d7d8ee" stroke-width="1.4"/>
      <path d="M145 344 Q230 395 315 344" fill="none" stroke="#f1d9ba" stroke-width="2.3" opacity=".75"/>
    </svg>`;
  }

  function installAtelierDecor() {
    if (!document.getElementById('atelier-art-library')) {
      const library = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      library.id = 'atelier-art-library';
      library.classList.add('atelier-art-library');
      library.setAttribute('aria-hidden', 'true');
      library.innerHTML = `
        <symbol id="art-moon" viewBox="0 0 160 180"><path d="M108 13 A70 70 0 1 0 145 132 A58 58 0 0 1 108 13Z" fill="#c9a15a" fill-opacity=".12" stroke="#e5c786" stroke-width="1.6"/><path d="M105 24 A57 57 0 0 0 136 125" fill="none" stroke="#f3dfb0" stroke-width=".8" stroke-dasharray="2 5"/><circle cx="65" cy="48" r="2.6" fill="#f3dfb0"/><path d="M35 81 l4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" fill="#e8d09a"/></symbol>
        <symbol id="art-branch" viewBox="0 0 320 380"><g fill="none" stroke="#b7a174" stroke-width="1.35" stroke-linecap="round"><path d="M20 0 C68 60 70 116 128 163 S214 250 299 380"/><path d="M67 88 Q23 48 12 25 Q54 31 67 88Z"/><path d="M81 114 Q120 71 154 73 Q133 112 81 114Z"/><path d="M111 151 Q63 139 44 103 Q93 112 111 151Z"/><path d="M146 184 Q185 132 225 140 Q207 180 146 184Z"/><path d="M171 220 Q131 218 108 184 Q154 191 171 220Z"/><path d="M210 268 Q242 220 279 233 Q260 268 210 268Z"/></g><g stroke="#d8b0c1" stroke-width="1" fill="#8e5fb0" fill-opacity=".55"><path d="M91 124 C76 110 81 91 96 94 C107 96 108 114 91 124Z"/><path d="M100 138 C85 124 90 105 105 108 C116 110 117 128 100 138Z"/><path d="M111 151 C96 137 101 118 116 121 C127 123 128 141 111 151Z"/><path d="M214 244 C199 230 204 211 219 214 C230 216 231 234 214 244Z"/></g></symbol>
        <symbol id="art-arch" viewBox="0 0 320 420"><path d="M24 420 V165 A136 136 0 0 1 296 165 V420" fill="#8e5fb0" fill-opacity=".05" stroke="#c9a15a" stroke-width="2"/><path d="M37 420 V165 A123 123 0 0 1 283 165 V420" fill="none" stroke="#f3dfb0" stroke-opacity=".5" stroke-width=".8"/><path d="M24 242 Q160 199 296 242 M24 278 Q160 235 296 278" fill="none" stroke="#b28a50" stroke-opacity=".48"/></symbol>
        <symbol id="art-hills" viewBox="0 0 520 240"><path d="M0 155 Q72 68 146 129 T290 112 T520 126 V240 H0Z" fill="#4a2260" fill-opacity=".58" stroke="#8e5fb0" stroke-width="1.4"/><path d="M0 189 Q88 117 165 169 T337 165 T520 149 V240 H0Z" fill="#2a1638" fill-opacity=".8" stroke="#b7a174" stroke-width=".8"/><path d="M0 213 Q107 174 189 204 T375 190 T520 201 V240 H0Z" fill="#1b0f24" fill-opacity=".92" stroke="#8e5fb0" stroke-opacity=".65"/></symbol>
        <symbol id="art-lamps" viewBox="0 0 520 220"><path d="M5 6 Q260 115 515 6" fill="none" stroke="#c9a15a" stroke-width="1.3"/><g stroke="#d9bf87" stroke-width="1.1"><path d="M72 32 v24 M155 57 v24 M260 67 v24 M365 56 v24 M450 33 v24"/></g><g fill="#f3dfb0" stroke="#9e793b" stroke-width="1.2"><path d="M54 54 Q72 36 90 54 L86 78 Q72 91 58 78Z"/><path d="M137 79 Q155 61 173 79 L169 103 Q155 116 141 103Z"/><path d="M242 89 Q260 71 278 89 L274 113 Q260 126 246 113Z"/><path d="M347 78 Q365 60 383 78 L379 102 Q365 115 351 102Z"/><path d="M432 55 Q450 37 468 55 L464 79 Q450 92 436 79Z"/></g></symbol>
        <symbol id="art-tarot" viewBox="0 0 240 360"><path d="M14 20 Q120 -2 226 20 V340 Q120 360 14 340Z" fill="#f4ecdf" fill-opacity=".08" stroke="#c9a15a" stroke-width="1.6"/><path d="M25 31 Q120 11 215 31 V329 Q120 349 25 329Z" fill="none" stroke="#f3dfb0" stroke-width=".7"/><path d="M120 83 C91 50 60 76 80 106 L120 145 L160 106 C180 76 149 50 120 83Z" fill="#d9b779" fill-opacity=".86" stroke="#f3dfb0" stroke-width="1.4"/></symbol>
        <symbol id="art-envelope" viewBox="0 0 360 240"><path d="M15 58 Q180 24 345 58 L330 218 Q180 240 30 218Z" fill="#f4ecdf" fill-opacity=".1" stroke="#c9a15a" stroke-width="2"/><path d="M30 68 L180 160 L330 68 M30 218 L130 135 M330 218 L230 135" fill="none" stroke="#e5c786" stroke-width="1.5"/><path d="M180 122 C156 100 138 118 151 136 L180 163 L209 136 C222 118 204 100 180 122Z" fill="#d9b779" stroke="#f3dfb0" stroke-width="1.2"/></symbol>
        <symbol id="art-gallery" viewBox="0 0 380 420"><path d="M20 420 V155 A170 170 0 0 1 360 155 V420" fill="#f4ecdf" fill-opacity=".05" stroke="#c9a15a" stroke-width="3"/><path d="M34 420 V155 A156 156 0 0 1 346 155 V420" fill="none" stroke="#e5c786" stroke-width=".9"/><circle cx="190" cy="60" r="8" fill="#f3dfb0"/><path d="M190 68 V98" stroke="#c9a15a" stroke-width="1.3"/></symbol>
        <symbol id="art-curtain" viewBox="0 0 520 520"><path d="M0 0 H135 Q105 125 140 260 T110 520 H0Z" fill="#4a2260" fill-opacity=".72" stroke="#8e5fb0" stroke-width="1.2"/><path d="M0 0 Q82 82 40 205 T56 405 Q80 468 0 520Z" fill="#2a1638" fill-opacity=".78"/><path d="M520 0 H385 Q415 125 380 260 T410 520 H520Z" fill="#4a2260" fill-opacity=".72" stroke="#8e5fb0" stroke-width="1.2"/><path d="M520 0 Q438 82 480 205 T464 405 Q440 468 520 520Z" fill="#2a1638" fill-opacity=".78"/></symbol>
        <symbol id="art-star" viewBox="0 0 32 32"><path d="M16 1 L19 12 L31 16 L19 19 L16 31 L13 19 L1 16 L13 12Z" fill="#e5c786"/></symbol>
        <symbol id="art-sigil" viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" fill="none" stroke="#c9a15a" stroke-width="1.4"/><circle cx="40" cy="40" r="26" fill="none" stroke="#e5c786" stroke-width=".8" stroke-dasharray="1.5 3.5"/><path d="M40 20 C29 8 15 21 25 33 L40 47 L55 33 C65 21 51 8 40 20Z" fill="#d9b779" stroke="#f3dfb0" stroke-width="1.1"/></symbol>
        <symbol id="art-moth" viewBox="0 0 80 60"><path d="M40 28 C13 -3 3 12 17 38 L34 35 M40 28 C67 -3 77 12 63 38 L46 35" fill="#8e5fb0" fill-opacity=".42" stroke="#c9a15a" stroke-width="1.1"/><path d="M40 19 V48 M35 24 L28 16 M45 24 L52 16" stroke="#e5c786" stroke-width="1.2" fill="none"/></symbol>
      `;
      document.body.prepend(library);
    }
    const motifs = {
      s0: ['moon','art-moon','art-branch'], s1: ['telegram','art-envelope','art-sigil'],
      s2: ['arch','art-arch','art-branch'], s3: ['dusk','art-hills','art-moon'],
      s4: ['candle','art-lamps','art-moth'], s5: ['herbarium','art-branch','art-moth'],
      s6: ['tarot','art-tarot','art-branch'], s7: ['interlude','art-branch','art-star'],
      'zodiac-slide': ['libra','art-sigil','art-star'],
      s8: ['gallery','art-gallery','art-lamps'], s9: ['envelope','art-envelope','art-moth'],
      s10: ['letter','art-branch','art-envelope'], s11: ['curtain','art-curtain','art-star']
    };
    Object.entries(motifs).forEach(([id, item], index) => {
      const scene = document.getElementById(id);
      if (!scene || scene.querySelector('.scene-scenery')) return;
      scene.dataset.motif = item[0];
      scene.insertAdjacentHTML('afterbegin', `
        <div class="scene-scenery" aria-hidden="true">
          <svg class="scenery-large scenery-main" viewBox="0 0 520 620" preserveAspectRatio="xMidYMid meet"><use href="#${item[1]}" x="0" y="0" width="520" height="620"/></svg>
          <svg class="scenery-large scenery-secondary" viewBox="0 0 320 380"><use href="#${item[2]}" x="0" y="0" width="320" height="380"/></svg>
          <span class="scenery-corner corner-a"></span><span class="scenery-corner corner-b"></span>
          <span class="scenery-note">N° ${String(index + 1).padStart(2, '0')} <i>édition du soir</i></span>
          <svg class="scenery-mini mini-star" viewBox="0 0 32 32"><use href="#art-star"/></svg>
          <svg class="scenery-mini mini-moth" viewBox="0 0 80 60"><use href="#art-moth"/></svg>
          <svg class="scenery-mini mini-sigil" viewBox="0 0 80 80"><use href="#art-sigil"/></svg>
          <span class="scenery-rule"></span>
        </div>`);
    });
  }

  function installSignatureCompositions() {
    const map = { s0: 'seal', s1: 'telegram', s2: 'birthday-arch', s3: 'dusk-sky', s4: 'candle-table', s5: 'specimen', s6: 'tarot-deck', s7: 'interlude-editorial', 'zodiac-slide': 'libra-orbit', s8: 'gallery-wall', s9: 'sealed-envelope', s10: 'letter-stationery', s11: 'finale-curtain' };
    Object.entries(map).forEach(([id, signature]) => {
      const scene = document.getElementById(id);
      const scenery = scene && scene.querySelector('.scene-scenery');
      if (!scenery) return;
      scene.dataset.signature = signature;
      if (scenery.querySelector('.signature-ornament')) return;
      const mark = document.createElement('span');
      mark.className = 'signature-ornament';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = signature === 'specimen' ? 'SPECIMEN N° 18' : signature === 'tarot-deck' ? 'ARCANA · VIII' : signature === 'gallery-wall' ? 'GALERIE PRIVÉE · 10' : signature === 'letter-stationery' ? 'VIA HAMID · 18' : signature === 'finale-curtain' ? 'ÉDITION LIMITÉE · 18' : '✦';
      scenery.appendChild(mark);
      const extras = {
        seal: '<svg class="constellation-etch" viewBox="0 0 320 240"><g class="constellation-strokes" fill="none" stroke="#f3dfb0" stroke-width="1"><path d="M25 150 L68 74 L126 102 L174 36 L226 91 L281 50 M68 74 L88 174 L126 102 L165 190 L226 91"/></g><g fill="#f3dfb0"><circle cx="25" cy="150" r="2"/><circle cx="68" cy="74" r="3"/><circle cx="126" cy="102" r="2"/><circle cx="174" cy="36" r="3"/><circle cx="226" cy="91" r="2.5"/><circle cx="281" cy="50" r="2"/></g></svg>',
        'birthday-arch': '<svg class="birthday-stamp" viewBox="0 0 180 180"><defs><path id="birthday-stamp-circle" d="M90 90 m-66 0 a66 66 0 1 1 132 0 a66 66 0 1 1 -132 0"/></defs><circle cx="90" cy="90" r="77" fill="none" stroke="#c9a15a" stroke-width="1.5"/><circle cx="90" cy="90" r="68" fill="none" stroke="#f3dfb0" stroke-width=".8" stroke-dasharray="2 4"/><text fill="#f3dfb0" font-size="8.5" letter-spacing="2"><textPath href="#birthday-stamp-circle">SELAMAT ULANG TAHUN • NOR • 18 • </textPath></text></svg><div class="hero-marquee"><span>HAPPY 18 • NOR • HAPPY 18 • NOR •</span></div>',
        'dusk-sky': '<svg class="dusk-clouds" viewBox="0 0 390 180"><path d="M-10 72 Q45 43 78 68 T150 64 T222 70 T302 53 T410 67 M-10 103 Q48 78 93 100 T184 94 T278 100 T410 88" fill="none" stroke="#eaa98b" stroke-width="1.2"/></svg>',
        specimen: '<div class="specimen-label"><span>HERBIER DU SOIR</span><strong>Specimen N° 18</strong><i>flore pour Nor</i><b>— H. / 18 —</b></div><svg class="specimen-corners" viewBox="0 0 340 440"><path d="M8 58 V8 H58 M282 8 H332 V58 M8 382 V432 H58 M282 432 H332 V382" fill="none" stroke="#c9a15a" stroke-width="1.1"/></svg>',
        telegram: '<div class="telegram-perforation"></div><span class="telegram-side-note">SERVICE DES ÉTOILES · 18</span>',
        'candle-table': '<div class="candle-table-edge"></div><span class="candle-table-note">une petite lumière · 18</span>',
        'tarot-deck': '<div class="tarot-heading-mark"><span>ARCANA</span><strong>VIII</strong><i>petites raisons, grand amour</i></div>',
        'interlude-editorial': '<span class="editorial-marginalia">on garde les beaux jours</span><span class="editorial-pencil-mark">—</span>',
        'gallery-wall': '<div class="gallery-room-label">GALERIE PRIVÉE <span>·</span> N° 10</div>',
        'sealed-envelope': '<div class="envelope-seal"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="#8e5fb0" stroke="#c9a15a" stroke-width="1.5"/><circle cx="32" cy="32" r="23" fill="none" stroke="#f3dfb0" stroke-dasharray="1.5 3"/><path d="M32 22 C22 11 13 24 22 33 L32 43 L42 33 C51 24 42 11 32 22Z" fill="#d9b779" stroke="#f3dfb0" stroke-width="1"/></svg></div>',
        'letter-stationery': '<div class="letter-postmark"><span>VIA</span><strong>HAMID</strong><i>18 · JEMBER</i></div><span class="letter-washi"></span><svg class="pressed-botanical" viewBox="0 0 80 130" aria-hidden="true"><path d="M7 124 Q42 66 65 8 M34 79 Q10 68 12 43 Q34 55 34 79 M45 51 Q70 47 74 22 Q53 28 45 51" fill="none" stroke="#9a9972" stroke-width="1.2"/><path d="M34 79 Q10 68 12 43 Q34 55 34 79 M45 51 Q70 47 74 22 Q53 28 45 51" fill="#8e5fb0" fill-opacity=".4" stroke="#9a9972" stroke-width=".7"/></svg>',
        'finale-curtain': '<span class="velvet-curtain-panel curtain-left"></span><span class="velvet-curtain-panel curtain-right"></span><div class="marquee-frame"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'
      };
      if (extras[signature]) scenery.insertAdjacentHTML('beforeend', extras[signature]);
    });
    const intro = document.getElementById('s0');
    if (intro && !intro.dataset.constellationReady) {
      intro.dataset.constellationReady = 'true';
      intro.addEventListener('pointerdown', () => {
        intro.classList.add('constellation-lit');
        window.setTimeout(() => intro.classList.remove('constellation-lit'), 1900);
      }, { passive: true });
    }
  }

  function renderApp() {
    const c = C.copy;
    const zodiac = C.zodiac || {};
    const s0 = `
      <div class="hero-copy">
        <div class="hero-orbit" aria-hidden="true"><span class="orbit-ring"></span><span class="orbit-ring ring-two"></span><div class="orbit-center">${BIG_HEART}</div></div>
        ${makeTopline(c.startEyebrow, 0)}
        <p class="kicker">${formatted(c.startKicker)}</p>
        <div class="zodiac-hero-badge" aria-label="${formatted(zodiac.name || 'Libra')} · ${formatted(zodiac.birthday || '18 Oktober')}">
          <span class="zodiac-hero-sigil" aria-hidden="true">${LIBRA_SIGIL}</span>
          <span class="zodiac-hero-copy"><strong>${formatted(zodiac.name || 'Libra')} · ${formatted(zodiac.birthday || '18 Oktober')}</strong><small>THE BALANCE OF BEAUTY & HEART</small></span>
          <span class="zodiac-hero-spark" aria-hidden="true">✦</span>
        </div>
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
        <div class="zodiac-mini-badge"><span class="libra-mini-sigil" aria-hidden="true">${LIBRA_SIGIL}</span> LIBRA · 18 OKTOBER</div>
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

    const romanNumerals = ['I','II','III','IV','V','VI','VII','VIII'];
    const reasons = C.reasons.map((reason, i) => `<article class="reason-card tarot-card" data-tarot-index="${i}" tabindex="0" role="button" aria-pressed="false" aria-label="${safe(reason.title)}">
      <div class="tarot-face tarot-front">
        <span class="tarot-number">${romanNumerals[i % romanNumerals.length]}</span>
        <svg class="tarot-botanical" viewBox="0 0 120 150" aria-hidden="true"><path d="M60 145 C51 108 67 76 56 16 M58 103 Q21 91 18 57 Q49 69 58 103 M62 83 Q95 74 103 43 Q74 53 62 83" fill="none" stroke="#b7a174" stroke-width="1.3"/><circle cx="56" cy="16" r="4" fill="#eaa98b"/><circle cx="18" cy="57" r="3" fill="#f3dfb0"/><circle cx="103" cy="43" r="3" fill="#f3dfb0"/></svg>
        <span class="tarot-index-label">ARCANA · N° ${String(i + 1).padStart(2, '0')}</span>
        <span class="tarot-flip-hint">balik kartu ↻</span>
      </div>
      <div class="tarot-face tarot-back">
        <span class="reason-index">N° ${String(i + 1).padStart(2, '0')} / ${String(C.reasons.length).padStart(2, '0')}</span>
        <h3>${formatted(reason.title)}</h3><p>${formatted(reason.body)}</p>
        <span class="tarot-back-mark">— H. / 18 —</span>
      </div>
    </article>`).join('');
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

    const zodiacFacts = Array.isArray(zodiac.facts) ? zodiac.facts : []
    const zodiacCards = zodiacFacts.map((fact, i) => `
      <article class="zodiac-fact">
        <span class="zodiac-fact-number">${String(i + 1).padStart(2, '0')}</span>
        <span class="zodiac-fact-star" aria-hidden="true">✦</span>
        <h3>${formatted(fact.title || 'Fakta Libra')}</h3>
        <p>${formatted(fact.body || '')}</p>
      </article>`).join('');
    const sZodiac = `
      ${makeTopline(zodiac.eyebrow || 'KARTU LANGIT UNTUKMU', 8)}
      <div class="zodiac-panel">
        <div class="zodiac-intro">
          <div class="zodiac-emblem" aria-hidden="true">
            <svg viewBox="0 0 100 100" role="presentation">
              <circle cx="50" cy="50" r="43" class="zodiac-emblem-ring"/>
              <path d="M50 17v17 M29 35h42 M37 35L24 56h26L37 35Zm26 0L50 56h26L63 35ZM25 61q12 10 25 0 M50 61q13 10 25 0 M22 70h56 M30 79h40" class="zodiac-emblem-line"/>
            </svg>
          </div>
          <div class="zodiac-intro-copy">
            <p class="kicker">${formatted(zodiac.birthday || '18 Oktober')} · ${formatted(zodiac.name || 'Libra')}</p>
            <h2 class="section-title">${formatted(zodiac.title || 'Sedikit tentang Libra')}</h2>
            <p class="body-copy">${formatted(zodiac.body || '')}</p>
          </div>
        </div>
        <div class="zodiac-meta" aria-label="Ringkasan zodiak">
          <span><strong class="zodiac-meta-symbol">${LIBRA_SIGIL}</strong> ${formatted(zodiac.name || 'Libra')}</span>
          <span>Rentang: ${formatted(zodiac.dateRange || '23 September – 22 Oktober')}</span>
          <span>${formatted(zodiac.element || 'Unsur udara')}</span>
          <span>Planet: ${formatted(zodiac.rulingPlanet || 'Venus')}</span>
        </div>
        <h3 class="zodiac-facts-title">Lima hal kecil tentang bintangmu</h3>
        <div class="zodiac-facts-grid">${zodiacCards}</div>
        <p class="zodiac-note"><span aria-hidden="true">✧</span> ${formatted(zodiac.note || '')}</p>
      </div>
      <div class="actions zodiac-actions">${button(zodiac.button || 'Lanjut', 'next')}</div>`;

    const photos = C.photos.map((photo, i) => `<article class="gallery-card" style="--rot:${(-3 + Math.random() * 7).toFixed(2)}deg;--lift:${(-4 + Math.random() * 8).toFixed(1)}px" data-photo-index="${i}"><span class="polaroid-tape" aria-hidden="true"></span><div class="gallery-photo"><div class="photo-placeholder"><div class="frame-icon">${imageIcon}</div><p>${formatted(c.photoEmpty)}</p><small>${formatted(c.photoEmptyNote)}</small></div><img data-src="${safe(photo.src)}" loading="lazy" decoding="async" alt="${safe(c.photoAlt)} ${i + 1}"></div><div class="gallery-caption"><span class="caption-count">${String(i + 1).padStart(2, '0')}</span><span>${formatted(photo.caption)}</span></div></article>`).join('');
    const s7 = `
      ${makeTopline(c.galleryEyebrow, 9)}
      <p class="kicker">${String(C.photos.length).padStart(2, '0')} ${formatted(c.galleryKicker)}</p>
      <h2 class="section-title">${formatted(c.galleryTitle)}</h2>
      <p class="body-copy">${formatted(c.galleryBody)}</p>
      <div class="gallery-strip" id="gallery-strip" aria-label="${safe(c.galleryAria)}">${photos}</div>
      <div class="gallery-foot"><span>${formatted(c.gallerySwipe)}</span><span id="gallery-index">01 / ${String(C.photos.length).padStart(2, '0')}</span></div>
      <div class="actions">${button(c.galleryButton, 'next')}</div>`;

    const s8 = `
      ${makeTopline(c.preletterEyebrow, 10)}
      <div class="hero-copy">
        <div class="hero-orbit" aria-hidden="true"><span class="orbit-ring"></span><span class="orbit-ring ring-two"></span><div class="orbit-center">${BIG_HEART}</div></div>
        <p class="kicker">${formatted(c.preletterKicker)}</p>
        <h2 class="section-title">${formatted(c.preletterTitle)}</h2>
        <p class="body-copy">${formatted(c.preletterBody)}</p>
        <div class="actions">${button(c.preletterButton, 'next')}</div>
      </div>`;

    const paragraphs = C.letter.map((paragraph, i) => `<p class="letter-paragraph" data-letter-paragraph="${i}">${formatted(paragraph)}</p>`).join('');
    const s9 = `
      ${makeTopline(c.letterEyebrow, 11)}
      <div class="hero-copy" style="text-align:left"><p class="kicker">${formatted(c.letterKicker)}</p><h2 class="section-title">${formatted(c.letterTitle)}</h2></div>
      <article class="letter-paper" id="letter-paper">${paragraphs}</article>
      <div class="actions" style="justify-content:center">${button(c.letterButton, 'next')}</div>`;

    const s10 = `
      ${makeTopline(c.finaleEyebrow, 12)}
      <div class="hero-copy">
        <p class="kicker">${formatted(c.finaleKicker)}</p>
        <h2 class="section-title">${formatted(c.finaleTitle)}</h2>
      </div>
      <div class="finale-stage" id="finale-stage">
        <div class="gift-stage" id="gift-stage">
          <button type="button" class="gift-wrap" id="gift-wrap" aria-label="${safe(c.giftButton)}" aria-expanded="false"><span class="gift-bow"></span><span class="gift-lid"></span><span class="gift-box"></span></button>
          <div class="lion-stage" id="lion-stage" hidden>
            <p class="lion-caption" id="lion-caption" aria-live="polite"></p>
            <svg class="lion-art lion-roaring" id="lion-roaring" viewBox="0 0 360 310" role="img" aria-label="Singa besar bersurai emas muncul dari kado">
              <defs>
                <linearGradient id="lion-mane" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe7aa"/><stop offset=".35" stop-color="#d99642"/><stop offset=".72" stop-color="#8d481f"/><stop offset="1" stop-color="#452326"/></linearGradient>
                <linearGradient id="lion-face" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#ffe4a3"/><stop offset=".58" stop-color="#d9984b"/><stop offset="1" stop-color="#a6602d"/></linearGradient>
                <radialGradient id="lion-eye"><stop offset="0" stop-color="#fff0a6"/><stop offset=".52" stop-color="#e7a13f"/><stop offset="1" stop-color="#331522"/></radialGradient>
              </defs>
              <g id="roar-body">
                <path d="M82 294Q67 250 92 219Q116 191 148 205L214 205Q253 193 279 228Q297 255 280 294Z" fill="url(#lion-face)" stroke="#67341f" stroke-width="3"/>
                <path d="M105 245L99 289H144L157 246M212 246L227 289H265L257 245" fill="#bd7939" stroke="#71401f" stroke-width="3"/>
                <path d="M107 281q16 12 31 0m95 0q15 12 30 0" fill="none" stroke="#f6ce85" stroke-width="3" stroke-linecap="round"/>
              </g>
              <g id="roar-mane">
                <path d="M176 10L198 29L222 20L231 44L258 43L258 67L285 80L274 103L298 121L282 143L295 165L272 181L273 206L247 213L233 238L210 231L190 254L171 237L146 247L136 224L108 227L108 202L82 194L94 172L70 157L87 136L68 116L91 99L84 76L110 68L115 43L141 47L151 24Z" fill="url(#lion-mane)" stroke="#6b381f" stroke-width="4" stroke-linejoin="round"/>
                <g fill="none" stroke="#f6c16e" stroke-width="5" stroke-linecap="round" opacity=".72">
                  <path d="M144 35Q123 77 145 102Q117 135 123 173"/>
                  <path d="M173 24Q151 60 174 90Q151 123 161 154"/>
                  <path d="M207 41Q226 73 202 103Q227 136 213 173"/>
                  <path d="M246 72Q224 104 250 129Q229 158 248 188"/>
                  <path d="M111 101Q134 125 112 153Q130 174 111 193"/>
                </g>
              </g>
              <g id="roar-head">
                <path d="M121 91Q105 67 126 57Q145 57 151 79L151 93M210 92Q212 66 235 63Q256 75 239 101" fill="#9a5128" stroke="#54251e" stroke-width="5"/>
                <path d="M129 85Q132 70 144 82L146 100M221 91Q225 75 238 84L233 103" fill="#e8a36b" stroke="#73371f" stroke-width="3"/>
                <path d="M143 85Q114 109 125 153Q135 197 174 213Q215 202 231 158Q242 117 214 88Q179 67 143 85Z" fill="url(#lion-face)" stroke="#63331f" stroke-width="4"/>
                <path d="M137 119L161 111L173 124L159 132Z M187 124L201 111L225 119L202 132Z" fill="#3a2020"/>
                <ellipse cx="158" cy="123" rx="8" ry="10" fill="url(#lion-eye)"/><ellipse cx="204" cy="123" rx="8" ry="10" fill="url(#lion-eye)"/>
                <ellipse cx="159" cy="125" rx="2.6" ry="7" fill="#1b1117"/><ellipse cx="203" cy="125" rx="2.6" ry="7" fill="#1b1117"/>
                <path d="M136 111L163 104L174 115M190 115L202 104L227 111" fill="none" stroke="#67351f" stroke-width="7" stroke-linecap="round"/>
                <path d="M148 150Q163 135 180 150Q197 135 214 150L208 169Q197 186 180 187Q162 185 151 168Z" fill="#4a2021" stroke="#713522" stroke-width="3"/>
                <path d="M154 151L164 163L174 154L180 164L188 154L198 163L207 151L203 169Q180 187 158 169Z" fill="#e9d6b3"/>
                <path d="M172 177Q180 183 188 177L186 194Q180 201 174 194Z" fill="#e98d87"/>
                <path d="M170 148Q180 139 190 148Q180 158 170 148Z" fill="#2b171a"/>
                <path d="M149 158L113 151M151 166L117 170M211 158L246 151M209 166L243 170" fill="none" stroke="#f5d8a3" stroke-width="1.5" opacity=".85"/>
                <path d="M135 191Q147 210 166 212L157 230L144 214Z M225 190Q215 211 195 213L204 229L217 212Z" fill="#d18c43" stroke="#67341f" stroke-width="3"/>
              </g>
              <g id="roar-paws">
                <path d="M96 248Q115 235 139 247L153 273Q153 287 141 289H108Q87 285 91 267Z M208 247Q233 235 255 249L264 267Q269 286 247 289H215Q203 285 205 273Z" fill="url(#lion-face)" stroke="#67341f" stroke-width="3"/>
                <path d="M107 278l12 7m9-7 8 7m82-7 8 7m9-7 8 7" fill="none" stroke="#7f4828" stroke-width="2" stroke-linecap="round"/>
              </g>
            </svg>
            <svg class="lion-art lion-cub" id="lion-cub" viewBox="0 0 360 310" role="img" aria-label="Anak singa mungil bermata besar dan menggemaskan" hidden>
              <defs>
                <radialGradient id="cub-fur" cx=".35" cy=".2" r=".9"><stop offset="0" stop-color="#fff0bd"/><stop offset=".6" stop-color="#e5ac5b"/><stop offset="1" stop-color="#b87335"/></radialGradient>
                <radialGradient id="cub-face" cx=".35" cy=".2" r=".95"><stop offset="0" stop-color="#fff0cb"/><stop offset=".65" stop-color="#f4d5a0"/><stop offset="1" stop-color="#d79b58"/></radialGradient>
              </defs>
              <g id="cub-tail"><path d="M255 226Q310 239 299 202Q291 183 274 198" fill="none" stroke="#c17a35" stroke-width="12" stroke-linecap="round"/><circle cx="273" cy="198" r="10" fill="#8b4c29"/></g>
              <ellipse cx="181" cy="240" rx="92" ry="59" fill="url(#cub-fur)" stroke="#9c5c2d" stroke-width="3"/>
              <path d="M117 231L105 283Q109 294 131 292L151 256M209 255L232 286Q249 295 258 281L241 233" fill="#d9954e" stroke="#9c5c2d" stroke-width="3" stroke-linecap="round"/>
              <g id="cub-head">
                <path d="M113 112Q87 76 119 57Q149 53 158 88L153 118M207 88Q216 54 245 62Q270 81 244 116" fill="url(#cub-fur)" stroke="#9c5c2d" stroke-width="4"/>
                <path d="M124 91Q133 70 151 96L147 110M223 96Q236 72 251 93L234 113" fill="#f6b2a0" stroke="#b86a49" stroke-width="3"/>
                <ellipse cx="180" cy="153" rx="78" ry="80" fill="url(#cub-face)" stroke="#9c5c2d" stroke-width="4"/>
                <ellipse cx="148" cy="148" rx="17" ry="21" fill="#fff8dd"/><ellipse cx="212" cy="148" rx="17" ry="21" fill="#fff8dd"/>
                <ellipse cx="151" cy="151" rx="10" ry="13" fill="#633b2b"/><ellipse cx="209" cy="151" rx="10" ry="13" fill="#633b2b"/>
                <ellipse cx="153" cy="153" rx="5" ry="8" fill="#1b1417"/><ellipse cx="207" cy="153" rx="5" ry="8" fill="#1b1417"/>
                <circle cx="147" cy="143" r="5" fill="#fff"/><circle cx="205" cy="143" r="5" fill="#fff"/>
                <path d="M119 137Q142 119 160 134M200 134Q220 117 242 137" fill="none" stroke="#9c5c2d" stroke-width="6" stroke-linecap="round"/>
                <ellipse cx="163" cy="184" rx="26" ry="22" fill="#fff2d6"/><ellipse cx="199" cy="184" rx="26" ry="22" fill="#fff2d6"/>
                <path d="M170 180Q180 170 190 180Q180 195 170 180Z" fill="#5a2d2e"/>
                <path d="M180 192Q166 204 154 195M180 192Q194 204 206 195" fill="none" stroke="#71412d" stroke-width="3.5" stroke-linecap="round"/>
                <ellipse cx="127" cy="181" rx="11" ry="6" fill="#e8a08f" opacity=".48"/><ellipse cx="233" cy="181" rx="11" ry="6" fill="#e8a08f" opacity=".48"/>
              </g>
              <path d="M139 219Q180 245 222 219" fill="none" stroke="#fff0c6" stroke-width="4" stroke-linecap="round"/>
              <g id="cub-paws"><ellipse cx="135" cy="276" rx="25" ry="18" fill="url(#cub-face)" stroke="#9c5c2d" stroke-width="3"/><ellipse cx="226" cy="276" rx="25" ry="18" fill="url(#cub-face)" stroke="#9c5c2d" stroke-width="3"/><path d="M129 273l-4 6m12-6 2 7m82-7-3 7m11-7 2 7" stroke="#9c5c2d" stroke-width="2" stroke-linecap="round"/></g>
            </svg>
          </div>
        </div>
      </div>
      <div class="voucher" id="voucher"><div class="voucher-label">${formatted(c.voucherLabel)}</div><h3>${formatted(C.finale.title || c.voucherTitle)}</h3><p>${formatted(C.finale.body || c.voucherBody)}</p><div class="voucher-bottom"><span>${formatted(c.voucherFoot)}</span>${BIG_HEART}</div></div>
      <div class="hero-copy"><button type="button" class="primary-btn" id="gift-button">${formatted(c.giftButton)}</button><h2 class="closing-line" id="closing-line" hidden>${formatted(C.finale.message || C.finale.closing || c.closing)}</h2><div class="replay-row" id="replay-row" hidden>${button(c.replay, 'replay', true)}</div></div>`;

    app.innerHTML = [s0,s1,s2,s3,s5,sFlower,s4,s6,sZodiac,s7,s8,s9,s10].map((html, i) => makeScene(sceneIds[i], html, i)).join('');
    installAtelierDecor();
    installSignatureCompositions();
    installEventHandlers();
    observePhotos();
    setupLetterReveal();
    setupGalleryProgress();
  }

  function installEventHandlers() {
    app.addEventListener('click', (event) => {
      const tarotCard = event.target.closest('.tarot-card');
      if (tarotCard) {
        const flipped = tarotCard.classList.toggle('is-flipped');
        tarotCard.setAttribute('aria-pressed', String(flipped));
        return;
      }
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      const action = actionButton.dataset.action;
      if (action === 'start') {
        unlockAudioOnGesture();
        setScene(1);
      } else if (action === 'next') {
        setScene(Math.min(sceneIds.length - 1, currentScene + 1));
      } else if (action === 'replay') {
        // A full reload resets timers, balloon/candle/gift state, and all particle pools.
        window.location.reload();
      }
    });

    app.addEventListener('keydown', (event) => {
      const card = event.target.closest('.tarot-card');
      if (!card || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      const flipped = card.classList.toggle('is-flipped');
      card.setAttribute('aria-pressed', String(flipped));
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
        const gatePanel = document.querySelector('#s1 .lock-panel');
        const gateLock = document.querySelector('#s1 .lock-symbol');
        [gatePanel, gateLock].filter(Boolean).forEach((element) => {
          element.classList.remove('gate-error');
          void element.offsetWidth;
          element.classList.add('gate-error');
          window.setTimeout(() => element.classList.remove('gate-error'), 420);
        });
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
      audio.muted = audioMuted && !(musicMuteGain && audioContext);
      if (musicMuteGain && audioContext) {
        musicMuteGain.gain.setTargetAtTime(audioMuted ? 0 : 1, audioContext.currentTime, .025);
      }
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
          musicGain.gain.value = 0;
          musicDuckGain = audioContext.createGain();
          musicDuckGain.gain.value = 1;
          musicMuteGain = audioContext.createGain();
          musicMuteGain.gain.value = audioMuted ? 0 : 1;
          mediaSource.connect(audioAnalyser);
          audioAnalyser.connect(musicGain);
          musicGain.connect(musicDuckGain);
          musicDuckGain.connect(musicMuteGain);
          musicMuteGain.connect(audioContext.destination);
        } catch (_) {
          audioAnalyser = null;
          frequencyData = null;
          musicGain = null;
          musicDuckGain = null;
          musicMuteGain = null;
        }
      }
    } catch (_) {
      audioContext = null;
      sfxMasterGain = null;
      musicGain = null;
      musicDuckGain = null;
      musicMuteGain = null;
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
      if (musicDuckGain && audioContext) {
        const now = audioContext.currentTime;
        musicDuckGain.gain.cancelScheduledValues(now);
        musicDuckGain.gain.setTargetAtTime(.48, now, .035);
        musicDuckGain.gain.setTargetAtTime(1, now + .22, .1);
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
      audio.volume = musicGain && musicMuteGain ? 1 : 0;
      audio.muted = audioMuted && !(musicMuteGain && audioContext);
      if (musicMuteGain && audioContext) {
        musicMuteGain.gain.setTargetAtTime(audioMuted ? 0 : 1, audioContext.currentTime, .025);
      }
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
      audio.volume = musicGain && musicMuteGain ? 1 : 0;
      audio.muted = audioMuted && !(musicMuteGain && audioContext);
      if (musicMuteGain && audioContext) {
        musicMuteGain.gain.setTargetAtTime(audioMuted ? 0 : 1, audioContext.currentTime, .025);
      }
      const playResult = audio.play();
      if (playResult?.catch) playResult.catch(() => {});
      fadeAudio(0, 1, Math.max(0.1, Number(C.music.fadeSeconds) || 3) * 1000);
    } catch (_) {
      // Gagal audio tidak menghentikan alur kejutan.
    }
  }

  function fadeAudio(from, to, duration) {
    if (musicFadeRaf) {
      window.cancelAnimationFrame(musicFadeRaf);
      musicFadeRaf = 0;
    }
    const hasGainStage = !!(musicGain && audioContext && musicMuteGain);
    const setLevel = (level) => {
      if (hasGainStage) {
        musicGain.gain.setValueAtTime(level, audioContext.currentTime);
      } else {
        audio.volume = Math.max(0, Math.min(1, level));
      }
    };
    if (reducedMotion || duration <= 0) {
      setLevel(to);
      return;
    }
    const started = performance.now();
    const frame = (time) => {
      const progress = Math.min(1, (time - started) / Math.max(1, duration));
      setLevel(from + (to - from) * progress);
      if (progress < 1) {
        musicFadeRaf = window.requestAnimationFrame(frame);
      } else {
        musicFadeRaf = 0;
      }
    };
    musicFadeRaf = window.requestAnimationFrame(frame);
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
    const atmosphereCanvas = document.getElementById('atmosphere-canvas');
    const atmosphereParent = atmosphereCanvas ? atmosphereCanvas.parentNode : null;
    const atmosphereNextSibling = atmosphereCanvas ? atmosphereCanvas.nextSibling : null;
    if (atmosphereCanvas) overlay.appendChild(atmosphereCanvas);
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
    if (atmosphereCanvas && atmosphereParent) {
      if (atmosphereNextSibling && atmosphereNextSibling.parentNode === atmosphereParent) {
        atmosphereParent.insertBefore(atmosphereCanvas, atmosphereNextSibling);
      } else {
        atmosphereParent.appendChild(atmosphereCanvas);
      }
    }
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
    if (reducedMotion || ![2, 5, 10].includes(index)) return;
    const mode = index === 2 ? 'iris' : index === 5 ? 'curtain' : 'cross';
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
    if (sceneTransitioning) return;
    index = Math.max(0, Math.min(sceneIds.length - 1, index));
    if (index === 1 && !unlocked) { /* riddle is the expected first gate */ }
    const previous = document.getElementById(sceneIds[currentScene]);
    const next = document.getElementById(sceneIds[index]);
    if (!next || index === currentScene) return;
    if (currentScene === 5 && index !== 5) {
      if (bouquetPetalTimer) {
        window.clearTimeout(bouquetPetalTimer);
        bouquetPetalTimer = 0;
      }
      const bouquetSvg = document.getElementById('bouquet-svg');
      if (bouquetSvg && window.gsap) {
        const stems = Array.from(bouquetSvg.querySelectorAll('.bouquet-stem'));
        const targets = Array.from(bouquetSvg.querySelectorAll('.bouquet-leaf, .bouquet-flower, .bouquet-flower-cluster'));
        window.gsap.killTweensOf([...stems, ...targets]);
        window.gsap.set(stems, { clearProps: 'strokeDashoffset' });
        window.gsap.set(targets, { clearProps: 'transform,opacity' });
      }
    }
    sceneTransitioning = true;
    if (previous) {
      previous.classList.remove('is-active');
      previous.classList.add('is-leaving');
      previous.setAttribute('aria-hidden', 'true');
      window.setTimeout(() => previous.classList.remove('is-leaving'), reducedMotion ? 1 : 360);
    }
    window.setTimeout(() => { sceneTransitioning = false; }, reducedMotion ? 1 : 360);
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
      animateHeroNumber();
      launchFireworkSequence(8);
    }
    if (index === 3) animateBalloonEntrance();
    if (index === sceneIds.length - 1) launchFireworkSequence(8);
    if (index === 6) animateReasonCards();
    if (index === 5) animateBouquet();
    if (index === 11) revealVisibleLetterParagraphs();
    const audioToggle = document.getElementById('audio-toggle');
    if (audioToggle) audioToggle.hidden = index < 2 || index >= sceneIds.length - 2;
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
    const phraseCharacters = Array.from(phrase.matchAll(/\S/gu), match => ({
      character: match[0],
      end: match.index + match[0].length
    }));
    const charCount = Math.min(phraseCharacters.length, count);
    const coords = [
      [2,8], [19,3], [36,12], [54,4], [72,11], [88,5],
      [10,37], [27,31], [45,39], [63,32], [81,38], [1,65],
      [19,61], [37,70], [55,62], [72,69], [88,62], [43,81],
    ];
    const palettes = [
      ['#f3dfb0','#8f6b32'], ['#9e75ba','#4a2260'], ['#eaa98b','#9d5e54'],
      ['#d7c3e5','#8e5fb0'], ['#f4ecdf','#a9895d'], ['#d9b779','#7a5330'],
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
        const phraseCharacter = phraseCharacters[letterCount];
        const character = phraseCharacter.character;
        letterCount++;
        const mark = item.querySelector('.balloon-mark');
        if (mark) { mark.textContent = character === ' ' ? '\u00a0' : character; mark.classList.add('revealed-character'); }
        item.setAttribute('aria-label', safe(withName(C.copy.balloonPoppedLabel)));
        reveal.textContent = phrase.slice(0, phraseCharacter.end);
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
        if (mark) mark.textContent = phraseCharacters[Math.max(0, letterCount - 1)]?.character || '';
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
    buttons.forEach((item) => {
      item.addEventListener('pointerdown', () => {
        if (item.classList.contains('popped') || reducedMotion || !window.gsap) return;
        window.gsap.to(item, { scale: .94, duration: .075, ease: 'power1.out', yoyo: true, repeat: 1, overwrite: true });
      }, { passive: true });
      item.addEventListener('click', () => pop(item, false));
    });
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
      { y: arena.clientHeight + 150, opacity: 0, scale: .86, rotation: (index, target) => (Number.parseFloat(target.style.getPropertyValue('--tilt')) || 0) + (Math.random() - .5) * 7 },
      { y: 0, opacity: 1, scale: 1, rotation: (index, target) => (Number.parseFloat(target.style.getPropertyValue('--tilt')) || 0) + (Math.random() - .5) * 3,
        duration: index => .72 + Math.random() * .18, ease: 'back.out(1.32)', stagger: () => .04 + Math.random() * .05,
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
        const wasFloating = item.classList.contains('is-floating');
        const resumeDrift = () => {
          if (wasFloating && item.isConnected) item.style.removeProperty('animation');
        };
        if (wasFloating) item.style.animation = 'none';
        window.gsap.killTweensOf(item);
        window.gsap.to(item, {
          x: dx / distance * force, y: dy / distance * force, duration: .14, ease: 'power2.out',
          onComplete: () => {
            if (!item.isConnected || item.classList.contains('popped') || item.classList.contains('balloon-escape')) {
              resumeDrift();
              return;
            }
            window.gsap.to(item, {
              x: 0, y: 0, duration: .6, ease: 'elastic.out(1,.42)', clearProps: 'x,y',
              onComplete: resumeDrift
            });
          }
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

  let bouquetPetalTimer = 0;
  function scheduleBouquetPetalDrop() {
    if (bouquetPetalTimer) window.clearTimeout(bouquetPetalTimer);
    const drop = () => {
      if (currentScene !== 5 || document.hidden || reducedMotion || !canvasActive) {
        bouquetPetalTimer = 0;
        return;
      }
      const blooms = Array.from(document.querySelectorAll('#bouquet-svg .bouquet-flower-cluster'));
      const bloom = blooms.length ? blooms[Math.floor(Math.random() * blooms.length)] : null;
      if (bloom) {
        const svg = bloom.ownerSVGElement;
        const cx = Number(bloom.dataset.cx);
        const cy = Number(bloom.dataset.cy);
        const matrix = svg && svg.getScreenCTM ? svg.getScreenCTM() : null;
        let x;
        let y;
        if (svg && matrix && Number.isFinite(cx) && Number.isFinite(cy)) {
          const point = svg.createSVGPoint();
          point.x = cx;
          point.y = cy;
          const screenPoint = point.matrixTransform(matrix);
          x = screenPoint.x;
          y = screenPoint.y;
        } else {
          const rect = bloom.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + rect.height / 2;
        }
        addParticle({
          type: 'petal', x, y,
          vx: (Math.random() - .5) * .55, vy: .18 + Math.random() * .3,
          rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * .035,
          radius: 3 + Math.random() * 2.5, life: 1, decay: .004 + Math.random() * .002,
          gravity: .012, friction: .993, maxVy: 1.8, phase: Math.random() * 6.28,
          phaseSpeed: .08 + Math.random() * .05, sway: Math.random() * 6.28,
          swayAmplitude: .42, color: ['#d9c6ed','#f3d9ca','#e2bd73','#b79acb'][Math.floor(Math.random()*4)],
          color2: '#f4e8e0'
        });
      }
      bouquetPetalTimer = window.setTimeout(drop, 1250 + Math.random() * 650);
    };
    bouquetPetalTimer = window.setTimeout(drop, 1250 + Math.random() * 650);
  }

  function animateBouquet() {
    const scene = document.getElementById('s5');
    if (!scene) return;
    const svg = scene.querySelector('#bouquet-svg');
    if (!svg) return;

    const stems = Array.from(svg.querySelectorAll('.bouquet-stem'));
    const leaves = Array.from(svg.querySelectorAll('.bouquet-leaf'));
    const flowers = Array.from(svg.querySelectorAll('.bouquet-flower'));
    const clusters = Array.from(svg.querySelectorAll('.bouquet-flower-cluster'));

    if (reducedMotion || !window.gsap) {
      stems.forEach(el => { el.style.strokeDashoffset = '0'; });
      leaves.forEach(el => { el.style.opacity = '1'; });
      flowers.forEach(el => { el.style.opacity = '1'; });
      clusters.forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
      return;
    }

    const gsap = window.gsap;
    const allTargets = [...stems, ...leaves, ...flowers, ...clusters];
    gsap.killTweensOf(allTargets);
    gsap.set(flowers, { opacity: 0 });
    gsap.set(leaves, { opacity: 0 });
    gsap.set(clusters, {
      scale: .2,
      opacity: 0,
      svgOrigin: (index, target) => `${target.dataset.cx} ${target.dataset.cy}`
    });

    const timeline = gsap.timeline();
    timeline.to(stems, {
      strokeDashoffset: 0, duration: .95, stagger: .055, ease: 'power2.out'
    });
    timeline.to(leaves, {
      opacity: 1, duration: .34, stagger: .035, ease: 'power1.out'
    }, '-=.5');
    timeline.to(clusters, {
      opacity: 1,
      scale: 1,
      svgOrigin: (index, target) => `${target.dataset.cx} ${target.dataset.cy}`,
      duration: .5,
      stagger: .045,
      ease: 'back.out(1.25)'
    }, '-=.24');
    timeline.to(flowers, {
      opacity: 1, duration: .3, stagger: .008, ease: 'power1.out'
    }, '<');
    timeline.call(() => releasePetals(20, canvasWidth * .5, canvasHeight * .18), null, '+=.12');
    scheduleBouquetPetalDrop();
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
        flame.style.removeProperty('filter');
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
        window.setTimeout(() => { playTone(740, .36, 'sine', .055, 1120); playTone(1110, .28, 'sine', .025, 1480); }, 360);
        spawnCandleSmoke(stage);
        sprinkleCakeSparks(stage);
        if (navigator.vibrate && /Android/i.test(navigator.userAgent)) {
          try { navigator.vibrate(35); } catch (_) { /* no-op */ }
        }
        window.setTimeout(() => { if (scene) scene.classList.remove('candle-dimming'); }, 1850);
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
    const load = (img) => {
      if (img.dataset.checked === 'true') return;
      img.dataset.checked = 'true';
      const src = img.dataset.src;
      const placeholder = img.parentElement?.querySelector('.photo-placeholder');
      if (!src) {
        img.hidden = true;
        return;
      }

      let settled = false;
      const reveal = () => {
        if (settled || !img.naturalWidth) return;
        settled = true;
        img.classList.add('loaded');
        if (placeholder) placeholder.hidden = true;
      };
      img.addEventListener('load', reveal, { once: true });
      img.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        img.hidden = true;
        if (placeholder) placeholder.hidden = false;
      }, { once: true });

      // Defer the real image request until the card approaches view; no extra HEAD round-trip.
      img.src = src;
      if (img.complete && img.naturalWidth > 0) reveal();
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
    const lionStage = document.getElementById('lion-stage');
    const roaringLion = document.getElementById('lion-roaring');
    const lionCub = document.getElementById('lion-cub');
    const lionCaption = document.getElementById('lion-caption');
    if (!buttonElement || !wrap || !voucher || !giftStage || !lionStage || !roaringLion || !lionCub) return;

    let opened = false;
    const revealVoucher = () => {
      voucher.classList.add('visible');
      spawnCelebrationBurst(canvasWidth * .5, canvasHeight * .48, 70);
      spawnConfettiBurst(canvasWidth * .5, canvasHeight * .42, 18);
      const closing = document.getElementById('closing-line');
      if (closing) closing.removeAttribute('hidden');
      const replay = document.getElementById('replay-row');
      if (replay) replay.removeAttribute('hidden');
      if (closing && window.gsap && !reducedMotion) {
        window.gsap.fromTo(closing, { opacity: 0, y: 18, scale: .96 }, {
          opacity: 1, y: 0, scale: 1, duration: .9, delay: .18, ease: 'power4.out'
        });
      }
    };

    const transformToCub = () => {
      if (lionCaption) lionCaption.textContent = 'Ternyata cuma si kecil yang ingin merayakan kamu. ♡';
      if (reducedMotion || !window.gsap) {
        roaringLion.setAttribute('hidden', '');
        lionCub.removeAttribute('hidden');
        lionCub.classList.add('lion-revealed');
        window.setTimeout(revealVoucher, reducedMotion ? 250 : 850);
        return;
      }
      const gsap = window.gsap;
      const timeline = gsap.timeline({ onComplete: () => window.setTimeout(revealVoucher, 450) });
      timeline.to(roaringLion, { opacity: 0, scale: .68, y: 25, rotation: -3, duration: .48, ease: 'power2.in' });
      timeline.call(() => { roaringLion.setAttribute('hidden', ''); lionCub.removeAttribute('hidden'); });
      timeline.fromTo(lionCub,
        { opacity: 0, scale: .48, y: 86, rotation: 5 },
        { opacity: 1, scale: 1, y: 0, rotation: 0, duration: .95, ease: 'back.out(1.45)' }
      );
      timeline.to('#cub-tail', { rotation: 13, transformOrigin: '80% 70%', duration: .22, yoyo: true, repeat: 5, ease: 'sine.inOut' }, '-=.52');
      timeline.to('#cub-head', { rotation: -2, transformOrigin: '50% 85%', duration: .22, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '-=.95');
      timeline.to({}, { duration: .28 });
    };

    const openGift = () => {
      if (opened) return;
      opened = true;
      wrap.disabled = true;
      wrap.setAttribute('aria-expanded', 'true');
      wrap.classList.add('open');
      giftStage.classList.add('gift-opened');
      lionStage.hidden = false;
      lionStage.classList.add('lion-stage-active');
      if (navigator.vibrate && /Android/i.test(navigator.userAgent)) {
        try { navigator.vibrate([20, 35, 20]); } catch (_) { /* no-op */ }
      }
      buttonElement.disabled = true;
      buttonElement.setAttribute('hidden', '');

      if (reducedMotion) {
        roaringLion.setAttribute('hidden', '');
        lionCub.removeAttribute('hidden');
        lionCub.classList.add('lion-revealed');
        if (lionCaption) lionCaption.textContent = 'Ternyata cuma si kecil yang ingin merayakan kamu. ♡';
        window.setTimeout(revealVoucher, 250);
        return;
      }
      if (lionCaption) lionCaption.textContent = 'Grrrr… ada penjaga besar di dalam kado!';
      if (window.gsap) {
        const gsap = window.gsap;
        gsap.fromTo(roaringLion, { opacity: 0, y: 125, scale: .57, rotation: -2 }, {
          opacity: 1, y: 0, scale: 1, rotation: 0, duration: 1.45, ease: 'expo.out',
          onComplete: () => gsap.fromTo('#roar-head', { y: 8, rotation: -2, transformOrigin: '50% 82%' }, {
            y: -2, rotation: 1.4, duration: .42, repeat: 3, yoyo: true, ease: 'sine.inOut'
          })
        });
        gsap.fromTo('#roar-mane', { rotation: -2, transformOrigin: '50% 55%' }, {
          rotation: 1.3, duration: .56, repeat: 3, yoyo: true, ease: 'sine.inOut', delay: .22
        });
      } else {
        roaringLion.classList.add('lion-revealed');
      }
      window.setTimeout(transformToCub, 4700);
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
    particleBudget = Math.max(80, Math.min(window.innerWidth <= 600 ? 220 : 520, Number(C.settings.canvasParticleMax) || 400));
    const starterCount = Math.min(window.innerWidth <= 600 ? 26 : 58, particleBudget);
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

  let lastFingerStarAt = 0;
  let orientationPermissionRequested = false;
  let orientationListenerBound = false;

  function requestDecorOrientationFromGesture() {
    if (orientationPermissionRequested) return;
    orientationPermissionRequested = true;
    const API = window.DeviceOrientationEvent;
    if (!API || typeof API.requestPermission !== 'function') {
      if (!orientationListenerBound && API) bindDecorOrientation();
      return;
    }
    // iOS permission prompt can only be called synchronously from a user gesture.
    API.requestPermission().then((permission) => {
      if (permission === 'granted') bindDecorOrientation();
    }).catch(() => { /* pointer parallax remains the fallback */ });
  }

  function bindDecorOrientation() {
    if (orientationListenerBound) return;
    orientationListenerBound = true;
    window.addEventListener('deviceorientation', (event) => {
      if (document.hidden || !Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;
      const active = document.getElementById(sceneIds[currentScene]);
      if (!active) return;
      active.style.setProperty('--parallax-x', (Math.max(-22, Math.min(22, event.gamma)) * .42).toFixed(1) + 'px');
      active.style.setProperty('--parallax-y', (Math.max(-24, Math.min(24, event.beta - 25)) * .24).toFixed(1) + 'px');
    }, { passive: true });
  }

  function spawnFingerStars(x, y, burst = false) {
    if (reducedMotion || !canvasActive) return;
    const count = burst ? 5 : 1;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = burst ? .45 + Math.random() * 1.4 : .12 + Math.random() * .42;
      addParticle({
        type: 'fingerStar',
        x: x + (burst ? (Math.random() - .5) * 14 : 0),
        y: y + (burst ? (Math.random() - .5) * 14 : 0),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        radius: burst ? 2.2 + Math.random() * 2 : 1.5 + Math.random() * 1.5,
        life: burst ? .95 : .62, decay: burst ? .025 : .034,
        friction: .91, ageMs: 0, color: ['#f3dfb0','#c9a15a','#eaa98b','#f4ecdf'][Math.floor(Math.random() * 4)],
        rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * .1
      });
    }
  }

  function animateHeroNumber() {
    const number = document.querySelector('#s2 .big-number');
    if (!number) return;
    if (reducedMotion || !window.gsap) { number.textContent = '18'; return; }
    const counter = { value: 0 };
    window.gsap.to(counter, {
      value: 18, duration: 1.55, ease: 'power2.out',
      onStart: () => { number.textContent = '0'; },
      onUpdate: () => { number.textContent = String(Math.round(counter.value)); },
      onComplete: () => { number.textContent = '18'; }
    });
  }

  function bindCanvasGestures() {
    globalPointerBound = true;
    document.addEventListener('pointerdown', (event) => {
      if (reducedMotion || document.hidden) return;
      spawnFingerStars(event.clientX, event.clientY, true);
      if (currentScene === 0) {
        attractionPoint = { x: event.clientX, y: event.clientY, until: performance.now() + 1450 };
        requestDecorOrientationFromGesture();
      }
      const finalSceneIndex = sceneIds.length - 1;
      const overControl = event.target && event.target.closest && event.target.closest('button, input, textarea, a');
      if (!overControl && (currentScene === 2 || currentScene === finalSceneIndex)) {
        spawnFireworkRocket(event.clientX, event.clientY, ['round', 'ring', 'heart'][Math.floor(Math.random() * 3)]);
      }
    }, { passive: true });
    document.addEventListener('pointermove', (event) => {
      const now = performance.now();
      if (now - lastFingerStarAt >= 58) {
        spawnFingerStars(event.clientX, event.clientY, false);
        lastFingerStarAt = now;
      }
      const active = document.getElementById(sceneIds[currentScene]);
      if (active) {
        active.style.setProperty('--parallax-x', (((event.clientX / Math.max(1, window.innerWidth)) - .5) * -12).toFixed(1) + 'px');
        active.style.setProperty('--parallax-y', (((event.clientY / Math.max(1, window.innerHeight)) - .5) * -9).toFixed(1) + 'px');
      }
      if (currentScene === 0 && attractionPoint && performance.now() < attractionPoint.until) {
        attractionPoint.x = event.clientX;
        attractionPoint.y = event.clientY;
      }
    }, { passive: true });
  }

  const FIREWORK_PALETTE = ['#f3dfb0', '#c9a15a', '#8f6b32', '#eaa98b', '#f4ecdf', '#d9b779', '#8e5fb0'];
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
    addParticle({ type: 'flash', x, y, vx: 0, vy: 0, color, life: 1, decay: .078, radius: 2, maxRadius: Math.min(170, Math.max(110, canvasWidth * .42), radius || 170) });
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
    const gravity = .068 + Math.random() * .018;
    const apexHeight = Math.max(110, startY - y);
    const baseSpeed = Math.sqrt(2 * gravity * apexHeight);
    addParticle({
      type: 'rocket', x: startX, y: startY, previousX: startX, previousY: startY,
      targetX: x, targetY: y, originX: startX, vx: (x - startX) / Math.max(45, baseSpeed / gravity),
      vy: -baseSpeed, gravity, curve: (Math.random() - .5) * .035,
      sway: Math.random() * Math.PI * 2, swayAmplitude: .016 + Math.random() * .022,
      life: 1, shape, age: 0, trailClock: 0, apexTargetY: y,
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
        color: ['#d9c6ed', '#f3d9ca', '#d9b779', '#b79acb'][Math.floor(Math.random() * 4)],
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
        color: ['#d9c6ed', '#f3d9ca', '#d9b779', '#b79acb'][i % 4], sway: 0
      });
    }
  }

  function drawCanvas(time) {
    if (!canvasActive || !canvasContext || document.hidden) { stopCanvas(); return; }
    const delta = Math.max(1, Math.min(70, time - (lastFrameTime || time)));
    const dt = delta / 16.667;
    lastFrameTime = time;
    averageFrameTime = averageFrameTime * .92 + delta * .08;
    if (averageFrameTime > 24) {
      document.documentElement.classList.add('motion-economy');
      if (particleBudget > 110) particleBudget = Math.max(110, Math.floor(particleBudget * .78));
      while (particles.length > particleBudget) releaseParticle(particles.length - 1);
    }
    if (canvasElement && (canvasWidth !== window.innerWidth || canvasHeight !== window.innerHeight)) resizeCanvas();
    const trailsActive = currentScene === 2 || currentScene === sceneIds.length - 1 || !!document.querySelector('.countdown-overlay');
    if (trailsActive) {
      canvasContext.globalCompositeOperation = 'destination-out';
      canvasContext.globalAlpha = .18;
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
      if (p.type === 'fingerStar') {
        p.ageMs = (p.ageMs || 0) + delta;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.pow(p.friction || .91, dt);
        p.vy *= Math.pow(p.friction || .91, dt);
        p.rotation += (p.spin || 0) * dt;
        p.life -= p.decay * dt;
        canvasContext.globalAlpha = Math.max(0, p.life) * (.72 + .28 * Math.abs(Math.sin(time / 38 + p.rotation)));
        canvasContext.fillStyle = p.color;
        canvasContext.save();
        canvasContext.translate(p.x, p.y);
        canvasContext.rotate(p.rotation);
        canvasContext.beginPath();
        canvasContext.moveTo(0, -p.radius * 1.7);
        canvasContext.lineTo(p.radius * .42, -p.radius * .42);
        canvasContext.lineTo(p.radius * 1.7, 0);
        canvasContext.lineTo(p.radius * .42, p.radius * .42);
        canvasContext.lineTo(0, p.radius * 1.7);
        canvasContext.lineTo(-p.radius * .42, p.radius * .42);
        canvasContext.lineTo(-p.radius * 1.7, 0);
        canvasContext.lineTo(-p.radius * .42, -p.radius * .42);
        canvasContext.closePath();
        canvasContext.fill();
        canvasContext.restore();
        if (p.life <= 0) releaseParticle(i);
        continue;
      }
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
        const sway = Math.sin(p.age / (165 + (p.sway % 1) * 85) + p.sway) * (p.swayAmplitude || .02);
        p.vx += ((p.curve || 0) + sway - p.vx * .0018) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.gravity || .075) * dt;
        // Ease the final ascent near the apex; the explosion occurs close to vy = 0.
        if (p.vy < -.8 && p.y < p.targetY + 85) p.vy += .012 * dt;
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
        if ((p.vy >= -.14 && p.age > 160) || p.age > 3600) {
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
        const sprite = getPetalSprite(p.color || '#f3d9ca', p.color2 || '#d9b779');
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
