/**
 * Phone Number Parser & Normalizer Utility for WhatsApp Web
 */
(function (global) {
  'use strict';

  const WAPhoneParser = {
    /**
     * Membersihkan string nomor ke format standar internasional (+628xxxx)
     * @param {string} raw - String nomor HP atau JID WhatsApp
     * @returns {string} Nomor bersih
     */
    cleanPhone: function (raw) {
      if (!raw || typeof raw !== 'string') return '';

      // Hapus suffix JID WhatsApp (@c.us, @s.whatsapp.net, :1, dll)
      let cleaned = raw.split('@')[0].split(':')[0].trim();

      // Hapus karakter non-digit selain '+' di awal
      cleaned = cleaned.replace(/[\u200e\u200f\u202a-\u202e]/g, ''); // Hapus karakter RTL/LTR tersembunyi
      cleaned = cleaned.replace(/[^\d+]/g, '');

      // Jika diawali 08 (format lokal Indonesia), ubah ke +628
      if (cleaned.startsWith('08')) {
        cleaned = '+62' + cleaned.substring(1);
      } else if (/^8[1-9]\d{7,13}$/.test(cleaned)) {
        // Format Indonesia tanpa leading 0 (misal dari export Excel: 812xxxx, 857xxxx)
        cleaned = '+62' + cleaned;
      } else if (cleaned.startsWith('62') && !cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
      } else if (!cleaned.startsWith('+') && cleaned.length >= 9) {
        cleaned = '+' + cleaned;
      }

      return cleaned;
    },

    /**
     * Memeriksa apakah teks kemungkinan besar adalah nomor telepon
     * @param {string} str
     * @returns {boolean}
     */
    isPhoneNumber: function (str) {
      if (!str || typeof str !== 'string') return false;
      // Hapus spasi dan tanda baca standar telepon
      const digitsOnly = str.replace(/[^\d]/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 16) return false;

      // Cek apakah pola menyerupai format telepon
      const phoneRegex = /^(\+?\d{1,4}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?[\d\s.-]{5,14}$/;
      return phoneRegex.test(str.trim());
    },

    /**
     * Ekstrak semua nomor telepon dari satu teks panjang (misal: subtitle header grup)
     * Contoh: "+62 812-3456-789, John, +62 857-1111-222, Anda"
     * @param {string} text
     * @returns {Array<{name: string, phone: string, isSaved: boolean}>}
     */
    extractParticipantsFromHeader: function (text) {
      if (!text || typeof text !== 'string') return [];

      // Split berdasarkan koma
      const parts = text.split(',').map(p => p.trim()).filter(Boolean);
      const results = [];

      for (const part of parts) {
        // Hilangkan kata 'Anda' atau 'You'
        if (/^(anda|you)$/i.test(part)) continue;

        const cleaned = this.cleanPhone(part);
        if (this.isPhoneNumber(part) && cleaned.length >= 8) {
          results.push({
            name: '',
            phone: cleaned,
            isSaved: false
          });
        } else {
          // Jika berupa nama kontak
          const isPush = part.startsWith('~');
          results.push({
            name: part.replace(/^~/, '').trim(),
            phone: '',
            isSaved: !isPush
          });
        }
      }

      return results;
    },

    /**
     * Format tampilan nomor agar nyaman dibaca (misal: +62 812-3456-7890)
     * @param {string} phone
     * @returns {string}
     */
    formatDisplay: function (phone) {
      if (!phone) return '-';
      const clean = this.cleanPhone(phone);
      if (clean.startsWith('+62')) {
        const num = clean.replace('+62', '');
        if (num.length >= 9) {
          return `+62 ${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7)}`;
        }
      }
      return clean;
    }
  };

  global.WAPhoneParser = WAPhoneParser;
})(typeof window !== 'undefined' ? window : this);
