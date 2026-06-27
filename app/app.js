import SpeedTest from 'https://cdn.jsdelivr.net/npm/@cloudflare/speedtest@1.10.1/+esm';

let speedtest = null;
let history = [];
let isRunning = false;

const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const statusDiv = document.getElementById('status');
const statusText = document.getElementById('statusText');
const resultsDiv = document.getElementById('results');
const progressDiv = document.getElementById('progress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const historyList = document.getElementById('historyList');
const serverInfoDiv = document.getElementById('serverInfo');

// Dùng cdn-cgi/trace - trả về plain text, parse dễ, colo là string 3 chữ cái luôn
async function fetchServerInfo() {
    try {
        // Lấy colo, ip từ cloudflare trace
        const traceRes = await fetch('https://cloudflare.com/cdn-cgi/trace');
        const traceText = await traceRes.text();

        // Parse plain text: key=value mỗi dòng
        const traceData = {};
        traceText.trim().split('\n').forEach(line => {
            const [key, ...rest] = line.split('=');
            traceData[key.trim()] = rest.join('=').trim();
        });

        // Lấy ISP từ speed.cloudflare.com/meta
        const metaRes = await fetch('https://speed.cloudflare.com/meta');
        const metaData = await metaRes.json();

        document.getElementById('infoIP').textContent = traceData.ip || '-';
        document.getElementById('infoISP').textContent = metaData.asOrganization || '-';
        document.getElementById('infoCity').textContent = [metaData.city, metaData.country].filter(Boolean).join(', ') || '-';
        document.getElementById('infoServer').textContent = traceData.colo || '-'; // SGN, HAN, etc.

    } catch (e) {
        console.error('Failed to fetch server info:', e);
    }
}

function loadHistory() {
    const saved = localStorage.getItem('speedtest-history');
    history = saved ? JSON.parse(saved) : [];
    renderHistory();
}

function saveHistory() {
    localStorage.setItem('speedtest-history', JSON.stringify(history));
}

function renderHistory() {
    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-history">No test history yet</p>';
        return;
    }
    historyList.innerHTML = history.map((item, index) => `
        <div class="history-item">
            <div class="history-item-info">
                <div class="history-item-time">${item.timestamp}</div>
                <div class="history-item-values">
                    ⬇️ ${item.download} Mbps &nbsp;|&nbsp; ⬆️ ${item.upload} Mbps &nbsp;|&nbsp; 📡 ${item.latency}ms &nbsp;|&nbsp; 📊 ${item.jitter}ms
                </div>
            </div>
            <button class="history-item-delete" onclick="deleteHistory(${index})">✕</button>
        </div>
    `).join('');
}

window.deleteHistory = function(index) {
    history.splice(index, 1);
    saveHistory();
    renderHistory();
}

function setProgress(pct) {
    progressFill.style.width = pct + '%';
    progressText.textContent = Math.round(pct) + '%';
}

function updateStatus(type) {
    const messages = {
        latency: '📡 Measuring latency...',
        download: '⬇️ Measuring download speed...',
        upload: '⬆️ Measuring upload speed...',
        packetLoss: '📦 Measuring packet loss...'
    };
    statusText.textContent = messages[type] || '⏳ Running test...';
}

async function startTest() {
    if (isRunning) return;

    isRunning = true;
    startBtn.disabled = true;
    resetBtn.disabled = false;

    resultsDiv.style.display = 'none';
    serverInfoDiv.style.display = 'none';
    statusDiv.style.display = 'block';
    progressDiv.style.display = 'block';
    statusText.textContent = '⏳ Initializing...';
    setProgress(0);

    ['download', 'upload', 'latency', 'jitter'].forEach(id => {
        document.getElementById(id + 'Value').textContent = '-';
    });

    try {
        speedtest = new SpeedTest({ autoStart: false });

        let dlPoints = 0;
        let ulPoints = 0;

        speedtest.onResultsChange = ({ type }) => {
            updateStatus(type);
            const results = speedtest.results;

            if (type === 'download') {
                dlPoints++;
                const dl = results.getDownloadBandwidth();
                if (dl) {
                    document.getElementById('downloadValue').textContent = (dl / 1e6).toFixed(1);
                    resultsDiv.style.display = 'grid';
                }
                setProgress(Math.min(dlPoints * 5, 45));
            }

            if (type === 'upload') {
                ulPoints++;
                const ul = results.getUploadBandwidth();
                if (ul) {
                    document.getElementById('uploadValue').textContent = (ul / 1e6).toFixed(1);
                    resultsDiv.style.display = 'grid';
                }
                setProgress(Math.min(45 + ulPoints * 5, 90));
            }

            if (type === 'latency') {
                const lat = results.getUnloadedLatency();
                const jit = results.getUnloadedJitter();
                if (lat) document.getElementById('latencyValue').textContent = lat.toFixed(0);
                if (jit) document.getElementById('jitterValue').textContent = jit.toFixed(0);
                resultsDiv.style.display = 'grid';
            }
        };

        speedtest.onError = (err) => {
            console.error('SpeedTest error:', err);
            statusText.textContent = '⚠️ Error: ' + err;
            isRunning = false;
            startBtn.disabled = false;
        };

        speedtest.onFinish = (results) => {
            setProgress(100);
            statusDiv.style.display = 'none';
            progressDiv.style.display = 'none';
            resultsDiv.style.display = 'grid';
            serverInfoDiv.style.display = 'grid';

            const summary = results.getSummary();
            const dl = summary.download ? (summary.download / 1e6).toFixed(2) : '0';
            const ul = summary.upload ? (summary.upload / 1e6).toFixed(2) : '0';
            const lat = summary.latency ? summary.latency.toFixed(0) : '0';
            const jit = summary.jitter ? summary.jitter.toFixed(0) : '0';

            document.getElementById('downloadValue').textContent = dl;
            document.getElementById('uploadValue').textContent = ul;
            document.getElementById('latencyValue').textContent = lat;
            document.getElementById('jitterValue').textContent = jit;

            history.unshift({
                timestamp: new Date().toLocaleString('vi-VN'),
                download: dl,
                upload: ul,
                latency: lat,
                jitter: jit
            });
            if (history.length > 20) history = history.slice(0, 20);
            saveHistory();
            renderHistory();

            isRunning = false;
            startBtn.disabled = false;
            startBtn.textContent = '▶ Test Again';
        };

        speedtest.play();

    } catch (err) {
        console.error(err);
        statusText.textContent = '❌ Test failed: ' + err.message;
        isRunning = false;
        startBtn.disabled = false;
    }
}

function resetTest() {
    if (speedtest) {
        speedtest.pause();
        speedtest = null;
    }
    isRunning = false;
    startBtn.disabled = false;
    startBtn.textContent = '▶ Start Test';
    resetBtn.disabled = true;
    statusDiv.style.display = 'none';
    progressDiv.style.display = 'none';
    resultsDiv.style.display = 'none';
    serverInfoDiv.style.display = 'none';
    setProgress(0);
}

startBtn.addEventListener('click', startTest);
resetBtn.addEventListener('click', resetTest);

loadHistory();
fetchServerInfo();
