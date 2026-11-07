/**
 * WhatsApp Web Group & Number Scraper - Content Script v1.0.0
 * 
 * Professional UI: SVG icons, drag & drop, collapsible, progress bar
 * Open-source ready
 */
(function () {
  'use strict';

  if (window.__WA_SCRAPER_LOADED__) return;
  window.__WA_SCRAPER_LOADED__ = true;

  const contactsMap = new Map();
  let nameToPhoneCache = new Map();
  let savedPhonesCache = new Set();
  let savedNamesCache = new Set();
  let isScrapingActive = false;
  let activeGroupName = '';
  let expectedMemberCount = 0;
  let myOwnPhone = '';
  let scrapeProgress = { phase: 0, totalPhases: 6, detail: '', pct: 0 };

  let activeTab = 'scrape'; // 'scrape' | 'match'
  let csvState = {
    step: 1, // 1: upload, 2: map columns, 3: results
    fileName: '',
    fileSizeStr: '',
    analysis: null,
    selectedPhoneCol: -1,
    selectedPhone2Col: -1,
    selectedNameCol: -1,
    matchedResults: null,
    filterStatus: 'not_in_group', // 'not_in_group' | 'in_group' | 'all'
    searchKeyword: ''
  };

  /* ══════════════════════════════════════════════════════════════
     SVG ICONS (inline, no external deps)
     ══════════════════════════════════════════════════════════════ */
  const ICONS = {
    logo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    bolt: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    stop: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    expand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
    grip: `<svg viewBox="0 0 24 24" fill="currentColor" opacity="0.3"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>`,
    users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  /* ══════════════════════════════════════════════════════════════
     TOAST NOTIFICATION SYSTEM
     ══════════════════════════════════════════════════════════════ */
  function ensureToastContainer() {
    let c = document.getElementById('ws-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'ws-toast-container';
      c.className = 'ws-toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  /**
   * @param {string} message
   * @param {'success'|'error'|'info'|'warning'} type
   * @param {number} duration ms
   */
  function showToast(message, type = 'info', duration = 3000) {
    const container = ensureToastContainer();
    const iconMap = {
      success: ICONS.check,
      error: ICONS.x,
      info: ICONS.bolt,
      warning: ICONS.shield,
    };

    const toast = document.createElement('div');
    toast.className = 'ws-toast';
    toast.style.position = 'relative';
    toast.innerHTML = `
      <div class="ws-toast-icon ws-toast-${type}">${iconMap[type] || iconMap.info}</div>
      <span class="ws-toast-msg">${message}</span>
      <button class="ws-toast-close">${ICONS.x}</button>
      <div class="ws-toast-bar" style="animation-duration:${duration}ms;${type === 'success' ? 'background:var(--ws-accent);' : type === 'error' ? 'background:var(--ws-danger);' : type === 'warning' ? 'background:var(--ws-warning);' : 'background:var(--ws-info);'}"></div>
    `;

    const dismiss = () => {
      toast.classList.add('ws-toast-out');
      setTimeout(() => toast.remove(), 250);
    };
    toast.querySelector('.ws-toast-close').addEventListener('click', dismiss);
    container.appendChild(toast);
    setTimeout(dismiss, duration);
  }

  /* ══════════════════════════════════════════════════════════════
     CONFIRM DIALOG SYSTEM
     ══════════════════════════════════════════════════════════════ */
  /**
   * @param {Object} opts
   * @param {string} opts.title
   * @param {string} opts.message
   * @param {'danger'|'warning'|'info'} opts.type
   * @param {string} opts.confirmText
   * @param {string} opts.cancelText
   * @param {string} opts.icon - SVG from ICONS
   * @returns {Promise<boolean>}
   */
  function showConfirm({ title, message, type = 'danger', confirmText = 'Hapus', cancelText = 'Batal', icon }) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'ws-dialog-overlay';

      const btnClass = type === 'danger' ? 'ws-dialog-btn-danger' : 'ws-dialog-btn-primary';
      const dialogIcon = icon || (type === 'danger' ? ICONS.trash : type === 'warning' ? ICONS.shield : ICONS.bolt);

      overlay.innerHTML = `
        <div class="ws-dialog">
          <div class="ws-dialog-body">
            <div class="ws-dialog-icon ws-dialog-${type}">${dialogIcon}</div>
            <div class="ws-dialog-title">${title}</div>
            <div class="ws-dialog-message">${message}</div>
          </div>
          <div class="ws-dialog-actions">
            <button class="ws-dialog-btn ws-dialog-btn-cancel" id="ws-dlg-cancel">${cancelText}</button>
            <button class="ws-dialog-btn ${btnClass}" id="ws-dlg-confirm">${confirmText}</button>
          </div>
        </div>
      `;

      // Stop keyboard propagation
      overlay.addEventListener('keydown', e => e.stopPropagation());
      overlay.addEventListener('keyup', e => e.stopPropagation());

      const dismiss = (result) => {
        overlay.classList.add('ws-dialog-out');
        setTimeout(() => { overlay.remove(); resolve(result); }, 200);
      };

      overlay.querySelector('#ws-dlg-cancel').addEventListener('click', () => dismiss(false));
      overlay.querySelector('#ws-dlg-confirm').addEventListener('click', () => dismiss(true));
      overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(false); });

      document.body.appendChild(overlay);
      overlay.querySelector('#ws-dlg-confirm').focus();
    });
  }

  /**
   * Dialog interaktif untuk memilih format unduhan hasil pencocokan (Excel sel hijau / CSV lengkap / CSV belum masuk)
   * @param {Object} summary
   * @returns {Promise<'excel'|'csv_full'|'csv_notin'|null>}
   */
  function showExportChoiceDialog(summary) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'ws-dialog-overlay';

      const notInGroupCount = summary.notInGroup || 0;
      const inGroupCount = summary.inGroup || 0;
      const phonesInGroup = summary.totalPhonesInGroup || 0;

      overlay.innerHTML = `
        <div class="ws-dialog ws-dialog-export">
          <div class="ws-export-header">
            <h3>${ICONS.download} Pilihan Format Unduhan</h3>
            <button class="ws-export-close" id="ws-dlg-export-close" title="Tutup">${ICONS.x}</button>
          </div>
          <div class="ws-export-list">
            <!-- Pilihan 1: Excel Lengkap dengan Sel Hijau Asli -->
            <button class="ws-export-item recommended" id="ws-export-excel">
              <div class="ws-export-icon excel">XLS</div>
              <div class="ws-export-item-info">
                <div class="ws-export-item-head">
                  <span class="ws-export-item-title">Excel Lengkap (.xls)</span>
                  <span class="ws-export-badge green">Sel Hijau Otomatis</span>
                </div>
                <p class="ws-export-item-desc">
                  Mengacu pada file asli Anda. Sel nomor yang <b>sudah masuk grup diwarnai HIJAU</b> (${inGroupCount} peserta / ${phonesInGroup} nomor). Format nomor diawali 08/62 aman tanpa rusak <code>6.28E+11</code>.
                </p>
              </div>
            </button>

            <!-- Pilihan 2: CSV Lengkap Bertanda Hijau -->
            <button class="ws-export-item" id="ws-export-csv-full">
              <div class="ws-export-icon csv">CSV</div>
              <div class="ws-export-item-info">
                <div class="ws-export-item-head">
                  <span class="ws-export-item-title">CSV Lengkap (.csv)</span>
                  <span class="ws-export-badge blue">Tanda 🟢 Sudah Masuk</span>
                </div>
                <p class="ws-export-item-desc">
                  Semua kolom asli tetap utuh + kolom status bertanda <code>🟢 Sudah Masuk</code> dan <code>⏳ Belum Masuk</code>. Format standar teks UTF-8 BOM.
                </p>
              </div>
            </button>

            <!-- Pilihan 3: CSV Khusus Belum Masuk Saja -->
            <button class="ws-export-item" id="ws-export-csv-notin">
              <div class="ws-export-icon filtered">WA</div>
              <div class="ws-export-item-info">
                <div class="ws-export-item-head">
                  <span class="ws-export-item-title">Khusus Belum Masuk (.csv)</span>
                  <span class="ws-export-badge yellow">${notInGroupCount} Peserta</span>
                </div>
                <p class="ws-export-item-desc">
                  Hanya mengekspor peserta yang belum bergabung ke grup. Sangat praktis untuk follow-up japri atau broadcast pesan undangan WhatsApp.
                </p>
              </div>
            </button>
          </div>
        </div>
      `;

      overlay.addEventListener('keydown', e => e.stopPropagation());
      overlay.addEventListener('keyup', e => e.stopPropagation());

      const dismiss = (choice) => {
        overlay.classList.add('ws-dialog-out');
        setTimeout(() => { overlay.remove(); resolve(choice); }, 200);
      };

      overlay.querySelector('#ws-dlg-export-close').addEventListener('click', () => dismiss(null));
      overlay.querySelector('#ws-export-excel').addEventListener('click', () => dismiss('excel'));
      overlay.querySelector('#ws-export-csv-full').addEventListener('click', () => dismiss('csv_full'));
      overlay.querySelector('#ws-export-csv-notin').addEventListener('click', () => dismiss('csv_notin'));
      overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(null); });

      document.body.appendChild(overlay);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     DETEKSI CHAT & JUDUL GRUP
     ══════════════════════════════════════════════════════════════ */
  function getActiveChatInfo() {
    const header = document.querySelector('#main header');
    if (!header) return null;

    let titleEl = header.querySelector('[data-testid="conversation-info-header-chat-title"]');
    if (!titleEl) {
      const candidateSpans = Array.from(header.querySelectorAll('span')).filter(s => {
        const txt = (s.getAttribute('title') || s.innerText || '').trim();
        return txt.length > 1 && !txt.includes(',') && !/^(menu|search|cari|online|typing|panggilan|video|call)/i.test(txt);
      });
      if (candidateSpans.length > 0) titleEl = candidateSpans[0];
    }

    const title = titleEl ? (titleEl.getAttribute('title') || titleEl.innerText || '').trim() : '';

    const subtitleEl = Array.from(header.querySelectorAll('span')).find(s => {
      const txt = (s.getAttribute('title') || s.innerText || '').trim();
      return txt !== title && (txt.includes(',') || /peserta|anggota|\+62/i.test(txt));
    });
    const subtitle = subtitleEl ? (subtitleEl.getAttribute('title') || subtitleEl.innerText || '').trim() : '';

    if (subtitle) {
      const parts = subtitle.split(',');
      if (parts.length > 3) expectedMemberCount = parts.length;
    }

    return { title: title || 'Grup WhatsApp', subtitle, isGroup: true };
  }

  /* ══════════════════════════════════════════════════════════════
     NORMALISASI NAMA & VALIDASI NOMOR
     ══════════════════════════════════════════════════════════════ */
  function normalizeName(str) {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/^(bapak|ibu|bpk|pak|bu|mas|mbak|kak|ustadz|ust|dr|prof)\.?\s+/i, '')
      .replace(/^[^\w\s]+|[^\w\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isValidPhone(phone) {
    if (!phone || phone === '-') return false;
    const digits = phone.replace(/[^\d]/g, '');
    return digits.startsWith('62') && digits.length >= 10 && digits.length <= 15;
  }

  async function loadNameToPhoneMap() {
    if (nameToPhoneCache.size > 0 && savedPhonesCache.size > 0) return nameToPhoneCache;
    if (window.WAIdbExtractor) {
      try {
        if (typeof window.WAIdbExtractor.getSavedContactsInfo === 'function') {
          const info = await window.WAIdbExtractor.getSavedContactsInfo();
          if (info) {
            savedPhonesCache = info.savedPhones || new Set();
            savedNamesCache = info.savedNames || new Set();
            nameToPhoneCache = info.nameToPhone || new Map();
            console.log('[WA-Scraper] IDB Cache loaded: savedPhones=', savedPhonesCache.size, 'savedNames=', savedNamesCache.size, 'nameToPhone=', nameToPhoneCache.size);
            return nameToPhoneCache;
          }
        }
        nameToPhoneCache = await window.WAIdbExtractor.getNameToPhoneMap();
        console.log('[WA-Scraper] Kontak database:', nameToPhoneCache.size);
      } catch (e) {}
    }
    return nameToPhoneCache;
  }

  function isYouEntry(name) {
    if (!name) return false;
    const n = name.trim().toLowerCase();
    return n === 'you' || n === 'anda';
  }

  function matchPhoneFromName(name) {
    if (!name || nameToPhoneCache.size === 0) return '';
    if (isYouEntry(name)) return myOwnPhone || '';

    const fullLower = name.toLowerCase().trim();
    if (nameToPhoneCache.has(fullLower)) {
      const phone = nameToPhoneCache.get(fullLower);
      if (isValidPhone(phone)) return phone;
    }

    const norm = normalizeName(name);
    if (norm && norm !== fullLower && nameToPhoneCache.has(norm)) {
      const phone = nameToPhoneCache.get(norm);
      if (isValidPhone(phone)) return phone;
    }

    const prefix = (norm || fullLower).replace(/[\.…]+$/, '').trim();
    if (prefix.length >= 5) {
      for (const [savedName, phone] of nameToPhoneCache.entries()) {
        if (savedName.length >= 5 && (savedName.startsWith(prefix) || prefix.startsWith(savedName)) && isValidPhone(phone)) {
          return phone;
        }
      }
    }
    return '';
  }

  /* ══════════════════════════════════════════════════════════════
     DOM HELPERS
     ══════════════════════════════════════════════════════════════ */
  function getSearchInput() {
    return Array.from(document.querySelectorAll(
      'input[placeholder*="Search contacts"], input[placeholder*="Search members"], input[placeholder*="Search"], input[placeholder*="Cari"]'
    )).find(el => !el.closest('#wa-scraper-modal') && !el.closest('#pane-side') && !el.closest('#side')) || null;
  }

  function getSearchModalContainer() {
    const input = getSearchInput();
    if (!input) return null;
    let p = input.parentElement;
    while (p && p !== document.body) {
      if (p.id === 'wa-scraper-modal') break;
      if (p.getAttribute('role') === 'region' || p.getAttribute('role') === 'dialog' || p.tagName === 'SECTION') return p;
      p = p.parentElement;
    }
    return input.closest('div[tabindex="-1"]') || document.body;
  }

  function findScrollContainer(container) {
    if (!container) return null;
    const rows = Array.from(container.querySelectorAll(
      'div[role="listitem"], div[data-testid="cell-frame-container"]'
    )).filter(el => !el.closest('#wa-scraper-modal') && !el.closest('#pane-side') && !el.closest('#main'));
    if (rows.length > 0) {
      let p = rows[0].parentElement;
      while (p && p !== document.body && p.id !== 'wa-scraper-modal') {
        try {
          const cs = window.getComputedStyle(p);
          if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 10) return p;
        } catch (e) {}
        p = p.parentElement;
      }
    }
    return null;
  }

  function setNativeInput(el, val) {
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ══════════════════════════════════════════════════════════════
     CORE: SCROLL + EXTRACT
     ══════════════════════════════════════════════════════════════ */
  async function scrollAndExtract(container, scrollEl) {
    if (!scrollEl) { await extractRows(container); return; }

    // Pass 1: scroll dari atas ke bawah
    scrollEl.scrollTop = 0;
    await sleep(150);
    await extractRows(container);

    let stuck = 0;
    while (isScrapingActive && stuck < 8) {
      // Cek apakah modal Search members masih terbuka
      if (!getSearchInput()) { isScrapingActive = false; break; }

      const before = scrollEl.scrollTop;
      scrollEl.scrollTop += 300;
      scrollEl.dispatchEvent(new Event('scroll', { bubbles: true }));
      await sleep(100);
      await extractRows(container);

      if (Math.abs(scrollEl.scrollTop - before) < 2) {
        scrollEl.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true }));
        await sleep(150);
        await extractRows(container);
        if (Math.abs(scrollEl.scrollTop - before) < 2) stuck++;
        else stuck = 0;
      } else {
        stuck = 0;
      }
    }

    // Pass 2: paksa scroll ke paling bawah, tunggu render, extract
    scrollEl.scrollTop = scrollEl.scrollHeight;
    scrollEl.dispatchEvent(new Event('scroll', { bubbles: true }));
    await sleep(200);
    await extractRows(container);

    // Micro-scroll terakhir: naik sedikit lalu turun lagi agar item paling bawah ter-render
    scrollEl.scrollTop = scrollEl.scrollHeight - 200;
    scrollEl.dispatchEvent(new Event('scroll', { bubbles: true }));
    await sleep(150);
    await extractRows(container);
    scrollEl.scrollTop = scrollEl.scrollHeight;
    scrollEl.dispatchEvent(new Event('scroll', { bubbles: true }));
    await sleep(150);
    await extractRows(container);
  }

  function isIgnored(str) {
    if (!str) return false;
    return /^(add member tag|tambah tag|add participant|tambah peserta|invite to group|undang via tautan)/i.test(str.trim()) ||
           /^ic-|^default-user|^videocam|^msg-|^status-/i.test(str.trim());
  }

  /**
   * Ekstrak nomor telepon / JID dan status isMyContact dari React Fiber internal props
   * Membaca langsung flag isMyContact yang menentukan apakah WhatsApp menampilkan "Message [Nama]" vs "Message +62..."
   */
  function getContactInfoFromFiber(el) {
    const result = { phone: '', isMyContact: false, name: '' };
    if (!el) return result;

    try {
      const inspectObj = (obj, depth = 0) => {
        if (!obj || depth > 5 || typeof obj !== 'object') return false;

        const candidates = [
          obj, obj.contact, obj.user, obj.participant, obj.chat,
          obj.item, obj.member, obj.data, obj.model, obj.props
        ].filter(Boolean);

        for (const c of candidates) {
          if (typeof c !== 'object') continue;

          // Cek ID / phone
          const rawId = c.id?._serialized || c.id || c.wid?._serialized || c.user || '';
          const userStr = c.id?.user || c.wid?.user || (typeof c.user === 'string' ? c.user : '') || (typeof rawId === 'string' ? rawId : (rawId.user || rawId._serialized || ''));
          const digits = String(userStr).replace(/[^\d]/g, '').replace(/@.*/, '');
          if (digits.length >= 10 && digits.length <= 15) {
            result.phone = '+' + digits;
          } else if (c.phoneNumber) {
            const pDigits = String(c.phoneNumber).replace(/[^\d]/g, '');
            if (pDigits.length >= 10 && pDigits.length <= 15) {
              result.phone = '+' + pDigits;
            }
          }

          // Cek isAddressBookContact (HANYA flag buku telepon murni)
          if (c.isAddressBookContact === 1 || c.isAddressBookContact === true ||
              c.__x_isAddressBookContact === 1 || c.__x_isAddressBookContact === true) {
            result.isMyContact = true;
          }
          if (c.name && typeof c.name === 'string') {
            result.name = c.name;
          }

          if (result.phone && result.isMyContact) return true;
        }

        for (const k in obj) {
          if (typeof obj[k] === 'object' && depth < 2) {
            if (inspectObj(obj[k], depth + 1)) return true;
          }
        }
        return false;
      };

      const elementsToTry = [
        el,
        el.querySelector('div[role="button"]'),
        el.querySelector('div[role="gridcell"]'),
        el.querySelector('div[tabindex]'),
        el.querySelector('img'),
        el.querySelector('span[title]'),
        el.firstElementChild
      ].filter(Boolean);

      for (const cur of elementsToTry) {
        let currEl = cur;
        let elDepth = 0;
        while (currEl && elDepth < 2) {
          const fiberKey = Object.keys(currEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
          if (fiberKey && currEl[fiberKey]) {
            let fiber = currEl[fiberKey];
            let fDepth = 0;
            while (fiber && fDepth < 6) {
              if (fiber.memoizedProps) inspectObj(fiber.memoizedProps);
              if (fiber.memoizedState) inspectObj(fiber.memoizedState);
              if (result.phone && result.isMyContact) return result;
              fiber = fiber.return;
              fDepth++;
            }
          }
          currEl = currEl.parentElement;
          elDepth++;
        }
      }
    } catch (e) {}
    return result;
  }

  /**
   * Ekstrak nomor telepon dari URL avatar img (u=628xxx%40c.us)
   */
  function getPhoneFromAvatar(el) {
    if (!el) return '';
    try {
      const imgs = el.querySelectorAll('img');
      for (const img of imgs) {
        const src = img.getAttribute('src') || img.src || '';
        if (!src) continue;
        const m1 = src.match(/[?&]u=(\d{10,15})%40c\.us/i);
        if (m1 && m1[1]) return '+' + m1[1];
        const m2 = src.match(/[?&]u=(\d{10,15})@c\.us/i);
        if (m2 && m2[1]) return '+' + m2[1];
        const m3 = src.match(/(\d{10,15})(@|%40)c\.us/i);
        if (m3 && m3[1]) return '+' + m3[1];
      }
    } catch (e) {}
    return '';
  }

  async function extractRows(container) {
    if (!container) return;
    const rows = Array.from(container.querySelectorAll(
      'div[role="listitem"], div[data-testid="cell-frame-container"]'
    )).filter(el => !el.closest('#wa-scraper-modal') && !el.closest('#pane-side') && !el.closest('#main'));

    for (const row of rows) {
      const fullText = (row.innerText || '').trim();
      if (!fullText || fullText.length < 2) continue;
      const isAdmin = /\badmin\b/i.test(fullText);

      let visiblePhone = '';
      let phone = '';
      let name = '';
      let firstFound = '';

      const spans = Array.from(row.querySelectorAll('span[title], span'));
      for (const s of spans) {
        const txt = (s.getAttribute('title') || s.textContent || '').trim();
        if (!txt || txt.length < 2) continue;
        if (isIgnored(txt)) continue;

        if (!phone && window.WAPhoneParser.isPhoneNumber(txt)) {
          const cleaned = window.WAPhoneParser.cleanPhone(txt);
          if (isValidPhone(cleaned)) {
            phone = cleaned;
            visiblePhone = cleaned;
            if (!firstFound) firstFound = 'phone';
          }
        } else if (!name && txt.length > 1 && !/^\+?\d[\d\s\-.]+$/.test(txt) && !/^admin$/i.test(txt) && !/^ic-/i.test(txt) && !/^(default-user|video|audio|search|back|x-alt|checkmark|msg-|status-)/i.test(txt)) {
          name = txt;
          if (!firstFound) firstFound = 'name';
        }
      }

      if (!phone) {
        for (const line of fullText.split('\n')) {
          const l = line.trim();
          if (isIgnored(l)) continue;
          if (window.WAPhoneParser.isPhoneNumber(l)) {
            const cleaned = window.WAPhoneParser.cleanPhone(l);
            if (isValidPhone(cleaned)) {
              phone = cleaned;
              visiblePhone = cleaned;
              break;
            }
          }
        }
      }

      // Resolusi nomor dan info kontak dari React Fiber
      const fiberInfo = getContactInfoFromFiber(row);
      if (!phone && fiberInfo.phone) {
        phone = fiberInfo.phone;
      }
      if (!phone) {
        phone = getPhoneFromAvatar(row);
      }
      if (!phone && name) {
        phone = matchPhoneFromName(name);
      }

      const isPushname = name.startsWith('~');
      name = name.replace(/^~/, '').trim();
      if (isIgnored(name)) name = '';

      if (!phone && !name) continue;

      const isPhoneAsName = name && /^\+?\d[\d\s\-.]+$/.test(name);
      const isYou = isYouEntry(name);

      // Pencocokan existing contact key: prioritas phone, lalu name
      const rawKey = name ? name.toLowerCase().trim() : '';
      let existingKey = null;

      if (phone && phone !== '-' && contactsMap.has(phone)) {
        existingKey = phone;
      }
      if (!existingKey && rawKey) {
        for (const [k, v] of contactsMap.entries()) {
          const vRaw = v.name ? v.name.toLowerCase().trim() : '';
          if (vRaw && vRaw === rawKey) {
            existingKey = k;
            break;
          }
        }
      }

      // Kriteria Kontak Tersimpan (100% PASTI & VALID):
      // 1. Akun Anda sendiri ("You" / "Anda") -> isSaved = true
      // 2. Nomor telepon TERVERIFIKASI ada di buku telepon ponsel (isAddressBookContact === 1) -> isSaved = true
      // 3. Tampilan DOM: Nama kontak di atas + nomor HP di bawahnya yang terlihat -> isSaved = true
      // 4. SEMUA KASUS LAINNYA -> NOMOR BARU (isSaved = false):
      //    - Nomor muncul pertama (firstFound === 'phone') -> Nomor Baru
      //    - Pushname (diawali ~) -> Nomor Baru
      //    - Anggota Name-Only (hanya tampil nama seperti 'Halaqoh Meta' & 'Rifqy Ramanda') -> 100% NOMOR BARU!
      const isPhoneInSavedCache = Boolean(phone && phone !== '-' && savedPhonesCache.has(phone));

      const isDomSaved = Boolean(
        firstFound === 'name' &&
        !isPushname &&
        !isPhoneAsName &&
        visiblePhone &&
        phone && phone !== '-' &&
        isPhoneInSavedCache
      );

      let saved = false;
      if (isYou) {
        saved = true;
      } else if (firstFound === 'phone') {
        saved = false;
      } else if (isPushname) {
        saved = isPhoneInSavedCache;
      } else if (!visiblePhone && !isPhoneAsName && name) {
        // Anggota name-only: HANYA tersimpan jika nomor teleponnya ada di buku telepon user
        saved = isPhoneInSavedCache;
      } else {
        saved = isPhoneInSavedCache || isDomSaved;
      }

      if (existingKey) {
        const c = contactsMap.get(existingKey);
        if (phone && phone !== '-' && (!c.phone || c.phone === '-')) {
          c.phone = phone;
          if (existingKey.startsWith('name_') && !contactsMap.has(phone)) {
            contactsMap.delete(existingKey);
            contactsMap.set(phone, c);
            existingKey = phone;
          }
        }
        if (name && (!c.name || c.name.length < name.length)) c.name = name;
        if (isAdmin) c.isAdmin = true;
        c.isSaved = saved;
      } else {
        contactsMap.set(
          (phone && phone !== '-') ? phone : ('name_' + rawKey + '_' + contactsMap.size),
          { phone: phone || '-', name, groupName: activeGroupName, isAdmin, isSaved: saved }
        );
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     SCRAPE GROUP INFO PANEL
     ══════════════════════════════════════════════════════════════ */
  async function scrapeGroupInfoPanel() {
    const rightPanel = document.querySelector('[data-testid="chat-info-drawer"]') ||
                       document.querySelector('div[data-testid="panel-right"]') ||
                       document.querySelector('span[data-testid="section-participants"]')?.closest('div[role="region"]');
    if (!rightPanel) return;
    const scrollables = Array.from(rightPanel.querySelectorAll('div')).filter(d => {
      try {
        const cs = window.getComputedStyle(d);
        return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 50;
      } catch (e) { return false; }
    });
    for (const sc of scrollables) {
      const items = sc.querySelectorAll('div[role="listitem"], div[data-testid="cell-frame-container"]');
      if (items.length > 0) {
        await scrollAndExtract(sc, sc);
        break;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     PROGRESS HELPERS
     ══════════════════════════════════════════════════════════════ */
  function setProgress(phase, totalPhases, detail, subIdx, subTotal) {
    const basePct = ((phase - 1) / totalPhases) * 100;
    const phaseRange = (1 / totalPhases) * 100;
    const subPct = subTotal > 0 ? (subIdx / subTotal) * phaseRange : 0;
    scrapeProgress.pct = Math.min(Math.round(basePct + subPct), 99);
    scrapeProgress.phase = phase;
    scrapeProgress.totalPhases = totalPhases;
    scrapeProgress.detail = detail;
    updateProgressUI();
  }

  function setProgressDone() {
    scrapeProgress.pct = 100;
    scrapeProgress.detail = 'Selesai!';
    updateProgressUI();
  }

  function updateProgressUI() {
    const section = document.getElementById('ws-progress');
    const fill = document.getElementById('ws-progress-fill');
    const text = document.getElementById('ws-progress-text');
    const pct = document.getElementById('ws-progress-pct');
    const headerPct = document.getElementById('ws-header-pct');

    if (section) section.classList.toggle('ws-active', isScrapingActive || scrapeProgress.pct === 100);
    if (fill) {
      fill.style.width = scrapeProgress.pct + '%';
      fill.classList.toggle('ws-indeterminate', isScrapingActive && scrapeProgress.pct === 0);
    }
    if (text) text.textContent = scrapeProgress.detail;
    if (pct) pct.textContent = scrapeProgress.pct + '%';
    if (headerPct) {
      headerPct.textContent = scrapeProgress.pct + '%';
      headerPct.parentElement.classList.toggle('ws-active', isScrapingActive);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     MAIN SCRAPE ORCHESTRATOR
     ══════════════════════════════════════════════════════════════ */
  async function executeFullScrape(resetFirst = true) {
    if (isScrapingActive) return;
    const PHASES = 6;

    try {
      const chatInfo = getActiveChatInfo();
      activeGroupName = chatInfo ? chatInfo.title : 'Grup WhatsApp';

      if (resetFirst) {
        contactsMap.clear();
        updateUI();
      }

      scrapeProgress.pct = 0;
      setProgress(1, PHASES, 'Mempersiapkan...', 0, 0);
      await loadNameToPhoneMap();

      // Coba pra-isi anggota grup dari IndexedDB jika tersedia (mengambil JID asli seluruh peserta)
      if (window.WAIdbExtractor) {
        try {
          const idbData = await window.WAIdbExtractor.getGroupParticipantsFromIDB(activeGroupName);
          if (idbData && idbData.participants && idbData.participants.length > 0) {
            console.log(`[WA-Scraper] IDB mendeteksi ${idbData.participants.length} anggota grup.`);
            for (const p of idbData.participants) {
              if (!p.phone && !p.name) continue;
              const clPhone = (p.phone && p.phone !== '-') ? (window.WAPhoneParser ? window.WAPhoneParser.cleanPhone(p.phone) : p.phone) : '';
              const key = (clPhone && isValidPhone(clPhone)) ? clPhone : ('name_' + (p.name || '').toLowerCase().trim());
              const isYou = isYouEntry(p.name);
              // Untuk IDB pre-fill: HANYA set saved jika:
              // - Akun sendiri (You)
              // - ATAU nomor ada di savedPhonesCache
              // JANGAN trust p.isSaved dari IDB secara langsung
              const isSaved = isYou || Boolean(clPhone && isValidPhone(clPhone) && savedPhonesCache.has(clPhone));
              if (!contactsMap.has(key)) {
                contactsMap.set(key, {
                  phone: (clPhone && isValidPhone(clPhone)) ? clPhone : (p.phone || '-'),
                  name: p.name || '',
                  groupName: idbData.groupTitle || activeGroupName,
                  isAdmin: Boolean(p.isAdmin),
                  isSaved: isSaved
                });
              }
            }
            updateUI();
          }
        } catch (e) {
          console.warn('[WA-Scraper] IDB pre-fill warning:', e);
        }
      }

      window.postMessage({ source: 'WA_SCRAPER_CONTENT', action: 'GET_ACTIVE_GROUP_DYNAMIC', hintTitle: activeGroupName }, '*');
      window.postMessage({ source: 'WA_SCRAPER_CONTENT', action: 'GET_MY_PHONE' }, '*');
      await sleep(600);

      const searchInput = getSearchInput();
      const modal = getSearchModalContainer();

      if (!searchInput || !modal) {
        await scrapeGroupInfoPanel();
        if (contactsMap.size > 0) {
          setProgress(PHASES, PHASES, `${contactsMap.size} anggota. Buka "Search members" untuk lengkap.`, 1, 1);
        } else {
          showToast('Buka info grup → klik "Lihat semua" (Search members) → lalu klik Scrape.', 'warning', 5000);
        }
        updateUI();
        isScrapingActive = false;
        updateProgressUI();
        return;
      }

      isScrapingActive = true;

      // Helper: cek apakah modal Search members masih terbuka
      function isSearchModalStillOpen() {
        return Boolean(getSearchInput() && getSearchModalContainer());
      }

      // FASE 1: Scroll default
      setProgress(1, PHASES, 'Memindai daftar default...', 0, 1);
      let sc = findScrollContainer(modal);
      if (sc) await scrollAndExtract(modal, sc);
      else await extractRows(modal);
      updateUI();

      if (!isScrapingActive) { finish(); return; }
      if (!isSearchModalStillOpen()) { showToast('Modal ditutup, scraping dihentikan.', 'warning', 4000); finish(); return; }

      // FASE 2: Single char search
      const phase2 = 'abcdefghijklmnopqrstuvwxyz0123456789~+.-_@'.split('');
      for (let i = 0; i < phase2.length; i++) {
        if (!isScrapingActive) break;
        if (!isSearchModalStillOpen()) { showToast('Modal ditutup, scraping dihentikan.', 'warning', 4000); isScrapingActive = false; break; }
        setProgress(2, PHASES, `Pencarian "${phase2[i]}" — ${contactsMap.size} anggota`, i, phase2.length);
        searchInput.focus();
        setNativeInput(searchInput, phase2[i]);
        await sleep(500);
        sc = findScrollContainer(modal);
        if (sc) await scrollAndExtract(modal, sc);
        else await extractRows(modal);
        updateUI();
      }

      if (!isScrapingActive) { clearSearch(searchInput); finish(); return; }
      if (!isSearchModalStillOpen()) { showToast('Modal ditutup, scraping dihentikan.', 'warning', 4000); finish(); return; }

      // FASE 3: Two-char combos
      const consonants = ['b','c','d','f','g','h','j','k','l','m','n','p','q','r','s','t','v','w','x','y','z'];
      const vowels = ['a','e','i','o','u'];
      const combos = [];
      for (const c of consonants) { for (const v of vowels) { combos.push(c + v); } }
      for (const v of vowels) { for (const c of ['b','d','g','k','l','m','n','r','s','t']) { combos.push(v + c); } }
      combos.push('~','.', '+6','08','62','dr','ir','st','dw','sp','aa','ee','ii','oo','uu','ng','ny','kh','sy','dh','th');

      for (let i = 0; i < combos.length; i++) {
        if (!isScrapingActive) break;
        if (!isSearchModalStillOpen()) { showToast('Modal ditutup, scraping dihentikan.', 'warning', 4000); isScrapingActive = false; break; }
        setProgress(3, PHASES, `"${combos[i]}" — ${contactsMap.size} anggota`, i, combos.length);
        searchInput.focus();
        setNativeInput(searchInput, combos[i]);
        await sleep(450);
        sc = findScrollContainer(modal);
        if (sc) await scrollAndExtract(modal, sc);
        else await extractRows(modal);
        updateUI();
      }

      if (!isScrapingActive) { clearSearch(searchInput); finish(); return; }
      if (!isSearchModalStillOpen()) { showToast('Modal ditutup, scraping dihentikan.', 'warning', 4000); clearSearch(searchInput); finish(); return; }

      // FASE 4: Phone prefixes
      const phonePrefixes = ['+62 8','08','081','082','083','085','087','088','089','+62 21','+62 22','+62 24','+62 31','+62 85','+62 81','+62 82','+62 87','+62 89','+62 83','+62 88'];
      for (let i = 0; i < phonePrefixes.length; i++) {
        if (!isScrapingActive) break;
        if (!isSearchModalStillOpen()) { showToast('Modal ditutup, scraping dihentikan.', 'warning', 4000); isScrapingActive = false; break; }
        setProgress(4, PHASES, `Nomor "${phonePrefixes[i]}" — ${contactsMap.size} anggota`, i, phonePrefixes.length);
        searchInput.focus();
        setNativeInput(searchInput, phonePrefixes[i]);
        await sleep(500);
        sc = findScrollContainer(modal);
        if (sc) await scrollAndExtract(modal, sc);
        else await extractRows(modal);
        updateUI();
      }

      if (!isScrapingActive) { clearSearch(searchInput); finish(); return; }
      if (!isSearchModalStillOpen()) { showToast('Modal ditutup, scraping dihentikan.', 'warning', 4000); clearSearch(searchInput); finish(); return; }

      // FASE 5: Group info panel
      setProgress(5, PHASES, `Panel Group Info — ${contactsMap.size} anggota`, 0, 1);
      clearSearch(searchInput);
      await sleep(300);
      await scrapeGroupInfoPanel();
      updateUI();

      // FASE 6: Re-scroll default
      setProgress(6, PHASES, `Verifikasi akhir — ${contactsMap.size} anggota`, 0, 1);
      clearSearch(searchInput);
      await sleep(400);
      sc = findScrollContainer(modal);
      if (sc) await scrollAndExtract(modal, sc);
      else await extractRows(modal);
      updateUI();

      clearSearch(searchInput);
      finish();

    } catch (err) {
      console.error('[WA-Scraper] Error:', err);
      isScrapingActive = false;
      scrapeProgress.detail = 'Error: ' + err.message;
      updateProgressUI();
    }
  }

  function clearSearch(input) {
    if (input) { input.focus(); setNativeInput(input, ''); }
  }

  function finish() {
    isScrapingActive = false;
    setProgressDone();
    updateUI();
    showToast(`Selesai! ${contactsMap.size} anggota berhasil dikumpulkan.`, 'success', 4000);
    // Auto-hide progress after 8s
    setTimeout(() => {
      if (!isScrapingActive && scrapeProgress.pct === 100) {
        const section = document.getElementById('ws-progress');
        if (section) section.classList.remove('ws-active');
      }
    }, 8000);
  }

  /* ══════════════════════════════════════════════════════════════
     STORE EXTRACTOR COMMUNICATION
     ══════════════════════════════════════════════════════════════ */
  window.addEventListener('message', function (event) {
    if (!event.data || event.data.source !== 'WA_SCRAPER_INJECTED') return;

    if (event.data.action === 'MY_PHONE_RESULT') {
      if (event.data.phone && isValidPhone(event.data.phone)) {
        myOwnPhone = event.data.phone;
        savedPhonesCache.add(myOwnPhone);
        console.log('[WA-Scraper] Nomor akun sendiri (Me) terdeteksi:', myOwnPhone);
      }
      if (event.data.savedContacts && Array.isArray(event.data.savedContacts)) {
        for (const sc of event.data.savedContacts) {
          if (sc.phone) savedPhonesCache.add(sc.phone);
          if (sc.name) {
            savedNamesCache.add(sc.name.toLowerCase().trim());
            const norm = normalizeName(sc.name);
            if (norm) savedNamesCache.add(norm);
            if (sc.phone) {
              nameToPhoneCache.set(sc.name.toLowerCase().trim(), sc.phone);
              if (norm) nameToPhoneCache.set(norm, sc.phone);
            }
          }
        }
      }
    }

    if (event.data.action === 'DYNAMIC_GROUP_RESULT' && event.data.success && event.data.participants) {
      for (const p of event.data.participants) {
        if (!p.phone && !p.name) continue;
        if (p.phone && !isValidPhone(p.phone)) p.phone = '';
        const key = (p.phone && p.phone !== '-' && p.phone !== '') ? p.phone : ('name_' + (p.name || '').toLowerCase());
        const isYou = isYouEntry(p.name);
        // Untuk pre-fill dari Store: HANYA set saved jika:
        // - Akun sendiri (You) 
        // - ATAU nomor ada di savedPhonesCache (sudah eksplisit dari buku telepon)
        // JANGAN trust p.isSaved dari Store secara langsung karena isMyContact dari Store
        // bisa false positive untuk kontak seperti Halaqoh Meta
        const saved = isYou || Boolean(p.phone && p.phone !== '-' && savedPhonesCache.has(p.phone));
        if (!contactsMap.has(key)) {
          contactsMap.set(key, {
            phone: p.phone || '-', name: p.name || '', groupName: event.data.groupTitle || activeGroupName,
            isAdmin: Boolean(p.isAdmin), isSaved: saved
          });
        } else {
          const existing = contactsMap.get(key);
          if (p.phone && p.phone !== '-' && (!existing.phone || existing.phone === '-')) {
            existing.phone = p.phone;
          }
          // Hanya set saved=true jika sumber data mengkonfirmasi saved
          if (saved && isYou) {
            existing.isSaved = true;
          }
          if (p.isAdmin) {
            existing.isAdmin = true;
          }
        }
      }
      updateUI();
    }
  });

  /* ══════════════════════════════════════════════════════════════
     CSV MATCHING MODULE
     ══════════════════════════════════════════════════════════════ */
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function switchTab(tab) {
    if (activeTab === tab) return;
    activeTab = tab;

    const btnScrape = document.getElementById('ws-tab-btn-scrape');
    const btnMatch = document.getElementById('ws-tab-btn-match');
    const paneScrape = document.getElementById('ws-pane-scrape');
    const paneMatch = document.getElementById('ws-pane-match');
    const footerScrape = document.getElementById('ws-footer-scrape');
    const footerMatch = document.getElementById('ws-footer-match');

    if (btnScrape && btnMatch) {
      btnScrape.classList.toggle('ws-tab-active', tab === 'scrape');
      btnMatch.classList.toggle('ws-tab-active', tab === 'match');
    }
    if (paneScrape && paneMatch) {
      paneScrape.classList.toggle('ws-pane-hidden', tab !== 'scrape');
      paneMatch.classList.toggle('ws-pane-hidden', tab !== 'match');
    }
    if (footerScrape && footerMatch) {
      footerScrape.classList.toggle('ws-pane-hidden', tab !== 'scrape');
      footerMatch.classList.toggle('ws-pane-hidden', tab !== 'match');
    }

    if (tab === 'match') {
      renderCSVMatchingUI();
    }
  }

  function handleFileSelected(file) {
    if (!file) return;
    const lowerName = (file.name || '').toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.txt') && !file.type.includes('csv') && !file.type.includes('text')) {
      showToast('Harap pilih file dengan format CSV (.csv)', 'warning');
      return;
    }

    showToast('Membaca file CSV...', 'info', 1500);
    const reader = new FileReader();
    reader.onload = function (e) {
      const text = e.target.result;
      if (!text || text.trim().length === 0) {
        showToast('File CSV kosong!', 'error');
        return;
      }

      if (!window.WACSVMatcher) {
        showToast('Modul WACSVMatcher belum siap.', 'error');
        return;
      }

      const analysis = window.WACSVMatcher.analyzeCSV(text);
      if (analysis.totalRows === 0 || analysis.headers.length === 0) {
        showToast('Tidak ada data baris yang ditemukan dalam file CSV.', 'error');
        return;
      }

      csvState.fileName = file.name;
      csvState.fileSizeStr = formatBytes(file.size);
      csvState.rawCSVText = text;
      csvState.analysis = analysis;
      csvState.selectedPhoneCol = analysis.suggestedPhoneCol >= 0 ? analysis.suggestedPhoneCol : 0;
      csvState.selectedPhone2Col = analysis.suggestedPhone2Col;
      csvState.selectedNameCol = analysis.suggestedNameCol;
      csvState.step = 2; // Pindah ke wizard langkah 2 (Pilih Kolom)
      csvState.matchedResults = null;

      renderCSVMatchingUI();
      showToast(`Berhasil membaca ${analysis.totalRows} baris data. Silakan pilih kolom.`, 'success', 3000);
    };
    reader.onerror = function () {
      showToast('Gagal membaca file CSV.', 'error');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function renderCSVMatchingUI() {
    const container = document.getElementById('ws-match-container');
    const footer = document.getElementById('ws-footer-match');
    if (!container) return;

    const step = csvState.step;

    // Indikator langkah wizard
    const stepsHtml = `
      <div class="ws-wizard-steps">
        <div class="ws-wstep ${step === 1 ? 'active' : 'completed'}">
          <span class="ws-wstep-num">1</span> Upload CSV
        </div>
        <div class="ws-wstep-line"></div>
        <div class="ws-wstep ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}">
          <span class="ws-wstep-num">2</span> Pilih Kolom
        </div>
        <div class="ws-wstep-line"></div>
        <div class="ws-wstep ${step === 3 ? 'active' : ''}">
          <span class="ws-wstep-num">3</span> Hasil & Tindakan
        </div>
      </div>
    `;

    if (step === 1) {
      renderStep1(container, stepsHtml);
      if (footer) footer.innerHTML = '';
    } else if (step === 2) {
      renderStep2(container, stepsHtml);
      if (footer) footer.innerHTML = '';
    } else if (step === 3) {
      renderStep3(container, stepsHtml);
      renderStep3Footer(footer);
    }
  }

  function renderStep1(container, stepsHtml) {
    const groupCount = contactsMap.size;
    const isReady = groupCount > 0;
    const groupTitle = activeGroupName || 'Grup WhatsApp';

    const readinessHtml = isReady
      ? `<div class="ws-readiness-banner ready">
           <div class="ws-readiness-left">
             ${ICONS.check}
             <span>Siap membandingkan dengan <b>${groupCount} anggota</b> dari grup "<b>${groupTitle}</b>"</span>
           </div>
         </div>`
      : `<div class="ws-readiness-banner not-ready">
           <div class="ws-readiness-left">
             ${ICONS.shield}
             <span>Belum ada data anggota grup yang di-scrape. Hasil perbandingan akan lebih akurat jika Anda scrape grup terlebih dahulu.</span>
           </div>
           <button class="ws-readiness-btn" id="ws-btn-step1-scrape">Scrape Sekarang</button>
         </div>`;

    container.innerHTML = `
      ${stepsHtml}
      <div style="padding:14px;">
        ${readinessHtml}

        <div class="ws-guide-box">
          <div class="ws-guide-header">
            ${ICONS.info}
            <span>Panduan Pencocokan Data CSV</span>
          </div>
          <ol class="ws-guide-list">
            <li><b>Upload file CSV</b> Anda (data pendaftar, leads, siswa, atau pelanggan).</li>
            <li><b>Pilih kolom header</b> yang memuat nomor WhatsApp pada langkah berikutnya.</li>
            <li>Sistem akan menyaring secara otomatis nomor mana saja yang <b>belum masuk grup</b>.</li>
          </ol>
          <div class="ws-guide-tip">
            ${ICONS.check} Mendukung 1 atau 2 kolom nomor WhatsApp sekaligus (misal nomor utama & cadangan/kantor), awalan 08xx, 62xx, atau 8xx.
          </div>
        </div>

        <div class="ws-dropzone" id="ws-dropzone">
          <div class="ws-dropzone-icon">${ICONS.upload}</div>
          <div class="ws-dropzone-title">Pilih File CSV atau Seret ke Sini</div>
          <div class="ws-dropzone-sub">Mendukung file <b>.csv</b> (Excel, Google Sheets, CRM)</div>
          <input type="file" id="ws-file-input" accept=".csv,text/csv,text/plain" style="display:none;" />
        </div>
      </div>
    `;

    const dropzone = container.querySelector('#ws-dropzone');
    const fileInput = container.querySelector('#ws-file-input');
    const scrapeBtn = container.querySelector('#ws-btn-step1-scrape');

    if (scrapeBtn) {
      scrapeBtn.addEventListener('click', () => switchTab('scrape'));
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) {
          handleFileSelected(e.target.files[0]);
        }
      });

      ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, e => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, e => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', e => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFileSelected(e.dataTransfer.files[0]);
        }
      });
    }
  }

  function renderStep2(container, stepsHtml) {
    const analysis = csvState.analysis;
    if (!analysis) {
      csvState.step = 1;
      renderCSVMatchingUI();
      return;
    }

    const headers = analysis.headers;
    const phoneOptions = headers.map((h, idx) => {
      const selected = idx === csvState.selectedPhoneCol ? 'selected' : '';
      return `<option value="${idx}" ${selected}>Kolom ${idx + 1}: ${h}</option>`;
    }).join('');

    const phone2Options = headers.map((h, idx) => {
      const selected = idx === csvState.selectedPhone2Col ? 'selected' : '';
      return `<option value="${idx}" ${selected}>Kolom ${idx + 1}: ${h}</option>`;
    }).join('');

    const nameOptions = headers.map((h, idx) => {
      const selected = idx === csvState.selectedNameCol ? 'selected' : '';
      return `<option value="${idx}" ${selected}>Kolom ${idx + 1}: ${h}</option>`;
    }).join('');

    container.innerHTML = `
      ${stepsHtml}
      <div style="padding:14px;" class="ws-mapper-wrap">
        <div class="ws-file-meta">
          <div class="ws-file-info">
            ${ICONS.file}
            <span>${csvState.fileName} (${csvState.fileSizeStr})</span>
          </div>
          <span class="ws-file-rows">${analysis.totalRows} baris data</span>
        </div>

        <div class="ws-field-card">
          <div class="ws-field-label">
            <span>Kolom Nomor WhatsApp Utama (1)</span>
            <span class="ws-field-tag required">Wajib</span>
          </div>
          <select class="ws-select" id="ws-select-phone-col">
            ${phoneOptions}
          </select>
          <div class="ws-preview-box">
            <div class="ws-preview-title">Contoh isi kolom terpilih:</div>
            <div id="ws-preview-phone-samples"></div>
          </div>
        </div>

        <div class="ws-field-card">
          <div class="ws-field-label">
            <span>Kolom Nomor WhatsApp Kedua (Opsional / Cadangan)</span>
            <span class="ws-field-tag optional">Opsional</span>
          </div>
          <select class="ws-select" id="ws-select-phone2-col">
            <option value="-1" ${csvState.selectedPhone2Col === -1 ? 'selected' : ''}>-- Tidak Ada (Hanya 1 Kolom Nomor) --</option>
            ${phone2Options}
          </select>
          <div class="ws-preview-box">
            <div class="ws-preview-title">Contoh isi kolom terpilih:</div>
            <div id="ws-preview-phone2-samples"></div>
          </div>
        </div>

        <div class="ws-field-card">
          <div class="ws-field-label">
            <span>Kolom Nama / Identitas</span>
            <span class="ws-field-tag optional">Opsional</span>
          </div>
          <select class="ws-select" id="ws-select-name-col">
            <option value="-1" ${csvState.selectedNameCol === -1 ? 'selected' : ''}>-- Tanpa Kolom Nama --</option>
            ${nameOptions}
          </select>
          <div class="ws-preview-box">
            <div class="ws-preview-title">Contoh isi kolom terpilih:</div>
            <div id="ws-preview-name-samples"></div>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:6px;">
          <button class="ws-btn ws-btn-outline" id="ws-btn-step2-back" style="flex:1;">
            ${ICONS.arrowLeft} Ganti File
          </button>
          <button class="ws-btn ws-btn-primary" id="ws-btn-step2-match" style="flex:2;">
            ${ICONS.bolt} Mulai Pencocokan Data
          </button>
        </div>
      </div>
    `;

    const phoneSelect = container.querySelector('#ws-select-phone-col');
    const phone2Select = container.querySelector('#ws-select-phone2-col');
    const nameSelect = container.querySelector('#ws-select-name-col');
    const phoneSampleBox = container.querySelector('#ws-preview-phone-samples');
    const phone2SampleBox = container.querySelector('#ws-preview-phone2-samples');
    const nameSampleBox = container.querySelector('#ws-preview-name-samples');

    function updatePhonePreview() {
      const colIdx = parseInt(phoneSelect.value, 10);
      csvState.selectedPhoneCol = colIdx;
      const samples = (analysis.samplesByCol && analysis.samplesByCol[colIdx]) || [];
      if (samples.length === 0) {
        phoneSampleBox.innerHTML = '<span style="color:var(--ws-text-3);">(Kolom kosong pada baris awal)</span>';
      } else {
        const previewRows = samples.map((s, i) => `<div class="ws-preview-item">Baris ${i + 1}: ${s}</div>`).join('');
        const headerName = (analysis.headers[colIdx] || '').toLowerCase().trim();
        const looksLikeRowIndex = samples.every(s => /^\d{1,4}$/.test(s.trim())) || /^(no|no\.|nomor|id|no kursi|no meja|npsn)$/i.test(headerName);

        if (looksLikeRowIndex) {
          phoneSampleBox.innerHTML = previewRows + `
            <div style="color:#fbbf24;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:4px;padding:6px 8px;margin-top:6px;font-size:11px;">
              ⚠️ <b>Peringatan:</b> Kolom ini tampaknya adalah nomor urut/ID (${samples.join(', ')}), bukan nomor telepon. Pastikan memilih kolom yang memuat nomor WhatsApp (misal awalan 08xx, 62xx, atau 8xx).
            </div>`;
        } else {
          phoneSampleBox.innerHTML = previewRows;
        }
      }
    }

    function updatePhone2Preview() {
      const colIdx = parseInt(phone2Select.value, 10);
      csvState.selectedPhone2Col = colIdx;
      if (colIdx < 0) {
        phone2SampleBox.innerHTML = '<span style="color:var(--ws-text-3);">(Hanya menggunakan 1 nomor telepon per peserta)</span>';
        return;
      }
      const samples = (analysis.samplesByCol && analysis.samplesByCol[colIdx]) || [];
      if (samples.length === 0) {
        phone2SampleBox.innerHTML = '<span style="color:var(--ws-text-3);">(Kolom kosong pada baris awal)</span>';
      } else {
        const previewRows = samples.map((s, i) => `<div class="ws-preview-item">Baris ${i + 1}: ${s}</div>`).join('');
        phone2SampleBox.innerHTML = previewRows;
      }
    }

    function updateNamePreview() {
      const colIdx = parseInt(nameSelect.value, 10);
      csvState.selectedNameCol = colIdx;
      if (colIdx < 0) {
        nameSampleBox.innerHTML = '<span style="color:var(--ws-text-3);">(Tidak menggunakan kolom nama)</span>';
        return;
      }
      const samples = (analysis.samplesByCol && analysis.samplesByCol[colIdx]) || [];
      if (samples.length === 0) {
        nameSampleBox.innerHTML = '<span style="color:var(--ws-text-3);">(Kolom kosong pada baris awal)</span>';
      } else {
        nameSampleBox.innerHTML = samples.map((s, i) => `<div class="ws-preview-item">Baris ${i + 1}: ${s}</div>`).join('');
      }
    }

    phoneSelect.addEventListener('change', updatePhonePreview);
    phone2Select.addEventListener('change', updatePhone2Preview);
    nameSelect.addEventListener('change', updateNamePreview);
    updatePhonePreview();
    updatePhone2Preview();
    updateNamePreview();

    container.querySelector('#ws-btn-step2-back').addEventListener('click', () => {
      csvState.step = 1;
      renderCSVMatchingUI();
    });

    container.querySelector('#ws-btn-step2-match').addEventListener('click', () => {
      const phoneIdx = parseInt(phoneSelect.value, 10);
      if (isNaN(phoneIdx) || phoneIdx < 0) {
        showToast('Pilih kolom yang berisi nomor telepon!', 'warning');
        return;
      }

      const phone2Idx = parseInt(phone2Select.value, 10);
      const nameIdx = parseInt(nameSelect.value, 10);

      const results = window.WACSVMatcher.matchData(
        analysis.rows,
        analysis.headers,
        phoneIdx,
        nameIdx,
        contactsMap,
        phone2Idx
      );

      if (results.summary.invalid === results.summary.total && results.summary.total > 0) {
        showToast(`Semua data berstatus tidak valid. Kolom "${analysis.headers[phoneIdx]}" bukan kolom nomor telepon WhatsApp. Silakan pilih kolom yang sesuai.`, 'error', 5500);
        return;
      }

      csvState.matchedResults = results;
      csvState.step = 3;
      csvState.filterStatus = 'not_in_group';
      csvState.searchKeyword = '';

      renderCSVMatchingUI();
      showToast(`Pencocokan selesai! ${results.summary.notInGroup} peserta belum masuk grup.`, 'success', 4000);
    });
  }

  function renderStep3(container, stepsHtml) {
    const results = csvState.matchedResults;
    if (!results) {
      csvState.step = 1;
      renderCSVMatchingUI();
      return;
    }

    const { summary } = results;

    const col1Title = (csvState.selectedPhoneCol >= 0 && csvState.analysis && csvState.analysis.headers[csvState.selectedPhoneCol])
      ? csvState.analysis.headers[csvState.selectedPhoneCol].replace(/^no\s*(whatsapp|wa|hp)?\s*/i, '').trim() || 'No Utama'
      : 'No Utama';
    const col2Title = (csvState.selectedPhone2Col >= 0 && csvState.analysis && csvState.analysis.headers[csvState.selectedPhone2Col])
      ? csvState.analysis.headers[csvState.selectedPhone2Col].replace(/^no\s*(whatsapp|wa|hp)?\s*/i, '').trim() || 'No Kedua'
      : 'No Kedua';

    const dualBreakdownHtml = summary.hasDualPhone ? `
      <div class="ws-dual-breakdown">
        <div class="ws-db-item" title="Data di mana kedua nomor berada di dalam grup (dihitung 2 nomor per baris)">
          <span class="ws-db-dot both"></span>
          <span><b>${summary.bothInGroupCount}</b> Keduanya Masuk (<b>${summary.bothInGroupCount * 2}</b> no)</span>
        </div>
        <div class="ws-db-item" title="Hanya nomor ${col1Title} yang ada di grup">
          <span class="ws-db-dot p1"></span>
          <span><b>${summary.phone1OnlyCount}</b> ${col1Title} Saja</span>
        </div>
        <div class="ws-db-item" title="Hanya nomor ${col2Title} yang ada di grup">
          <span class="ws-db-dot p2"></span>
          <span><b>${summary.phone2OnlyCount}</b> ${col2Title} Saja</span>
        </div>
        <div style="margin-left:auto;font-size:10.5px;color:var(--ws-text-2);">
          Total di grup: <b style="color:var(--ws-accent);font-size:11px;">${summary.totalPhonesInGroup} nomor WA</b>
        </div>
      </div>
    ` : '';

    const bothPillBtn = (summary.hasDualPhone && summary.bothInGroupCount > 0)
      ? `<button class="ws-pill-btn ${csvState.filterStatus === 'both_in_group' ? 'active' : ''}" data-filter="both_in_group">
           Keduanya Masuk (${summary.bothInGroupCount})
         </button>`
      : '';

    container.innerHTML = `
      ${stepsHtml}
      <div style="padding:14px;display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;">
        <div class="ws-results-summary">
          <div class="ws-res-card highlight">
            <div class="ws-res-num not-in-group">${summary.notInGroup}</div>
            <div class="ws-res-label">Peserta Belum Masuk</div>
            ${summary.hasDualPhone ? `<div class="ws-res-subinfo">${summary.totalPhonesNotInGroup} nomor WA</div>` : ''}
          </div>
          <div class="ws-res-card">
            <div class="ws-res-num in-group">${summary.inGroup}</div>
            <div class="ws-res-label">Peserta Sudah Masuk</div>
            ${summary.hasDualPhone ? `<div class="ws-res-subinfo" style="color:var(--ws-accent);font-weight:600;">${summary.totalPhonesInGroup} Nomor WA di Grup</div>` : ''}
          </div>
          <div class="ws-res-card">
            <div class="ws-res-num total">${summary.total}</div>
            <div class="ws-res-label">Total Peserta CSV</div>
            ${summary.hasDualPhone ? `<div class="ws-res-subinfo">${summary.totalPhonesInGroup + summary.totalPhonesNotInGroup} nomor total</div>` : ''}
          </div>
        </div>

        ${dualBreakdownHtml}

        <div class="ws-filter-pills">
          <button class="ws-pill-btn pill-danger ${csvState.filterStatus === 'not_in_group' ? 'active' : ''}" data-filter="not_in_group">
            Belum Masuk (${summary.notInGroup})
          </button>
          <button class="ws-pill-btn ${csvState.filterStatus === 'in_group' ? 'active' : ''}" data-filter="in_group">
            Sudah Masuk (${summary.inGroup}${summary.hasDualPhone ? ` / ${summary.totalPhonesInGroup} No` : ''})
          </button>
          ${bothPillBtn}
          <button class="ws-pill-btn ${csvState.filterStatus === 'all' ? 'active' : ''}" data-filter="all">
            Semua Data (${summary.total})
          </button>
        </div>

        <div class="ws-search-wrap" style="margin-bottom:8px;">
          <div class="ws-search-icon">${ICONS.search}</div>
          <input type="text" class="ws-search-input" id="ws-match-search" placeholder="Cari nomor atau nama hasil..." autocomplete="off" spellcheck="false" />
          <button class="ws-search-clear" id="ws-match-search-clear" title="Hapus">${ICONS.x}</button>
        </div>
        <div class="ws-search-meta" style="margin-bottom:6px;">
          <span>Menampilkan <b id="ws-match-search-count" style="color:var(--ws-accent);">0</b> data</span>
          <span style="opacity:0.5;">Klik ikon untuk salin nomor</span>
        </div>

        <div class="ws-table-wrap" style="flex:1;">
          <table class="ws-table">
            <thead>
              <tr>
                <th style="width:34px;">No</th>
                <th>Nomor WhatsApp</th>
                <th>Nama / Identitas</th>
                <th style="width:125px;">Status Grup</th>
              </tr>
            </thead>
            <tbody id="ws-match-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    // Filter pill bindings
    container.querySelectorAll('.ws-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.ws-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        csvState.filterStatus = btn.dataset.filter;
        renderMatchTable();
        // Update copy button label in footer
        const copyBtn = document.getElementById('ws-btn-match-copy');
        if (copyBtn) {
          if (csvState.filterStatus === 'not_in_group') {
            copyBtn.innerHTML = `${ICONS.copy} Salin Belum Masuk (${summary.notInGroup}${summary.hasDualPhone ? ` / ${summary.totalPhonesNotInGroup} No` : ''})`;
          } else if (csvState.filterStatus === 'in_group') {
            copyBtn.innerHTML = `${ICONS.copy} Salin Sudah Masuk (${summary.totalPhonesInGroup} No)`;
          } else if (csvState.filterStatus === 'both_in_group') {
            copyBtn.innerHTML = `${ICONS.copy} Salin Keduanya Masuk (${summary.bothInGroupCount * 2} No)`;
          } else {
            copyBtn.innerHTML = `${ICONS.copy} Salin Semua Nomor (${summary.total})`;
          }
        }
      });
    });

    // Search input
    const matchSearch = container.querySelector('#ws-match-search');
    const matchSearchClear = container.querySelector('#ws-match-search-clear');

    ['keydown', 'keyup', 'keypress'].forEach(evt => {
      matchSearch.addEventListener(evt, e => e.stopPropagation());
    });

    matchSearch.addEventListener('input', e => {
      csvState.searchKeyword = e.target.value;
      if (matchSearchClear) matchSearchClear.style.display = e.target.value ? 'flex' : 'none';
      renderMatchTable();
    });

    if (matchSearchClear) {
      matchSearchClear.addEventListener('click', () => {
        matchSearch.value = '';
        csvState.searchKeyword = '';
        matchSearchClear.style.display = 'none';
        matchSearch.focus();
        renderMatchTable();
      });
    }

    // Table copy delegation
    const tbody = container.querySelector('#ws-match-tbody');
    tbody.addEventListener('click', async e => {
      const btn = e.target.closest('.ws-copy-btn');
      if (btn) {
        const ph = btn.dataset.phone;
        if (ph && ph !== '-') {
          await window.WAExporter.writeToClipboard(ph);
          btn.innerHTML = ICONS.check;
          btn.style.color = 'var(--ws-accent)';
          btn.style.borderColor = 'var(--ws-accent)';
          setTimeout(() => { btn.innerHTML = ICONS.copy; btn.style.color = ''; btn.style.borderColor = ''; }, 1500);
        }
      }
    });

    renderMatchTable();
  }

  function renderMatchTable() {
    const tbody = document.getElementById('ws-match-tbody');
    const countEl = document.getElementById('ws-match-search-count');
    if (!tbody || !csvState.matchedResults) return;

    const items = csvState.matchedResults.items;
    const filter = csvState.filterStatus;
    const kw = (csvState.searchKeyword || '').toLowerCase().trim();
    const kwDigits = kw.replace(/[^\d+]/g, '');

    const filtered = items.filter(item => {
      if (filter === 'not_in_group' && item.status !== 'not_in_group') return false;
      if (filter === 'in_group' && item.status !== 'in_group') return false;
      if (filter === 'both_in_group' && item.matchDetail !== 'both') return false;
      if (!kw) return true;
      const matchName = item.name && item.name.toLowerCase().includes(kw);
      const matchPhone1 = kwDigits.length > 0 && (
        (item.cleanPhone && item.cleanPhone.replace(/[^\d+]/g, '').includes(kwDigits)) ||
        (item.rawPhone && item.rawPhone.replace(/[^\d+]/g, '').includes(kwDigits))
      );
      const matchPhone2 = kwDigits.length > 0 && (
        (item.cleanPhone2 && item.cleanPhone2.replace(/[^\d+]/g, '').includes(kwDigits)) ||
        (item.rawPhone2 && item.rawPhone2.replace(/[^\d+]/g, '').includes(kwDigits))
      );
      return matchName || matchPhone1 || matchPhone2;
    });

    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="ws-empty-row">Tidak ada data yang sesuai filter.</td></tr>`;
      return;
    }

    const col1Title = (csvState.selectedPhoneCol >= 0 && csvState.analysis && csvState.analysis.headers[csvState.selectedPhoneCol])
      ? csvState.analysis.headers[csvState.selectedPhoneCol].replace(/^no\s*(whatsapp|wa|hp)?\s*/i, '').trim() || 'No 1'
      : 'No 1';
    const col2Title = (csvState.selectedPhone2Col >= 0 && csvState.analysis && csvState.analysis.headers[csvState.selectedPhone2Col])
      ? csvState.analysis.headers[csvState.selectedPhone2Col].replace(/^no\s*(whatsapp|wa|hp)?\s*/i, '').trim() || 'No 2'
      : 'No 2';

    tbody.innerHTML = filtered.map((item, i) => {
      const ph1 = item.cleanPhone || item.rawPhone || '-';
      const dp1 = (window.WAPhoneParser && ph1.startsWith('+62')) ? window.WAPhoneParser.formatDisplay(ph1) : ph1;
      const canCopy1 = ph1 && ph1 !== '-';
      const cp1 = canCopy1 ? `<button class="ws-copy-btn" data-phone="${ph1}" title="Salin nomor utama">${ICONS.copy}</button>` : '';
      const tag1 = item.hasPhone2 && canCopy1
        ? `<span class="ws-tag-phone ${item.inGroup1 ? 'in' : 'out'}">${item.inGroup1 ? `🟢 ${col1Title} (Di Grup)` : `⚪ ${col1Title}`}</span>`
        : '';

      const hasPhone2 = item.hasPhone2 && (item.cleanPhone2 || (item.rawPhone2 && item.rawPhone2 !== '-'));
      let phone2Html = '';
      if (hasPhone2) {
        const ph2 = item.cleanPhone2 || item.rawPhone2 || '-';
        const dp2 = (window.WAPhoneParser && ph2.startsWith('+62')) ? window.WAPhoneParser.formatDisplay(ph2) : ph2;
        const canCopy2 = ph2 && ph2 !== '-';
        const cp2 = canCopy2 ? `<button class="ws-copy-btn" data-phone="${ph2}" title="Salin nomor ke-2">${ICONS.copy}</button>` : '';
        const tag2 = canCopy2
          ? `<span class="ws-tag-phone ${item.inGroup2 ? 'in' : 'out'}">${item.inGroup2 ? `🟢 ${col2Title} (Di Grup)` : `⚪ ${col2Title}`}</span>`
          : '';
        phone2Html = `
          <div class="ws-phone-cell ws-phone-secondary">
            <span>${dp2}</span>
            ${tag2}
            ${cp2}
          </div>
        `;
      }

      const nm = item.name && item.name !== '-' ? item.name : '<span style="color:var(--ws-text-3)">(Tanpa Nama)</span>';

      let statusBadge = '';
      if (item.status === 'not_in_group') {
        statusBadge = `<span class="ws-badge-status not-in-group">Belum Masuk</span>`;
      } else if (item.status === 'in_group') {
        let label = 'Sudah Masuk';
        if (item.matchDetail === 'both') label = 'Keduanya Masuk (2 No)';
        else if (item.matchDetail === 'phone1') label = `${col1Title} (1 No)`;
        else if (item.matchDetail === 'phone2') label = `${col2Title} (1 No)`;
        statusBadge = `<span class="ws-badge-status in-group">${label}</span>`;
      } else {
        statusBadge = `<span class="ws-badge-status invalid">Format Tidak Valid</span>`;
      }

      return `<tr>
        <td>${i + 1}</td>
        <td>
          <div class="ws-phone-cell">
            <span>${dp1}</span>
            ${tag1}
            ${cp1}
          </div>
          ${phone2Html}
        </td>
        <td>${nm}</td>
        <td>${statusBadge}</td>
      </tr>`;
    }).join('');
  }

  function renderStep3Footer(footer) {
    if (!footer || !csvState.matchedResults) return;
    const { summary } = csvState.matchedResults;

    const copyBtnText = summary.hasDualPhone
      ? `Salin Belum Masuk (${summary.notInGroup} Peserta / ${summary.totalPhonesNotInGroup} No)`
      : `Salin Belum Masuk (${summary.notInGroup})`;

    footer.innerHTML = `
      <button class="ws-footer-btn ws-footer-btn-primary" id="ws-btn-match-copy" title="Salin seluruh nomor pada filter aktif">
        ${ICONS.copy} ${copyBtnText}
      </button>
      <button class="ws-footer-btn ws-footer-btn-ghost" id="ws-btn-match-export" title="Download ke Excel (sel hijau) atau CSV">
        ${ICONS.download} Download Hasil
      </button>
      <button class="ws-footer-btn ws-footer-btn-icon" id="ws-btn-match-remap" title="Pilih Ulang Kolom">
        ${ICONS.arrowLeft}
      </button>
      <button class="ws-footer-btn ws-footer-btn-icon" id="ws-btn-match-reset" title="Ganti File CSV">
        ${ICONS.refresh}
      </button>
    `;

    footer.querySelector('#ws-btn-match-copy').addEventListener('click', async () => {
      const res = await window.WAExporter.copyMatchingNumbers(csvState.matchedResults.items, csvState.filterStatus);
      if (res.success) {
        const btn = footer.querySelector('#ws-btn-match-copy');
        const origText = btn.innerHTML;
        btn.innerHTML = `${ICONS.check} ${res.count} Nomor Disalin!`;
        showToast(`${res.count} nomor berhasil disalin ke clipboard! Siap digunakan untuk invite/broadcast.`, 'success');
        setTimeout(() => { btn.innerHTML = origText; }, 2000);
      } else {
        showToast('Tidak ada nomor valid untuk disalin.', 'warning');
      }
    });

    footer.querySelector('#ws-btn-match-export').addEventListener('click', async () => {
      const choice = await showExportChoiceDialog(summary);
      if (!choice) return;

      const groupTitle = activeGroupName || 'Grup WA';

      if (choice === 'excel') {
        const success = window.WAExporter.exportMatchingExcel(
          csvState.matchedResults.items,
          csvState.analysis.headers,
          groupTitle,
          csvState.selectedPhoneCol,
          csvState.selectedPhone2Col,
          'all'
        );
        if (success) {
          showToast('File Excel (.xls) lengkap dengan sel bertanda HIJAU berhasil diunduh!', 'success', 4500);
        }
      } else if (choice === 'csv_full') {
        const success = window.WAExporter.exportMatchingResults(
          csvState.matchedResults.items,
          csvState.analysis.headers,
          groupTitle,
          'all',
          csvState.selectedPhoneCol,
          csvState.selectedPhone2Col
        );
        if (success) {
          showToast('File CSV lengkap dengan penanda status grup berhasil diunduh.', 'success', 3500);
        }
      } else if (choice === 'csv_notin') {
        const success = window.WAExporter.exportMatchingResults(
          csvState.matchedResults.items,
          csvState.analysis.headers,
          groupTitle,
          'not_in_group',
          csvState.selectedPhoneCol,
          csvState.selectedPhone2Col
        );
        if (success) {
          showToast('Daftar nomor yang belum masuk grup berhasil diunduh.', 'success', 3500);
        }
      }
    });

    footer.querySelector('#ws-btn-match-remap').addEventListener('click', () => {
      csvState.step = 2;
      renderCSVMatchingUI();
    });

    footer.querySelector('#ws-btn-match-reset').addEventListener('click', () => {
      csvState.step = 1;
      csvState.matchedResults = null;
      renderCSVMatchingUI();
      showToast('Silakan pilih file CSV baru.', 'info');
    });
  }

  /* ══════════════════════════════════════════════════════════════
     UI: BUILD
     ══════════════════════════════════════════════════════════════ */
  function createScraperUI() {
    if (document.getElementById('wa-scraper-fab')) return;

    // FAB
    const fab = document.createElement('div');
    fab.id = 'wa-scraper-fab';
    fab.innerHTML = `<span class="fab-icon">${ICONS.users}</span><span>WA Scraper</span><span class="fab-badge" id="wa-fab-badge">0</span>`;
    fab.addEventListener('click', toggleModal);
    document.body.appendChild(fab);

    // Modal
    const modal = document.createElement('div');
    modal.id = 'wa-scraper-modal';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="ws-header" id="ws-drag-handle">
        <div class="ws-header-left">
          <div class="ws-logo">${ICONS.users}</div>
          <span class="ws-header-title">WA Group Scraper</span>
          <span class="ws-badge-version">v1.0.0</span>
        </div>
        <div class="ws-header-progress" id="ws-header-progress">
          <span id="ws-header-pct">0%</span>
        </div>
        <div class="ws-header-actions">
          <button class="ws-icon-btn" id="ws-btn-collapse" title="Collapse">${ICONS.minus}</button>
          <button class="ws-icon-btn" id="ws-btn-close" title="Tutup">${ICONS.x}</button>
        </div>
      </div>

      <div class="ws-tab-nav">
        <button class="ws-tab-btn ws-tab-active" id="ws-tab-btn-scrape">
          ${ICONS.users} Anggota Grup
          <span class="ws-tab-badge" id="ws-tab-badge-scrape">0</span>
        </button>
        <button class="ws-tab-btn" id="ws-tab-btn-match">
          ${ICONS.bolt} Cocokkan CSV
          <span class="ws-tab-badge" id="ws-tab-badge-match">Baru</span>
        </button>
      </div>

      <div class="ws-body" style="padding:0;display:flex;flex-direction:column;flex:1;overflow:hidden;">
        <!-- Tab 1: Scrape Anggota Grup -->
        <div class="ws-tab-pane" id="ws-pane-scrape" style="padding:14px;overflow-y:auto;">
          <div class="ws-status-card">
            <div class="ws-status-row">
              <span class="ws-label">Grup</span>
              <span class="ws-value" id="ws-status-group">Memeriksa...</span>
            </div>
            <div class="ws-status-row">
              <span class="ws-label">Mode</span>
              <span class="ws-value" style="color:var(--ws-text-2);font-size:11px;">Deep Scan (1.000+ anggota)</span>
            </div>
          </div>

          <div class="ws-actions">
            <button class="ws-btn ws-btn-primary" id="ws-btn-scrape">${ICONS.bolt} Scrape Semua Anggota</button>
            <button class="ws-btn ws-btn-outline" id="ws-btn-resume">${ICONS.play} Lanjutkan (Tambah)</button>
          </div>

          <div class="ws-progress-section" id="ws-progress">
            <div class="ws-progress-bar-wrap">
              <div class="ws-progress-bar-fill" id="ws-progress-fill"></div>
            </div>
            <div class="ws-progress-info">
              <span class="ws-progress-text" id="ws-progress-text">Memproses...</span>
              <span class="ws-progress-pct" id="ws-progress-pct">0%</span>
              <button class="ws-btn-stop" id="ws-btn-stop" title="Stop">${ICONS.stop}</button>
            </div>
          </div>

          <div class="ws-stats">
            <div class="ws-stat">
              <div class="ws-stat-num" id="ws-stat-total" style="color:var(--ws-text);">0</div>
              <div class="ws-stat-label">Total Anggota</div>
            </div>
            <div class="ws-stat">
              <div class="ws-stat-num" id="ws-stat-unsaved" style="color:var(--ws-accent);">0</div>
              <div class="ws-stat-label">Nomor Baru</div>
            </div>
            <div class="ws-stat">
              <div class="ws-stat-num" id="ws-stat-admin" style="color:#f87171;">0</div>
              <div class="ws-stat-label">Admin</div>
            </div>
          </div>

          <div class="ws-search-wrap">
            <div class="ws-search-icon">${ICONS.search}</div>
            <input type="text" class="ws-search-input" id="ws-search" placeholder="Cari nomor atau nama..." autocomplete="off" spellcheck="false" />
            <button class="ws-search-clear" id="ws-search-clear" title="Hapus pencarian">${ICONS.x}</button>
          </div>
          <div class="ws-search-meta">
            <span>Menampilkan <b id="ws-search-count" style="color:var(--ws-accent);">0</b> kontak</span>
            <span style="opacity:0.5;">Klik ikon salin nomor</span>
          </div>

          <div class="ws-table-wrap">
            <table class="ws-table" id="ws-table">
              <thead><tr>
                <th style="width:34px;">No</th>
                <th>Nomor WhatsApp</th>
                <th>Nama Kontak</th>
                <th style="width:50px;">Admin</th>
              </tr></thead>
              <tbody id="ws-tbody"><tr><td colspan="4" class="ws-empty-row">Buka grup → "Search members" → klik <b>Scrape</b></td></tr></tbody>
            </table>
          </div>
        </div>

        <!-- Tab 2: Cocokkan CSV -->
        <div class="ws-tab-pane ws-pane-hidden" id="ws-pane-match" style="padding:0;overflow-y:auto;">
          <div id="ws-match-container"></div>
        </div>
      </div>

      <div class="ws-footer" id="ws-footer-scrape">
        <button class="ws-footer-btn ws-footer-btn-primary" id="ws-btn-csv">${ICONS.download} CSV</button>
        <button class="ws-footer-btn ws-footer-btn-ghost" id="ws-btn-copy">${ICONS.copy} Salin</button>
        <button class="ws-footer-btn ws-footer-btn-icon" id="ws-btn-reset" title="Hapus data">${ICONS.trash}</button>
      </div>

      <div class="ws-footer ws-pane-hidden" id="ws-footer-match">
      </div>

      <!-- 8-way Window Resize Handles -->
      <div class="ws-resize-handle ws-rh-t" data-dir="t"></div>
      <div class="ws-resize-handle ws-rh-b" data-dir="b"></div>
      <div class="ws-resize-handle ws-rh-l" data-dir="l"></div>
      <div class="ws-resize-handle ws-rh-r" data-dir="r"></div>
      <div class="ws-resize-handle ws-rh-tl" data-dir="tl"></div>
      <div class="ws-resize-handle ws-rh-tr" data-dir="tr"></div>
      <div class="ws-resize-handle ws-rh-bl" data-dir="bl"></div>
      <div class="ws-resize-handle ws-rh-br" data-dir="br"></div>
    `;
    document.body.appendChild(modal);

    // Stop keyboard shortcuts leaking from modal to WA Web
    ['keydown', 'keyup', 'keypress'].forEach(evt => {
      modal.addEventListener(evt, e => e.stopPropagation());
    });

    // Bindings
    document.getElementById('ws-btn-close').addEventListener('click', toggleModal);
    document.getElementById('ws-btn-collapse').addEventListener('click', toggleCollapse);
    document.getElementById('ws-tab-btn-scrape').addEventListener('click', () => switchTab('scrape'));
    document.getElementById('ws-tab-btn-match').addEventListener('click', () => switchTab('match'));
    document.getElementById('ws-btn-scrape').addEventListener('click', () => executeFullScrape(true));
    document.getElementById('ws-btn-resume').addEventListener('click', () => executeFullScrape(false));
    document.getElementById('ws-btn-stop').addEventListener('click', () => { isScrapingActive = false; updateProgressUI(); });
    document.getElementById('ws-btn-csv').addEventListener('click', () => {
      if (contactsMap.size === 0) {
        showToast('Belum ada data untuk diekspor.', 'warning');
        return;
      }
      window.WAExporter.exportToCSV(Array.from(contactsMap.values()), `wa-grup-${activeGroupName}`);
      showToast(`${contactsMap.size} kontak berhasil diekspor ke CSV.`, 'success');
    });
    document.getElementById('ws-btn-copy').addEventListener('click', async () => {
      if (contactsMap.size === 0) {
        showToast('Belum ada nomor untuk disalin.', 'warning');
        return;
      }
      const ok = await window.WAExporter.copyNumbersOnly(Array.from(contactsMap.values()));
      if (ok) {
        const btn = document.getElementById('ws-btn-copy');
        btn.innerHTML = `${ICONS.check} Disalin!`;
        showToast(`${contactsMap.size} nomor berhasil disalin ke clipboard.`, 'success');
        setTimeout(() => { btn.innerHTML = `${ICONS.copy} Salin`; }, 2000);
      }
    });
    document.getElementById('ws-btn-reset').addEventListener('click', async () => {
      if (contactsMap.size === 0) return;
      const confirmed = await showConfirm({
        title: 'Hapus Semua Data?',
        message: `${contactsMap.size} kontak yang sudah di-scrape akan dihapus permanen. Pastikan kamu sudah mengekspor data jika diperlukan.`,
        type: 'danger',
        confirmText: 'Ya, Hapus',
        cancelText: 'Batal'
      });
      if (confirmed) {
        contactsMap.clear();
        updateUI();
        showToast('Semua data berhasil dihapus.', 'info');
      }
    });

    // Search Input: perlindungan klik & ketik agar selalu fokus dan responsif
    const searchEl = document.getElementById('ws-search');
    const searchClear = document.getElementById('ws-search-clear');

    ['keydown', 'keyup', 'keypress'].forEach(evt => {
      searchEl.addEventListener(evt, e => e.stopPropagation());
    });

    searchEl.addEventListener('click', e => {
      searchEl.focus();
    });

    searchEl.addEventListener('input', e => {
      if (searchClear) searchClear.style.display = searchEl.value ? 'flex' : 'none';
      renderTable(searchEl.value);
    });

    if (searchClear) {
      searchClear.addEventListener('click', e => {
        searchEl.value = '';
        searchClear.style.display = 'none';
        searchEl.focus();
        renderTable('');
      });
    }

    // Copy button delegation
    document.getElementById('ws-tbody').addEventListener('click', async e => {
      const btn = e.target.closest('.ws-copy-btn');
      if (btn) {
        const ph = btn.dataset.phone;
        if (ph && ph !== '-') {
          await window.WAExporter.writeToClipboard(ph);
          btn.innerHTML = ICONS.check;
          btn.style.color = 'var(--ws-accent)';
          btn.style.borderColor = 'var(--ws-accent)';
          setTimeout(() => { btn.innerHTML = ICONS.copy; btn.style.color = ''; btn.style.borderColor = ''; }, 1500);
        }
      }
    });

    // Drag & Drop + Edge Resizing
    initDrag(modal, document.getElementById('ws-drag-handle'));
    initResize(modal);

    setInterval(updateActiveStatus, 1500);
  }

  /* ══════════════════════════════════════════════════════════════
     DRAG & DROP
     ══════════════════════════════════════════════════════════════ */
  function initDrag(modal, handle) {
    let isDragging = false;
    let startX, startY, origLeft, origTop;

    handle.addEventListener('mousedown', e => {
      if (e.target.closest('.ws-icon-btn') || e.target.closest('.ws-resize-handle')) return;
      isDragging = true;
      const rect = modal.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      origLeft = rect.left;
      origTop = rect.top;

      modal.style.left = origLeft + 'px';
      modal.style.top = origTop + 'px';
      modal.style.right = 'auto';
      modal.style.bottom = 'auto';
      modal.style.width = rect.width + 'px';
      if (!modal.classList.contains('ws-collapsed')) {
        modal.style.height = rect.height + 'px';
      }
      modal.style.transition = 'none';
      document.body.style.userSelect = 'none';

      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newLeft = origLeft + dx;
      let newTop = origTop + dy;

      const w = modal.offsetWidth;
      const h = modal.offsetHeight;
      newLeft = Math.max(0, Math.min(window.innerWidth - w, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - h, newTop));

      modal.style.left = newLeft + 'px';
      modal.style.top = newTop + 'px';
      modal.style.right = 'auto';
      modal.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        modal.style.transition = '';
        document.body.style.userSelect = '';
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     RESIZE (8-WAY: TOP, BOTTOM, LEFT, RIGHT, CORNERS)
     ══════════════════════════════════════════════════════════════ */
  function initResize(modal) {
    const handles = modal.querySelectorAll('.ws-resize-handle');
    let isResizing = false;
    let currentDir = '';
    let startX = 0, startY = 0;
    let startW = 0, startH = 0;
    let startLeft = 0, startTop = 0;

    const MIN_W = 340;
    const MIN_H = 300;

    handles.forEach(h => {
      h.addEventListener('mousedown', e => {
        if (modal.classList.contains('ws-collapsed')) return;
        isResizing = true;
        currentDir = h.dataset.dir;

        const rect = modal.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startW = rect.width;
        startH = rect.height;
        startLeft = rect.left;
        startTop = rect.top;

        modal.style.left = startLeft + 'px';
        modal.style.top = startTop + 'px';
        modal.style.right = 'auto';
        modal.style.bottom = 'auto';
        modal.style.width = startW + 'px';
        modal.style.height = startH + 'px';
        modal.style.transition = 'none';
        document.body.style.userSelect = 'none';

        e.preventDefault();
        e.stopPropagation();
      });
    });

    document.addEventListener('mousemove', e => {
      if (!isResizing) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Horizontal resizing
      if (currentDir.includes('r')) {
        const maxW = window.innerWidth - startLeft - 10;
        const newW = Math.min(Math.max(MIN_W, startW + dx), maxW);
        modal.style.width = newW + 'px';
      } else if (currentDir.includes('l')) {
        const maxDelta = startW - MIN_W;
        const boundedDx = Math.min(Math.max(-startLeft + 10, dx), maxDelta);
        modal.style.width = (startW - boundedDx) + 'px';
        modal.style.left = (startLeft + boundedDx) + 'px';
      }

      // Vertical resizing
      if (currentDir.includes('b')) {
        const maxH = window.innerHeight - startTop - 10;
        const newH = Math.min(Math.max(MIN_H, startH + dy), maxH);
        modal.style.height = newH + 'px';
      } else if (currentDir.includes('t')) {
        const maxDelta = startH - MIN_H;
        const boundedDy = Math.min(Math.max(-startTop + 10, dy), maxDelta);
        modal.style.height = (startH - boundedDy) + 'px';
        modal.style.top = (startTop + boundedDy) + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        modal.style.transition = '';
        document.body.style.userSelect = '';
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     COLLAPSE / EXPAND
     ══════════════════════════════════════════════════════════════ */
  function toggleCollapse() {
    const modal = document.getElementById('wa-scraper-modal');
    const btn = document.getElementById('ws-btn-collapse');
    if (!modal) return;
    const isCollapsed = modal.classList.toggle('ws-collapsed');
    btn.innerHTML = isCollapsed ? ICONS.expand : ICONS.minus;
    btn.title = isCollapsed ? 'Expand' : 'Collapse';
  }

  function toggleModal() {
    const m = document.getElementById('wa-scraper-modal');
    if (!m) return;
    const h = m.style.display === 'none';
    m.style.display = h ? 'flex' : 'none';
    if (h) {
      if (!m.style.width) m.style.width = '440px';
      if (!m.style.height) m.style.height = '640px';
      updateActiveStatus();
      updateUI();
    }
  }

  function updateActiveStatus() {
    const el = document.getElementById('ws-status-group');
    if (!el) return;
    const ci = getActiveChatInfo();
    el.textContent = ci ? ci.title : 'Tidak ada obrolan';
    if (ci && ci.title !== activeGroupName) {
      activeGroupName = ci.title;
      if (activeTab === 'match' && csvState.step === 1) {
        renderCSVMatchingUI();
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     UI: UPDATE & RENDER
     ══════════════════════════════════════════════════════════════ */
  function updateUI() {
    let total = contactsMap.size, unsaved = 0, admin = 0;
    for (const c of contactsMap.values()) { if (!c.isSaved) unsaved++; if (c.isAdmin) admin++; }
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('ws-stat-total', total); el('ws-stat-unsaved', unsaved); el('ws-stat-admin', admin);
    const badge = document.getElementById('wa-fab-badge');
    if (badge) { badge.style.display = total > 0 ? 'inline-block' : 'none'; badge.textContent = total; }
    const tabBadge = document.getElementById('ws-tab-badge-scrape');
    if (tabBadge) tabBadge.textContent = total;
    if (activeTab === 'match' && csvState.step === 1) {
      renderCSVMatchingUI();
    }
    renderTable(document.getElementById('ws-search')?.value || '');
  }

  function renderTable(kw = '') {
    const tbody = document.getElementById('ws-tbody');
    const countEl = document.getElementById('ws-search-count');
    if (!tbody) return;

    const items = Array.from(contactsMap.values());
    const k = (kw || '').toLowerCase().trim();
    const kDigits = k.replace(/[^\d+]/g, '');

    const filtered = items.filter(i => {
      if (!k) return true;
      const matchName = Boolean(i.name && i.name.toLowerCase().includes(k));
      const matchPhone = Boolean(kDigits.length > 0 && i.phone && i.phone.replace(/[^\d+]/g, '').includes(kDigits));
      return matchName || matchPhone;
    });

    if (countEl) countEl.textContent = filtered.length;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="ws-empty-row">${items.length ? 'Tidak ada kontak yang cocok.' : 'Belum ada data.'}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((item, i) => {
      const ok = item.phone && item.phone !== '-' && item.phone.startsWith('+62');
      const dp = ok ? window.WAPhoneParser.formatDisplay(item.phone) : (item.phone || '-');
      const nm = item.name || '<span style="color:var(--ws-text-3)">(Tanpa Nama)</span>';
      const adm = item.isAdmin ? '<span class="ws-badge ws-badge-admin">Admin</span>' : '<span style="color:var(--ws-text-3)">—</span>';
      const cp = ok ? `<button class="ws-copy-btn" data-phone="${item.phone}" title="Salin nomor">${ICONS.copy}</button>` : '';
      return `<tr><td>${i+1}</td><td><div class="ws-phone-cell"><span>${dp}</span>${cp}</div></td><td>${nm}</td><td>${adm}</td></tr>`;
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════ */
  function init() {
    const iv = setInterval(() => {
      if (document.querySelector('#app') || document.querySelector('#main')) {
        clearInterval(iv);
        createScraperUI();
        loadNameToPhoneMap();
        window.postMessage({ source: 'WA_SCRAPER_CONTENT', action: 'GET_MY_PHONE' }, '*');
        console.log('[WA-Scraper] v1.0.0 Professional UI ready!');
      }
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
