import SpeedTest from 'https://cdn.jsdelivr.net/npm/@cloudflare/speedtest@1.10.1/+esm';

let speedtest = null;
let history = [];
let isRunning = false;

// Chart instances
let downloadChart = null;
let uploadChart = null;

// Data for charts
let downloadData = [];
let uploadData = [];
const maxDataPoints = 30;

const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const statusDiv = document.getElementById('status');
const statusText = document.getElementById('statusText');
const resultsDiv = document.getElementById('results-container');
const historyList = document.getElementById('historyList');
const serverInfoDiv = document.getElementById('serverInfo');

// Initialize charts
function initCharts() {
    const downloadCtx = document.getElementById('downloadChart').getContext('2d');
    const uploadCtx = document.getElementById('uploadChart').getContext('2d');

    // Destroy existing charts if they exist
    if (downloadChart) downloadChart.destroy();
    if (uploadChart) uploadChart.destroy();

    downloadData = [];
    uploadData = [];

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: true,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderColor: '#ff6b35',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                callbacks: {
                    label: function(context) {
                        return context.parsed.y.toFixed(2) + ' Mbps';
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    color: '#8892b0',
                    font: {
                        size: 11,
                        weight: '500'
                    }
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false
                }
            },
            x: {
                ticks: {
                    color: '#8892b0',
                    font: {
                        size: 11,
                        weight: '500'
                    }
                },
                grid: {
                    display: false
                }
            }
        }
    };

    // Download Chart (Orange)
    downloadChart = new Chart(downloadCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Download',
                data: [],
                borderColor: '#ff6b35',
                backgroundColor: 'rgba(255, 107, 53, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#ff6b35',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                segment: {
                    borderColor: '#ff6b35'
                }
            }]
        },
        options: chartOptions
    });

    // Upload Chart (Purple)
    uploadChart = new Chart(uploadCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Upload',
                data: [],
                borderColor: '#9d4edd',
                backgroundColor: 'rgba(157, 78, 221, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#9d4edd',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                segment: {
                    borderColor: '#9d4edd'
                }
            }]
        },
        options: chartOptions
    });
}

function updateCharts(dlValue, ulValue) {
    if (!downloadChart || !uploadChart) return;

    // Add new data points
    downloadData.push(dlValue);
    uploadData.push(ulValue);

    // Keep only last maxDataPoints
    if (downloadData.length > maxDataPoints) {
        downloadData.shift();
        uploadData.shift();
    }

    // Update chart data
    downloadChart.data.labels = Array.from({length: downloadData.length}, (_, i) => i + 1);
    downloadChart.data.datasets[0].data = downloadData;
    downloadChart.update('none');

    uploadChart.data.labels = Array.from({length: uploadData.length}, (_, i) => i + 1);
    uploadChart.data.datasets[0].data = uploadData;
    uploadChart.update('none');
}

// Fetch server info
async function fetchServerInfo() {
    try {
        const traceRes = await fetch('https://1.1.1.1/cdn-cgi/trace');
        const traceText = await traceRes.text();

        const traceData = {};
        traceText.trim().split('\n').forEach(line => {
            const [key, ...rest] = line.split('=');
            traceData[key.trim()] = rest.join('=').trim();
        });

        const metaRes = await fetch('https://speed.cloudflare.com/meta');
        const metaData = await metaRes.json();

        document.getElementById('infoIP').textContent = traceData.ip || '-';
        document.getElementById('infoISP').textContent = metaData.asOrganization || '-';
        document.getElementById('infoCity').textContent = [metaData.city, metaData.country].filter(Boolean).join(', ') || '-';
        document.getElementById('infoServer').textContent = traceData.colo || '-';

    } catch (e) {
        console.error('Failed to fetch server info:', e);
    }
}

// Load history from localStorage
function loadHistory() {
    const saved = localStorage.getItem('speedtest-history');
    history = saved ? JSON.parse(saved) : [];
    renderHistory();
}

// Save history to localStorage
function saveHistory() {
    localStorage.setItem('speedtest-history', JSON.stringify(history));
}

// Render history list
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

// Delete history item
window.deleteHistory = function(index) {
    history.splice(index, 1);
    saveHistory();
    renderHistory();
}

// Update status text
function updateStatus(type) {
    const messages = {
        latency: '📡 Measuring latency...',
        download: '⬇️ Measuring download speed...',
        upload: '⬆️ Measuring upload speed...',
        packetLoss: '📦 Measuring packet loss...'
    };
    statusText.textContent = messages[type] || '⏳ Running test...';
}

// Start speed test
async function startTest() {
    if (isRunning) return;

    isRunning = true;
    startBtn.disabled = true;
    resetBtn.disabled = false;

    resultsDiv.style.display = 'none';
    serverInfoDiv.style.display = 'none';
    statusDiv.style.display = 'block';
    statusText.textContent = '⏳ Initializing...';

    // Initialize charts
    initCharts();

    // Reset values
    ['download', 'upload', 'latency', 'jitter'].forEach(id => {
        document.getElementById(id + 'Value').textContent = '-';
    });

    try {
        speedtest = new SpeedTest({ autoStart: false });

        speedtest.onResultsChange = ({ type }) => {
            updateStatus(type);
            const results = speedtest.results;

            if (type === 'download') {
                const dl = results.getDownloadBandwidth();
                if (dl) {
                    const dlMbps = dl / 1e6;
                    document.getElementById('downloadValue').textContent = dlMbps.toFixed(1);
                    updateCharts(dlMbps, uploadData[uploadData.length - 1] || 0);
                    resultsDiv.style.display = 'block';
                }
            }

            if (type === 'upload') {
                const ul = results.getUploadBandwidth();
                if (ul) {
                    const ulMbps = ul / 1e6;
                    document.getElementById('uploadValue').textContent = ulMbps.toFixed(1);
                    updateCharts(downloadData[downloadData.length - 1] || 0, ulMbps);
                    resultsDiv.style.display = 'block';
                }
            }

            if (type === 'latency') {
                const lat = results.getUnloadedLatency();
                const jit = results.getUnloadedJitter();
                if (lat) document.getElementById('latencyValue').textContent = lat.toFixed(0);
                if (jit) document.getElementById('jitterValue').textContent = jit.toFixed(0);
                resultsDiv.style.display = 'block';
            }
        };

        speedtest.onError = (err) => {
            console.error('SpeedTest error:', err);
            statusText.textContent = '⚠️ Error: ' + err;
            isRunning = false;
            startBtn.disabled = false;
        };

        speedtest.onFinish = (results) => {
            statusDiv.style.display = 'none';
            resultsDiv.style.display = 'block';
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

            // Add to history
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

// Reset test
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
    resultsDiv.style.display = 'none';
    serverInfoDiv.style.display = 'none';
    
    // Destroy charts
    if (downloadChart) {
        downloadChart.destroy();
        downloadChart = null;
    }
    if (uploadChart) {
        uploadChart.destroy();
        uploadChart = null;
    }
}

// Event listeners
startBtn.addEventListener('click', startTest);
resetBtn.addEventListener('click', resetTest);

// Initialize on load
loadHistory();
fetchServerInfo();
