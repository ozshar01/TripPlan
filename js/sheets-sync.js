// ============================================
// Google Sheets sync (simple, no API key)
// Reads the trip spreadsheet directly using Google's public visualization
// endpoint (the same one Sheets uses for "Publish to web" charts/tables).
// It's loaded via a <script> tag, which browsers don't subject to CORS,
// so this works with nothing more than "Anyone with the link: Viewer"
// sharing on the sheet — no Google Cloud project, no API key.
// ============================================
window.SheetsSync = (() => {
  const CONFIG_KEY = 'japanTripSheetsConfigV1';
  const CACHE_KEY = 'japanTripCachedDataV1';

  // Tab names must match the Excel sheet names exactly.
  const TABS = {
    settings: 'הגדרות',
    days: 'ימים',
    schedule: 'לוח זמנים',
    bookings: 'הזמנות',
    restaurants: 'מסעדות',
    hotels: 'מלונות',
    phrases: 'משפטים',
  };

  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function setConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  function getCached() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    } catch {
      return null;
    }
  }

  // If we have a previously-synced copy, use it instead of the bundled
  // fallback data — must run synchronously before app.js reads window.TRIP_DATA.
  function applyCachedOverride() {
    const cached = getCached();
    if (cached) window.TRIP_DATA = cached;
  }

  // Accepts either a bare spreadsheet ID or a full Google Sheets URL and
  // extracts the ID either way, so pasting the browser address bar link works.
  function extractSpreadsheetId(input) {
    const s = String(input || '').trim();
    const match = s.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : s;
  }

  function parseList(s) {
    if (!s) return [];
    return String(s)
      .replace(/\r/g, '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function truth(v) {
    return ['כן', 'true', '1', 'yes', 'y'].includes(String(v ?? '').trim().toLowerCase());
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  // Turns a single gviz table cell into a plain value, normalizing dates
  // and times to the ISO-ish strings the rest of the app expects
  // ("YYYY-MM-DD" / "HH:MM"), regardless of whether the sheet column is
  // formatted as plain text or an actual Date/Time cell type.
  function cellValue(cell, colType) {
    if (!cell) return '';
    const v = cell.v;
    if (v === null || v === undefined) return cell.f != null ? cell.f : '';

    if (colType === 'date' && v instanceof Date) {
      return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
    }
    if (colType === 'datetime' && v instanceof Date) {
      return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())} ${pad2(v.getHours())}:${pad2(v.getMinutes())}`;
    }
    if (colType === 'timeofday' && Array.isArray(v)) {
      return `${pad2(v[0])}:${pad2(v[1])}`;
    }
    if (v instanceof Date) {
      // Fallback: unexpected date-typed value, use the formatted display text
      // rather than risk a garbled ISO string.
      return cell.f != null ? cell.f : String(v);
    }
    return v;
  }

  function gvizToRows(json) {
    const table = json && json.table;
    if (!table) return [];
    const cols = table.cols || [];
    const headers = cols.map((c) => String(c.label || c.id || '').trim());
    return (table.rows || [])
      .map((r) =>
        (r.c || []).map((cell, i) => cellValue(cell, cols[i] && cols[i].type))
      )
      .filter((row) => row.some((v) => String(v ?? '').trim() !== ''))
      .map((row) => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = row[i] !== undefined && row[i] !== null ? row[i] : '';
        });
        return obj;
      });
  }

  // Loads one sheet tab via a JSONP-style <script> tag (no CORS involved).
  function loadTab(spreadsheetId, tabName) {
    return new Promise((resolve, reject) => {
      const cbName = 'sheetsSyncCb_' + Math.random().toString(36).slice(2);
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`תם הזמן להמתנה לטעינת "${tabName}"`));
      }, 15000);

      function cleanup() {
        clearTimeout(timeout);
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[cbName] = (json) => {
        cleanup();
        if (json && json.status === 'error') {
          const msg = (json.errors && json.errors[0] && json.errors[0].detailed_message) || 'שגיאה לא ידועה';
          reject(new Error(`שגיאה בטעינת "${tabName}": ${msg}`));
          return;
        }
        resolve(json);
      };

      const url =
        `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq` +
        `?tqx=out:json;responseHandler:${cbName}&headers=1&sheet=${encodeURIComponent(tabName)}`;

      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => {
        cleanup();
        reject(new Error(
          `לא ניתן לטעון את הכרטיסייה "${tabName}". ודא/י שהגיליון משותף כ"כל מי שיש לו את הקישור - צפייה" ושהשם תואם בדיוק.`
        ));
      };
      document.head.appendChild(script);
    });
  }

  async function fetchAndTransform(spreadsheetIdOrUrl) {
    const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
    const names = Object.values(TABS);
    const jsons = await Promise.all(names.map((n) => loadTab(spreadsheetId, n)));
    const byName = {};
    names.forEach((n, i) => {
      byName[n] = gvizToRows(jsons[i]);
    });

    const settings = {};
    byName[TABS.settings].forEach((r) => {
      settings[r['שדה']] = r['ערך'];
    });

    const days = byName[TABS.days].map((r) => ({
      id: r['מזהה'],
      day: parseInt(r['יום'], 10),
      date: r['תאריך'],
      weekday: r['יום בשבוע'],
      city: r['עיר'],
      title: r['כותרת'],
      subtitle: r['כותרת משנה'],
      hotelId: r['מזהה מלון'],
      load: r['עומס'],
      holiday: truth(r['חג']),
      important: parseList(r['חשוב לדעת']),
      take: parseList(r['מה לקחת']),
    }));

    const schedule = byName[TABS.schedule].map((r) => ({
      id: r['מזהה'],
      dayId: r['מזהה יום'],
      order: parseInt(r['סדר'], 10),
      start: r['שעת התחלה'],
      end: r['שעת סיום'],
      title: r['כותרת'],
      description: r['תיאור'],
      transport: r['תחבורה'],
      place: r['מקום'],
      mapsQuery: r['חיפוש במפות'],
      bookingId: r['מזהה הזמנה'],
      internet: truth(r['דורש אינטרנט']),
    }));

    const bookings = byName[TABS.bookings].map((r) => ({
      id: r['מזהה'],
      dayId: r['מזהה יום'],
      name: r['שם'],
      status: r['סטטוס'],
      priority: r['עדיפות'],
      deadline: r['תאריך יעד'],
      useDate: r['תאריך שימוש'],
      time: r['שעה'],
      arrival: r['הגעה מומלצת'],
      cost: r['עלות משוערת'],
      url: r['קישור'],
      notes: r['הערות'],
    }));

    const restaurants = byName[TABS.restaurants].map((r) => ({
      id: r['מזהה'],
      days: parseList(r['ימים']),
      area: r['אזור'],
      name: r['שם'],
      cuisine: r['מטבח'],
      price: r['מחיר'],
      porkStatus: r['התאמה ללא חזיר'],
      recommended: r['מומלץ להזמין'],
      mapsQuery: r['חיפוש במפות'],
      website: r['אתר'],
      notes: r['הערות'],
    }));

    const hotels = byName[TABS.hotels].map((r) => ({
      id: r['מזהה'],
      name: r['שם'],
      city: r['עיר'],
      address: r['כתובת'],
      phone: r['טלפון'],
      mapsQuery: r['חיפוש במפות'],
      notes: r['הערות'],
    }));

    const phrases = byName[TABS.phrases].map((r) => ({
      category: r['קטגוריה'],
      he: r['עברית'],
      ja: r['יפנית'],
      roman: r['תעתיק'],
    }));

    return {
      version: new Date().toLocaleString('sv-SE').slice(0, 16) + ' (Sheets)',
      settings,
      days,
      schedule,
      bookings,
      restaurants,
      hotels,
      phrases,
    };
  }

  function validate(data) {
    const problems = [];
    if (!data.settings || !data.settings['שם הטיול']) {
      problems.push('לא נמצא "שם הטיול" בכרטיסיית "הגדרות" — ודא/י ששם העמודות הוא "שדה" ו"ערך".');
    }
    if (!Array.isArray(data.days) || data.days.length === 0) {
      problems.push('לא נמצאו ימים בכרטיסיית "ימים".');
    } else if (data.days.some((d) => !d.id || !d.date || Number.isNaN(d.day))) {
      problems.push('יש שורה בכרטיסיית "ימים" עם מזהה, תאריך או מספר יום חסרים.');
    }
    if (problems.length) {
      throw new Error(
        'הנתונים מהגיליון לא תקינים, ולכן לא נשמרו (כדי לא לפגוע בנתונים הקיימים): ' + problems.join(' ')
      );
    }
  }

  async function sync(spreadsheetIdOrUrl) {
    const data = await fetchAndTransform(spreadsheetIdOrUrl);
    validate(data);
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    setConfig({ spreadsheetId: extractSpreadsheetId(spreadsheetIdOrUrl) });
    return data;
  }

  function clearCache() {
    localStorage.removeItem(CACHE_KEY);
  }

  applyCachedOverride();

  return { getConfig, setConfig, getCached, clearCache, sync, fetchAndTransform, extractSpreadsheetId };
})();
