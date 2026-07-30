(() => {
  // ============================================
  // Japan Trip PWA - Main Application
  // ============================================

  try {
    boot();
  } catch (err) {
    showFatalError(err);
  }

  function showFatalError(err) {
    console.error('Japan Trip PWA failed to start:', err);
    const appEl = document.querySelector('#app');
    if (!appEl) return;
    appEl.innerHTML = `
      <article class="card">
        <h2>משהו השתבש בטעינת האפליקציה</h2>
        <p>סביר שהנתונים האחרונים שסונכרנו פגומים או לא תואמים. אפשר לנסות לאפס את הנתונים המסונכרנים ולחזור לנתוני ברירת המחדל.</p>
        <div class="actions">
          <button class="btn" id="fatalResetBtn">איפוס נתונים מסונכרנים וטעינה מחדש</button>
          <button class="btn secondary" id="fatalReloadBtn">טעינה מחדש בלבד</button>
        </div>
        <p class="meta">פרטי השגיאה: ${String((err && err.message) || err)}</p>
      </article>`;
    const resetBtn = document.querySelector('#fatalResetBtn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        try {
          if (window.SheetsSync) window.SheetsSync.clearCache();
        } catch {
          /* ignore */
        }
        location.reload();
      };
    }
    const reloadBtn = document.querySelector('#fatalReloadBtn');
    if (reloadBtn) reloadBtn.onclick = () => location.reload();
  }

  function boot() {
  const D = window.TRIP_DATA;
  const STORAGE_KEY = 'japanTripStateV1';

  // Apply page language/direction from settings instead of the hardcoded
  // values in index.html, so a non-Hebrew/non-RTL trip renders correctly.
  document.documentElement.lang = D.settings['שפה'] || 'he';
  document.documentElement.dir =
    String(D.settings['כיוון'] || 'rtl').toLowerCase() === 'ltr' ? 'ltr' : 'rtl';

  // Label shown on the phrases tab and in its aria-labels/messages.
  // Falls back to "יפנית" so existing sheets keep working unchanged.
  function phraseLangLabel() {
    return D.settings['שם שפת הביטויים'] || 'יפנית';
  }

  // BCP-47 code used for speech synthesis (e.g. ja-JP, ko-KR, fr-FR).
  // Falls back to ja-JP so existing sheets keep working unchanged.
  function phraseVoiceLang() {
    return D.settings['קוד קול'] || 'ja-JP';
  }

  let state = JSON.parse(
    localStorage.getItem(STORAGE_KEY) ||
      '{"done":{},"booking":{},"notes":{},"favorites":{}}'
  );

  let view = 'today';
  let manualDay = null;

  const app = document.querySelector('#app');
  const tabs = document.querySelector('#tabs');

  // --- SVG Icon System ---
  const ICONS = {
    calendar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    list: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    checklist: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    bowl: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 14h14"/><path d="M19 14a8 8 0 0 0-16 0"/><path d="M5 14l1 7h12l1-7"/></svg>`,
    hotel: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16"/><path d="M1 21h22"/><path d="M9 7h1"/><path d="M9 11h1"/><path d="M9 15h1"/></svg>`,
    speech: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    gear: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    external: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    speaker: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
    copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    stop: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>`,
    leaf: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.8-.04C9 16 15 12 22 6"/><path d="M2 22c0-7 5-12 12-16"/></svg>`,
    train: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="M8 19l-2 3"/><path d="M16 19l2 3"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>`,
    walking: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4" r="2"/><path d="M14 7l-3 5 2 6 3-4"/><path d="M9 10l-3 5"/></svg>`,
    car: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14v-5H5z"/><path d="M17 12V7a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>`,
    boat: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20l2-1 3 1 4-1 4 1 3-1 2 1"/><path d="M19 13V8a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v5"/><path d="M12 6V3"/></svg>`,
    metro: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 10h14"/><circle cx="9" cy="16" r="1"/><circle cx="15" cy="16" r="1"/></svg>`,
    taxi: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14v-3H5z"/><path d="M19 14V8a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/><path d="M9 8h6"/></svg>`,
    bus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="15" rx="2"/><path d="M3 9h18"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/><path d="M6 3v4"/></svg>`,
    fuji: `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M100 15L20 120h160L100 15z" fill="currentColor"/><path d="M85 60c-5 12-10 25-10 38h50c0-13-5-26-10-38" fill="white" opacity="0.9"/><ellipse cx="40" cy="125" rx="30" ry="6" fill="currentColor" opacity="0.3"/><ellipse cx="160" cy="125" rx="25" ry="5" fill="currentColor" opacity="0.2"/></svg>`,
    torii: `<svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="6" height="55" fill="currentColor"/><rect x="84" y="20" width="6" height="55" fill="currentColor"/><rect x="4" y="18" width="92" height="7" rx="2" fill="currentColor"/><rect x="10" y="35" width="80" height="4" fill="currentColor"/></svg>`,
    star: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    starEmpty: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    apple: `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`,
    android: `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.24 6 5.01 6 7h12c0-1.99-.97-3.76-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>`,
    phone: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    upload: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    reset: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
    search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  // --- Transport type detection for event icons ---
  function getEventType(event) {
    const t = (event.transport || '').trim().toLowerCase();
    if (t === 'רכבת') return { type: 'transport', icon: ICONS.train, label: 'רכבת' };
    if (t === 'מטרו') return { type: 'transport', icon: ICONS.metro, label: 'מטרו' };
    if (t === 'רכב') return { type: 'transport', icon: ICONS.car, label: 'רכב' };
    if (t === 'שייט') return { type: 'transport', icon: ICONS.boat, label: 'שייט' };
    if (t === 'אוטובוס') return { type: 'transport', icon: ICONS.bus, label: 'אוטובוס' };
    if (t === 'מונית') return { type: 'transport', icon: ICONS.taxi, label: 'מונית' };
    if (t === 'הליכה') return { type: 'transport', icon: ICONS.walking, label: 'הליכה' };
    // Default to sightseeing if no transport
    return { type: 'sightseeing', icon: ICONS.list, label: '' };
  }

  // --- Utility Functions ---
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const maps = (q) =>
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q || '');

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m]));

  const fmt = (d) =>
    d
      ? new Date(d + 'T12:00:00').toLocaleDateString('he-IL', {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
        })
      : '';

  const dayById = (id) => D.days.find((x) => x.id === id);

  const currentDay = () => {
    if (manualDay) return dayById(manualDay);
    let iso = new Date().toLocaleDateString('sv-SE', {
      timeZone: D.settings['אזור זמן'] || 'Asia/Tokyo',
    });
    return D.days.find((d) => d.date === iso) || D.days[0];
  };

  // --- Tab Rendering ---
  const tabList = [
    ['today', 'היום'],
    ['days', 'כל הימים'],
    ['bookings', 'הזמנות'],
    ['food', 'אוכל'],
    ['hotels', 'מלונות'],
    ['phrases', phraseLangLabel()],
    ['settings', 'הגדרות'],
  ];

  tabs.innerHTML = tabList
    .map((t) => `<button data-view="${t[0]}">${ICONS[t[0]] || ''} ${t[1]}</button>`)
    .join('');

  tabs.onclick = (e) => {
    let b = e.target.closest('button');
    if (b) {
      view = b.dataset.view;
      render();
    }
  };

  // --- Event HTML (Timeline) ---
  function eventHTML(e) {
    const done = !!state.done[e.id];
    const evtType = getEventType(e);
    return `
      <div class="event ${done ? 'completed' : ''} type-${evtType.type}">
        <div class="eventtime">${esc(e.start)}${e.end ? '–' + esc(e.end) : ''}</div>
        <h3>
          ${evtType.icon ? `<span class="event-icon ${evtType.type}">${evtType.icon}</span>` : ''}
          ${evtType.type === 'sightseeing' ? `<img src="icons/shrine-icon.svg" alt="" class="shrine-event-icon">` : ''}
          ${esc(e.title)}
        </h3>
        <p>${esc(e.description)}</p>
        ${e.transport ? `<span class="badge">${evtType.icon || ''} ${esc(e.transport)}</span>` : ''}
        <div class="actions">
          ${e.mapsQuery ? `<a class="btn secondary" target="_blank" href="${maps(e.mapsQuery)}">${ICONS.pin} ${ICONS.external} ניווט</a>` : ''}
          <label class="check">
            <input type="checkbox" data-done="${e.id}" ${done ? 'checked' : ''}> בוצע
          </label>
        </div>
      </div>`;
  }

  // --- Day Card ---
  function dayCard(d, full = true) {
    const ev = D.schedule
      .filter((x) => x.dayId === d.id)
      .sort((a, b) => a.order - b.order);

    const loadClass =
      d.load === 'קל' ? 'load-low' : d.load.includes('גבוה') ? 'load-high' : 'load-medium';

    return `
      <section class="hero">
        <div class="hero-accent ${loadClass}"></div>
        <img src="icons/fuji-cherry.svg" alt="" class="hero-fuji-img">
        <div class="hero-watermark">${d.day}</div>
        <div class="hero-content">
          <div class="hero-meta">
            ${ICONS.calendar} יום ${d.day} • ${fmt(d.date)} • ${esc(d.weekday)}
          </div>
          <h2>${esc(d.title)}</h2>
          <p>${esc(d.subtitle)}</p>
          <div class="hero-badges">
            <span class="badge day-number-badge">${ICONS.pin} ${esc(d.city)}</span>
            <span class="badge">עומס: ${esc(d.load)}</span>
            ${d.holiday ? '<span class="badge holiday">חג</span>' : ''}
          </div>
        </div>
      </section>
      ${
        full
          ? `
        <section class="card">
          <div class="torii-header">
            <img src="icons/torii-gate.svg" alt="" width="36" height="28">
            <h2 style="margin:0">${ICONS.list} לוח הזמנים</h2>
          </div>
          <div class="timeline">${ev.map(eventHTML).join('')}</div>
        </section>
        <section class="card">
          <h2>${ICONS.info} חשוב לדעת</h2>
          <ul class="clean">${d.important.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          <h2 style="margin-top:16px">🎒 מה לקחת</h2>
          <ul class="clean">${d.take.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        </section>
        <section class="card">
          <div class="torii-header">
            <img src="icons/paper-lantern.svg" alt="" width="28" height="42">
            <h2 style="margin:0">${ICONS.bowl} מסעדות מתאימות</h2>
          </div>
          ${
            D.restaurants
              .filter(
                (r) =>
                  r.days.includes(d.id) ||
                  r.days.includes(String(d.day)) ||
                  r.days.includes('day-' + String(d.day).padStart(2, '0'))
              )
              .map((food) => foodCard(food))
              .join('') || '<p>אין מסעדות משויכות ליום זה.</p>'
          }
        </section>`
          : ''
      }`;
  }

  // --- Food Card ---
  function foodCard(r) {
    const isFav = !!state.favorites[r.id];
    return `
      <article class="card">
        <div class="food-card-header">
          <span class="cuisine-icon">${ICONS.bowl}</span>
          <h3>${esc(r.name)}</h3>
        </div>
        <div class="meta">${ICONS.pin} ${esc(r.area)} • ${esc(r.cuisine)} • <strong>${esc(r.price)}</strong></div>
        <p><span class="pork-status ${r.porkStatus.includes('ללא') || r.porkStatus.includes('חלאל') ? 'safe' : 'check'}">${ICONS.leaf} ללא חזיר: ${esc(r.porkStatus)}</span></p>
        <p><strong>מומלץ:</strong> ${esc(r.recommended)}</p>
        <p>${esc(r.notes)}</p>
        <div class="actions">
          <a class="btn secondary" target="_blank" href="${maps(r.mapsQuery || r.name)}">${ICONS.pin} ${ICONS.external} Google Maps</a>
          ${r.website ? `<a class="btn secondary" target="_blank" href="${esc(r.website)}">${ICONS.external} אתר</a>` : ''}
          <button class="btn ${isFav ? 'green' : 'secondary'}" data-fav="${r.id}">${isFav ? '★ נמחק' : '☆ חביב'}</button>
        </div>
      </article>`;
  }

  // --- Render Functions ---
  function renderToday() {
    const d = currentDay();
    app.innerHTML = `
      <div class="notice">${ICONS.info} גרסת נתונים: ${esc(D.version)}. אפשר לבחור יום אחר בתצוגת כל הימים.</div>
      ${dayCard(d, true)}`;
  }

  function renderDays() {
    app.innerHTML = `
      <div style="position:relative">
        <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted)">${ICONS.search}</span>
        <input class="search" id="search" placeholder="חיפוש יום, מקום או פעילות" style="padding-left:42px;padding-right:16px">
      </div>
      <div id="dayList">
        ${D.days.map(
          (d) => `
          <article class="card">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <span class="day-number-big">${d.day}</span>
              <div>
                <div class="meta">יום ${d.day} • ${fmt(d.date)}</div>
              </div>
            </div>
            <h2>${esc(d.title)}</h2>
            <p>${ICONS.pin} ${esc(d.city)} • עומס ${esc(d.load)}</p>
            <button class="btn" data-open-day="${d.id}">פתיחת היום ${ICONS.calendar}</button>
          </article>`
        ).join('')}
      </div>`;

    document.querySelector('#search').oninput = (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#dayList article').forEach((x) => {
        x.classList.toggle('hidden', !x.innerText.toLowerCase().includes(q));
      });
    };
  }

  function renderBookings() {
    const rank = { קריטית: 0, גבוהה: 1, בינונית: 2, נמוכה: 3 };
    const b = [...D.bookings].sort((a, z) => (rank[a.priority] ?? 9) - (rank[z.priority] ?? 9));

    app.innerHTML = `
      <div class="filters">
        <button data-bfilter="all" class="active">${ICONS.list} הכול</button>
        <button data-bfilter="open">${ICONS.info} פתוח</button>
        <button data-bfilter="booked">${ICONS.checklist} הוזמן</button>
      </div>
      <div id="bookingList">
        ${b
          .map(
            (x) => `
          <article class="card" data-status="${state.booking[x.id] || x.status}">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h3>${esc(x.name)}</h3>
              <span class="booking-status-dot ${(state.booking[x.id] || x.status) === 'הוזמן' ? 'booked' : 'open'}"></span>
            </div>
            <div class="meta">${fmt(x.useDate)} • ${esc(x.time)} • <span class="badge priority-${
              x.priority === 'קריטית' ? 'critical' : x.priority === 'גבוהה' ? 'high' : x.priority === 'בינונית' ? 'medium' : 'low'
            }">${esc(x.priority)}</span></div>
            <p><strong>יעד:</strong> ${fmt(x.deadline)} | <strong>עלות:</strong> ${esc(x.cost)}</p>
            <p>${esc(x.notes)}</p>
            <div class="actions">
              ${x.url ? `<a class="btn secondary" target="_blank" href="${esc(x.url)}">${ICONS.external} הזמנה</a>` : ''}
              <button class="btn" data-book="${x.id}">${
                (state.booking[x.id] || x.status) === 'הוזמן' ? 'ביטול סימון' : 'סימון כהוזמן'
              }</button>
            </div>
          </article>`
          )
          .join('')}
      </div>`;

    // Filter button handling
    app.querySelectorAll('[data-bfilter]').forEach((btn) => {
      btn.onclick = () => {
        app.querySelectorAll('[data-bfilter]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.bfilter;
        document.querySelectorAll('#bookingList article').forEach((card) => {
          const status = state.booking[card.dataset.status] || card.dataset.status;
          if (filter === 'all') {
            card.classList.remove('hidden');
          } else if (filter === 'open') {
            card.classList.toggle('hidden', status === 'הוזמן');
          } else if (filter === 'booked') {
            card.classList.toggle('hidden', status !== 'הוזמן');
          }
        });
      };
    });
  }

  function renderFood() {
    app.innerHTML = `
      <div style="position:relative">
        <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted)">${ICONS.search}</span>
        <input class="search" id="search" placeholder="חיפוש מסעדה, אזור או מטבח" style="padding-left:42px;padding-right:16px">
      </div>
      ${D.restaurants.map((r) => foodCard(r)).join('')}`;

    document.querySelector('#search').oninput = (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('main article').forEach((x) => {
        x.classList.toggle('hidden', !x.innerText.toLowerCase().includes(q));
      });
    };
  }

  function renderHotels() {
    app.innerHTML = D.hotels
      .map(
        (h) => `
      <article class="card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-size:2rem">${ICONS.hotel}</span>
            <h2 style="margin:0">${esc(h.name)}</h2>
          </div>
          <div class="hotel-stars">${'★'.repeat(4)}<span style="opacity:0.3">★</span></div>
          <p>${ICONS.pin} ${esc(h.city)}</p>
          ${h.address ? `<p style="margin-top:4px">${ICONS.phone} ${esc(h.address)}</p>` : ''}
          ${h.phone ? `<p style="margin-top:4px">טלפון: ${esc(h.phone)}</p>` : ''}
          <p style="margin-top:8px">${esc(h.notes)}</p>
          <div class="actions">
            <a class="btn" target="_blank" href="${maps(h.mapsQuery || h.name)}">${ICONS.pin} ${ICONS.external} ניווט למלון</a>
          </div>
        </article>`
        )
        .join('');
  }

  // --- Voice Functions ---
  function japaneseVoice() {
    const code = phraseVoiceLang();
    const prefix = code.split('-')[0].toLowerCase();
    const voices = window.speechSynthesis?.getVoices() || [];
    return (
      voices.find((v) => v.lang === code) ||
      voices.find((v) => String(v.lang).toLowerCase().startsWith(prefix)) ||
      null
    );
  }

  function speakJapanese(text, slow = false) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      alert('המכשיר אינו תומך בהשמעת טקסט.');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = phraseVoiceLang();
    u.rate = slow ? 0.72 : 0.9;
    u.pitch = 1;
    u.volume = 1;
    const v = japaneseVoice();
    if (v) u.voice = v;
    u.onerror = () =>
      alert(`לא ניתן להשמיע כרגע. ודאו שמותקן קול מתאים (${phraseLangLabel()}) במכשיר.`);
    window.speechSynthesis.speak(u);

    // Add speaking animation to the parent card
    const btn = document.querySelector(`[data-speak="${encodeURIComponent(text)}"]`);
    let speakingCard = null;
    if (btn) {
      speakingCard = btn.closest('.phrase-card');
      if (speakingCard) speakingCard.classList.add('speaking');
    }

    // Remove animation when speech ends
    u.onend = () => {
      if (speakingCard) speakingCard.classList.remove('speaking');
    };
  }

  function stopJapanese() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      document.querySelectorAll('.phrase-card.speaking').forEach((c) => c.classList.remove('speaking'));
    }
  }

  function renderPhrases() {
    const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

    // Category color mapping
    const categoryClass = (cat) => {
      if (cat.includes('אוכל')) return 'category-food';
      if (cat.includes('נימוסים') || cat.includes('נימוס')) return 'category-etiquette';
      if (cat.includes('תחבורה')) return 'category-transport';
      if (cat.includes('תקשורת') || cat.includes('הסתדרות')) return 'category-communication';
      if (cat.includes('מלון')) return 'category-etiquette';
      return '';
    };

    app.innerHTML = `
      ${!supported ? '<div class="notice">${ICONS.info} המכשיר אינו תומך בהשמעת טקסט. עדיין ניתן להעתיק את המשפט.</div>' : ''}
      ${D.phrases
        .map(
          (p) => `
        <article class="card phrase-card ${categoryClass(p.category)}">
          <span class="badge">${esc(p.category)}</span>
          <h3>${esc(p.he)}</h3>
          <button class="japanese-text" data-speak="${encodeURIComponent(p.ja)}" aria-label="השמעת המשפט ב${esc(phraseLangLabel())}">${esc(
            p.ja
          )}</button>
          <p style="color:var(--muted);font-style:italic">${esc(p.roman)}</p>
          <div class="actions">
            <button class="btn green" data-speak="${encodeURIComponent(p.ja)}" ${
              supported ? '' : 'disabled'
            }>${ICONS.speaker} השמעה</button>
            <button class="btn secondary" data-slow="${encodeURIComponent(p.ja)}" ${
              supported ? '' : 'disabled'
            }>${ICONS.speaker} לאט</button>
            <button class="btn secondary" data-stop="1" ${supported ? '' : 'disabled'}>${ICONS.stop} עצירה</button>
            <button class="btn secondary" data-copy="${esc(p.ja)}">${ICONS.copy} העתקה</button>
          </div>
        </article>`
        )
        .join('')}`;
  }

  function renderSettings() {
    const sheetsCfg = window.SheetsSync.getConfig() || {};
    app.innerHTML = `
      <article class="card install">
        <h2>${ICONS.phone} התקנה</h2>
        <div class="install-card">
          <span class="install-icon">${ICONS.apple}</span>
          <div>
            <strong>iPhone:</strong> Safari → שיתוף → הוספה למסך הבית → פתיחה כיישום.
          </div>
        </div>
        <div class="install-card">
          <span class="install-icon">${ICONS.android}</span>
          <div>
            <strong>Android:</strong> Chrome → תפריט → Add to Home screen → Install.
          </div>
        </div>
        <button class="btn" id="installBtn">${ICONS.download} התקנה באנדרואיד</button>
      </article>
      <article class="card">
        <h2>${ICONS.list} גיבוי אישי</h2>
        <p>הסימונים וההערות נשמרים רק במכשיר.</p>
        <div class="actions">
          <button class="btn secondary" id="exportBtn">${ICONS.download} ייצוא גיבוי</button>
          <label class="btn secondary">${ICONS.upload} ייבוא<input id="importFile" type="file" accept="application/json" hidden></label>
          <button class="btn secondary" id="resetBtn">${ICONS.reset} איפוס</button>
        </div>
      </article>
      <article class="card">
        <h2>${ICONS.gear} סנכרון מ-Google Sheets</h2>
        <p>הדביקו כאן את הקישור לגיליון Google Sheets של הטיול, כדי שהאפליקציה תמשוך ממנו את הנתונים במקום מהנתונים המובנים.</p>
        <label class="field">
          <span>קישור לגיליון (או מזהה הגיליון)</span>
          <input id="sheetsId" type="text" placeholder="https://docs.google.com/spreadsheets/d/..." value="${esc(sheetsCfg.spreadsheetId || '')}">
        </label>
        <div class="actions">
          <button class="btn" id="sheetsSyncBtn">${ICONS.upload} סנכרון עכשיו</button>
          ${window.SheetsSync.getCached() ? `<button class="btn secondary" id="sheetsClearBtn">${ICONS.reset} חזרה לנתוני ברירת המחדל</button>` : ''}
        </div>
        <p id="sheetsStatus" class="meta"></p>
        <p class="meta">לפני הסנכרון: פתחו את הגיליון ← Share/שיתוף ← "כל מי שיש לו את הקישור" ← צפייה (Viewer). זה כל מה שצריך – אין צורך בהרשמה או במפתחות טכניים.</p>
      </article>
      <p class="footer-note">${esc(D.settings['שם הטיול'] || '')} • גרסת נתונים ${esc(D.version)}</p>`;

    const sheetsStatus = document.querySelector('#sheetsStatus');

    document.querySelector('#sheetsSyncBtn').onclick = async () => {
      const link = document.querySelector('#sheetsId').value.trim();
      if (!link) {
        sheetsStatus.textContent = 'יש להדביק קישור לגיליון.';
        return;
      }
      sheetsStatus.textContent = 'מסנכרן…';
      try {
        await window.SheetsSync.sync(link);
        sheetsStatus.textContent = 'הסנכרון הצליח! טוען מחדש…';
        location.reload();
      } catch (err) {
        sheetsStatus.textContent = 'שגיאה בסנכרון: ' + err.message;
      }
    };

    const clearBtn = document.querySelector('#sheetsClearBtn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        window.SheetsSync.clearCache();
        location.reload();
      };
    }

    document.querySelector('#exportBtn').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
      );
      a.download = 'trip-backup.json';
      a.click();
    };

    document.querySelector('#importFile').onchange = (e) => {
      const r = new FileReader();
      r.onload = () => {
        state = JSON.parse(r.result);
        save();
        render();
      };
      r.readAsText(e.target.files[0]);
    };

    document.querySelector('#resetBtn').onclick = () => {
      if (confirm('למחוק את כל הסימונים המקומיים?')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    };

    if (window._installPrompt) {
      document.querySelector('#installBtn').onclick = () => window._installPrompt.prompt();
    } else {
      document.querySelector('#installBtn').disabled = true;
    }
  }

  // --- Main Render ---
  function render() {
    try {
      document.querySelectorAll('.tabs button').forEach((b) =>
        b.classList.toggle('active', b.dataset.view === view)
      );
      ({
        today: renderToday,
        days: renderDays,
        bookings: renderBookings,
        food: renderFood,
        hotels: renderHotels,
        phrases: renderPhrases,
        settings: renderSettings,
      }[view] || renderToday)();
    } catch (err) {
      showFatalError(err);
    }
  }

  // --- Event Delegation ---
  app.onclick = (e) => {
    const d = e.target.dataset;

    if (d.done) {
      state.done[d.done] = e.target.checked;
      save();
    }

    if (d.openDay) {
      manualDay = d.openDay;
      view = 'today';
      render();
    }

    if (d.book) {
      state.booking[d.book] = state.booking[d.book] === 'הוזמן' ? '' : 'הוזמן';
      save();
      render();
    }

    if (d.fav) {
      state.favorites[d.fav] = !state.favorites[d.fav];
      save();
      render();
    }

    if (d.speak) {
      speakJapanese(decodeURIComponent(d.speak), false);
    }

    if (d.slow) {
      speakJapanese(decodeURIComponent(d.slow), true);
    }

    if (d.stop) {
      stopJapanese();
    }

    if (d.copy) {
      navigator.clipboard.writeText(d.copy);
      e.target.textContent = 'הועתק';
      setTimeout(() => {
        e.target.innerHTML = ICONS.copy + ' העתקה';
      }, 1500);
    }
  };

  // --- Global Event Handlers ---
  document.querySelector('#todayBtn').onclick = () => {
    manualDay = null;
    view = 'today';
    render();
  };

  document.querySelector('#darkBtn').onclick = () => {
    document.body.classList.toggle('auto-dark');
  };

  document.querySelector('#menuBtn').onclick = () => {
    view = 'settings';
    render();
  };

  // --- Initialization ---
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window._installPrompt = e;
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      // If a new version is already waiting (e.g. from a previous visit), activate it.
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');

      // When a new worker finishes installing, tell it to activate right away.
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage('SKIP_WAITING');
          }
        });
      });

      // Check the server for a newer service-worker.js whenever the tab
      // regains focus, so the app catches updates without a manual refresh.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update();
      });
    });

    // Once the new worker takes control, reload once so the fresh
    // index.html/app.js/css are actually used.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }

  document.querySelector('#appTitle').textContent = (D.settings && D.settings['שם הטיול']) || 'הטיול שלי';

  render();
  }
})();
