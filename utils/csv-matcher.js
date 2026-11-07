/**
 * CSV Parser & Data Matching Utility for WhatsApp Web Scraper
 * Zero-dependency RFC 4180 compliant CSV parser with auto-delimiter detection,
 * column header mapping, live sample extraction, and phone comparison engine.
 */
(function (global) {
  'use strict';

  const WACSVMatcher = {
    /**
     * Mendeteksi delimiter CSV (koma, titik koma, atau tab)
     * @param {string} text
     * @returns {string} ',', ';', atau '\t'
     */
    detectDelimiter: function (text) {
      if (!text) return ',';
      // Ambil beberapa baris awal untuk analisis
      const firstLines = text.split(/\r\n|\n|\r/).slice(0, 5).join('\n');
      const counts = {
        ',': (firstLines.match(/,/g) || []).length,
        ';': (firstLines.match(/;/g) || []).length,
        '\t': (firstLines.match(/\t/g) || []).length
      };

      if (counts[';'] > counts[','] && counts[';'] > counts['\t']) return ';';
      if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
      return ',';
    },

    /**
     * Parser CSV RFC 4180 robust
     * Mampu menangani:
     * - Delimiter di dalam kutip ganda
     * - Karakter newline (\n) di dalam kutip ganda
     * - Escaped double quotes ("")
     * @param {string} csvText
     * @param {string} [delimiter]
     * @returns {Array<Array<string>>}
     */
    parseCSV: function (csvText, delimiter) {
      if (!csvText || typeof csvText !== 'string') return [];

      // Hilangkan UTF-8 BOM jika ada
      let text = csvText.replace(/^\uFEFF/, '');
      const delim = delimiter || this.detectDelimiter(text);

      const rows = [];
      let currentRow = [];
      let currentVal = '';
      let inQuotes = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote: "" -> "
            currentVal += '"';
            i++; // Lewati quote berikutnya
          } else {
            // Toggle status di dalam quote
            inQuotes = !inQuotes;
          }
        } else if (char === delim && !inQuotes) {
          // Delimiter kolom
          currentRow.push(currentVal.trim());
          currentVal = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
          // Baris baru
          if (char === '\r' && nextChar === '\n') {
            i++; // Lewati \n jika pasangan \r\n
          }
          currentRow.push(currentVal.trim());
          // Hanya masukkan baris jika ada setidaknya 1 kolom yang tidak kosong
          if (currentRow.some(col => col.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentVal = '';
        } else {
          currentVal += char;
        }
      }

      // Sisa karakter terakhir
      if (currentVal.length > 0 || currentRow.length > 0) {
        currentRow.push(currentVal.trim());
        if (currentRow.some(col => col.length > 0)) {
          rows.push(currentRow);
        }
      }

      return rows;
    },

    /**
     * Membaca file CSV untuk mengambil informasi header dan contoh nilai (samples)
     * @param {string} csvText
     * @returns {{
     *   headers: Array<string>,
     *   rows: Array<Array<string>>,
     *   totalRows: number,
     *   samplesByCol: Array<Array<string>>,
     *   delimiter: string,
     *   suggestedPhoneCol: number,
     *   suggestedNameCol: number
     * }}
     */
    analyzeCSV: function (csvText) {
      const delimiter = this.detectDelimiter(csvText);
      const allRows = this.parseCSV(csvText, delimiter);

      if (allRows.length === 0) {
        return {
          headers: [],
          rows: [],
          totalRows: 0,
          samplesByCol: [],
          delimiter,
          suggestedPhoneCol: -1,
          suggestedNameCol: -1
        };
      }

      // Baris pertama sebagai header
      const rawHeaders = allRows[0];
      const dataRows = allRows.slice(1);

      // Bersihkan dan beri nama fallback jika ada header kosong
      const headers = rawHeaders.map((h, idx) => {
        const clean = (h || '').trim();
        return clean.length > 0 ? clean : `Kolom ${idx + 1}`;
      });

      // Kumpulkan sampel data (hingga 3 baris non-kosong per kolom)
      const samplesByCol = headers.map((_, colIdx) => {
        const samples = [];
        for (const row of dataRows) {
          const val = (row[colIdx] || '').trim();
          if (val && !samples.includes(val)) {
            samples.push(val);
            if (samples.length >= 3) break;
          }
        }
        return samples;
      });

      // Deteksi otomatis kolom terbaik untuk nomor HP (utama & cadangan) dan nama
      const phoneCols = this.detectPhoneColumns(headers, samplesByCol);
      const suggestedPhoneCol = phoneCols.primary;
      const suggestedPhone2Col = phoneCols.secondary;
      const suggestedNameCol = this.detectNameColumn(headers, [suggestedPhoneCol, suggestedPhone2Col]);

      return {
        headers,
        rows: dataRows,
        totalRows: dataRows.length,
        samplesByCol,
        delimiter,
        suggestedPhoneCol,
        suggestedPhone2Col,
        suggestedNameCol
      };
    },

    /**
     * Deteksi kolom nomor telepon (utama dan cadangan/ke-2) berdasarkan kata kunci header dan pola isi data
     * @param {Array<string>} headers
     * @param {Array<Array<string>>} samplesByCol
     * @returns {{ primary: number, secondary: number }} Index kolom (0-based) atau -1 jika tidak ada
     */
    detectPhoneColumns: function (headers, samplesByCol) {
      const strongPhoneRegex = /(?:whatsapp|telepon|telp|nohp|handphone|mobile|phone|ponsel)/i;
      const combinedPhoneRegex = /(?:no|nomor)\s*[_.-]?\s*(?:wa|hp|telepon|telp|whatsapp|phone|mobile|kontak)/i;

      const found = [];

      // 1. Prioritas utama: Nama header mengandung kata kunci nomor telepon spesifik
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].trim();
        if (/^(no|no\.|nomor|nomor urut|id|no kursi|no meja|no peserta|no pendaftaran|no registrasi)$/i.test(h)) continue;

        if (combinedPhoneRegex.test(h) || strongPhoneRegex.test(h)) {
          found.push(i);
        }
      }

      // 2. Analisis isi sampel (apakah banyak angka yang menyerupai nomor HP Indonesia)
      if (found.length < 2 && samplesByCol && samplesByCol.length > 0) {
        for (let i = 0; i < samplesByCol.length; i++) {
          if (found.includes(i)) continue;
          const h = headers[i].trim();
          if (/^(no|no\.|nomor|nomor urut|id|no kursi|no meja)$/i.test(h)) continue;

          const samples = samplesByCol[i];
          const phoneCount = samples.filter(s => {
            if (!s || s === '-') return false;
            const digits = s.replace(/[^\d]/g, '');
            // Nomor HP Indonesia: minimal 9 digit dan diawali 8, 08, atau 628
            return (digits.length >= 9 && digits.length <= 15) && /^(08|628|8[1-9])/.test(digits);
          }).length;

          if (samples.length > 0 && phoneCount >= Math.ceil(samples.length / 2)) {
            found.push(i);
          }
        }
      }

      return {
        primary: found.length > 0 ? found[0] : -1,
        secondary: found.length > 1 ? found[1] : -1
      };
    },

    /**
     * Backward-compatible alias untuk detectPhoneColumn
     */
    detectPhoneColumn: function (headers, samplesByCol) {
      return this.detectPhoneColumns(headers, samplesByCol).primary;
    },

    /**
     * Deteksi kolom nama kontak
     * @param {Array<string>} headers
     * @param {number|Array<number>} excludeCol - Kolom yang sudah terpilih sebagai nomor HP
     * @returns {number}
     */
    detectNameColumn: function (headers, excludeCol = -1) {
      const excludeList = Array.isArray(excludeCol) ? excludeCol : [excludeCol];
      const nameKeywords = [
        /\b(?:nama_lengkap|namalengkap|fullname|full_name|nama_peserta|nama_siswa|nama_karyawan|nama_pelanggan|nama_user)\b/i,
        /\b(?:nama|name|peserta|member|pendaftar|pelanggan|customer|karyawan|pegawai|user|kontak)\b/i,
        /nama|name/i
      ];

      for (const regex of nameKeywords) {
        for (let i = 0; i < headers.length; i++) {
          if (excludeList.includes(i)) continue;
          if (regex.test(headers[i])) {
            return i;
          }
        }
      }

      return -1;
    },

    /**
     * Eksekusi pencocokan data CSV terhadap map anggota grup yang sudah di-scrape
     * Mendukung hingga 2 kolom nomor telepon (misal: Nomor Utama & Nomor Cadangan/Alternatif)
     * @param {Array<Array<string>>} rows - Baris-baris data CSV
     * @param {Array<string>} headers - Header kolom CSV
     * @param {number} phoneColIdx - Index kolom nomor HP utama
     * @param {number} nameColIdx - Index kolom nama (opsional, -1 jika tidak ada)
     * @param {Map<string, Object>} groupContactsMap - Map kontak grup hasil scraping
     * @param {number} [phoneColIdx2=-1] - Index kolom nomor HP cadangan/ke-2 (opsional)
     * @returns {{
     *   summary: {
     *     total: number,
     *     notInGroup: number,
     *     inGroup: number,
     *     invalid: number
     *   },
     *   items: Array<Object>
     * }}
     */
    matchData: function (rows, headers, phoneColIdx, nameColIdx, groupContactsMap, phoneColIdx2 = -1) {
      // Siapkan Set & Map nomor telepon grup ternormalisasi untuk lookup O(1)
      const groupPhoneSet = new Set();
      const groupPhoneMap = new Map();

      if (groupContactsMap && groupContactsMap.size > 0) {
        for (const contact of groupContactsMap.values()) {
          if (contact.phone && contact.phone !== '-') {
            // Normalisasi nomor grup
            const clean = window.WAPhoneParser ? window.WAPhoneParser.cleanPhone(contact.phone) : contact.phone.replace(/[^\d+]/g, '');
            if (clean) {
              groupPhoneSet.add(clean);
              // Juga simpan variasi tanpa '+' dan dengan '08' agar pencocokan 100% toleran
              const digits = clean.replace(/[^\d]/g, '');
              groupPhoneSet.add(digits);
              if (digits.startsWith('628')) {
                groupPhoneSet.add('0' + digits.substring(2));
              }
              groupPhoneMap.set(clean, contact);
            }
          }
        }
      }

      function cleanNumber(raw) {
        if (!raw || raw === '-' || raw === '—') return { raw: raw || '-', clean: '', isValid: false };
        const clean = window.WAPhoneParser ? window.WAPhoneParser.cleanPhone(raw) : raw.replace(/[^\d+]/g, '');
        const digits = clean.replace(/[^\d]/g, '');
        const isValid = digits.startsWith('62') && digits.length >= 10 && digits.length <= 16;
        return { raw, clean: isValid ? clean : raw, isValid };
      }

      function isMember(cleanPhone) {
        if (!cleanPhone) return false;
        const digits = cleanPhone.replace(/[^\d]/g, '');
        const localFormat = digits.startsWith('628') ? ('0' + digits.substring(2)) : '';
        return groupPhoneSet.has(cleanPhone) || groupPhoneSet.has(digits) || (localFormat && groupPhoneSet.has(localFormat));
      }

      const items = [];
      let countNotInGroup = 0;
      let countInGroup = 0;
      let countInvalid = 0;

      let totalPhonesInGroup = 0;
      let totalPhonesNotInGroup = 0;
      let bothInGroupCount = 0;
      let phone1OnlyCount = 0;
      let phone2OnlyCount = 0;

      rows.forEach((row, idx) => {
        const rawPhone1 = phoneColIdx >= 0 && row[phoneColIdx] ? String(row[phoneColIdx]).trim() : '';
        const rawPhone2 = phoneColIdx2 >= 0 && row[phoneColIdx2] ? String(row[phoneColIdx2]).trim() : '';
        const nameVal = nameColIdx >= 0 && row[nameColIdx] ? String(row[nameColIdx]).trim() : '';

        const p1 = cleanNumber(rawPhone1);
        const p2 = cleanNumber(rawPhone2);

        const inGroup1 = p1.isValid && isMember(p1.clean);
        const inGroup2 = p2.isValid && isMember(p2.clean);

        let status = 'invalid';
        let matchDetail = '';
        const hasAnyValid = p1.isValid || p2.isValid;

        if (!hasAnyValid) {
          status = 'invalid';
          countInvalid++;
        } else if (inGroup1 || inGroup2) {
          // Jika salah satu nomor peserta/orang tua sudah masuk grup, dianggap SUDAH MASUK
          status = 'in_group';
          countInGroup++;
          if (inGroup1 && inGroup2) {
            matchDetail = 'both';
            bothInGroupCount++;
            totalPhonesInGroup += 2; // Terhitung 2 nomor saat kedua nomor gabung di grup!
          } else if (inGroup1) {
            matchDetail = 'phone1';
            phone1OnlyCount++;
            totalPhonesInGroup += 1;
          } else {
            matchDetail = 'phone2';
            phone2OnlyCount++;
            totalPhonesInGroup += 1;
          }
        } else {
          // Belum ada nomor yang masuk grup
          status = 'not_in_group';
          countNotInGroup++;
          if (p1.isValid) totalPhonesNotInGroup++;
          if (p2.isValid) totalPhonesNotInGroup++;
        }

        items.push({
          index: idx + 1,
          originalRow: row,
          rawPhone: p1.raw,
          cleanPhone: p1.isValid ? p1.clean : (p1.raw !== '-' ? p1.raw : ''),
          rawPhone2: p2.raw,
          cleanPhone2: p2.isValid ? p2.clean : (p2.raw !== '-' ? p2.raw : ''),
          hasPhone2: phoneColIdx2 >= 0,
          p1Valid: p1.isValid,
          p2Valid: p2.isValid,
          inGroup1,
          inGroup2,
          matchDetail,
          name: nameVal || '-',
          status,
          matchedGroupContact: (inGroup1 ? groupPhoneMap.get(p1.clean) : null) || (inGroup2 ? groupPhoneMap.get(p2.clean) : null) || null
        });
      });

      return {
        summary: {
          total: rows.length,
          notInGroup: countNotInGroup,
          inGroup: countInGroup,
          invalid: countInvalid,
          totalPhonesInGroup,
          totalPhonesNotInGroup,
          bothInGroupCount,
          phone1OnlyCount,
          phone2OnlyCount,
          hasDualPhone: phoneColIdx2 >= 0
        },
        items
      };
    }
  };

  global.WACSVMatcher = WACSVMatcher;
})(typeof window !== 'undefined' ? window : this);
