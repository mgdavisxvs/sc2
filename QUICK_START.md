# SC2 Build Lab - Quick Start Guide

This guide will help you get the SC2 Build Lab running in under 2 minutes.

## 🚀 Quick Start (Automated)

We provide automated launch scripts that check dependencies and start the application:

### Linux / macOS

```bash
./start.sh
```

### Windows

```batch
start.bat
```

**That's it!** The script will:
1. ✓ Check for required dependencies
2. ✓ Install a development server if needed (with your permission)
3. ✓ Start the local web server
4. ✓ Open your default browser automatically
5. ✓ Load the SC2 Build Lab application

---

## 📋 What the Scripts Check

The automated scripts check for these dependencies in order of preference:

### 1. **http-server** (Recommended)
- Fast, lightweight Node.js server
- CORS-enabled for local development
- Auto-opens browser
- **Install:** `npm install -g http-server`

### 2. **serve**
- Alternative Node.js server
- CORS support
- **Install:** `npm install -g serve`

### 3. **Python HTTP Server**
- Built into Python 3
- No installation needed if you have Python
- Slightly slower than Node.js servers

---

## 🔧 Manual Installation (if scripts fail)

If the automated scripts don't work, here's how to run manually:

### Option 1: http-server (Recommended)

```bash
# Install http-server globally
npm install -g http-server

# Start server
cd /path/to/sc2
http-server -p 8080 -c-1 --cors -o
```

### Option 2: serve

```bash
# Install serve globally
npm install -g serve

# Start server
cd /path/to/sc2
serve -l 8080 --cors
```

### Option 3: Python 3

```bash
# No installation needed
cd /path/to/sc2
python3 -m http.server 8080
```

Then open: http://localhost:8080

---

## 📊 Loading Game Data

After the app loads, you need SC2 game data:

### Method 1: Drag & Drop (Easiest)
1. Drag `sc2units.json` from your file system
2. Drop it anywhere on the app window
3. Data loads automatically

### Method 2: File Picker
1. Click **"Load JSON"** button in header
2. Select `sc2units.json` from file dialog
3. Data loads automatically

### Method 3: Embedded Data (Advanced)
1. Place `sc2units.json` in the project root
2. Add `<script id="sc2-data" type="application/json">...</script>` to index.html
3. Data loads automatically on startup

---

## 🎯 First Steps After Loading Data

1. **Select a Race**: Click Protoss, Terran, or Zerg tabs
2. **Browse Units**: View units, buildings, and upgrades
3. **Create Your First Build**:
   - Click unit cards to add them
   - OR use "🌳 Tech Tree" for visual selection
   - OR click "Auto Build" for a sample build order

4. **Try Advanced Features**:
   - **📊 Visualize**: See timeline and resource charts
   - **📈 MRTS**: Economic analysis of your build
   - **💾 Save**: Save builds to library
   - **📚 Library**: Browse and compare saved builds

---

## 🐛 Troubleshooting

### "Port 8080 already in use"

The scripts will automatically try alternative ports. Or manually specify a different port:

```bash
# Linux/macOS
http-server -p 3000 -c-1 --cors -o

# Windows
http-server -p 3000 -c-1 --cors -o
```

### "CORS Error" in Browser Console

Make sure you're using a development server (http-server, serve, or Python), not opening `index.html` directly via `file://` protocol.

### "Module not found" Errors

This app uses ES6 modules which require:
- A web server (not file:// protocol)
- Modern browser (Chrome 61+, Firefox 60+, Safari 11+)

### Scripts Don't Run on Linux/macOS

Make sure the script is executable:

```bash
chmod +x start.sh
./start.sh
```

### No Browser Opens Automatically

Manually open: http://localhost:8080

---

## 🌐 Browser Compatibility

**Supported Browsers** (ES6 Modules + Modern JavaScript):
- ✅ Chrome 61+ (Sept 2017)
- ✅ Firefox 60+ (May 2018)
- ✅ Safari 11+ (Sept 2017)
- ✅ Edge 79+ (Chromium-based, Jan 2020)

**Not Supported**:
- ❌ Internet Explorer (any version)
- ❌ Old Edge (pre-Chromium)

---

## 📚 Next Steps

Once you're up and running, check out:

- **[USER_GUIDE.md](./USER_GUIDE.md)** - Complete feature walkthrough
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical documentation
- **[MRTS_ANALYSIS.md](./MRTS_ANALYSIS.md)** - Economic analysis guide

---

## 💡 Pro Tips

1. **Keyboard Shortcuts**:
   - Search bar auto-focuses when you start typing
   - Tab through interface elements for quick navigation

2. **Tech Tree Auto-Complete**:
   - Hold **Shift** while clicking locked units
   - Automatically adds all prerequisites

3. **Build Comparison**:
   - Save 2-4 builds to library
   - Select them with checkboxes
   - Click "Compare" for side-by-side analysis

4. **Export/Import Builds**:
   - Export as JSON for backup
   - Share builds with teammates
   - Version control your strategies

---

## 🆘 Need Help?

- **Bug Reports**: Open an issue with details
- **Feature Requests**: Describe your use case
- **Questions**: Check USER_GUIDE.md first

---

**Enjoy optimizing your StarCraft II build orders!** 🎮⚡
