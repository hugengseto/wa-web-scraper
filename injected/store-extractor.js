/**
 * Page Context (MAIN World) Extractor v2.5.0
 * Pencarian Model WhatsApp secara Heuristik, Direct WPP & Store Engine
 * + Fitur: Ambil nomor akun sendiri (Me/Anda/You)
 */
(function () {
  'use strict';

  console.log('[WA-Scraper MAIN] v2.5.0 Dynamic Engine Active');

  /**
   * Ambil nomor WhatsApp akun yang login (nomor kita sendiri)
   * @returns {string} Phone number like "+628xxx" atau ""
   */
  function getMyPhoneNumber() {
    try {
      // Method 1: window.Store.Me (WA Web internal)
      if (window.Store && window.Store.Me) {
        const meId = window.Store.Me.user || window.Store.Me.wid?.user || window.Store.Me.wid?._serialized || '';
        if (meId) {
          const digits = meId.replace(/[^\d]/g, '').replace(/@.*/, '');
          if (digits.length >= 10) return '+' + digits;
        }
      }

      // Method 2: WPP library
      if (window.WPP && window.WPP.profile) {
        if (typeof window.WPP.profile.getMyNumber === 'function') {
          const num = window.WPP.profile.getMyNumber();
          if (num) {
            const digits = String(num).replace(/[^\d]/g, '');
            if (digits.length >= 10) return '+' + digits;
          }
        }
      }

      // Method 3: WPP conn
      if (window.WPP && window.WPP.conn) {
        const me = window.WPP.conn.getMe && window.WPP.conn.getMe();
        if (me && me.wid) {
          const digits = (me.wid.user || me.wid._serialized || '').replace(/[^\d]/g, '');
          if (digits.length >= 10) return '+' + digits;
        }
      }

      // Method 4: Webpack search for conn/me module
      if (window.webpackChunkwhatsapp_web_client) {
        let webpackReq = null;
        try {
          const chunkId = 'wa_me_' + Math.floor(Math.random() * 1000000);
          window.webpackChunkwhatsapp_web_client.push([
            [chunkId], {}, function (req) { webpackReq = req; }
          ]);
        } catch (e) {}

        if (webpackReq && webpackReq.c) {
          for (const id in webpackReq.c) {
            try {
              const exp = webpackReq.c[id]?.exports;
              if (!exp) continue;
              const candidates = [exp, exp.default].filter(Boolean);
              for (const obj of candidates) {
                // Look for "me" or "wid" or "user" property that contains @c.us
                const wid = obj.wid || obj.me?.wid;
                if (wid && wid._serialized && wid._serialized.endsWith('@c.us')) {
                  const digits = (wid.user || wid._serialized).replace(/[^\d]/g, '');
                  if (digits.length >= 10) return '+' + digits;
                }
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      console.warn('[WA-Scraper MAIN] getMyPhoneNumber error:', e);
    }
    return '';
  }

  /**
   * Cari koleksi Chat dan Contact di Webpack cache
   */
  function findWhatsAppModels() {
    // 1. Cek jika Store sudah langsung diekspos
    if (window.Store && (window.Store.Chat || window.Store.GroupMetadata)) {
      return {
        groupList: window.Store.GroupMetadata?.models || window.Store.Chat?.models || null,
        contactList: window.Store.Contact?.models || null,
        chatCollection: window.Store.Chat || null
      };
    }

    if (!window.webpackChunkwhatsapp_web_client) return null;

    let webpackReq = null;
    const chunkId = 'wa_dyn_' + Math.floor(Math.random() * 1000000);

    try {
      window.webpackChunkwhatsapp_web_client.push([
        [chunkId],
        {},
        function (req) {
          webpackReq = req;
        }
      ]);
    } catch (e) {}

    if (!webpackReq || !webpackReq.c) return null;

    let groupList = null;
    let contactList = null;
    let chatCollection = null;
    const cache = webpackReq.c;

    for (const id in cache) {
      try {
        const exp = cache[id]?.exports;
        if (!exp) continue;

        const candidates = [
          exp,
          exp.default,
          exp.Chat,
          exp.Contact,
          exp.GroupMetadata
        ].filter(Boolean);

        for (const obj of candidates) {
          if (!chatCollection && (typeof obj.getActive === 'function' || typeof obj.getActiveChat === 'function')) {
            chatCollection = obj;
          }

          const list = obj.models || obj._models || (Array.isArray(obj) ? obj : null);
          if (list && Array.isArray(list) && list.length > 0) {
            // Cek koleksi grup
            if (!groupList) {
              const hasGroup = list.some(item => {
                const sId = item?.id?._serialized || item?.id || '';
                return typeof sId === 'string' && sId.endsWith('@g.us');
              });
              if (hasGroup) groupList = list;
            }

            // Cek koleksi kontak
            if (!contactList) {
              const hasUser = list.some(item => {
                const sId = item?.id?._serialized || item?.id || '';
                return typeof sId === 'string' && sId.endsWith('@c.us') && (item.name || item.pushname);
              });
              if (hasUser) contactList = list;
            }
          }
        }

        if (groupList && contactList) break;
      } catch (e) {}
    }

    return { groupList, contactList, chatCollection };
  }

  /**
   * Ekstraksi DINAMIS anggota dari grup yang SEDANG DIBUKA oleh pengguna
   * @param {string} hintTitle
   * @returns {Object|null}
   */
  async function extractActiveGroupDynamic(hintTitle) {
    // 0. Cek integrasi WPP jika tersedia
    if (window.WPP && window.WPP.group) {
      try {
        const active = typeof window.WPP.chat?.getActiveChat === 'function' 
          ? await window.WPP.chat.getActiveChat() 
          : null;
        if (active && (active.isGroup || (active.id?._serialized || '').endsWith('@g.us'))) {
          const parts = await window.WPP.group.getParticipants(active.id);
          if (parts && parts.length > 0) {
            const list = parts.map(p => {
              const pId = p.id?._serialized || p.id || '';
              const digits = pId.replace(/[^\d]/g, '');
              // HANYA flag eksplisit buku telepon: isAddressBookContact === 1
              const isSaved = Boolean(
                p.contact?.isAddressBookContact === 1 || p.contact?.isAddressBookContact === true ||
                p.contact?.__x_isAddressBookContact === 1 || p.contact?.__x_isAddressBookContact === true
              );
              const contactName = p.contact?.name || '';
              const pushname = p.contact?.pushname || '';
              return {
                id: pId,
                phone: digits ? '+' + digits : '',
                name: (isSaved ? contactName : (pushname || contactName || '')),
                isAdmin: Boolean(p.isAdmin || p.isSuperAdmin || p.admin === 'admin'),
                isSaved: isSaved
              };
            });
            return {
              groupTitle: active.name || active.formattedTitle || hintTitle,
              totalCount: list.length,
              participants: list
            };
          }
        }
      } catch (e) {}
    }

    const models = findWhatsAppModels();
    if (!models) return null;

    // Buat pemetaan Kontak ID -> { savedName, pushname, isSaved }
    const contactMap = new Map();
    if (models.contactList) {
      for (const c of models.contactList) {
        const cId = c?.id?._serialized || c?.id || '';
        // HANYA flag eksplisit buku telepon: isAddressBookContact === 1
        const isSaved = Boolean(
          c.isAddressBookContact === 1 || c.isAddressBookContact === true ||
          c.__x_isAddressBookContact === 1 || c.__x_isAddressBookContact === true
        );
        const rawName = c.name || '';
        const pushname = c.pushname || c.formattedName || '';
        const savedName = isSaved ? rawName : '';
        if (cId) contactMap.set(cId, { savedName, pushname, isSaved });
      }
    }

    let targetGroup = null;

    // 1. Cek obrolan yang sedang aktif via getActive()
    if (models.chatCollection) {
      try {
        const active = typeof models.chatCollection.getActive === 'function' 
          ? models.chatCollection.getActive() 
          : (typeof models.chatCollection.getActiveChat === 'function' ? models.chatCollection.getActiveChat() : null);

        if (active && (active.isGroup || (active.id?._serialized || '').endsWith('@g.us'))) {
          targetGroup = active;
        }
      } catch (e) {}
    }

    // 2. Cocokkan dengan nama grup yang sedang dibuka di header
    if (!targetGroup && models.groupList && hintTitle) {
      const cleanHint = hintTitle.toLowerCase().trim();
      targetGroup = models.groupList.find(g => {
        const sId = g?.id?._serialized || g?.id || '';
        if (!sId.endsWith('@g.us')) return false;
        const title = (g.name || g.formattedTitle || g.subject || '').toLowerCase().trim();
        return title && (title.includes(cleanHint) || cleanHint.includes(title));
      });
    }

    // 3. Cek flag active / __x_active pada daftar grup
    if (!targetGroup && models.groupList) {
      targetGroup = models.groupList.find(g => {
        const sId = g?.id?._serialized || g?.id || '';
        return sId.endsWith('@g.us') && (g.active || g.__x_active);
      });
    }

    // 4. Jika masih belum ditemukan, ambil grup dengan peserta terbanyak
    if (!targetGroup && models.groupList) {
      const validGroups = models.groupList.filter(g => (g?.id?._serialized || '').endsWith('@g.us'));
      if (validGroups.length > 0) {
        targetGroup = validGroups.reduce((prev, curr) => {
          const prevMeta = prev.groupMetadata || (prev.getGroupMetadata && prev.getGroupMetadata());
          const currMeta = curr.groupMetadata || (curr.getGroupMetadata && curr.getGroupMetadata());
          const prevCount = prevMeta?.participants?.length || 0;
          const currCount = currMeta?.participants?.length || 0;
          return currCount > prevCount ? curr : prev;
        }, validGroups[0]);
      }
    }

    if (!targetGroup) return null;

    const groupTitle = targetGroup.name || targetGroup.formattedTitle || targetGroup.subject || hintTitle || 'Grup WhatsApp';
    const meta = targetGroup.groupMetadata || (targetGroup.getGroupMetadata && targetGroup.getGroupMetadata());
    if (!meta || !meta.participants) return null;

    const rawParticipants = meta.participants.models || meta.participants;
    const participants = [];

    for (const p of rawParticipants) {
      const pId = p.id ? (p.id._serialized || p.id) : (p._serialized || String(p));
      const digitsOnly = pId.replace(/[^\d]/g, '');
      const cleanPhone = digitsOnly ? '+' + digitsOnly : '';

      const contactInfo = contactMap.get(pId) || {};
      const isSaved = Boolean(
        contactInfo.isSaved ||
        p.contact?.isAddressBookContact === 1 || p.contact?.isAddressBookContact === true ||
        p.contact?.__x_isAddressBookContact === 1 || p.contact?.__x_isAddressBookContact === true
      );
      const rawContactName = p.contact?.name || '';
      const pushname = contactInfo.pushname || p.contact?.pushname || '';
      const savedName = isSaved ? (contactInfo.savedName || rawContactName) : '';
      const displayName = savedName || pushname || rawContactName || '';
      const isAdmin = Boolean(p.isAdmin || p.isSuperAdmin || p.admin === 'admin');

      participants.push({
        id: pId,
        phone: cleanPhone,
        name: displayName,
        isAdmin: isAdmin,
        isSaved: isSaved
      });
    }

    return {
      groupTitle: groupTitle,
      totalCount: participants.length,
      participants: participants
    };
  }

  function getSavedContactsFromStore() {
    const list = [];
    try {
      const models = findWhatsAppModels();
      const contacts = models?.contactList || window.Store?.Contact?.models || [];
      for (const c of contacts) {
        // HANYA flag eksplisit buku telepon: isAddressBookContact === 1
        const isSaved = Boolean(
          c.isAddressBookContact === 1 || c.isAddressBookContact === true ||
          c.__x_isAddressBookContact === 1 || c.__x_isAddressBookContact === true
        );
        if (isSaved) {
          const rawId = c.id?._serialized || c.id || c.phoneNumber || '';
          const digits = String(rawId).replace(/[^\d]/g, '');
          const phone = digits.length >= 8 ? ('+' + digits) : '';
          const name = c.name || c.formattedName || c.displayName || c.shortName || '';
          if (phone || name) {
            list.push({ phone, name });
          }
        }
      }
    } catch (e) {}
    return list;
  }

  // Listener pesan dari content script
  window.addEventListener('message', async function (event) {
    if (!event.data || event.data.source !== 'WA_SCRAPER_CONTENT') return;

    if (event.data.action === 'GET_MY_PHONE') {
      const myPhone = getMyPhoneNumber();
      const savedContacts = getSavedContactsFromStore();
      window.postMessage({
        source: 'WA_SCRAPER_INJECTED',
        action: 'MY_PHONE_RESULT',
        phone: myPhone,
        savedContacts: savedContacts
      }, '*');
      return;
    }

    if (event.data.action === 'GET_ACTIVE_GROUP_DYNAMIC') {
      // Juga kirim nomor akun sendiri & kontak tersimpan
      const myPhone = getMyPhoneNumber();
      const savedContacts = getSavedContactsFromStore();
      if (myPhone) {
        window.postMessage({
          source: 'WA_SCRAPER_INJECTED',
          action: 'MY_PHONE_RESULT',
          phone: myPhone,
          savedContacts: savedContacts
        }, '*');
      }
      if (myPhone) {
        window.postMessage({
          source: 'WA_SCRAPER_INJECTED',
          action: 'MY_PHONE_RESULT',
          phone: myPhone
        }, '*');
      }

      const res = await extractActiveGroupDynamic(event.data.hintTitle || '');
      if (res && res.participants && res.participants.length > 0) {
        window.postMessage({
          source: 'WA_SCRAPER_INJECTED',
          action: 'DYNAMIC_GROUP_RESULT',
          success: true,
          groupTitle: res.groupTitle,
          totalCount: res.totalCount,
          participants: res.participants
        }, '*');
      } else {
        window.postMessage({
          source: 'WA_SCRAPER_INJECTED',
          action: 'DYNAMIC_GROUP_RESULT',
          success: false
        }, '*');
      }
    }
  });

  window.postMessage({
    source: 'WA_SCRAPER_INJECTED',
    action: 'READY'
  }, '*');
})();
