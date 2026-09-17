// Tüm webview'ları topla ve herhangi birinden gelen senkron sinyalini
// GÖNDEREN HARİÇ diğer tüm grafiklere ilet (N grafik destekler).
const views = Array.from(document.querySelectorAll('webview'));

const FORWARD_CHANNELS = ['sync-crosshair-time', 'hide-crosshair'];

views.forEach((source) => {
  source.addEventListener('ipc-message', (event) => {
    if (!FORWARD_CHANNELS.includes(event.channel)) return;

    const payload = event.args[0];
    for (const target of views) {
      if (target === source) continue;
      target.send(event.channel === 'hide-crosshair' ? 'hide-crosshair' : 'apply-crosshair', payload);
    }
  });
});

// Bir webview render sorunu yaşarsa konsola düşsün (hata ayıklama kolaylığı)
views.forEach((view) => {
  view.addEventListener('console-message', (e) => {
    if (e.level === 3) console.error(`[${view.id}]`, e.message);
  });
});
