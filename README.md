# India Mathematics AR

A browser-based WebAR experience built for a **CBSE Class 6 Mathematics**
competition. Point a phone camera at a printed marker and a 3D temple
rises out of the page, rotates slowly, and reveals four educational
labels that connect ancient Indian temple architecture to the
mathematics topics students learn in class: **triangles, geometry,
symmetry, and architecture.**

Built with **MindAR (image tracking)**, **A-Frame**, and **Three.js**
(bundled inside A-Frame). Pure HTML/CSS/JavaScript — no Node.js, no
npm, no build tools, no React. It runs by simply opening `index.html`
through a local server or by hosting the folder on GitHub Pages.

---

## ✨ What happens when it runs

1. The browser opens on the loading screen and requests camera access.
2. Once ready, a scanning overlay guides the user to point the camera
   at the printed **Marker.jpg**.
3. When MindAR detects the marker, the temple:
   - Rises upward from below the marker.
   - Scales up with a bouncy ease-out animation.
   - Glows gold briefly (point light + glow ring).
   - Then rotates slowly and continuously.
4. Four labels fade in one after another, each connected to a part of
   the temple with a colored leader line:
   - 🔺 **TRIANGLES** (yellow) → points to the upper tower (gopuram).
   - 📐 **GEOMETRY** (green) → points to the mid-body carvings.
   - ⚖️ **SYMMETRY** (cyan) → points to the temple's central axis.
   - 🏛️ **ANCIENT INDIAN ARCHITECTURE** (orange) → bottom title label.

---

## 📁 Folder structure

```
India_Mathematics_AR/
├── index.html          # Main entry point — scene, overlays, markup
├── style.css            # All styling (no inline styles anywhere)
├── main.js               # Loading, MindAR events, animation & label logic
├── README.md            # This file
├── LICENSE               # MIT license
├── .gitignore
└── assets/
    ├── Marker.jpg        # The printed image target (for reference/printing)
    ├── temple.glb         # 3D temple model
    └── targets.mind        # Compiled MindAR image target file
```

> **Important:** file names and locations must stay exactly as above.
> `index.html` references `./assets/targets.mind` and
> `./assets/temple.glb` directly.

---

## ▶️ Running locally with Live Server

WebAR requires camera access, and browsers only grant camera access on
a **secure context** — `https://` or `http://localhost`. Opening
`index.html` directly with `file://` will **not** work.

1. Install the **Live Server** extension in VS Code (or use any static
   file server — see alternatives below).
2. Open the `India_Mathematics_AR` folder in VS Code.
3. Right-click `index.html` → **Open with Live Server**.
4. Your browser opens at `http://127.0.0.1:5500` (or similar).
5. On a phone, connect to the **same Wi‑Fi network** as your computer
   and browse to `http://<your-computer-LAN-IP>:5500`. Most mobile
   browsers will refuse camera access here because it isn't HTTPS —
   use one of these options instead:
   - Live Server's built-in HTTPS (some versions support it), or
   - a tunneling tool such as `ngrok http 5500` to get a temporary
     HTTPS URL, or
   - deploy to GitHub Pages (see below), which is HTTPS by default.

### Alternative local servers (no VS Code required)

```bash
# Python 3
python3 -m http.server 8080

# Node.js (no install needed, via npx)
npx serve .
```

Then open `http://localhost:8080` (adjust the port to match).

---

## 🌐 Deploying to GitHub Pages

1. Create a new GitHub repository and push the contents of
   `India_Mathematics_AR/` to it (the files, not a parent folder).
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to
   `Deploy from a branch`, choose the `main` branch and the `/ (root)`
   folder, then click **Save**.
4. GitHub Pages will publish the site at:
   `https://<your-username>.github.io/<repository-name>/`
5. GitHub Pages is served over HTTPS automatically, so camera access
   will work on both desktop and Android Chrome.
6. Generate a QR code that points to that URL and print it alongside
   the temple marker for the demonstration.

> **Note on large files:** `temple.glb` can be large. If it exceeds
> GitHub's 100 MB per-file limit, either compress the model (see
> Troubleshooting below) or use [Git LFS](https://git-lfs.github.com/).

---

## 🖨️ Printing the marker

Print `assets/Marker.jpg` at a decent size (A5 or larger is ideal) on
plain paper or card. Keep it flat, well-lit, and avoid glare — glossy
lamination can create reflections that reduce tracking quality.

---

## 🔧 Troubleshooting

### Camera permission issues
- If the browser blocks the camera, check the site permissions icon
  in the address bar and set **Camera → Allow**, then reload.
- On Android Chrome: **Settings → Site settings → Camera** and make
  sure the site isn't blocked.
- Close any other app or browser tab currently using the camera
  (video calls, other AR tabs, etc.).

### HTTPS requirement
- Camera access via `getUserMedia` only works on secure contexts:
  `https://` or `http://localhost` / `http://127.0.0.1`.
- Plain `http://` on a LAN IP (e.g. `http://192.168.1.5:8080`) will be
  blocked by most mobile browsers. Use GitHub Pages or a tunnel (e.g.
  `ngrok`) for real HTTPS during testing.
- Opening the file directly (`file:///…/index.html`) will not work —
  always use a local server or a hosted URL.

### Marker not detected
- Ensure good, even lighting on the printed marker — avoid backlight
  and glare.
- Hold the phone steady, roughly 20–40 cm from the marker, fully
  inside the camera frame.
- Confirm `assets/targets.mind` was compiled from the same
  `Marker.jpg` shipped in `assets/` (re-compile via the
  [MindAR image target compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile)
  if you replace the marker image).

### Model appears distorted, huge, tiny, or floating
- The `temple-placement` component in `main.js` automatically
  measures `temple.glb` after it loads and rescales/repositions it so
  it always stands on the marker, centered. If something still looks
  off, check the browser console for a `model-error` message, which
  usually indicates a corrupted or missing `.glb` file.

### Browser compatibility
- **Recommended:** latest **Google Chrome** on **Android** or
  **Windows/macOS**.
- Also works on recent **Safari** (iOS 15+) and **Firefox**, though
  Chrome on Android is the primary target for this competition.
- WebAR requires WebGL and `getUserMedia` support — very old browsers
  or embedded WebViews without camera permissions will not work.

### Slow loading / large model
- `temple.glb` is loaded once via A-Frame's asset system (no duplicate
  downloads). On a slow connection the loading bar may take a while
  to reach 100%. For faster loads, consider compressing the model with
  [gltf-pipeline](https://github.com/CesiumGS/gltf-pipeline) (Draco
  compression) before deployment — this only requires a one-time
  offline conversion step and does not change how the site runs.

### Debug checklist
1. Open the browser DevTools console (remote-debug an Android phone
   via `chrome://inspect` on desktop Chrome if needed).
2. Confirm no red errors appear on load.
3. Confirm you see `arReady` fire (loading screen disappears, scanning
   overlay appears).
4. Point at the marker — confirm the console has no `model-error` or
   `arError` events.
5. If labels don't appear, confirm `temple-placement`'s `model-loaded`
   handler ran (the temple should be visibly grounded on the marker,
   not floating or embedded in it).

---

## 🧠 Educational context (for judges)

The temple model is used to visually connect real Indian architecture
to core CBSE Class 6 Mathematics topics:

| Label | Math concept | Where it points |
|---|---|---|
| 🔺 Triangles | Triangular gopuram tower profile | Upper tower |
| 📐 Geometry | Repeating geometric carvings & tiers | Mid-body |
| ⚖️ Symmetry | Bilateral symmetry of temple facades | Central axis |
| 🏛️ Ancient Indian Architecture | Historical & cultural context | Base / title |

---

## 📜 License

Released under the [MIT License](./LICENSE).
