const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');

const PORT = Number(process.env.PORT) || 4321;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

// Common USB Vendor Database cache
const VENDOR_NAMES = {
  '046d': 'Logitech, Inc.',
  '05ac': 'Apple, Inc.',
  '0781': 'SanDisk Corp.',
  '04e8': 'Samsung Electronics',
  '1058': 'Western Digital Technologies',
  '0bc2': 'Seagate Technology LLC',
  '2109': 'VIA Labs, Inc.',
  '05e3': 'Genesys Logic, Inc.',
  '17e9': 'DisplayLink',
  '0bda': 'Realtek Semiconductor',
  '1d6b': 'Linux Foundation (Root Hub)',
  '8087': 'Intel Corp.',
  '1022': 'Advanced Micro Devices (AMD)',
  '152d': 'JMicron Technology Corp.',
  '1e7d': 'ROCCAT',
  '1532': 'Razer USA Ltd.',
  '045e': 'Microsoft Corp.',
  '0a67': 'K66 Technology',
  '413d': 'Standard Optical Mouse',
  '001f': 'AB13X Audio Device',
  '2b73': 'Anker Innovations',
  '2e8a': 'Raspberry Pi Trading',
  '18d1': 'Google LLC',
};

// -------------------------------------------------------------
// Speed Classifier & Bottleneck Analyzer
// -------------------------------------------------------------
function normalizeSpeed(rawSpeed) {
  const num = parseFloat(rawSpeed);
  if (isNaN(num)) return { numericMb: 0, label: 'Unknown', tier: 'unknown', unit: '' };

  if (num >= 40000) {
    return { numericMb: num, label: '40 Gb/s', fullLabel: '40 Gb/s (USB4 / Thunderbolt 4)', tier: 'usb4', unit: 'Gbps', gbps: (num / 1000).toFixed(0) };
  } else if (num >= 20000) {
    return { numericMb: num, label: '20 Gb/s', fullLabel: '20 Gb/s (USB 3.2 Gen 2x2)', tier: 'ss20', unit: 'Gbps', gbps: (num / 1000).toFixed(0) };
  } else if (num >= 10000) {
    return { numericMb: num, label: '10 Gb/s', fullLabel: '10 Gb/s (USB 3.2 Gen 2 SuperSpeed+)', tier: 'ss10', unit: 'Gbps', gbps: (num / 1000).toFixed(0) };
  } else if (num >= 5000) {
    return { numericMb: num, label: '5 Gb/s', fullLabel: '5 Gb/s (USB 3.2 Gen 1 SuperSpeed)', tier: 'ss5', unit: 'Gbps', gbps: (num / 1000).toFixed(0) };
  } else if (num >= 480) {
    return { numericMb: num, label: '480 Mb/s', fullLabel: '480 Mb/s (USB 2.0 High-Speed)', tier: 'hs480', unit: 'Mbps', gbps: '0.48' };
  } else if (num >= 12) {
    return { numericMb: num, label: '12 Mb/s', fullLabel: '12 Mb/s (USB 1.1 Full-Speed)', tier: 'fs12', unit: 'Mbps', gbps: '0.012' };
  } else {
    return { numericMb: num, label: `${num} Mb/s`, fullLabel: `${num} Mb/s (USB 1.0 Low-Speed)`, tier: 'ls1', unit: 'Mbps', gbps: '0.0015' };
  }
}

function analyzeBottleneck(device) {
  // Device version string e.g. " 3.20", " 3.10", " 3.00", " 2.00"
  const verNum = parseFloat((device.version || '').trim());
  const speedMb = device.speedInfo ? device.speedInfo.numericMb : 0;
  const isHub = (device.product || '').toLowerCase().includes('hub') || (device.deviceClass === '09');

  // If device descriptor reports USB 3.x capability but negotiated speed is 480 Mbps or lower
  if (verNum >= 3.0 && speedMb <= 480 && !isHub) {
    return {
      isBottleneck: true,
      severity: 'high',
      title: 'USB Cable Bottleneck Detected!',
      description: `Device reports USB ${verNum.toFixed(1)} capability, but negotiated at only ${device.speedInfo.label}. The USB-C cable in use lacks high-speed SuperSpeed pairs and is operating in USB 2.0 charge-only mode.`,
      recommendedAction: 'Replace cable with a certified 10 Gbps (USB 3.2) or 40 Gbps (Thunderbolt/USB4) data cable.'
    };
  }

  // If a known SuperSpeed/NVMe SSD name is detected negotiating at 480
  const name = `${device.product || ''} ${device.manufacturer || ''}`.toLowerCase();
  const isFastStorage = name.includes('nvme') || name.includes('ssd') || name.includes('extreme') || name.includes('t7') || name.includes('t5') || name.includes('t9');
  if (isFastStorage && speedMb <= 480) {
    return {
      isBottleneck: true,
      severity: 'critical',
      title: 'High-Speed Storage Operating at USB 2.0 Speeds!',
      description: `External drive "${device.product}" is connected at ${device.speedInfo.label}. High-speed data transfer is severely degraded (max ~40 MB/s actual vs 1,000+ MB/s expected).`,
      recommendedAction: 'Verify both cable and port support USB 3.2 Gen 2 (10 Gb/s) or Thunderbolt.'
    };
  }

  return {
    isBottleneck: false,
    severity: 'none',
    title: 'Optimal Link Negotiated',
    description: `Device is operating at expected link speed (${device.speedInfo.fullLabel}).`,
    recommendedAction: null
  };
}

// -------------------------------------------------------------
// Linux Hardware Scanner (/sys/bus/usb/devices & /sys/bus/thunderbolt)
// -------------------------------------------------------------
function scanLinuxUsb() {
  const usbPath = '/sys/bus/usb/devices';
  if (!fs.existsSync(usbPath)) return [];

  const entries = fs.readdirSync(usbPath);
  const devices = [];

  const readFileSafe = (filePath) => {
    try {
      return fs.readFileSync(filePath, 'utf8').trim();
    } catch {
      return null;
    }
  };

  for (const entry of entries) {
    const devDir = path.join(usbPath, entry);
    // Only process device entries that have a 'speed' attribute
    if (!fs.existsSync(path.join(devDir, 'speed'))) continue;

    const rawSpeed = readFileSafe(path.join(devDir, 'speed'));
    const speedInfo = normalizeSpeed(rawSpeed);

    const product = readFileSafe(path.join(devDir, 'product')) || (entry.startsWith('usb') ? 'Host Controller' : 'USB Device');
    const manufacturer = readFileSafe(path.join(devDir, 'manufacturer')) || '';
    const idVendor = (readFileSafe(path.join(devDir, 'idVendor')) || '').toLowerCase();
    const idProduct = (readFileSafe(path.join(devDir, 'idProduct')) || '').toLowerCase();
    const serial = readFileSafe(path.join(devDir, 'serial')) || null;
    const version = readFileSafe(path.join(devDir, 'version')) || null;
    const bcdDevice = readFileSafe(path.join(devDir, 'bcdDevice')) || null;
    const maxPower = readFileSafe(path.join(devDir, 'bMaxPower')) || null;
    const removable = readFileSafe(path.join(devDir, 'removable')) || 'unknown';
    const rxLanes = readFileSafe(path.join(devDir, 'rx_lanes')) || '1';
    const txLanes = readFileSafe(path.join(devDir, 'tx_lanes')) || '1';
    const busnum = readFileSafe(path.join(devDir, 'busnum')) || null;
    const devnum = readFileSafe(path.join(devDir, 'devnum')) || null;
    const devpath = readFileSafe(path.join(devDir, 'devpath')) || null;
    const deviceClass = readFileSafe(path.join(devDir, 'bDeviceClass')) || null;

    const isRootHub = entry.startsWith('usb');
    const isHub = (product.toLowerCase().includes('hub')) || deviceClass === '09';

    const vendorName = VENDOR_NAMES[idVendor] || (manufacturer ? manufacturer : null);

    const devObj = {
      id: entry,
      sysfsPath: devDir,
      product,
      manufacturer,
      vendorName,
      idVendor,
      idProduct,
      serial,
      version: version ? version.trim() : null,
      bcdDevice,
      maxPower,
      removable,
      rxLanes: parseInt(rxLanes, 10) || 1,
      txLanes: parseInt(txLanes, 10) || 1,
      busnum: parseInt(busnum, 10) || null,
      devnum: parseInt(devnum, 10) || null,
      devpath,
      deviceClass,
      isRootHub,
      isHub,
      speedInfo,
      connectedAt: Date.now()
    };

    devObj.bottleneck = analyzeBottleneck(devObj);
    devices.push(devObj);
  }

  // Scan Thunderbolt / USB4
  const tbPath = '/sys/bus/thunderbolt/devices';
  if (fs.existsSync(tbPath)) {
    try {
      const tbEntries = fs.readdirSync(tbPath);
      for (const entry of tbEntries) {
        const tbDir = path.join(tbPath, entry);
        const devName = readFileSafe(path.join(tbDir, 'device_name')) || readFileSafe(path.join(tbDir, 'vendor_name'));
        const gen = readFileSafe(path.join(tbDir, 'generation'));
        const link = readFileSafe(path.join(tbDir, 'link'));
        const authorized = readFileSafe(path.join(tbDir, 'authorized'));

        if (devName || gen) {
          devices.push({
            id: `tb-${entry}`,
            isThunderbolt: true,
            product: devName || `Thunderbolt/USB4 Domain ${entry}`,
            manufacturer: readFileSafe(path.join(tbDir, 'vendor_name')) || 'Intel/AMD',
            vendorName: 'Thunderbolt / USB4 Controller',
            idVendor: '8087',
            idProduct: '0000',
            serial: readFileSafe(path.join(tbDir, 'unique_id')),
            version: gen ? `Gen ${gen}` : 'USB4 / TB',
            maxPower: 'Self-powered / Bus',
            removable: 'removable',
            rxLanes: 2,
            txLanes: 2,
            speedInfo: normalizeSpeed(40000),
            bottleneck: { isBottleneck: false, severity: 'none', title: 'Thunderbolt 4 / USB4 Active' },
            isRootHub: entry.includes('domain') || entry === '0-0' || entry === '1-0',
            isHub: false,
            linkStatus: link || 'active'
          });
        }
      }
    } catch (err) {
      console.warn('Thunderbolt scan warning:', err.message);
    }
  }

  return devices;
}

// -------------------------------------------------------------
// macOS Hardware Scanner (system_profiler SPUSBDataType SPThunderboltDataType)
// -------------------------------------------------------------
function scanMacOsUsb() {
  const devices = [];
  try {
    const rawUsbJson = execSync('system_profiler -json SPUSBDataType', { encoding: 'utf8', timeout: 5000 });
    const parsed = JSON.parse(rawUsbJson);
    const rootItems = parsed.SPUSBDataType || [];

    const walkItem = (item, parentId = 'root') => {
      const name = item._name || 'USB Device';
      const speedStr = item.device_speed || '';
      let speedMb = 480;
      if (speedStr.includes('40_Gb')) speedMb = 40000;
      else if (speedStr.includes('20_Gb')) speedMb = 20000;
      else if (speedStr.includes('10_Gb')) speedMb = 10000;
      else if (speedStr.includes('5_Gb')) speedMb = 5000;
      else if (speedStr.includes('480_Mb')) speedMb = 480;
      else if (speedStr.includes('12_Mb')) speedMb = 12;
      else if (speedStr.includes('1.5_Mb')) speedMb = 1.5;

      const vid = (item.vendor_id || '').replace(/^0x/, '').toLowerCase();
      const pid = (item.product_id || '').replace(/^0x/, '').toLowerCase();
      const isHub = (item._items && item._items.length > 0) || name.toLowerCase().includes('hub');

      const devObj = {
        id: item.location_id || `mac-${Math.random().toString(36).substr(2, 9)}`,
        product: name,
        manufacturer: item.manufacturer || '',
        vendorName: VENDOR_NAMES[vid] || item.manufacturer || null,
        idVendor: vid,
        idProduct: pid,
        serial: item.serial_num || null,
        version: item.bcd_device ? `bcd ${item.bcd_device}` : null,
        bcdDevice: item.bcd_device || null,
        maxPower: item.bus_power ? `${item.bus_power}mA` : null,
        removable: item.is_removable === 'yes' ? 'removable' : 'unknown',
        rxLanes: 1,
        txLanes: 1,
        speedInfo: normalizeSpeed(speedMb),
        isRootHub: parentId === 'root',
        isHub,
        connectedAt: Date.now()
      };
      devObj.bottleneck = analyzeBottleneck(devObj);
      devices.push(devObj);

      if (item._items && Array.isArray(item._items)) {
        for (const child of item._items) {
          walkItem(child, devObj.id);
        }
      }
    };

    for (const root of rootItems) {
      walkItem(root);
    }
  } catch (err) {
    console.warn('macOS USB scan error:', err.message);
  }

  // Thunderbolt scan on macOS
  try {
    const rawTb = execSync('system_profiler -json SPThunderboltDataType', { encoding: 'utf8', timeout: 5000 });
    const tbParsed = JSON.parse(rawTb);
    const tbBuses = tbParsed.SPThunderboltDataType || [];
    for (const bus of tbBuses) {
      devices.push({
        id: bus.domain_uuid || `tb-${bus._name || 'domain'}`,
        isThunderbolt: true,
        product: bus._name || 'Thunderbolt / USB4 Controller',
        manufacturer: 'Apple / Intel',
        vendorName: 'Apple Inc.',
        idVendor: '05ac',
        idProduct: '0000',
        serial: bus.domain_uuid || null,
        version: 'Thunderbolt 3/4 / USB4',
        maxPower: 'Self-powered',
        removable: 'fixed',
        rxLanes: 2,
        txLanes: 2,
        speedInfo: normalizeSpeed(40000),
        bottleneck: { isBottleneck: false, severity: 'none', title: 'Thunderbolt Active' },
        isRootHub: true,
        isHub: false
      });
    }
  } catch (err) {
    // Thunderbolt might not be supported or empty
  }

  return devices;
}

// -------------------------------------------------------------
// Unified Scanner & Tree Hierarchy Builder
// -------------------------------------------------------------
function scanAllDevices() {
  const isMac = os.platform() === 'darwin';
  const devices = isMac ? scanMacOsUsb() : scanLinuxUsb();

  // Summary statistics
  const stats = {
    total: devices.length,
    external: devices.filter(d => !d.isRootHub && (d.removable === 'removable' || !d.isHub)).length,
    speedBreakdown: {
      usb4: devices.filter(d => d.speedInfo.tier === 'usb4').length,
      ss20: devices.filter(d => d.speedInfo.tier === 'ss20').length,
      ss10: devices.filter(d => d.speedInfo.tier === 'ss10').length,
      ss5: devices.filter(d => d.speedInfo.tier === 'ss5').length,
      hs480: devices.filter(d => d.speedInfo.tier === 'hs480').length,
      fs12: devices.filter(d => d.speedInfo.tier === 'fs12' || d.speedInfo.tier === 'ls1').length,
    },
    bottlenecks: devices.filter(d => d.bottleneck && d.bottleneck.isBottleneck).length,
    controllers: devices.filter(d => d.isRootHub).length
  };

  return {
    timestamp: Date.now(),
    hostInfo: {
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname(),
      arch: os.arch()
    },
    stats,
    devices
  };
}

// -------------------------------------------------------------
// Real-Time Hotplug Watcher (SSE Manager)
// -------------------------------------------------------------
const sseClients = new Set();
let previousDeviceMap = new Map();
let isFirstScan = true;

function notifyHotplugClients(eventData) {
  const payload = `event: ${eventData.event}\ndata: ${JSON.stringify(eventData.data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function runDeviceCheck() {
  try {
    const currentScan = scanAllDevices();
    const currentMap = new Map(currentScan.devices.map(d => [d.id, d]));

    if (isFirstScan) {
      previousDeviceMap = currentMap;
      isFirstScan = false;
      return;
    }

    // Check for newly connected devices
    for (const [id, dev] of currentMap.entries()) {
      if (!previousDeviceMap.has(id)) {
        console.log(`[Hotplug] Device Connected: ${dev.product} (${dev.speedInfo.label}) [${id}]`);
        notifyHotplugClients({
          event: 'device-connected',
          data: {
            device: dev,
            timestamp: Date.now(),
            stats: currentScan.stats
          }
        });
      } else {
        // Check for speed changes or re-negotiation
        const prev = previousDeviceMap.get(id);
        if (prev.speedInfo.numericMb !== dev.speedInfo.numericMb) {
          console.log(`[Hotplug] Speed Changed: ${dev.product} (${prev.speedInfo.label} -> ${dev.speedInfo.label})`);
          notifyHotplugClients({
            event: 'device-speed-changed',
            data: {
              device: dev,
              previousSpeed: prev.speedInfo,
              newSpeed: dev.speedInfo,
              timestamp: Date.now()
            }
          });
        }
      }
    }

    // Check for removed/disconnected devices
    for (const [id, prevDev] of previousDeviceMap.entries()) {
      if (!currentMap.has(id)) {
        console.log(`[Hotplug] Device Disconnected: ${prevDev.product} [${id}]`);
        notifyHotplugClients({
          event: 'device-disconnected',
          data: {
            id,
            device: prevDev,
            timestamp: Date.now(),
            stats: currentScan.stats
          }
        });
      }
    }

    previousDeviceMap = currentMap;
  } catch (err) {
    console.error('Error during runDeviceCheck:', err);
  }
}

// Poll sysfs every 800ms for live sub-second hotplug detection
setInterval(runDeviceCheck, 800);

// Heartbeat every 15s to keep SSE connections healthy
setInterval(() => {
  notifyHotplugClients({
    event: 'heartbeat',
    data: { timestamp: Date.now() }
  });
}, 15000);

// -------------------------------------------------------------
// HTTP Server & API Routes
// -------------------------------------------------------------
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // API: Get full device tree & snapshot
  if (pathname === '/api/devices') {
    const data = scanAllDevices();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(data));
  }

  // API: System status
  if (pathname === '/api/system') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      os: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptime: os.uptime(),
      connectedClients: sseClients.size
    }));
  }

  // API: Real-time Server-Sent Events (SSE) Stream
  if (pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(': connected\n\n');

    // Send initial snapshot on connection
    const initialData = scanAllDevices();
    res.write(`event: initial-state\ndata: ${JSON.stringify(initialData)}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // API: Simulate cable hotplug for testing/demo purposes
  if (pathname === '/api/simulate-plug' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const simulatedSpeed = payload.speed || 480;
        const isBottleneck = simulatedSpeed <= 480;
        const fakeDev = {
          id: `sim-${Date.now()}`,
          product: payload.product || 'SanDisk Extreme PRO NVMe SSD',
          manufacturer: 'SanDisk',
          vendorName: 'SanDisk Corp.',
          idVendor: '0781',
          idProduct: '55df',
          serial: 'SN-DEMO-998822',
          version: '3.20',
          maxPower: '896mA',
          removable: 'removable',
          rxLanes: 1,
          txLanes: 1,
          speedInfo: normalizeSpeed(simulatedSpeed),
          isRootHub: false,
          isHub: false,
          isSimulated: true,
          connectedAt: Date.now()
        };
        fakeDev.bottleneck = analyzeBottleneck(fakeDev);

        notifyHotplugClients({
          event: 'device-connected',
          data: {
            device: fakeDev,
            timestamp: Date.now(),
            stats: { total: 1, bottlenecks: isBottleneck ? 1 : 0 }
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, device: fakeDev }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for SPA or return 404
      if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not Found');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Service worker should never be cached aggressively
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`⚡ LinkSpeed Pro Live Server running!`);
  console.log(`📡 Local Web App: http://localhost:${PORT}`);
  console.log(`🔌 Watching hardware events on ${os.platform()}...`);
  console.log(`=======================================================`);
});
