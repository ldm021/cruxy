# Running Crossword App in VSCode

This guide shows you how to run and develop the crossword app entirely within VSCode.

## Quick Start (Easiest Method)

### 1. Start the Server

**Using Terminal:**
- Press `` Ctrl+` `` to open the integrated terminal
- Run: `python app.py`
- Wait for "Running on http://127.0.0.1:5000"

### 2. Open in VSCode Browser

**Using Simple Browser (Built-in):**
- Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
- Type: `Simple Browser: Show`
- Enter URL: `http://localhost:5000`
- The app opens in a split panel!

**Tip:** You can move the browser panel anywhere by dragging it.

---

## Method 2: Using Browser Preview Extension (Recommended)

For a better browser experience with DevTools:

### Install Extension
1. Open Extensions: `Ctrl+Shift+X`
2. Search: "Browser Preview"
3. Install by Kenneth Auchenberg

### Run App
1. Start server: `python app.py` in terminal
2. Press `Ctrl+Shift+P`
3. Type: `Browser Preview: Open Preview`
4. Enter: `http://localhost:5000`

### Features
- Full browser DevTools
- Inspect element
- Console logs
- Network monitoring
- Side-by-side code and preview

---

## Method 3: Using VSCode Tasks (One-Click Launch)

I've created VSCode tasks for you. Just press:

**`Ctrl+Shift+B`** (Windows/Linux) or **`Cmd+Shift+B`** (Mac)

This will:
1. Start the Flask server automatically
2. Open in terminal panel
3. You can then use Simple Browser to view it

---

## Method 4: Python Debugger

For debugging the backend:

### Launch with Debugger
1. Go to Run and Debug panel: `Ctrl+Shift+D`
2. Select "Python: Flask" from dropdown
3. Press `F5` to start
4. Set breakpoints in `app.py` or `backend/crossword_generator.py`
5. Open browser to `http://localhost:5000`

### Features
- Step through code
- Inspect variables
- Debug puzzle generation
- Monitor API calls

---

## Recommended Workflow

**Side-by-Side Development:**

1. **Left Panel:** Your code (app.py, static/app.js, etc.)
2. **Right Panel:** Simple Browser with app running
3. **Bottom Panel:** Terminal with Flask server

**Layout:**
```
┌─────────────────┬─────────────────┐
│                 │                 │
│   Code Editor   │  Simple Browser │
│                 │  (localhost:5000│
│                 │                 │
├─────────────────┴─────────────────┤
│   Terminal: python app.py         │
└────────────────────────────────────┘
```

---

## Hot Reload Tips

### Backend Changes (Python)
- Flask auto-reloads when you save `.py` files
- Just refresh the browser

### Frontend Changes (HTML/CSS/JS)
- Just save and refresh the browser
- No need to restart Flask

### Force Reload
- In Simple Browser: `Ctrl+Shift+P` → "Reload"
- Or use Browser Preview's refresh button

---

## Troubleshooting

### "Address already in use" Error
Port 5000 is taken. Options:
1. Kill existing process:
   - Linux/Mac: `lsof -ti:5000 | xargs kill -9`
   - Windows: `netstat -ano | findstr :5000` then `taskkill /PID <PID> /F`
2. Or change port in `app.py`:
   ```python
   app.run(debug=True, host='0.0.0.0', port=5001)
   ```

### Simple Browser Won't Open
- Make sure URL starts with `http://`
- Try `http://127.0.0.1:5000` instead of `localhost:5000`

### Browser Preview Not Working
- Reinstall the extension
- Try Simple Browser instead (built-in, always works)

### Flask Not Starting
- Check Python is installed: `python --version`
- Install Flask: `pip install -r requirements.txt`

---

## VSCode Extensions for Better Experience

**Recommended:**
1. **Python** (Microsoft) - Python language support
2. **Browser Preview** (Kenneth Auchenberg) - Embedded browser
3. **Live Server** (Ritwick Dey) - Alternative preview method

**Optional but Nice:**
1. **Prettier** - Format HTML/CSS/JS
2. **Python Docstring Generator** - Document Python code
3. **GitLens** - Enhanced Git features
4. **Thunder Client** - Test API endpoints

---

## Keyboard Shortcuts Summary

| Action | Shortcut |
|--------|----------|
| Open Terminal | `` Ctrl+` `` |
| Command Palette | `Ctrl+Shift+P` |
| Run Task | `Ctrl+Shift+B` |
| Simple Browser | `Ctrl+Shift+P` → "Simple Browser: Show" |
| Start Debugging | `F5` |
| Toggle Sidebar | `Ctrl+B` |
| Split Editor | `Ctrl+\` |

---

## Best Practices

1. **Keep terminal visible** - Monitor Flask logs for errors
2. **Use split view** - Code on left, browser on right
3. **Set breakpoints** - Debug puzzle generation algorithm
4. **Check console** - Browser DevTools for JavaScript errors
5. **Auto-save** - Enable in VSCode settings for instant updates

---

## Example Workflow

```bash
# 1. Open VSCode
code .

# 2. Open terminal (Ctrl+`)
# Terminal will open at bottom

# 3. Start server
python app.py

# 4. Open Simple Browser (Ctrl+Shift+P)
# Type: Simple Browser: Show
# Enter: http://localhost:5000

# 5. Start coding!
# Edit files → Save → Refresh browser → See changes
```

---

## Advanced: Multi-Root Workspace

If you're working on multiple projects:

```json
// .code-workspace file
{
  "folders": [
    { "path": "." }
  ],
  "settings": {
    "python.defaultInterpreterPath": "python3"
  }
}
```

---

**You're all set!** Press `Ctrl+Shift+P`, type "Simple Browser", and start solving crosswords right in VSCode! 🎯
