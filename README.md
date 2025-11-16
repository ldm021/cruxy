# Crossword Puzzle Generator

A web-based crossword puzzle generator that creates puzzles from a curated word list using constraint satisfaction and backtracking algorithms.

## Features

- **Intelligent Puzzle Generation**: Uses a backtracking algorithm with constraint satisfaction to generate valid crossword puzzles
- **Multiple Grid Sizes**: Choose from 7x7, 9x9, 11x11, or 13x13 grids
- **Interactive Web Interface**: Click and type to solve puzzles directly in your browser
- **Answer Checking**: Verify your solution and get instant feedback
- **Hint System**: Reveal the full solution if you get stuck
- **300+ Word Library**: Curated list of common English words with clear clues

## Project Structure

```
cruxy/
├── app.py                      # Flask backend server
├── backend/
│   └── crossword_generator.py # Core puzzle generation algorithm
├── frontend/
│   └── index.html             # Main web interface
├── static/
│   ├── style.css              # Styling
│   └── app.js                 # Frontend logic
├── data/
│   └── words.json             # Word list with clues
└── requirements.txt           # Python dependencies
```

## How It Works

### Algorithm Overview

The crossword generator uses a **backtracking algorithm** with the following strategy:

1. **Word Selection**: Sorts words by length (longer words first) for better placement success
2. **Initial Placement**: Places the first word in the center of the grid
3. **Intersection Finding**: For each subsequent word, finds all valid intersection points with existing words
4. **Constraint Checking**: Validates that words don't conflict and maintains proper spacing
5. **Backtracking**: If a placement fails, removes the word and tries alternatives
6. **Optimization**: Falls back to smaller word sets if initial attempts fail

### Key Components

#### Backend (`app.py`)
- **Flask server** providing REST API endpoints
- `/api/generate` - Generate new puzzle
- `/api/check` - Validate user's solution
- `/api/reveal` - Show solution
- `/api/puzzle` - Get current puzzle data

#### Core Generator (`backend/crossword_generator.py`)
- `CrosswordGenerator` class implementing the backtracking algorithm
- `WordPlacement` dataclass for tracking word positions
- Constraint satisfaction logic for valid placements
- Grid numbering system for clues

#### Frontend (`static/app.js`)
- Interactive grid with keyboard navigation
- Arrow key support for moving between cells
- Auto-advance after entering letters
- Real-time solution checking with visual feedback

## Installation & Setup

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Step 1: Clone or Download

```bash
cd cruxy
```

### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 3: Run the Application

```bash
python app.py
```

The server will start on `http://localhost:5000`

### Step 4: Open in Browser

Navigate to `http://localhost:5000` in your web browser.

## Usage

1. **Select Grid Size**: Choose your preferred grid size from the dropdown (7x7 to 13x13)
2. **Generate Puzzle**: Click "Generate New Puzzle" to create a new crossword
3. **Solve**:
   - Click on a cell to start entering letters
   - Use arrow keys to navigate between cells
   - Letters are automatically converted to uppercase
4. **Check Answers**: Click "Check Answers" to see your progress
   - Incorrect cells are highlighted in red
   - You'll see your completion percentage
5. **Get Help**: Click "Reveal Solution" to see all answers

## Customization

### Adding New Words

Edit `data/words.json` to add new words:

```json
{
  "word": "EXAMPLE",
  "clue": "A sample or illustration"
}
```

**Guidelines**:
- Words should be 3-15 letters
- Use clear, concise clues
- Avoid obscure or overly specialized terms
- Mix word lengths for better puzzle variety

### Adjusting Grid Size

Modify the grid size options in `frontend/index.html`:

```html
<select id="gridSize">
    <option value="7">7x7</option>
    <option value="9" selected>9x9</option>
    <!-- Add more sizes -->
</select>
```

### Changing Algorithm Parameters

In `backend/crossword_generator.py`, adjust:

- `max_attempts`: Maximum puzzle generation attempts (default: 100)
- `min_words`: Minimum words required for valid puzzle (default: grid_size)

## Technical Details

### Grid Representation

Each cell in the grid contains:
- `letter`: The letter in the cell (or None if blocked)
- `number`: Clue number (if word starts here)
- `blocked`: Boolean indicating if cell is part of puzzle

### Word Placement

Words are placed with these constraints:
- Must intersect existing words at matching letters
- Cannot have letters adjacent in perpendicular direction
- Must have blank spaces before/after the word
- Must fit within grid bounds

### API Response Format

Generate puzzle response:
```json
{
  "grid": [[{"number": 1, "blocked": false}, ...]],
  "size": 9,
  "clues": {
    "across": [{"number": 1, "clue": "...", "length": 5}],
    "down": [{"number": 2, "clue": "...", "length": 6}]
  }
}
```

## Future Enhancements (Phase 2+)

- [ ] Multiple languages (Spanish, Italian, German)
- [ ] News article integration for themed puzzles
- [ ] User accounts and saved puzzles
- [ ] Difficulty levels
- [ ] Mobile-responsive design improvements
- [ ] Print-friendly format
- [ ] Timer and scoring system
- [ ] Multiplayer mode

## Troubleshooting

### Puzzle Generation Fails

If you see "Failed to generate puzzle":
- Try a smaller grid size
- Ensure `data/words.json` has at least 50-100 words
- Check that words have variety in length (3-10 letters recommended)

### Server Won't Start

- Ensure Flask is installed: `pip install Flask`
- Check that port 5000 is not in use
- Verify you're in the correct directory

### Grid Not Displaying

- Check browser console for JavaScript errors
- Ensure all static files are in the `static/` folder
- Clear browser cache and reload

## Contributing

This is Phase 1 of the multilingual crossword app. The codebase is designed to be modular and extensible for future features.

## License

MIT License - feel free to use and modify for your projects.

## Credits

Built with:
- Python & Flask for backend
- Vanilla JavaScript for frontend (no frameworks - keeping it simple!)
- CSS Grid for layout

---

**Version**: 1.0.0 (Phase 1)
**Last Updated**: 2025-01-16
