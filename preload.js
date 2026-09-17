const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  let pendingMove = null;
  let lastSent = ''; // Son gönderilen verinin parmak izi (tekrar gönderimi engeller)

  // Fare sadece grafik alanındaysa işlem yap
  const isChartArea = (e) => e.target && e.target.tagName === 'CANVAS';

  // TradingView'in zaman ekseni tooltip'ini bulmaya çalış (seçiciler DOM'a göre esnek)
  const findTimeTooltip = () => {
    const selectors = [
      '[class*="timeAxis"] [class*="tooltip"]',
      '[class*="time-axis"] [class*="tooltip"]',
      'div[class*="value-"][class*="time-"]',
      '[data-name="time-axis-tooltip"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && (el.innerText || '').trim()) return el;
    }
    return null;
  };

  // -------------------------------------------------------------
  // 1. ZAMANI VE KOORDİNATLARI OKUYUP KARŞI GRAFİĞE GÖNDERME
  // -------------------------------------------------------------
  window.addEventListener('pointermove', (e) => {
    if (!e.isTrusted || !isChartArea(e)) return;

    // Önceki kareyi iptal et -> animasyon karesi başına en fazla 1 gönderim
    if (pendingMove) cancelAnimationFrame(pendingMove);

    pendingMove = requestAnimationFrame(() => {
      const timeTooltip = findTimeTooltip();
      const currentTime = timeTooltip ? (timeTooltip.innerText || timeTooltip.textContent).trim() : '';

      // Yalnızca zaman, X veya Y GERÇEKTEN değiştiyse gönder (IPC selini önler)
      const fingerprint = `${currentTime}|${e.clientX}|${e.clientY}`;
      if (fingerprint === lastSent) return;
      lastSent = fingerprint;

      ipcRenderer.sendToHost('sync-crosshair-time', {
        timeText: currentTime,
        clientX: e.clientX, // Zoomlar eşitse doğrudan kullanılır
        clientY: e.clientY  // Yatay fiyat çizgisi için Y ekseni
      });
    });
  });

  // Fare grafikten ayrılınca karşı grafikteki crosshair'ı da gizle
  window.addEventListener('pointerout', (e) => {
    if (!e.isTrusted || !isChartArea(e)) return;
    lastSent = '';
    ipcRenderer.sendToHost('hide-crosshair');
  });

  // -------------------------------------------------------------
  // 2. GELEN ZAMAN BİLGİSİNİ ALIP SENTETİK CROSSHAIR ÇİZDİRME
  // -------------------------------------------------------------
  const getChartCanvas = () =>
    document.querySelector('.chart-gui-wrapper canvas') || document.querySelector('canvas');

  const buildEventInit = (x, y) => ({
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
    view: window,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true
  });

  // Hedef zaman metni için zaman eksenindeki en iyi etiketi bul.
  // En dar (en spesifik) eşleşen etiketi seçerek nested div hatasını önler.
  const findLabelX = (timeText) => {
    const bottomArea = document.querySelector('.layout__area--bottom') || document.body;
    const candidates = [];

    for (const el of bottomArea.querySelectorAll('div')) {
      const text = (el.textContent || '').trim();
      if (!text || !timeText.includes(text)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.top < 0) continue;
      candidates.push({ x: rect.left + rect.width / 2, width: rect.width });
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.width - b.width); // en dar etiket = en kesin eşleşme
    return candidates[0].x;
  };

  ipcRenderer.on('apply-crosshair', (event, data) => {
    const canvas = getChartCanvas();
    if (!canvas) return;

    let targetX = data.clientX; // Zoomlar eşitse doğrudan X kullanılır

    // Zoomlar bağımsızsa X'i zamana göre hizala
    if (data.timeText) {
      const labelX = findLabelX(data.timeText);
      if (labelX !== null) targetX = labelX;
    }

    const init = buildEventInit(targetX, data.clientY);
    // TradingView'e gerçek fare hareketi gibi davran -> dikey + yatay kesikli çizgiler
    canvas.dispatchEvent(new PointerEvent('pointermove', init));
    canvas.dispatchEvent(new MouseEvent('mousemove', init));
  });

  ipcRenderer.on('hide-crosshair', () => {
    const canvas = getChartCanvas();
    if (!canvas) return;
    // TradingView crosshair'ı pointerout/leave ile gizler
    canvas.dispatchEvent(new PointerEvent('pointerout', buildEventInit(0, 0)));
    canvas.dispatchEvent(new PointerEvent('pointerleave', buildEventInit(0, 0)));
    canvas.dispatchEvent(new MouseEvent('mouseout', buildEventInit(0, 0)));
  });
});
