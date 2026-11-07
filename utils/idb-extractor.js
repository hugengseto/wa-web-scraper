/**
 * WhatsApp Web IndexedDB Direct Extractor v2.4.0
 * Multi-Database & Multi-Store Deep Scanner dengan Dukungan Ekstraksi Grup Penuh
 */
(function (global) {
  'use strict';

  function normalizeName(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/\s*\([^)]*\)/g, '') // Hapus (SMP Muh 1 Yogyakarta), dll.
      .replace(/^(bapak|ibu|bpk|pak|bu|mas|mbak|kak|ustadz|ust|dr|prof)\.?\s+/i, '') // Hapus sapaan
      .replace(/^[^\w\s]+|[^\w\s]+$/g, '') // Karakter spesial di tepi
      .replace(/\s+/g, ' ')
      .trim();
  }

  const WAIdbExtractor = {
    normalizeName: normalizeName,

    /**
     * Membuka koneksi ke database tertentu dengan Promise
     */
    openDbPromise: function (dbName) {
      return new Promise((resolve) => {
        try {
          const req = window.indexedDB.open(dbName);
          req.onsuccess = (e) => resolve(e.target.result);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    },

    /**
     * Membaca seluruh data dari sebuah Object Store
     */
    getAllFromStore: function (db, storeName) {
      return new Promise((resolve) => {
        if (!db || !db.objectStoreNames.contains(storeName)) {
          return resolve([]);
        }

        try {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const req = store.getAll();

          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });
    },

    /**
     * Memindai SELURUH database dan store yang tersedia di origin WhatsApp Web
     * untuk memetakan nama kontak ke nomor telepon aslinya (dengan normalisasi cerdas)
     */
    getNameToPhoneMap: async function () {
      const map = new Map();

      try {
        let dbNames = ['model-storage', 'wawc', 'wawc_db'];

        if (typeof window.indexedDB.databases === 'function') {
          try {
            const list = await window.indexedDB.databases();
            const names = list.map(d => d.name).filter(Boolean);
            if (names.length > 0) {
              dbNames = Array.from(new Set([...names, ...dbNames]));
            }
          } catch (e) {}
        }

        for (const name of dbNames) {
          const db = await this.openDbPromise(name);
          if (!db) continue;

          for (const sName of db.objectStoreNames) {
            if (/contact|participant|chat|user|group/i.test(sName)) {
              const items = await this.getAllFromStore(db, sName);
              for (const it of items) {
                // Periksa nomor dari phoneNumber atau ID
                const rawId = it.phoneNumber || (it.id ? (it.id.user || it.id._serialized || it.id) : (it.userId || ''));
                const cleanPhone = window.WAPhoneParser ? window.WAPhoneParser.cleanPhone(rawId) : rawId;
                if (cleanPhone && cleanPhone.length >= 8) {
                  const nameCandidates = [
                    it.name,
                    it.pushname,
                    it.formattedName,
                    it.shortName,
                    it.verifiedName,
                    it.displayName,
                    it.notifyName
                  ].filter(Boolean);

                  for (const rawName of nameCandidates) {
                    const trimmed = rawName.toLowerCase().trim();
                    map.set(trimmed, cleanPhone);

                    const norm = normalizeName(rawName);
                    if (norm && norm.length >= 2) {
                      map.set(norm, cleanPhone);
                    }
                  }
                }

                // Jika berupa grup metadata, ekstrak juga nomor dan nama dari it.participants
                const participantsList = it.participants ? (it.participants.models || it.participants) : null;
                if (participantsList && Array.isArray(participantsList)) {
                  for (const p of participantsList) {
                    const pId = p.id ? (p.id.user || p.id._serialized || p.id) : (p._serialized || String(p));
                    const pPhone = window.WAPhoneParser ? window.WAPhoneParser.cleanPhone(pId) : (pId.replace(/[^\d]/g, ''));
                    if (!pPhone || pPhone.length < 8) continue;
                    const fullPPhone = pPhone.startsWith('+') ? pPhone : ('+' + pPhone);

                    const pNames = [p.displayName, p.name, p.pushname, p.notifyName, p.contact?.name, p.contact?.pushname].filter(Boolean);
                    for (const nm of pNames) {
                      map.set(nm.toLowerCase().trim(), fullPPhone);
                      const norm = normalizeName(nm);
                      if (norm && norm.length >= 2) {
                        map.set(norm, fullPPhone);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        console.log('[WA-Scraper IDB] Pemetaan kontak selesai. Total kamus:', map.size, 'kunci nama/nomor.');
      } catch (err) {
        console.warn('[WA-Scraper IDB] Error scanning databases:', err);
      }

      return map;
    },

    /**
     * Memindai kontak tersimpan di buku telepon (isAddressBookContact / isMyContact)
     * Mengembalikan { savedPhones: Set, savedNames: Set, nameToPhone: Map }
     */
    getSavedContactsInfo: async function () {
      const savedPhones = new Set();
      const savedNames = new Set();
      const nameToPhone = new Map();

      try {
        let dbNames = ['model-storage', 'wawc', 'wawc_db'];
        if (typeof window.indexedDB.databases === 'function') {
          try {
            const list = await window.indexedDB.databases();
            const names = list.map(d => d.name).filter(Boolean);
            if (names.length > 0) dbNames = Array.from(new Set([...names, ...dbNames]));
          } catch (e) {}
        }

        for (const name of dbNames) {
          const db = await this.openDbPromise(name);
          if (!db) continue;

          for (const sName of db.objectStoreNames) {
            if (/contact|participant|chat|user|group/i.test(sName)) {
              const items = await this.getAllFromStore(db, sName);
              for (const it of items) {
                const rawId = it.phoneNumber || (it.id ? (it.id.user || it.id._serialized || it.id) : (it.userId || ''));
                const cleanPhone = window.WAPhoneParser ? window.WAPhoneParser.cleanPhone(rawId) : rawId;
                const fullPhone = (cleanPhone && cleanPhone.length >= 8) ? (cleanPhone.startsWith('+') ? cleanPhone : ('+' + cleanPhone)) : '';

                // HANYA flag eksplisit buku telepon: isAddressBookContact === 1
                // JANGAN SEKALI-KALI gunakan isMyContact karena di WA Web peserta grup sering diset isMyContact=true
                const isSaved = Boolean(
                  it.isAddressBookContact === 1 || it.isAddressBookContact === true ||
                  it.__x_isAddressBookContact === 1 || it.__x_isAddressBookContact === true
                );

                if (fullPhone && isSaved) {
                  savedPhones.add(fullPhone);
                }

                if (it.name && isSaved) {
                  savedNames.add(it.name.toLowerCase().trim());
                  const norm = normalizeName(it.name);
                  if (norm) savedNames.add(norm);
                }

                const nameCandidates = [it.name, it.pushname, it.formattedName, it.shortName, it.verifiedName, it.displayName, it.notifyName].filter(Boolean);
                if (fullPhone) {
                  for (const n of nameCandidates) {
                    nameToPhone.set(n.toLowerCase().trim(), fullPhone);
                    const norm = normalizeName(n);
                    if (norm && norm.length >= 2) nameToPhone.set(norm, fullPhone);
                  }
                }

                const participantsList = it.participants ? (it.participants.models || it.participants) : null;
                if (participantsList && Array.isArray(participantsList)) {
                  for (const p of participantsList) {
                    const pId = p.id ? (p.id.user || p.id._serialized || p.id) : (p._serialized || String(p));
                    const pPhone = window.WAPhoneParser ? window.WAPhoneParser.cleanPhone(pId) : (pId.replace(/[^\d]/g, ''));
                    if (!pPhone || pPhone.length < 8) continue;
                    const fullPPhone = pPhone.startsWith('+') ? pPhone : ('+' + pPhone);

                    // HANYA flag buku telepon murni isAddressBookContact === 1
                    const pIsSaved = Boolean(
                      p.isAddressBookContact === 1 || p.isAddressBookContact === true ||
                      p.contact?.isAddressBookContact === 1 || p.contact?.isAddressBookContact === true ||
                      p.__x_isAddressBookContact === 1 || p.contact?.__x_isAddressBookContact === 1
                    );
                    if (pIsSaved) {
                      savedPhones.add(fullPPhone);
                    }

                    const pNames = [p.displayName, p.name, p.pushname, p.notifyName, p.contact?.name, p.contact?.pushname].filter(Boolean);
                    for (const nm of pNames) {
                      nameToPhone.set(nm.toLowerCase().trim(), fullPPhone);
                      const norm = normalizeName(nm);
                      if (norm && norm.length >= 2) nameToPhone.set(norm, fullPPhone);
                      if (pIsSaved && (p.name || p.contact?.name)) {
                        savedNames.add(nm.toLowerCase().trim());
                        if (norm) savedNames.add(norm);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[WA-Scraper IDB] Error getSavedContactsInfo:', e);
      }

      return { savedPhones, savedNames, nameToPhone };
    },

    /**
     * Membaca langsung seluruh anggota grup dari Store IndexedDB (Group Metadata)
     * @param {string} groupTitleHint
     */
    getGroupParticipantsFromIDB: async function (groupTitleHint) {
      try {
        let dbNames = ['model-storage', 'wawc', 'wawc_db'];
        if (typeof window.indexedDB.databases === 'function') {
          try {
            const list = await window.indexedDB.databases();
            const names = list.map(d => d.name).filter(Boolean);
            if (names.length > 0) dbNames = Array.from(new Set([...names, ...dbNames]));
          } catch (e) {}
        }

        let contactJidMap = new Map();
        let targetGroup = null;
        let allGroups = [];

        for (const dbName of dbNames) {
          const db = await this.openDbPromise(dbName);
          if (!db) continue;

          // 1. Ambil kontak untuk mencocokkan JID -> Nama
          for (const sName of db.objectStoreNames) {
            if (/contact|user/i.test(sName)) {
              const contacts = await this.getAllFromStore(db, sName);
              for (const c of contacts) {
                const jid = c.id ? (c.id._serialized || c.id) : '';
                const name = c.name || c.formattedName || c.pushname || '';
                const phone = c.phoneNumber || (window.WAPhoneParser ? window.WAPhoneParser.cleanPhone(jid) : jid);
                if (jid) {
                  contactJidMap.set(jid, { name, phone });
                }
              }
            }
          }

          // 2. Ambil grup dari group-metadata atau chat
          for (const sName of db.objectStoreNames) {
            if (/group-metadata|group_metadata/i.test(sName)) {
              const groups = await this.getAllFromStore(db, sName);
              for (const g of groups) {
                allGroups.push(g);
              }
            }
          }
        }

        if (allGroups.length === 0) return null;

        // Cocokkan grup yang dicari berdasarkan judul atau ambil grup dengan peserta terbanyak
        const cleanHint = groupTitleHint ? groupTitleHint.toLowerCase().trim() : '';

        if (cleanHint) {
          targetGroup = allGroups.find(g => {
            const subject = (g.subject || g.name || g.formattedTitle || '').toLowerCase().trim();
            return subject && (subject.includes(cleanHint) || cleanHint.includes(subject));
          });
        }

        if (!targetGroup) {
          // Cari grup dengan peserta terbanyak
          targetGroup = allGroups.reduce((prev, curr) => {
            const prevCount = prev && prev.participants ? (prev.participants.length || 0) : 0;
            const currCount = curr && curr.participants ? (curr.participants.length || 0) : 0;
            return currCount > prevCount ? curr : prev;
          }, null);
        }

        if (!targetGroup || !targetGroup.participants || targetGroup.participants.length === 0) {
          return null;
        }

        const participants = [];
        const rawList = targetGroup.participants.models || targetGroup.participants;

        for (const p of rawList) {
          const pId = p.id ? (p.id._serialized || p.id) : (p._serialized || String(p));
          const cleanPhone = window.WAPhoneParser ? window.WAPhoneParser.cleanPhone(pId) : pId.replace(/[^\d]/g, '');
          const contactInfo = contactJidMap.get(pId) || {};
          const name = contactInfo.name || p.contact?.name || p.contact?.pushname || '';
          const isAdmin = Boolean(p.isAdmin || p.isSuperAdmin || p.admin === 'admin');

          if (cleanPhone || name) {
            participants.push({
              phone: cleanPhone ? ('+' + cleanPhone.replace(/^\+/, '')) : '-',
              name: name,
              isAdmin: isAdmin,
              groupName: targetGroup.subject || groupTitleHint || 'Grup WhatsApp'
            });
          }
        }

        console.log(`[WA-Scraper IDB] Sukses mengekstrak ${participants.length} anggota grup dari IndexedDB!`);
        return {
          groupTitle: targetGroup.subject || groupTitleHint,
          totalCount: participants.length,
          participants: participants
        };
      } catch (err) {
        console.warn('[WA-Scraper IDB] Error extracting group from IDB:', err);
        return null;
      }
    }
  };

  global.WAIdbExtractor = WAIdbExtractor;
})(typeof window !== 'undefined' ? window : this);
