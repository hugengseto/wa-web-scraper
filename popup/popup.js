document.addEventListener('DOMContentLoaded', async () => {
  const indicator = document.getElementById('status-indicator');
  const title = document.getElementById('status-title');
  const desc = document.getElementById('status-desc');
  const openBtn = document.getElementById('btn-open-wa');

  // Periksa apakah tab aktif saat ini adalah WhatsApp Web
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (currentTab && currentTab.url && currentTab.url.includes('web.whatsapp.com')) {
      indicator.classList.add('active');
      title.textContent = 'WhatsApp Web Terdeteksi';
      desc.textContent = 'Widget tombol scraping sudah aktif di pojok kanan bawah halaman.';
      openBtn.textContent = 'Beralih ke WhatsApp Web';
    } else {
      indicator.classList.remove('active');
      title.textContent = 'WhatsApp Web Belum Terbuka';
      desc.textContent = 'Silakan buka web.whatsapp.com untuk menggunakan ekstensi.';
    }
  } catch (err) {
    console.error('Gagal memeriksa tab:', err);
  }

  // Tombol aksi Buka / Pindah ke WhatsApp Web
  openBtn.addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
    if (tabs && tabs.length > 0) {
      // Jika tab sudah ada, langsung aktifkan tab tersebut
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      // Jika belum ada, buat tab baru
      chrome.tabs.create({ url: 'https://web.whatsapp.com' });
    }
    window.close();
  });
});
