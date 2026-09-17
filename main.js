const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: '#131722',
    webPreferences: {
      // <webview> etiketinin çalışması için ZORUNLU
      webviewTag: true,
      // Ana pencerede node entegrasyonu gerekmez (webview'ler kendi preload'ını kullanır)
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // macOS'ta dock ikonuna tıklanınca pencere yoksa yeniden aç
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
