// ==========================================================================
// LINKSPEED PRO — CLIENT APPLICATION LOGIC
// ==========================================================================

(function () {
  'use strict';

  // State
  let allDevices = [];
  let systemInfo = {};
  let stats = {};
  let activeFilter = 'all';
  let searchQuery = '';
  let selectedDevice = null;
  let sseEventSource = null;
  let hotplugEvents = [];
  let isMuted = localStorage.getItem('linkspeed_muted') === 'true';
  let deferredInstallPrompt = null;

  // Audio Context (Synthesizer for non-intrusive futuristic audio cues)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) audioCtx = new AudioCtxClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playChime(type) {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === 'connect') {
        // Futuristic double-pip chime (high-pitched, pleasant)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now); // A5
        osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08); // E6
        gain1.gain.setValueAtTime(0.08, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.12);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1760, now + 0.09); // A6
        gain2.gain.setValueAtTime(0.08, now + 0.09);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.09);
        osc2.stop(now + 0.22);
      } else if (type === 'disconnect') {
        // Descending low tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.15); // E4
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'alert') {
        // Bottleneck warning tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(349.23, now + 0.1);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (err) {
      console.warn('Audio feedback skipped:', err);
    }
  }

  // -------------------------------------------------------------
  // DOM Elements
  // -------------------------------------------------------------
  const el = {
    connectionStatus: document.getElementById('connectionStatus'),
    connectionStatusText: document.getElementById('connectionStatusText'),
    btnAudioToggle: document.getElementById('btnAudioToggle'),
    audioIcon: document.getElementById('audioIcon'),
    btnInstallPwa: document.getElementById('btnInstallPwa'),
    btnSimulate: document.getElementById('btnSimulate'),
    simMenu: document.getElementById('simMenu'),
    navTabs: document.getElementById('navTabs'),
    eventBadge: document.getElementById('eventBadge'),

    // Stats
    valTotalDevices: document.getElementById('valTotalDevices'),
    valControllers: document.getElementById('valControllers'),
    valSpeedUsb4: document.getElementById('valSpeedUsb4'),
    valSpeedSs10: document.getElementById('valSpeedSs10'),
    valSpeedSs5: document.getElementById('valSpeedSs5'),
    valSpeedHs480: document.getElementById('valSpeedHs480'),
    valBottlenecks: document.getElementById('valBottlenecks'),
    bottleneckSub: document.getElementById('bottleneckSub'),

    // Workbench Elements
    cableSpeedDisplay: document.getElementById('cableSpeedDisplay'),
    cableTierDisplay: document.getElementById('cableTierDisplay'),
    cableBadge: document.getElementById('cableBadge'),
    cableLine: document.getElementById('cableLine'),
    visDeviceName: document.getElementById('visDeviceName'),
    visDeviceMfg: document.getElementById('visDeviceMfg'),
    visDeviceSpec: document.getElementById('visDeviceSpec'),
    visDeviceIcon: document.getElementById('visDeviceIcon'),
    visDeviceNode: document.getElementById('visDeviceNode'),
    diagnosticBanner: document.getElementById('diagnosticBanner'),
    diagIcon: document.getElementById('diagIcon'),
    diagTitle: document.getElementById('diagTitle'),
    diagBody: document.getElementById('diagBody'),
    diagAction: document.getElementById('diagAction'),

    // Speedometer
    gaugeMeterPath: document.getElementById('gaugeMeterPath'),
    gaugeDigitalVal: document.getElementById('gaugeDigitalVal'),
    gaugeDigitalUnit: document.getElementById('gaugeDigitalUnit'),
    gaugeTierTag: document.getElementById('gaugeTierTag'),
    gaugeSpecVal: document.getElementById('gaugeSpecVal'),
    gaugePowerVal: document.getElementById('gaugePowerVal'),
    gaugeLanesVal: document.getElementById('gaugeLanesVal'),
    spotlightSlider: document.getElementById('spotlightSlider'),
    workbenchCount: document.getElementById('workbenchCount'),

    // Grid & Filter
    searchInput: document.getElementById('searchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    filterGroup: document.getElementById('filterGroup'),
    devicesGrid: document.getElementById('devicesGrid'),

    // Tree & Timeline
    treeContainer: document.getElementById('treeContainer'),
    btnExpandAll: document.getElementById('btnExpandAll'),
    btnCollapseAll: document.getElementById('btnCollapseAll'),
    btnExportJson: document.getElementById('btnExportJson'),
    timelineContainer: document.getElementById('timelineContainer'),
    btnClearTimeline: document.getElementById('btnClearTimeline'),

    // WebUSB Lab
    btnRequestWebUsb: document.getElementById('btnRequestWebUsb'),
    webUsbOutput: document.getElementById('webUsbOutput'),
    daemonOs: document.getElementById('daemonOs'),

    // Inspector Drawer
    drawerOverlay: document.getElementById('drawerOverlay'),
    inspectorDrawer: document.getElementById('inspectorDrawer'),
    btnDrawerClose: document.getElementById('btnDrawerClose'),
    drawerSpeedTag: document.getElementById('drawerSpeedTag'),
    drawerProduct: document.getElementById('drawerProduct'),
    drawerManufacturer: document.getElementById('drawerManufacturer'),
    drawerAlert: document.getElementById('drawerAlert'),
    drawerAlertText: document.getElementById('drawerAlertText'),
    specSpeed: document.getElementById('specSpeed'),
    specSpeedTier: document.getElementById('specSpeedTier'),
    specVersion: document.getElementById('specVersion'),
    specLanes: document.getElementById('specLanes'),
    specCableEval: document.getElementById('specCableEval'),
    specMaxPower: document.getElementById('specMaxPower'),
    specPowerSource: document.getElementById('specPowerSource'),
    specRemovable: document.getElementById('specRemovable'),
    specVid: document.getElementById('specVid'),
    specPid: document.getElementById('specPid'),
    specVendorLookup: document.getElementById('specVendorLookup'),
    specSerial: document.getElementById('specSerial'),
    specBcdDevice: document.getElementById('specBcdDevice'),
    specNodeId: document.getElementById('specNodeId'),
    specBusNum: document.getElementById('specBusNum'),
    specDevNum: document.getElementById('specDevNum'),
    specSysfs: document.getElementById('specSysfs'),
    btnCopyJson: document.getElementById('btnCopyJson'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),

    // Server Launcher & Offline controls
    btnHeaderStartServer: document.getElementById('btnHeaderStartServer'),
    offlineBanner: document.getElementById('offlineBanner'),
    btnQuickCopy: document.getElementById('btnQuickCopy'),
    btnOpenServerModal: document.getElementById('btnOpenServerModal'),
    serverModalBackdrop: document.getElementById('serverModalBackdrop'),
    btnCloseServerModal: document.getElementById('btnCloseServerModal'),
    btnDismissServerModal: document.getElementById('btnDismissServerModal'),
    btnCopyTerminal: document.getElementById('btnCopyTerminal'),
    btnCopyNpx: document.getElementById('btnCopyNpx'),
    btnCopyBg: document.getElementById('btnCopyBg'),
    btnDownloadLauncher: document.getElementById('btnDownloadLauncher'),
    codeTerminal: document.getElementById('codeTerminal'),
    codeNpx: document.getElementById('codeNpx'),
    codeBg: document.getElementById('codeBg'),
    smStatusMsg: document.getElementById('smStatusMsg')
  };

  // -------------------------------------------------------------
  // Initial Setup & PWA Registration
  // -------------------------------------------------------------
  function init() {
    setupPwa();
    setupAudioUI();
    setupTabs();
    setupSearchAndFilters();
    setupSimulator();
    setupDrawer();
    setupWebUsbLab();
    setupServerModal();
    connectSseStream();
  }

  function setupPwa() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('LinkSpeed Pro ServiceWorker registered:', reg.scope);
      }).catch((err) => {
        console.warn('ServiceWorker registration error:', err);
      });
    }

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (el.btnInstallPwa) el.btnInstallPwa.style.display = 'inline-flex';
    });

    if (el.btnInstallPwa) {
      el.btnInstallPwa.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          el.btnInstallPwa.style.display = 'none';
        }
        deferredInstallPrompt = null;
      });
    }

    window.addEventListener('appinstalled', () => {
      showToast('🎉 LinkSpeed Pro installed as standalone desktop app!', 'add');
      if (el.btnInstallPwa) el.btnInstallPwa.style.display = 'none';
    });
  }

  function setupAudioUI() {
    updateAudioIcon();
    el.btnAudioToggle.addEventListener('click', () => {
      isMuted = !isMuted;
      localStorage.setItem('linkspeed_muted', isMuted ? 'true' : 'false');
      updateAudioIcon();
      if (!isMuted) playChime('connect');
    });
  }

  function updateAudioIcon() {
    el.audioIcon.textContent = isMuted ? '🔕' : '🔔';
    el.btnAudioToggle.title = isMuted ? 'Unmute hotplug sound chimes' : 'Mute hotplug sound chimes';
  }

  function setupTabs() {
    const tabButtons = el.navTabs.querySelectorAll('.nav-tab');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-pane').forEach((pane) => {
          pane.classList.remove('active');
        });
        const activePane = document.getElementById(`pane${capitalize(tabName)}`);
        if (activePane) activePane.classList.add('active');
      });
    });

    // Stats bar cards also act as quick filters
    document.querySelectorAll('.stat-card[data-filter]').forEach((card) => {
      card.addEventListener('click', () => {
        const filterVal = card.getAttribute('data-filter');
        // Switch to grid tab
        const gridTab = document.getElementById('tabGrid');
        if (gridTab) gridTab.click();
        // Activate matching filter chip
        const chip = document.querySelector(`.filter-chip[data-filter="${filterVal}"]`);
        if (chip) chip.click();
      });
    });
  }

  function setupSearchAndFilters() {
    el.searchInput.addEventListener('input', (e) => {
      searchQuery = (e.target.value || '').trim().toLowerCase();
      el.btnClearSearch.style.display = searchQuery ? 'block' : 'none';
      renderGrid();
    });

    el.btnClearSearch.addEventListener('click', () => {
      el.searchInput.value = '';
      searchQuery = '';
      el.btnClearSearch.style.display = 'none';
      renderGrid();
    });

    el.filterGroup.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        el.filterGroup.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.getAttribute('data-filter');
        renderGrid();
      });
    });

    el.btnClearTimeline.addEventListener('click', () => {
      hotplugEvents = [];
      el.eventBadge.textContent = '0';
      renderTimeline();
    });

    el.btnExportJson.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
        system: systemInfo,
        stats: stats,
        devices: allDevices,
        exportedAt: new Date().toISOString()
      }, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `linkspeed-report-${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Hardware report exported as JSON', 'add');
    });
  }

  function setupSimulator() {
    el.btnSimulate.addEventListener('click', (e) => {
      e.stopPropagation();
      el.simMenu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!el.simMenu.contains(e.target) && e.target !== el.btnSimulate) {
        el.simMenu.classList.remove('open');
      }
    });

    el.simMenu.querySelectorAll('.sim-menu-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const speed = parseInt(item.getAttribute('data-speed'), 10);
        const name = item.getAttribute('data-name');
        el.simMenu.classList.remove('open');

        try {
          const res = await fetch('/api/simulate-plug', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speed, product: name })
          });
          const result = await res.json();
          if (result.ok) {
            showToast(`Simulated: ${name} (${result.device.speedInfo.label})`, 'add');
          }
        } catch (err) {
          console.error('Simulation error:', err);
        }
      });
    });
  }

  function setupDrawer() {
    el.btnDrawerClose.addEventListener('click', closeDrawer);
    el.drawerOverlay.addEventListener('click', closeDrawer);

    el.btnCopyJson.addEventListener('click', () => {
      if (!selectedDevice) return;
      navigator.clipboard.writeText(JSON.stringify(selectedDevice, null, 2)).then(() => {
        showToast('Device JSON copied to clipboard!', 'add');
      });
    });
  }

  function setupWebUsbLab() {
    el.btnRequestWebUsb.addEventListener('click', async () => {
      if (!navigator.usb) {
        el.webUsbOutput.textContent = '❌ WebUSB is not supported in this browser (Safari and Firefox do not implement WebUSB).';
        return;
      }
      try {
        el.webUsbOutput.textContent = 'Opening browser device picker dialog...\n';
        const device = await navigator.usb.requestDevice({ filters: [] });
        el.webUsbOutput.textContent = `✔️ Device Granted by User!\n\n` +
          `Product Name: ${device.productName || 'Unknown'}\n` +
          `Manufacturer: ${device.manufacturerName || 'Unknown'}\n` +
          `Vendor ID: 0x${device.vendorId.toString(16).padStart(4, '0')}\n` +
          `Product ID: 0x${device.productId.toString(16).padStart(4, '0')}\n` +
          `USB Version: ${device.usbVersionMajor}.${device.usbVersionMinor}\n` +
          `\n⚠️ NOTICE: Notice that device.speed is UNDEFINED in WebUSB. WebUSB cannot determine if this device is negotiating at 10 Gb/s or 480 Mb/s. LinkSpeed Pro uses the local kernel daemon to give you exact physical link speed!`;
      } catch (err) {
        el.webUsbOutput.textContent = `WebUSB Picker cancelled or failed: ${err.message}\n(Note: OS-controlled drives and mass storage will not show in WebUSB for security)`;
      }
    });
  }

  // -------------------------------------------------------------
  // Server Launcher Modal & Offline Handlers
  // -------------------------------------------------------------
  function openServerModal() {
    if (el.serverModalBackdrop) {
      el.serverModalBackdrop.style.display = 'flex';
      if (el.smStatusMsg) {
        el.smStatusMsg.textContent = 'Listening for server on http://localhost:4321 ... (auto-closes on connection)';
      }
    }
  }

  function closeServerModal() {
    if (el.serverModalBackdrop) {
      el.serverModalBackdrop.style.display = 'none';
    }
  }

  function setupServerModal() {
    // Open modal triggers
    if (el.btnOpenServerModal) {
      el.btnOpenServerModal.addEventListener('click', openServerModal);
    }
    if (el.btnHeaderStartServer) {
      el.btnHeaderStartServer.addEventListener('click', openServerModal);
    }
    if (el.connectionStatus) {
      el.connectionStatus.addEventListener('click', () => {
        if (el.connectionStatus.classList.contains('clickable') || el.connectionStatus.classList.contains('disconnected')) {
          openServerModal();
        }
      });
    }

    // Close modal triggers
    if (el.btnCloseServerModal) {
      el.btnCloseServerModal.addEventListener('click', closeServerModal);
    }
    if (el.btnDismissServerModal) {
      el.btnDismissServerModal.addEventListener('click', closeServerModal);
    }
    if (el.serverModalBackdrop) {
      el.serverModalBackdrop.addEventListener('click', (e) => {
        if (e.target === el.serverModalBackdrop) {
          closeServerModal();
        }
      });
    }

    // Escape key closes modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el.serverModalBackdrop && el.serverModalBackdrop.style.display !== 'none') {
        closeServerModal();
      }
    });

    // Copy helper with feedback and fallback
    function copyText(text, button, successMsg) {
      if (!button) return;
      const originalText = button.innerHTML;
      const doSuccess = () => {
        button.innerHTML = '✓ Copied!';
        button.classList.add('copied');
        showToast(successMsg, 'add');
        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove('copied');
        }, 2000);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(doSuccess).catch(() => fallbackCopy(text, doSuccess));
      } else {
        fallbackCopy(text, doSuccess);
      }
    }

    function fallbackCopy(text, cb) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        cb();
      } catch (err) {
        showToast('Please copy command manually from dialog', 'remove');
      }
      document.body.removeChild(ta);
    }

    const startCmd = el.codeTerminal ? el.codeTerminal.innerText.trim() : 'cd /home/robert/Projects/active-link-speed && ./start.sh';
    const npxCmd = el.codeNpx ? el.codeNpx.innerText.trim() : 'npx github:rco-Tech/linkspeed-PRO';
    const bgCmd = el.codeBg ? el.codeBg.innerText.trim() : 'nohup node /home/robert/Projects/active-link-speed/server.js > /dev/null 2>&1 &';

    if (el.btnQuickCopy) {
      el.btnQuickCopy.addEventListener('click', () => {
        copyText(startCmd, el.btnQuickCopy, 'Startup command copied to clipboard!');
      });
    }

    if (el.btnCopyTerminal) {
      el.btnCopyTerminal.addEventListener('click', () => {
        copyText(startCmd, el.btnCopyTerminal, 'Terminal startup command copied!');
      });
    }

    if (el.btnCopyNpx) {
      el.btnCopyNpx.addEventListener('click', () => {
        copyText(npxCmd, el.btnCopyNpx, 'npx launch command copied!');
      });
    }

    if (el.btnCopyBg) {
      el.btnCopyBg.addEventListener('click', () => {
        copyText(bgCmd, el.btnCopyBg, 'Background daemon command copied!');
      });
    }

    if (el.btnDownloadLauncher) {
      el.btnDownloadLauncher.addEventListener('click', () => {
        const script = `#!/bin/bash\n# LinkSpeed Pro Auto-Launcher\ncd "/home/robert/Projects/active-link-speed" || cd "\$(dirname "\$0")"\necho "Starting LinkSpeed Pro Daemon on http://localhost:4321 ..."\n./start.sh || node server.js\n`;
        const blob = new Blob([script], { type: 'application/x-sh' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'start-linkspeed.command';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Downloaded start-linkspeed.command! Double-click to run in Terminal.', 'add');
      });
    }
  }

  // -------------------------------------------------------------
  // Real-Time Server-Sent Events (SSE) Client
  // -------------------------------------------------------------
  function connectSseStream() {
    if (sseEventSource) {
      sseEventSource.close();
    }

    el.connectionStatus.className = 'status-pill connecting';
    el.connectionStatusText.textContent = 'CONNECTING...';

    sseEventSource = new EventSource('/api/stream');

    sseEventSource.onopen = () => {
      el.connectionStatus.className = 'status-pill connected';
      el.connectionStatusText.textContent = 'LIVE DAEMON';
      el.connectionStatus.classList.remove('clickable');
      el.connectionStatus.title = 'Real-time Sub-second Hotplug Watcher Active';
      if (el.offlineBanner) el.offlineBanner.style.display = 'none';
      if (el.btnHeaderStartServer) el.btnHeaderStartServer.style.display = 'none';

      if (el.serverModalBackdrop && el.serverModalBackdrop.style.display !== 'none') {
        if (el.smStatusMsg) {
          el.smStatusMsg.innerHTML = '<span style="color:var(--c-green); font-weight:bold;">🟢 Daemon Connected Successfully! Closing...</span>';
        }
        playChime('connect');
        setTimeout(() => {
          closeServerModal();
        }, 1100);
      }
    };

    sseEventSource.addEventListener('initial-state', (e) => {
      try {
        const payload = JSON.parse(e.data);
        systemInfo = payload.hostInfo || {};
        stats = payload.stats || {};
        allDevices = payload.devices || [];

        if (el.daemonOs) {
          el.daemonOs.textContent = `${systemInfo.platform || 'Linux'} (${systemInfo.release || ''})`;
        }

        // Auto-select first non-root device for the Cable Workbench
        const externalDev = allDevices.find(d => !d.isRootHub && !d.isHub) || allDevices.find(d => !d.isRootHub) || allDevices[0];
        if (externalDev) {
          selectedDevice = externalDev;
        }

        updateStatsBar();
        renderWorkbench();
        renderGrid();
        renderTree();
      } catch (err) {
        console.error('Failed to parse initial state:', err);
      }
    });

    sseEventSource.addEventListener('device-connected', (e) => {
      try {
        const payload = JSON.parse(e.data);
        const dev = payload.device;
        console.log('SSE device-connected:', dev);

        // Add or update in list
        const existingIdx = allDevices.findIndex(d => d.id === dev.id);
        if (existingIdx >= 0) {
          allDevices[existingIdx] = dev;
        } else {
          allDevices.unshift(dev);
        }

        // Always spotlight freshly plugged device in the Cable Workbench
        selectedDevice = dev;

        // Sound cue
        if (dev.bottleneck && dev.bottleneck.isBottleneck) {
          playChime('alert');
          showToast(`⚠️ CABLE BOTTLENECK: ${dev.product} throttled to ${dev.speedInfo.label}!`, 'remove');
        } else {
          playChime('connect');
          showToast(`⚡ Plugged: ${dev.product} (${dev.speedInfo.label})`, 'add');
        }

        // Add to timeline
        addTimelineEvent({
          type: 'add',
          title: `Device Plugged: ${dev.product}`,
          sub: `${dev.vendorName || dev.manufacturer || 'USB Device'} · Negotiated Speed: ${dev.speedInfo.fullLabel}`,
          time: new Date(payload.timestamp || Date.now()).toLocaleTimeString()
        });

        // Trigger visual plug animation in visualizer
        triggerPlugAnimation();

        refreshAllViews();
      } catch (err) {
        console.error('Error handling device-connected:', err);
      }
    });

    sseEventSource.addEventListener('device-disconnected', (e) => {
      try {
        const payload = JSON.parse(e.data);
        const devId = payload.id;
        const prevDev = payload.device || allDevices.find(d => d.id === devId);
        const devName = prevDev ? prevDev.product : devId;

        allDevices = allDevices.filter(d => d.id !== devId);

        playChime('disconnect');
        showToast(`🔌 Unplugged: ${devName}`, 'remove');

        addTimelineEvent({
          type: 'remove',
          title: `Device Unplugged: ${devName}`,
          sub: prevDev ? `Was operating at ${prevDev.speedInfo.label}` : 'Disconnected from port',
          time: new Date(payload.timestamp || Date.now()).toLocaleTimeString()
        });

        // If active workbench device was removed, fallback
        if (selectedDevice && selectedDevice.id === devId) {
          const fallback = allDevices.find(d => !d.isRootHub && !d.isHub) || allDevices[0] || null;
          selectedDevice = fallback;
        }

        refreshAllViews();
      } catch (err) {
        console.error('Error handling device-disconnected:', err);
      }
    });

    sseEventSource.addEventListener('device-speed-changed', (e) => {
      try {
        const payload = JSON.parse(e.data);
        const dev = payload.device;
        showToast(`⚡ Speed Changed: ${dev.product} (${payload.previousSpeed.label} ➔ ${payload.newSpeed.label})`, 'add');
        playChime('connect');

        const idx = allDevices.findIndex(d => d.id === dev.id);
        if (idx >= 0) allDevices[idx] = dev;
        if (selectedDevice && selectedDevice.id === dev.id) selectedDevice = dev;

        addTimelineEvent({
          type: 'update',
          title: `Link Renegotiated: ${dev.product}`,
          sub: `Transitioned from ${payload.previousSpeed.label} to ${payload.newSpeed.label}`,
          time: new Date(payload.timestamp || Date.now()).toLocaleTimeString()
        });

        refreshAllViews();
      } catch (err) {
        console.error('Error handling speed change:', err);
      }
    });

    sseEventSource.onerror = () => {
      el.connectionStatus.className = 'status-pill disconnected clickable';
      el.connectionStatusText.textContent = 'OFFLINE · START SERVER ⚡';
      el.connectionStatus.title = 'Click to view server start commands & options';
      if (el.offlineBanner) el.offlineBanner.style.display = 'flex';
      if (el.btnHeaderStartServer) el.btnHeaderStartServer.style.display = 'inline-flex';
      setTimeout(connectSseStream, 3000);
    };
  }

  function refreshAllViews() {
    recalculateStats();
    updateStatsBar();
    renderWorkbench();
    renderGrid();
    renderTree();
  }

  function recalculateStats() {
    stats = {
      total: allDevices.length,
      controllers: allDevices.filter(d => d.isRootHub).length,
      bottlenecks: allDevices.filter(d => d.bottleneck && d.bottleneck.isBottleneck).length,
      speedBreakdown: {
        usb4: allDevices.filter(d => d.speedInfo.tier === 'usb4').length,
        ss20: allDevices.filter(d => d.speedInfo.tier === 'ss20').length,
        ss10: allDevices.filter(d => d.speedInfo.tier === 'ss10').length,
        ss5: allDevices.filter(d => d.speedInfo.tier === 'ss5').length,
        hs480: allDevices.filter(d => d.speedInfo.tier === 'hs480').length,
        fs12: allDevices.filter(d => d.speedInfo.tier === 'fs12' || d.speedInfo.tier === 'ls1').length
      }
    };
  }

  function updateStatsBar() {
    el.valTotalDevices.textContent = allDevices.length;
    el.valControllers.textContent = `${stats.controllers || 0} controllers`;
    el.valSpeedUsb4.textContent = (stats.speedBreakdown && stats.speedBreakdown.usb4) || 0;
    el.valSpeedSs10.textContent = (stats.speedBreakdown && stats.speedBreakdown.ss10) || 0;
    el.valSpeedSs5.textContent = (stats.speedBreakdown && stats.speedBreakdown.ss5) || 0;
    el.valSpeedHs480.textContent = (stats.speedBreakdown && stats.speedBreakdown.hs480) || 0;

    const bCount = stats.bottlenecks || 0;
    el.valBottlenecks.textContent = bCount;
    if (bCount > 0) {
      el.bottleneckSub.textContent = `${bCount} degraded cable link${bCount > 1 ? 's' : ''}!`;
      el.bottleneckSub.classList.add('text-red');
    } else {
      el.bottleneckSub.textContent = 'No degraded links';
      el.bottleneckSub.classList.remove('text-red');
    }
  }

  // -------------------------------------------------------------
  // Render Cable Workbench (Hero Component)
  // -------------------------------------------------------------
  function renderWorkbench() {
    const dev = selectedDevice;

    if (!dev) {
      el.cableSpeedDisplay.textContent = 'WAITING...';
      el.cableTierDisplay.textContent = 'Plug in a cable & device to test';
      el.visDeviceName.textContent = 'No Device Selected';
      el.visDeviceMfg.textContent = 'Plug in a USB peripheral or choose from below';
      el.visDeviceSpec.textContent = 'Hardware Capable: --';
      el.gaugeDigitalVal.textContent = '--';
      el.gaugeDigitalUnit.textContent = 'NEGOTIATED LINK';
      el.gaugeTierTag.textContent = 'INACTIVE';
      el.gaugeMeterPath.style.strokeDashoffset = '346';
      el.diagnosticBanner.className = 'diagnostic-banner optimal';
      el.diagTitle.textContent = 'Ready to Inspect USB Cable';
      el.diagBody.textContent = 'Connect your device with the cable you want to test. LinkSpeed Pro will measure the actual negotiated link speed.';
      el.diagAction.innerHTML = '';
      return;
    }

    const speedInfo = dev.speedInfo || { label: '--', fullLabel: '--', numericMb: 0, tier: 'unknown' };
    const bottleneck = dev.bottleneck || { isBottleneck: false };

    // Cable visual line
    el.cableSpeedDisplay.textContent = speedInfo.label;
    el.cableTierDisplay.textContent = speedInfo.fullLabel;

    // Cable line styling based on tier
    el.cableBadge.style.borderColor = getTierColor(speedInfo.tier);
    el.cableBadge.style.boxShadow = `0 0 15px ${getTierGlow(speedInfo.tier)}`;
    el.cableSpeedDisplay.style.color = getTierColor(speedInfo.tier);

    // Right device node
    el.visDeviceName.textContent = dev.product || 'USB Device';
    el.visDeviceMfg.textContent = `${dev.vendorName || dev.manufacturer || 'Unknown Manufacturer'} (VID: ${dev.idVendor || '?'})`;
    el.visDeviceSpec.textContent = `Descriptor Spec: USB ${dev.version || '2.0'}`;
    el.visDeviceIcon.textContent = getDeviceEmoji(dev);

    // Speedometer Gauge Arc (total length = 480)
    // 0 Mb -> offset 480, 40000 Mb -> offset 0
    let fillRatio = 0.05;
    if (speedInfo.numericMb >= 40000) fillRatio = 1.0;
    else if (speedInfo.numericMb >= 20000) fillRatio = 0.85;
    else if (speedInfo.numericMb >= 10000) fillRatio = 0.70;
    else if (speedInfo.numericMb >= 5000) fillRatio = 0.50;
    else if (speedInfo.numericMb >= 480) fillRatio = 0.25;
    else if (speedInfo.numericMb >= 12) fillRatio = 0.10;

    const targetOffset = 480 - (480 * fillRatio);
    el.gaugeMeterPath.style.strokeDashoffset = targetOffset;
    el.gaugeDigitalVal.textContent = speedInfo.label;
    el.gaugeDigitalVal.style.fill = getTierColor(speedInfo.tier);
    el.gaugeDigitalUnit.textContent = getTierSubLabel(speedInfo);
    el.gaugeTierTag.textContent = speedInfo.tier.toUpperCase();
    el.gaugeTierTag.style.color = getTierColor(speedInfo.tier);

    const specText = dev.version ? (dev.version.startsWith('USB') ? dev.version : `USB ${dev.version}`) : '--';
    el.gaugeSpecVal.textContent = specText;
    el.gaugePowerVal.textContent = dev.maxPower || 'Bus Powered';
    el.gaugeLanesVal.textContent = `${dev.rxLanes || 1}x Rx / ${dev.txLanes || 1}x Tx`;

    // Diagnostic Alert Banner
    if (bottleneck.isBottleneck) {
      el.diagnosticBanner.className = 'diagnostic-banner bottleneck';
      el.diagIcon.textContent = '🚨';
      el.diagTitle.textContent = bottleneck.title || 'Cable Bottleneck Detected!';
      el.diagBody.textContent = bottleneck.description || 'This device is capable of high-speed SuperSpeed transfers, but is currently throttled to USB 2.0 480 Mb/s. Your cable only connects the USB 2.0 charging pins.';
      el.diagAction.innerHTML = bottleneck.recommendedAction ? `<strong>Action:</strong> ${bottleneck.recommendedAction}` : '';
    } else {
      el.diagnosticBanner.className = 'diagnostic-banner optimal';
      el.diagIcon.textContent = '⚡';
      el.diagTitle.textContent = `Optimal Speed Verified: ${speedInfo.label}`;
      el.diagBody.textContent = `The cable negotiated full physical speed (${speedInfo.fullLabel}) with host controller. Cable integrity and SuperSpeed data lanes confirmed.`;
      el.diagAction.innerHTML = '';
    }

    renderSpotlightSlider();
  }

  function renderSpotlightSlider() {
    const candidates = allDevices.filter(d => !d.isRootHub);
    el.workbenchCount.textContent = `${candidates.length} peripheral${candidates.length === 1 ? '' : 's'}`;

    if (candidates.length === 0) {
      el.spotlightSlider.innerHTML = `<div class="timeline-empty">No peripheral devices found. Plug a device to begin.</div>`;
      return;
    }

    el.spotlightSlider.innerHTML = candidates.map((d) => {
      const isSelected = selectedDevice && selectedDevice.id === d.id;
      const isBottleneck = d.bottleneck && d.bottleneck.isBottleneck;
      return `
        <div class="spotlight-card ${isSelected ? 'active' : ''}" data-id="${d.id}">
          <div class="sc-info">
            <span class="sc-icon">${getDeviceEmoji(d)}</span>
            <div>
              <div class="sc-title" title="${esc(d.product)}">${esc(d.product)}</div>
              <div class="sc-mfg">${esc(d.vendorName || d.manufacturer || 'USB Device')}</div>
            </div>
          </div>
          <span class="speed-pill ${d.speedInfo.tier}">${d.speedInfo.label}${isBottleneck ? ' ⚠️' : ''}</span>
        </div>
      `;
    }).join('');

    el.spotlightSlider.querySelectorAll('.spotlight-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const found = allDevices.find(d => d.id === id);
        if (found) {
          selectedDevice = found;
          renderWorkbench();
        }
      });
    });
  }

  function triggerPlugAnimation() {
    if (!el.cableLine) return;
    el.cableLine.style.transform = 'scale(1.05)';
    el.cableBadge.style.transform = 'scale(1.15)';
    setTimeout(() => {
      el.cableLine.style.transform = 'scale(1)';
      el.cableBadge.style.transform = 'scale(1)';
    }, 400);
  }

  // -------------------------------------------------------------
  // Render Device Grid
  // -------------------------------------------------------------
  function renderGrid() {
    const filtered = allDevices.filter((dev) => {
      // Search query filter
      if (searchQuery) {
        const hay = `${dev.product || ''} ${dev.manufacturer || ''} ${dev.vendorName || ''} ${dev.idVendor || ''} ${dev.idProduct || ''} ${dev.serial || ''} ${dev.id || ''}`.toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }

      // Category filter
      if (activeFilter === 'external') {
        return !dev.isRootHub && (dev.removable === 'removable' || !dev.isHub);
      } else if (activeFilter === 'highspeed') {
        return (dev.speedInfo && dev.speedInfo.numericMb >= 5000);
      } else if (activeFilter === 'usb2') {
        return (dev.speedInfo && dev.speedInfo.numericMb === 480);
      } else if (activeFilter === 'bottleneck') {
        return (dev.bottleneck && dev.bottleneck.isBottleneck);
      } else if (activeFilter === 'hubs') {
        return dev.isHub || dev.isRootHub;
      }
      return true;
    });

    if (filtered.length === 0) {
      el.devicesGrid.innerHTML = `
        <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 48px;">
          <h3 style="margin-bottom: 8px;">No matching devices found</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Try adjusting your search query or filter chips above.</p>
        </div>
      `;
      return;
    }

    el.devicesGrid.innerHTML = filtered.map((d) => {
      const isBottleneck = d.bottleneck && d.bottleneck.isBottleneck;
      const progressPercent = getSpeedPercent(d.speedInfo ? d.speedInfo.numericMb : 0);
      const tierColor = getTierColor(d.speedInfo ? d.speedInfo.tier : 'unknown');

      return `
        <div class="device-card ${isBottleneck ? 'bottleneck' : ''}" data-id="${d.id}">
          <div class="dev-card-top">
            <div class="dev-avatar-wrap">
              <div class="dev-avatar">${getDeviceEmoji(d)}</div>
              <div class="dev-titles">
                <div class="dev-name" title="${esc(d.product)}">${esc(d.product)}</div>
                <div class="dev-mfg">${esc(d.vendorName || d.manufacturer || 'Standard USB Device')}</div>
              </div>
            </div>
            <span class="speed-pill ${d.speedInfo.tier}">${d.speedInfo.label}</span>
          </div>

          <!-- Speed meter line -->
          <div class="dev-speed-bar">
            <div class="dev-speed-progress" style="width: ${progressPercent}%; background: ${tierColor};"></div>
          </div>

          <!-- Metadata table -->
          <div class="dev-meta-grid">
            <div class="dev-meta-item">
              <span class="meta-k">PROTOCOL VER</span>
              <span class="meta-v">USB ${d.version || '2.0'}</span>
            </div>
            <div class="dev-meta-item">
              <span class="meta-k">BUS POWER</span>
              <span class="meta-v">${d.maxPower || 'Bus Powered'}</span>
            </div>
            <div class="dev-meta-item">
              <span class="meta-k">VENDOR ID / PID</span>
              <span class="meta-v">${d.idVendor || '----'}:${d.idProduct || '----'}</span>
            </div>
            <div class="dev-meta-item">
              <span class="meta-k">NODE ID / PORT</span>
              <span class="meta-v">${d.id}</span>
            </div>
          </div>

          ${isBottleneck ? `
            <div class="card-bottleneck-alert">
              <span>⚠️</span>
              <span><strong>Bottleneck:</strong> Hardware is USB 3.x, but running at 480 Mb/s. Check cable!</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    el.devicesGrid.querySelectorAll('.device-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const found = allDevices.find(d => d.id === id);
        if (found) {
          openDrawer(found);
        }
      });
    });
  }

  // -------------------------------------------------------------
  // Render System Report Tree View
  // -------------------------------------------------------------
  function renderTree() {
    if (!el.treeContainer) return;

    // Group devices: Controllers (Root Hubs) vs Children
    const controllers = allDevices.filter(d => d.isRootHub);
    const nonControllers = allDevices.filter(d => !d.isRootHub);

    let html = '<ul class="tree-root">';

    for (const ctrl of controllers) {
      // Find children that start with controller bus number or ID
      const ctrlBusNum = ctrl.busnum;
      const children = nonControllers.filter(c => {
        if (ctrlBusNum != null && c.busnum === ctrlBusNum) return true;
        if (ctrl.id && c.id && c.id.startsWith(ctrl.id.replace('usb', '') + '-')) return true;
        return false;
      });

      html += `
        <li class="tree-node">
          <div class="tree-item" data-id="${ctrl.id}">
            <span class="tree-icon">🖥️</span>
            <span class="tree-title"><strong>${esc(ctrl.product)}</strong> <span style="color:var(--text-muted); font-size:0.75rem;">(${ctrl.id})</span></span>
            <span class="speed-pill ${ctrl.speedInfo.tier} tree-speed">${ctrl.speedInfo.label}</span>
          </div>
          ${renderTreeChildren(children)}
        </li>
      `;
    }

    // Thunderbolt section
    const tbDevs = allDevices.filter(d => d.isThunderbolt);
    if (tbDevs.length > 0) {
      html += `
        <li class="tree-node" style="margin-top: 14px;">
          <div class="tree-item">
            <span class="tree-icon">⚡</span>
            <span class="tree-title"><strong>Thunderbolt / USB4 Subsystem</strong></span>
            <span class="speed-pill usb4 tree-speed">40 Gb/s</span>
          </div>
          <ul class="tree-children">
            ${tbDevs.map(t => `
              <li class="tree-node">
                <div class="tree-item" data-id="${t.id}">
                  <span class="tree-icon">🔌</span>
                  <span class="tree-title">${esc(t.product)}</span>
                  <span class="speed-pill usb4 tree-speed">40 Gb/s</span>
                </div>
              </li>
            `).join('')}
          </ul>
        </li>
      `;
    }

    html += '</ul>';
    el.treeContainer.innerHTML = html;

    el.treeContainer.querySelectorAll('.tree-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        const found = allDevices.find(d => d.id === id);
        if (found) {
          openDrawer(found);
        }
      });
    });
  }

  function renderTreeChildren(children) {
    if (!children || children.length === 0) {
      return `<ul class="tree-children"><li style="padding: 4px 12px; color: var(--text-muted); font-size: 0.78rem;">No external peripherals connected to this bus</li></ul>`;
    }

    return `
      <ul class="tree-children">
        ${children.map((c) => {
          const isBottleneck = c.bottleneck && c.bottleneck.isBottleneck;
          return `
            <li class="tree-node">
              <div class="tree-item" data-id="${c.id}">
                <span class="tree-icon">${getDeviceEmoji(c)}</span>
                <span class="tree-title">${esc(c.product)} <span style="color:var(--text-muted); font-size:0.75rem;">(${esc(c.vendorName || c.manufacturer || '')})</span></span>
                <span class="speed-pill ${c.speedInfo.tier} tree-speed">${c.speedInfo.label}${isBottleneck ? ' ⚠️' : ''}</span>
              </div>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }

  // -------------------------------------------------------------
  // Render Hotplug Timeline
  // -------------------------------------------------------------
  function addTimelineEvent(evt) {
    hotplugEvents.unshift(evt);
    if (hotplugEvents.length > 50) hotplugEvents.pop();
    el.eventBadge.textContent = hotplugEvents.length;
    renderTimeline();
  }

  function renderTimeline() {
    if (!el.timelineContainer) return;

    if (hotplugEvents.length === 0) {
      el.timelineContainer.innerHTML = `<div class="timeline-empty">Listening for live USB hotplug events... Try plugging or unplugging a USB cable.</div>`;
      return;
    }

    el.timelineContainer.innerHTML = hotplugEvents.map((evt) => {
      const icon = evt.type === 'add' ? '🔌' : evt.type === 'remove' ? '✕' : '⚡';
      return `
        <div class="timeline-entry">
          <div class="tl-icon ${evt.type}">${icon}</div>
          <div class="tl-content">
            <div class="tl-title">${esc(evt.title)}</div>
            <div class="tl-sub">${esc(evt.sub)}</div>
          </div>
          <div class="tl-time">${evt.time}</div>
        </div>
      `;
    }).join('');
  }

  // -------------------------------------------------------------
  // Inspector Drawer (macOS System Report Style)
  // -------------------------------------------------------------
  function openDrawer(dev) {
    selectedDevice = dev;
    renderWorkbench(); // Also sync workbench

    const speedInfo = dev.speedInfo || { label: '--', fullLabel: '--', tier: 'unknown' };
    const bottleneck = dev.bottleneck || { isBottleneck: false };

    el.drawerSpeedTag.textContent = speedInfo.label;
    el.drawerSpeedTag.className = `drawer-tag speed-pill ${speedInfo.tier}`;
    el.drawerProduct.textContent = dev.product || 'USB Device';
    el.drawerManufacturer.textContent = dev.vendorName || dev.manufacturer || 'Generic Device';

    if (bottleneck.isBottleneck) {
      el.drawerAlert.style.display = 'flex';
      el.drawerAlertText.innerHTML = `<strong>${bottleneck.title}</strong><br/>${bottleneck.description}`;
    } else {
      el.drawerAlert.style.display = 'none';
    }

    el.specSpeed.textContent = speedInfo.fullLabel;
    el.specSpeedTier.textContent = speedInfo.tier.toUpperCase();
    el.specVersion.textContent = dev.version ? `USB ${dev.version}` : 'Not Specified';
    el.specLanes.textContent = `${dev.rxLanes || 1} Lane Rx / ${dev.txLanes || 1} Lane Tx`;

    if (bottleneck.isBottleneck) {
      el.specCableEval.innerHTML = `<span style="color:var(--c-red); font-weight:700;">⚠️ Degraded / Charge-Only Cable</span>`;
    } else if (speedInfo.numericMb >= 5000) {
      el.specCableEval.innerHTML = `<span style="color:var(--c-ss5); font-weight:700;">✔️ Verified High-Speed Data Cable</span>`;
    } else {
      el.specCableEval.innerHTML = `<span>Standard USB 2.0 / Legacy Link</span>`;
    }

    el.specMaxPower.textContent = dev.maxPower || '0 mA / Unknown';
    el.specPowerSource.textContent = dev.maxPower === '0mA' ? 'Self-Powered Hub / Bus' : 'Bus Powered';
    el.specRemovable.textContent = dev.removable || 'Unknown';

    el.specVid.textContent = dev.idVendor ? `0x${dev.idVendor}` : 'Unknown';
    el.specPid.textContent = dev.idProduct ? `0x${dev.idProduct}` : 'Unknown';
    el.specVendorLookup.textContent = dev.vendorName || dev.manufacturer || 'Unregistered Vendor';
    el.specSerial.textContent = dev.serial || 'No Serial Reported';
    el.specBcdDevice.textContent = dev.bcdDevice ? `0x${dev.bcdDevice}` : '--';

    el.specNodeId.textContent = dev.id || '--';
    el.specBusNum.textContent = dev.busnum != null ? dev.busnum : '--';
    el.specDevNum.textContent = dev.devnum != null ? dev.devnum : '--';
    el.specSysfs.textContent = dev.sysfsPath || '/sys/bus/usb/devices/' + (dev.id || '');

    el.drawerOverlay.classList.add('open');
    el.inspectorDrawer.classList.add('open');
    el.inspectorDrawer.setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    el.drawerOverlay.classList.remove('open');
    el.inspectorDrawer.classList.remove('open');
    el.inspectorDrawer.setAttribute('aria-hidden', 'true');
  }

  // -------------------------------------------------------------
  // Toast Notifications
  // -------------------------------------------------------------
  function showToast(message, type = 'add') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'add' ? '⚡' : '🔌';
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-msg">
        <strong>${esc(message)}</strong>
        <small>${new Date().toLocaleTimeString()}</small>
      </div>
    `;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function getTierSubLabel(speedInfo) {
    if (!speedInfo) return 'NEGOTIATED LINK';
    switch (speedInfo.tier) {
      case 'usb4': return 'USB4 / THUNDERBOLT 4';
      case 'ss20': return 'USB 3.2 GEN 2X2';
      case 'ss10': return 'USB 3.2 GEN 2 (10G)';
      case 'ss5':  return 'USB 3.2 GEN 1 (5G)';
      case 'hs480': return 'USB 2.0 (HIGH-SPEED)';
      case 'fs12': return 'USB 1.1 (FULL-SPEED)';
      case 'ls1':  return 'USB 1.0 (LOW-SPEED)';
      default: return 'NEGOTIATED LINK';
    }
  }

  function getTierColor(tier) {
    switch (tier) {
      case 'usb4': return 'var(--c-usb4)';
      case 'ss20': return 'var(--c-ss20)';
      case 'ss10': return 'var(--c-ss10)';
      case 'ss5': return 'var(--c-ss5)';
      case 'hs480': return 'var(--c-hs480)';
      case 'fs12': return 'var(--c-fs12)';
      default: return 'var(--text-muted)';
    }
  }

  function getTierGlow(tier) {
    switch (tier) {
      case 'usb4': return 'var(--c-usb4-glow)';
      case 'ss20': return 'var(--c-ss20-glow)';
      case 'ss10': return 'var(--c-ss10-glow)';
      case 'ss5': return 'var(--c-ss5-glow)';
      case 'hs480': return 'var(--c-hs480-glow)';
      default: return 'transparent';
    }
  }

  function getSpeedPercent(mb) {
    if (mb >= 40000) return 100;
    if (mb >= 20000) return 85;
    if (mb >= 10000) return 70;
    if (mb >= 5000) return 50;
    if (mb >= 480) return 25;
    return 10;
  }

  function getDeviceEmoji(dev) {
    if (dev.isThunderbolt) return '⚡';
    if (dev.isRootHub) return '🖥️';
    if (dev.isHub) return '🔀';

    const p = (dev.product || '').toLowerCase();
    if (p.includes('keyboard')) return '⌨️';
    if (p.includes('mouse') || p.includes('optical')) return '🖱️';
    if (p.includes('audio') || p.includes('sound') || p.includes('speaker') || p.includes('mic')) return '🎧';
    if (p.includes('ssd') || p.includes('drive') || p.includes('nvme') || p.includes('storage') || p.includes('flash') || p.includes('disk')) return '💾';
    if (p.includes('cam') || p.includes('video')) return '📹';
    if (p.includes('bluetooth') || p.includes('wireless')) return '📶';
    return '🔌';
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
