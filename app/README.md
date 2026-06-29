# ⚡ Speed Test

Internet speed test web app powered by **@cloudflare/speedtest**.

Live demo: [your-project.pages.dev](https://your-project.pages.dev)

---

## 📁 Project Structure

```
app/
├── index.html              # Main HTML page
├── app.js                  # Core logic (speedtest + server info + history)
├── style.css               # Styles & wave progress animation
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (offline cache)
├── favicon.ico             # Browser tab icon
└── icons/
    ├── icon-192.png        # PWA icon (Android)
    ├── icon-512.png        # PWA icon (splash screen)
    └── apple-touch-icon.png # PWA icon (iOS)
```

---

## 🚀 Features

- ⬇️ Download / ⬆️ Upload speed (Mbps)
- 📡 Latency & 📊 Jitter (ms)
- 🌐 IP Address, 🏢 ISP, 📍 Location, 🖥️ CF Server
- 📋 Test History (localStorage, max 20)
- 📱 PWA — installable on Android & iOS
- 🌊 Wave progress bar animation

---

## ☁️ Deploy (Cloudflare Pages)

| Setting | Value |
|---------|-------|
| Framework preset | `None` |
| Build command | `echo 'Deploy ready'` |
| Build output directory | `app` |

---

## 📝 Notes

- History saved locally in browser (localStorage)
- If IP/server info shows `-`, clear browser cache and reload

---

## 📄 License

MIT © Based on [@cloudflare/speedtest](https://github.com/cloudflare/speedtest)
