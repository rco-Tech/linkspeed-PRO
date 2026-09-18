// ==========================================================================
// LINKSPEED PRO — ELECTRON DESKTOP RUNTIME
// ==========================================================================
// Provides a 1-click standalone desktop application without terminal commands.

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');

let mainWindow = null;
let serverProcess = null;
const PORT = Number(process.env.PORT) || 4321;

/**
 * Ensures the native bridge daemon is running.
 * If already active (e.g. background service), connects to it.
 * Otherwise, forks server.js internally with silent stdio.
 */
function ensureServerRunning() {
  return new Promise((resolve) => {
    // Probe existing instance
    const probe = http.get(`http://127.0.0.1:${PORT}/api/system`, (res) => {
      if (res.statusCode === 200) {
        console.log(`[LinkSpeed Desktop] Connected to existing daemon on port ${PORT}`);
        return resolve(true);
      }
    });

    probe.on('error', () => {
      // Not running, launch child process
      console.log(`[LinkSpeed Desktop] Launching internal hardware bridge on port ${PORT}...`);
      const serverScript = path.join(__dirname, 'server.js');
      
      serverProcess = fork(serverScript, [], {
        env: {
          ...process.env,
          PORT: String(PORT),
          NO_OPEN: '1' // Prevent spawning separate browser window
        },
        stdio: 'ignore'
      });

      // Poll until HTTP service is ready
      let retries = 0;
      const pollInterval = setInterval(() => {
        http.get(`http://127.0.0.1:${PORT}/api/system`, (res) => {
          if (res.statusCode === 200) {
            clearInterval(pollInterval);
            console.log(`[LinkSpeed Desktop] Internal daemon ready.`);
            resolve(true);
          }
        }).on('error', () => {
          retries++;
          if (retries > 40) {
            clearInterval(pollInterval);
            console.error('[LinkSpeed Desktop] Daemon startup timed out, continuing anyway.');
            resolve(false);
          }
        });
      }, 150);
    });
  });
}

function createMainWindow() {
  const isMac = process.platform === 'darwin';
  const { screen, Menu } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

  const winW = Math.min(1360, Math.max(880, Math.floor(screenW * 0.92)));
  const winH = Math.min(920, Math.max(640, Math.floor(screenH * 0.92)));

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    minWidth: 760,
    minHeight: 540,
    backgroundColor: '#07090e',
    title: 'LinkSpeed Pro v1.1.2',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 18 },
    icon: path.join(__dirname, 'public', 'icons', 'icon-512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    show: false
  });

  // Application Menu (macOS App Menu and Cross-Platform Help/About)
  const menuTemplate = [
    ...(isMac ? [{
      label: 'LinkSpeed Pro',
      submenu: [
        {
          label: 'About LinkSpeed Pro',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                if (typeof openAboutModal === 'function') openAboutModal();
              `);
            }
          }
        },
        {
          label: 'Preferences / About...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                if (typeof openAboutModal === 'function') openAboutModal();
              `);
            }
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About LinkSpeed Pro & Version Info',
          accelerator: 'F1',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                if (typeof openAboutModal === 'function') openAboutModal();
              `);
            }
          }
        },
        {
          label: 'GitHub Repository & Releases',
          click: () => {
            shell.openExternal('https://github.com/rco-Tech/linkspeed-PRO/releases');
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Inject electron styling class and app version once DOM is ready
  mainWindow.webContents.on('dom-ready', () => {
    const appVersion = app.getVersion();
    mainWindow.webContents.executeJavaScript(`
      document.body.classList.add('is-electron');
      if (navigator.platform.includes('Mac')) {
        document.body.classList.add('electron-mac');
      }
      window.__ELECTRON_APP_VERSION__ = '${appVersion}';
      const brandVer = document.getElementById('btnBrandVersion');
      if (brandVer) brandVer.textContent = 'v${appVersion}';
      const aboutVerPill = document.querySelector('.about-title-row .version-pill');
      if (aboutVerPill) aboutVerPill.textContent = 'v${appVersion}';
      const aboutVerStat = document.getElementById('aboutReleaseVer');
      if (aboutVerStat) aboutVerStat.textContent = 'v${appVersion} (Production)';
    `);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Direct external hyperlinks (e.g. GitHub repo, docs) to default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  const { session } = require('electron');
  try {
    if (session && session.defaultSession) {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] });
    }
  } catch (err) {
    console.warn('Session clear warning:', err.message);
  }

  await ensureServerRunning();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    try {
      serverProcess.kill('SIGTERM');
    } catch (e) {}
  }
});
