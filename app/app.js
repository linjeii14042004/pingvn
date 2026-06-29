import SpeedTest from 'https://cdn.jsdelivr.net/npm/@cloudflare/speedtest@1.10.1/+esm';

let speedtest = null;
let history = [];
let isRunning = false;

// ── Scrolling wave data (fixed-width buffer) ──
const MAX_POINTS = 120;
let dlBuffer = new Array(MAX_POINTS).fill(0);
let ulBuffer = new Array(MAX_POINTS).fill(0);
let maxDL = 1;   // auto-scale
let maxUL = 1;

let dlCtx, ulCtx;
let animationId = null;

// DOM
const startBtn    = document.getElementById('startBtn');
const resetBtn    = document.getElementById('resetBtn');
const statusDiv   = document.getElementById('status');
const statusText  = document.getElementById('statusText');
const historyList = document.getElementById('historyList');
const serverInfoDiv = document.getElementById('serverInfo');

// ─────────────────────────────────────────────
//  Canvas init
// ─────────────────────────────────────────────
function initCanvas(id) {
    const canvas = document.getElementById(id);
    const wrapper = canvas.parentElement;
    canvas.width  = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
    return canvas.getContext('2d');
}

function initCanvases() {
    dlCtx = initCanvas('dlChart');
    ulCtx = initCanvas('ulChart');
}

// ─────────────────────────────────────────────
//  Push a new Mbps value into the scrolling buffer
// ─────────────────────────────────────────────
function pushValue(buffer, mbps) {
    buffer.shift();
    buffer.push(mbps);
}

// ─────────────────────────────────────────────
//  Draw one scrolling wave chart
// ─────────────────────────────────────────────
function drawChart(ctx, buffer, color, maxVal) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const padL = 48, padR = 12, padT = 18, padB = 28;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);

    // ── background ──
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    const gridLines = 4;
    const step = innerH / gridLines;

    // ── grid lines + Y labels ──
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridLines; i++) {
        const y = padT + i * step;
        const mbpsLabel = ((maxVal * (gridLines - i)) / gridLines).toFixed(0);

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(W - padR, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(mbpsLabel, padL - 6, y + 4);
    }

    // ── Mbps unit label ──
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.translate(10, padT + innerH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Mbps', 0, 0);
    ctx.restore();

    // ── wave line ──
    const segW = innerW / (MAX_POINTS - 1);

    ctx.save();
    ctx.beginPath();
    buffer.forEach((v, i) => {
        const x = padL + i * segW;
        const norm = Math.min(v / maxVal, 1);
        const y = padT + innerH - norm * innerH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    // stroke
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.stroke();

    // fill under curve
    ctx.lineTo(padL + (MAX_POINTS - 1) * segW, padT + innerH);
    ctx.lineTo(padL, padT + innerH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH);
    grad.addColorStop(0,   color.replace(')', ', 0.25)').replace('rgb', 'rgba'));
    grad.addColorStop(1,   color.replace(')', ', 0.01)').replace('rgb', 'rgba'));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // ── glowing dot at latest point ──
    const lastVal  = buffer[MAX_POINTS - 1];
    const dotX     = padL + (MAX_POINTS - 1) * segW;
    const dotNorm  = Math.min(lastVal / maxVal, 1);
    const dotY     = padT + innerH - dotNorm * innerH;

    const glow = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 8);
    glow.addColorStop(0,   color.replace(')', ', 0.9)').replace('rgb', 'rgba'));
    glow.addColorStop(0.4, color.replace(')', ', 0.4)').replace('rgb', 'rgba'));
    glow.addColorStop(1,   color.replace(')', ', 0)').replace('rgb', 'rgba'));
    ctx.beginPath();
    ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
}

// ─────────────────────────────────────────────
//  Animation loop
// ─────────────────────────────────────────────
function renderLoop() {
    drawChart(dlCtx, dlBuffer, 'rgb(56,189,248)',  Math.max(maxDL, 1));
    drawChart(ulCtx, ulBuffer, 'rgb(168,85,247)',  Math.max(maxUL, 1));
    animationId = requestAnimationFrame(renderLoop);
}

function startLoop() {
    if (animationId) cancelAnimationFrame(animationId);
    renderLoop();
}

// ─────────────────────────────────────────────
//  Server info
// ─────────────────────────────────────────────
async function fetchServerInfo() {
    try {
        const traceRes  = await fetch('https://1.1.1.1/cdn-cgi/trace');
        const traceText = await traceRes.text();
        const traceData = {};
        traceText.trim().split('\n').forEach(line => {
            const [key, ...rest] = line.split('=');
            traceData[key.trim()] = rest.join('=').trim();
        });

        const metaData = await (await fetch('https://speed.cloudflare.com/meta')).json();

        document.getElementById('infoIP').textContent     = traceData.ip                  || '-';
        document.getElementById('infoISP').textContent    = metaData.asOrganization        || '-';
        document.getElementById('infoCity').textContent   = [metaData.city, metaData.country].filter(Boolean).join(', ') || '-';
        document.getElementById('infoServer').textContent = traceData.colo                 || '-';
    } catch(e) { console.error(e); }
}

// ─────────────────────────────────────────────
//  History
// ─────────────────────────────────────────────
function loadHistory() {
    const saved = localStorage.getItem('speedtest-history');
    history = saved ? JSON.parse(saved) : [];
    renderHistory();
}

function saveHistory() {
    localStorage.setItem('speedtest-history', JSON.stringify(history));
}

function renderHistory() {
    if (!history.length) {
        historyList.innerHTML = '<p class="empty-history">No test history yet</p>';
        return;
    }
    historyList.innerHTML = history.map((item, i) => `
        <div class="history-item">
            <div class="history-item-info">
                <div class="history-item-time">${item.timestamp}</div>
                <div class="history-item-values">
                    ⬇️ ${item.download} Mbps &nbsp;|&nbsp; ⬆️ ${item.upload} Mbps &nbsp;|&nbsp; 📡 ${item.latency}ms &nbsp;|&nbsp; 📊 ${item.jitter}ms
                </div>
            </div>
            <button class="history-item-delete" onclick="deleteHistory(${i})">✕</button>
        </div>
    `).join('');
}

window.deleteHistory = function(i) {
    history.splice(i, 1);
    saveHistory();
    renderHistory();
};

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function setMetric(id, val, decimals = 0) {
    const el = document.getElementById(id);
    if (el) el.textContent = val != null ? (+val).toFixed(decimals) : '-';
}

function updateStatus(type) {
    const map = {
        latency:  '📡 Measuring latency...',
        download: '⬇️ Measuring download speed...',
        upload:   '⬆️ Measuring upload speed...',
    };
    statusText.textContent = map[type] || '⏳ Running test...';
}

// ─────────────────────────────────────────────
//  Start Test
// ─────────────────────────────────────────────
async function startTest() {
    if (isRunning) return;
    isRunning = true;
    startBtn.disabled = true;
    resetBtn.disabled = false;

    // reset buffers
    dlBuffer = new Array(MAX_POINTS).fill(0);
    ulBuffer = new Array(MAX_POINTS).fill(0);
    maxDL = 1; maxUL = 1;

    ['dlDisplay','ulDisplay','latencyValue','jitterValue'].forEach(id => setMetric(id, null));

    statusDiv.style.display   = 'flex';
    serverInfoDiv.style.display = 'none';
    statusText.textContent    = '⏳ Initializing...';

    try {
        speedtest = new SpeedTest({ autoStart: false });

        speedtest.onResultsChange = ({ type }) => {
            updateStatus(type);
            const r = speedtest.results;

            if (type === 'download') {
                const dl = r.getDownloadBandwidth();
                if (dl) {
                    const mbps = dl / 1e6;
                    if (mbps > maxDL) maxDL = mbps * 1.2;
                    pushValue(dlBuffer, mbps);
                    setMetric('dlDisplay', mbps, 1);
                }
            }
            if (type === 'upload') {
                const ul = r.getUploadBandwidth();
                if (ul) {
                    const mbps = ul / 1e6;
                    if (mbps > maxUL) maxUL = mbps * 1.2;
                    pushValue(ulBuffer, mbps);
                    setMetric('ulDisplay', mbps, 1);
                }
            }
            if (type === 'latency') {
                const lat = r.getUnloadedLatency();
                const jit = r.getUnloadedJitter();
                if (lat) setMetric('latencyValue', lat, 0);
                if (jit) setMetric('jitterValue',  jit, 0);
            }
        };

        speedtest.onError = err => {
            statusText.textContent = '⚠️ ' + err;
            isRunning = false;
            startBtn.disabled = false;
        };

        speedtest.onFinish = results => {
            statusDiv.style.display     = 'none';
            serverInfoDiv.style.display = 'grid';

            const s  = results.getSummary();
            const dl = s.download ? (s.download / 1e6).toFixed(2) : '0';
            const ul = s.upload   ? (s.upload   / 1e6).toFixed(2) : '0';
            const lat = s.latency ? s.latency.toFixed(0) : '0';
            const jit = s.jitter  ? s.jitter.toFixed(0)  : '0';

            document.getElementById('dlDisplay').textContent      = dl;
            document.getElementById('ulDisplay').textContent      = ul;
            document.getElementById('latencyValue').textContent   = lat;
            document.getElementById('jitterValue').textContent    = jit;
            document.getElementById('downloadValue').textContent  = dl;
            document.getElementById('uploadValue').textContent    = ul;

            history.unshift({
                timestamp: new Date().toLocaleString('vi-VN'),
                download: dl, upload: ul, latency: lat, jitter: jit
            });
            if (history.length > 20) history = history.slice(0, 20);
            saveHistory();
            renderHistory();

            isRunning = false;
            startBtn.disabled = false;
            startBtn.textContent = '▶ Test Again';
        };

        speedtest.play();

    } catch(err) {
        statusText.textContent = '❌ ' + err.message;
        isRunning = false;
        startBtn.disabled = false;
    }
}

// ─────────────────────────────────────────────
//  Reset
// ─────────────────────────────────────────────
function resetTest() {
    if (speedtest) { speedtest.pause(); speedtest = null; }
    isRunning = false;
    startBtn.disabled = false;
    startBtn.textContent = '▶ Start Test';
    resetBtn.disabled = true;

    dlBuffer = new Array(MAX_POINTS).fill(0);
    ulBuffer = new Array(MAX_POINTS).fill(0);
    maxDL = 1; maxUL = 1;

    ['dlDisplay','ulDisplay','latencyValue','jitterValue',
     'downloadValue','uploadValue'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
    });

    statusDiv.style.display     = 'none';
    serverInfoDiv.style.display = 'none';
}

// ─────────────────────────────────────────────
//  Events & Init
// ─────────────────────────────────────────────
startBtn.addEventListener('click', startTest);
resetBtn.addEventListener('click', resetTest);

window.addEventListener('load', () => {
    initCanvases();
    startLoop();
    loadHistory();
    fetchServerInfo();
});

window.addEventListener('resize', () => {
    initCanvases();
});
