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

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#07090e',
    title: 'LinkSpeed Pro',
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

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Inject electron styling class once DOM is ready
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.executeJavaScript(`
      document.body.classList.add('is-electron');
      if (navigator.platform.includes('Mac')) {
        document.body.classList.add('electron-mac');
      }
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
