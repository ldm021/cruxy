# Quick Start Guide

## Get Started in 3 Steps

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

Or simply run:

```bash
./run.sh
```

The script will automatically install dependencies if needed.

### 2. Start the Server

```bash
python app.py
```

Or use the convenience script:

```bash
./run.sh
```

### 3. Open Your Browser

Navigate to: **http://localhost:5000**

## Using the App

1. **Click "Generate New Puzzle"** to create a crossword
2. **Click on any white cell** to start entering letters
3. **Use arrow keys** to move between cells
4. **Type letters** - they'll automatically convert to uppercase
5. **Click "Check Answers"** to see your progress
6. **Click "Reveal Solution"** if you need help

## Tips

- Start with a 9x9 grid (default) - it's the sweet spot
- 7x7 grids are quicker but have fewer words
- Larger grids (11x11, 13x13) are more challenging
- The generator creates a new random puzzle each time

## What's Next?

This is **Phase 1** - the core functionality. Future phases will add:
- Multiple languages (Spanish, Italian, German)
- News article integration for themed puzzles
- User accounts and saved puzzles
- Difficulty levels
- Mobile optimization

## File Structure

```
cruxy/
├── app.py                  # Start here - Flask server
├── backend/
│   └── crossword_generator.py  # Core algorithm
├── frontend/
│   └── index.html         # Main page
├── static/
│   ├── style.css          # Styling
│   └── app.js             # Interactive features
└── data/
    └── words.json         # 337 words with clues
```

## Customization

Want to add your own words? Edit `data/words.json`:

```json
{
  "word": "PYTHON",
  "clue": "Popular programming language"
}
```

## Troubleshooting

**"Failed to generate puzzle"**
- Try a smaller grid size
- The algorithm needs at least 10 suitable words

**Port 5000 already in use?**
Edit `app.py` and change the port:
```python
app.run(debug=True, host='0.0.0.0', port=5001)
```

**Grid not appearing?**
- Check browser console for errors
- Make sure you're accessing http://localhost:5000 (not file://)

---

Enjoy creating crosswords! 🎯
