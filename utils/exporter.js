/**
 * Data Exporter Utility (CSV, Excel-friendly, Clipboard)
 */
(function (global) {
  'use strict';

  const WAExporter = {
    /**
     * Escape HTML string untuk keamanan tag tabel
     * @param {string|number} str
     * @returns {string}
     */
    escapeHTML: function (str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },

    /**
     * Escape field untuk CSV format RFC 4180
     * @param {string|number} field
     * @returns {string}
     */
    escapeCSVField: function (field) {
      if (field === null || field === undefined) return '""';
      const str = String(field);
      // Jika mengandung koma, petik dua, atau newline, bungkus dengan petik dan ganti " menjadi ""
      if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    },

    /**
     * Generate & Download file CSV dari daftar kontak
     * @param {Array<Object>} items
     * @param {string} baseFilename
     */
    exportToCSV: function (items, baseFilename = 'wa-scraped-contacts') {
      if (!items || items.length === 0) {
        alert('Tidak ada data kontak untuk diekspor!');
        return false;
      }

      const headers = [
        'No',
        'Nomor Telepon',
        'Nomor Untuk Excel',
        'Nama Kontak',
        'Grup WhatsApp',
        'Status Admin',
        'Tipe'
      ];

      const rows = [headers.map(this.escapeCSVField).join(',')];

      items.forEach((item, index) => {
        const phone = item.phone || '-';
        // Format khusus untuk Excel agar tidak menjadi scientific notation (misal: 6.281E+11)
        const excelPhone = phone !== '-' ? `="${phone}"` : '-';
        const name = item.name || '-';
        const group = item.groupName || '-';
        const isAdmin = item.isAdmin ? 'Ya (Admin)' : 'Anggota Biasa';
        const type = item.isSaved ? 'Kontak Tersimpan' : 'Nomor Belum Disimpan';

        const row = [
          this.escapeCSVField(index + 1),
          this.escapeCSVField(phone),
          excelPhone, // Biarkan tanda petik formula Excel
          this.escapeCSVField(name),
          this.escapeCSVField(group),
          this.escapeCSVField(isAdmin),
          this.escapeCSVField(type)
        ];

        rows.push(row.join(','));
      });

      // Tambahkan UTF-8 BOM (\uFEFF) agar Microsoft Excel membuka karakter dengan benar
      const csvContent = '\uFEFF' + rows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `${baseFilename.replace(/[^a-zA-Z0-9_-]/g, '_')}_${timestamp}.csv`;

      this.downloadBlob(blob, filename);
      return true;
    },

    /**
     * Download Blob sebagai file
     * @param {Blob} blob
     * @param {string} filename
     */
    downloadBlob: function (blob, filename) {
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    /**
     * Ekspor hasil pencocokan CSV vs Anggota Grup ke format Excel (.xls)
     * Menggunakan HTML Spreadsheet dengan warna latar sel HIJAU ASLI pada nomor yang sudah bergabung ke grup,
     * serta mso-number-format agar angka 0 di depan tidak terpotong dan tidak menjadi notasi ilmiah (6.28E+11).
     * @param {Array<Object>} items - Array of matched items from WACSVMatcher
     * @param {Array<string>} originalHeaders - Header asli file CSV input
     * @param {string} groupName - Nama grup WhatsApp pembanding
     * @param {number} phoneColIdx - Indeks kolom nomor WhatsApp utama
     * @param {number} phoneColIdx2 - Indeks kolom nomor WhatsApp cadangan
     * @param {'all'|'not_in_group'} exportType
     */
    exportMatchingExcel: function (items, originalHeaders = [], groupName = 'Grup WA', phoneColIdx = -1, phoneColIdx2 = -1, exportType = 'all') {
      if (!items || items.length === 0) {
        alert('Tidak ada data hasil pencocokan untuk diekspor!');
        return false;
      }

      let exportItems = items;
      if (exportType === 'not_in_group') {
        exportItems = items.filter(it => it.status === 'not_in_group');
      }

      if (exportItems.length === 0) {
        alert('Tidak ada data pada kategori ini untuk diekspor.');
        return false;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const cleanGroup = groupName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `laporan_pencocokan_${cleanGroup}_${timestamp}.xls`;

      // Header tabel: Tambahkan kolom status ringkasan di awal, lalu seluruh kolom file asli
      let theadHtml = `
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold; height: 38px;">
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; background-color: #0f172a; color: #ffffff;">No</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; background-color: #0f172a; color: #ffffff;">Status Grup WA</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; background-color: #0f172a; color: #ffffff;">Detail Keanggotaan</th>
      `;

      originalHeaders.forEach((h, hIdx) => {
        let isPhoneCol = (hIdx === phoneColIdx || hIdx === phoneColIdx2);
        let colBg = isPhoneCol ? '#1e293b' : '#0f172a';
        theadHtml += `<th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; background-color: ${colBg}; color: #ffffff;">${this.escapeHTML(h)}</th>`;
      });

      theadHtml += `</tr></thead>`;

      // Nama kolom untuk keterangan yang jelas
      const col1Name = (phoneColIdx >= 0 && originalHeaders[phoneColIdx]) ? originalHeaders[phoneColIdx] : 'Nomor Utama';
      const col2Name = (phoneColIdx2 >= 0 && originalHeaders[phoneColIdx2]) ? originalHeaders[phoneColIdx2] : 'Nomor Cadangan';

      // Body tabel
      let tbodyHtml = '<tbody>';

      exportItems.forEach((it, idx) => {
        let statusBadgeHtml = '';
        if (it.status === 'in_group') {
          statusBadgeHtml = `<td style="border: 1px solid #cbd5e1; padding: 6px 10px; background-color: #22c55e; color: #ffffff; font-weight: bold; text-align: center; mso-number-format: '\\@';">🟢 SUDAH MASUK GRUP</td>`;
        } else if (it.status === 'not_in_group') {
          statusBadgeHtml = `<td style="border: 1px solid #cbd5e1; padding: 6px 10px; background-color: #fef08a; color: #854d0e; font-weight: bold; text-align: center; mso-number-format: '\\@';">⏳ BELUM MASUK</td>`;
        } else {
          statusBadgeHtml = `<td style="border: 1px solid #cbd5e1; padding: 6px 10px; background-color: #f1f5f9; color: #64748b; text-align: center; mso-number-format: '\\@';">⚠️ FORMAT TIDAK VALID</td>`;
        }

        let detailText = 'Belum Ada yang Bergabung';
        if (it.matchDetail === 'both') {
          detailText = `🟢 KEDUA NOMOR DI GRUP (${col1Name} & ${col2Name})`;
        } else if (it.matchDetail === 'phone1') {
          detailText = `🟢 ${col1Name} Sudah di Grup (${it.cleanPhone})`;
        } else if (it.matchDetail === 'phone2') {
          detailText = `🟢 ${col2Name} Sudah di Grup (${it.cleanPhone2})`;
        }

        let rowBg = (idx % 2 === 0) ? '#ffffff' : '#f8fafc';

        tbodyHtml += `<tr style="background-color: ${rowBg};">`;
        tbodyHtml += `<td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center; mso-number-format: '\\@';">${idx + 1}</td>`;
        tbodyHtml += statusBadgeHtml;
        tbodyHtml += `<td style="border: 1px solid #cbd5e1; padding: 6px 10px; mso-number-format: '\\@';">${this.escapeHTML(detailText)}</td>`;

        const rowCells = it.originalRow || [];
        // Pastikan jumlah cell sesuai dengan jumlah header asli
        for (let cIdx = 0; cIdx < originalHeaders.length; cIdx++) {
          const val = rowCells[cIdx] !== undefined ? String(rowCells[cIdx]) : '';
          const escapedVal = this.escapeHTML(val);

          // Cek apakah kolom ini nomor telepon 1 atau nomor telepon 2 yang SUDAH MASUK ke grup
          const isP1InGroup = (cIdx === phoneColIdx && it.inGroup1);
          const isP2InGroup = (cIdx === phoneColIdx2 && it.inGroup2);

          if (isP1InGroup || isP2InGroup) {
            // TANDAI HIJAU ASLI PADA SEL NOMOR YANG SUDAH MASUK KE GRUP!
            tbodyHtml += `<td style="border: 1px solid #86efac; padding: 6px 10px; background-color: #86efac; color: #14532d; font-weight: bold; mso-number-format: '\\@';">${escapedVal}</td>`;
          } else {
            // Sel biasa dengan mso-number-format text agar nomor 08 / angka panjang tidak berubah menjadi format eksponensial (6.28E+11)
            tbodyHtml += `<td style="border: 1px solid #cbd5e1; padding: 6px 10px; mso-number-format: '\\@';">${escapedVal}</td>`;
          }
        }

        tbodyHtml += `</tr>`;
      });

      tbodyHtml += '</tbody>';

      // Dokumen HTML Spreadsheet yang sepenuhnya kompatibel dengan Microsoft Excel, LibreOffice, WPS, dan Google Sheets
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Hasil Pencocokan WA</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body { font-family: Calibri, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11pt; color: #1e293b; }
            table { border-collapse: collapse; width: 100%; }
            th { border: 1px solid #cbd5e1; font-weight: bold; padding: 8px 12px; }
            td { border: 1px solid #cbd5e1; padding: 6px 10px; mso-number-format: "\\@"; }
          </style>
        </head>
        <body>
          <div style="margin-bottom: 15px; font-family: Calibri, sans-serif;">
            <h2 style="margin: 0 0 5px 0; color: #0f172a;">Laporan Pencocokan Anggota WhatsApp</h2>
            <p style="margin: 0; color: #475569; font-size: 11pt;">Grup WhatsApp: <b>${this.escapeHTML(groupName)}</b> &bull; Total Baris: <b>${exportItems.length}</b> &bull; Diekspor pada: <b>${new Date().toLocaleString('id-ID')}</b></p>
            <p style="margin: 4px 0 0 0; color: #15803d; font-size: 10pt;"><i>* Sel yang berwarna HIJAU menandakan nomor telepon tersebut SUDAH BERGABUNG di dalam grup WhatsApp.</i></p>
          </div>
          <table>
            ${theadHtml}
            ${tbodyHtml}
          </table>
        </body>
        </html>
      `.trim();

      const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      this.downloadBlob(blob, filename);
      return true;
    },

    /**
     * Ekspor hasil pencocokan CSV vs Anggota Grup ke file CSV baru
     * @param {Array<Object>} items - Array of matched items from WACSVMatcher
     * @param {Array<string>} originalHeaders - Header asli file CSV input
     * @param {string} groupName - Nama grup WhatsApp pembanding
     * @param {'not_in_group'|'all'} exportType - 'not_in_group' (hanya yang belum masuk) atau 'all' (laporan lengkap)
     * @param {number} phoneColIdx
     * @param {number} phoneColIdx2
     */
    exportMatchingResults: function (items, originalHeaders = [], groupName = 'Grup WA', exportType = 'not_in_group', phoneColIdx = -1, phoneColIdx2 = -1) {
      if (!items || items.length === 0) {
        alert('Tidak ada data hasil pencocokan untuk diekspor!');
        return false;
      }

      let exportItems = items;
      if (exportType === 'not_in_group') {
        exportItems = items.filter(it => it.status === 'not_in_group');
      }

      if (exportItems.length === 0) {
        alert('Tidak ada data pada kategori ini untuk diekspor.');
        return false;
      }

      const rows = [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const cleanGroup = groupName.replace(/[^a-zA-Z0-9_-]/g, '_');
      let filename = '';

      if (exportType === 'not_in_group') {
        filename = `belum_masuk_grup_${cleanGroup}_${timestamp}.csv`;
        const headers = [
          'No',
          'Status Grup WA',
          'Nomor WhatsApp 1',
          'Nomor WhatsApp 2',
          'Nama / Identitas',
          ...originalHeaders
        ];
        rows.push(headers.map(this.escapeCSVField).join(','));

        exportItems.forEach((it, idx) => {
          const ph1 = it.cleanPhone || it.rawPhone || '-';
          const excelPh1 = ph1 !== '-' && it.p1Valid ? `="${ph1}"` : ph1;
          const ph2 = it.cleanPhone2 || it.rawPhone2 || '-';
          const excelPh2 = ph2 !== '-' && it.p2Valid ? `="${ph2}"` : ph2;

          const row = [
            this.escapeCSVField(idx + 1),
            this.escapeCSVField('⏳ Belum Masuk Grup'),
            excelPh1,
            excelPh2,
            this.escapeCSVField(it.name || '-'),
            ...(it.originalRow || []).map(val => {
              const strVal = String(val || '');
              if (/^0\d{8,15}$/.test(strVal) || /^\+?\d{9,16}$/.test(strVal)) {
                return `="${strVal}"`;
              }
              return this.escapeCSVField(strVal);
            })
          ];
          rows.push(row.join(','));
        });
      } else {
        // Laporan Lengkap: Menjaga seluruh kolom asli CSV pengguna + menyisipkan status jelas di depan
        filename = `laporan_lengkap_pencocokan_${cleanGroup}_${timestamp}.csv`;
        const col1Header = (phoneColIdx >= 0 && originalHeaders[phoneColIdx]) ? originalHeaders[phoneColIdx] : 'Nomor 1';
        const col2Header = (phoneColIdx2 >= 0 && originalHeaders[phoneColIdx2]) ? originalHeaders[phoneColIdx2] : 'Nomor 2';

        const augmentedHeaders = [
          'No',
          'Status Grup WhatsApp',
          'Keterangan Nomor Masuk',
          `Status ${col1Header}`,
          ...(phoneColIdx2 >= 0 ? [`Status ${col2Header}`] : []),
          ...originalHeaders
        ];
        rows.push(augmentedHeaders.map(this.escapeCSVField).join(','));

        exportItems.forEach((it, idx) => {
          let statusText = '⏳ BELUM MASUK';
          if (it.status === 'in_group') statusText = '🟢 SUDAH MASUK GRUP';
          else if (it.status === 'invalid') statusText = '⚠️ FORMAT TIDAK VALID';

          let detailText = '⏳ Belum Ada Nomor di Grup';
          if (it.matchDetail === 'both') detailText = `🟢 KEDUA NOMOR DI GRUP (${col1Header} & ${col2Header})`;
          else if (it.matchDetail === 'phone1') detailText = `🟢 ${col1Header} Sudah Masuk (${it.cleanPhone})`;
          else if (it.matchDetail === 'phone2') detailText = `🟢 ${col2Header} Sudah Masuk (${it.cleanPhone2})`;

          const statusNo1 = it.p1Valid ? (it.inGroup1 ? '🟢 Di Grup' : '⏳ Belum Masuk') : (it.rawPhone && it.rawPhone !== '-' ? '⚠️ Tidak Valid' : '-');
          const statusNo2 = it.hasPhone2 ? (it.p2Valid ? (it.inGroup2 ? '🟢 Di Grup' : '⏳ Belum Masuk') : (it.rawPhone2 && it.rawPhone2 !== '-' ? '⚠️ Tidak Valid' : '-')) : '-';

          const row = [
            this.escapeCSVField(idx + 1),
            this.escapeCSVField(statusText),
            this.escapeCSVField(detailText),
            this.escapeCSVField(statusNo1),
            ...(phoneColIdx2 >= 0 ? [this.escapeCSVField(statusNo2)] : []),
            ...(it.originalRow || []).map((val, colIdx) => {
              const strVal = String(val || '');
              // Jika kolom ini nomor telepon, bungkus dengan ="..." agar Excel tidak menghilangkan 0 atau merusak ke eksponen
              if (colIdx === phoneColIdx || colIdx === phoneColIdx2 || /^0\d{8,15}$/.test(strVal) || /^\+?\d{9,16}$/.test(strVal)) {
                return `="${strVal}"`;
              }
              return this.escapeCSVField(strVal);
            })
          ];
          rows.push(row.join(','));
        });
      }

      const csvContent = '\uFEFF' + rows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      this.downloadBlob(blob, filename);
      return true;
    },

    /**
     * Salin nomor-nomor hasil pencocokan (misal yang belum masuk grup) ke clipboard
     * @param {Array<Object>} items
     * @param {'not_in_group'|'in_group'|'all'} statusFilter
     * @returns {Promise<{success: boolean, count: number}>}
     */
    copyMatchingNumbers: async function (items, statusFilter = 'not_in_group') {
      if (!items || items.length === 0) return { success: false, count: 0 };

      let targetItems = items;
      if (statusFilter !== 'all') {
        targetItems = items.filter(it => it.status === statusFilter);
      }

      const numbers = [];
      targetItems.forEach(it => {
        if (it.cleanPhone && it.p1Valid && it.cleanPhone !== '-') numbers.push(it.cleanPhone);
        if (it.cleanPhone2 && it.p2Valid && it.cleanPhone2 !== '-') numbers.push(it.cleanPhone2);
      });

      // Filter unik
      const uniqueNumbers = numbers.filter((val, idx, arr) => arr.indexOf(val) === idx);

      if (uniqueNumbers.length === 0) return { success: false, count: 0 };

      const ok = await this.writeToClipboard(uniqueNumbers.join('\n'));
      return { success: ok, count: uniqueNumbers.length };
    },

    /**
     * Salin daftar nomor telepon saja ke clipboard (1 baris per nomor)
     * @param {Array<Object>} items
     * @returns {Promise<boolean>}
     */
    copyNumbersOnly: async function (items) {
      if (!items || items.length === 0) {
        alert('Tidak ada nomor untuk disalin!');
        return false;
      }

      // Ambil hanya nomor unik yang valid
      const numbers = items
        .map(i => i.phone)
        .filter(p => p && p !== '-')
        .filter((val, idx, arr) => arr.indexOf(val) === idx);

      if (numbers.length === 0) {
        alert('Tidak ditemukan nomor telepon valid!');
        return false;
      }

      const text = numbers.join('\n');
      return this.writeToClipboard(text);
    },

    /**
     * Salin seluruh tabel (TSV format) sehingga bisa langsung di-paste ke Excel / Google Sheets
     * @param {Array<Object>} items
     * @returns {Promise<boolean>}
     */
    copyTableTSV: async function (items) {
      if (!items || items.length === 0) return false;

      const headers = ['No', 'Nomor Telepon', 'Nama Kontak', 'Grup WhatsApp', 'Status Admin'];
      const rows = [headers.join('\t')];

      items.forEach((item, index) => {
        rows.push([
          index + 1,
          item.phone || '-',
          item.name || '-',
          item.groupName || '-',
          item.isAdmin ? 'Admin' : 'Member'
        ].join('\t'));
      });

      return this.writeToClipboard(rows.join('\n'));
    },

    /**
     * Helper clipboard dengan fallback
     * @param {string} text
     * @returns {Promise<boolean>}
     */
    writeToClipboard: async function (text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (err) {
        console.warn('Clipboard API gagal, mencoba execCommand fallback:', err);
      }

      // Fallback menggunakan textarea
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
      } catch (err) {
        console.error('Semua metode copy gagal:', err);
        return false;
      }
    }
  };

  global.WAExporter = WAExporter;
})(typeof window !== 'undefined' ? window : this);
