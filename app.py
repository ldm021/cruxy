"""
Flask backend for Crossword Generator App
Provides API endpoints for generating and serving crossword puzzles.
"""

from flask import Flask, render_template, jsonify, request, send_from_directory
import json
import os
import time
from backend.crossword_generator import generate_crossword
from backend.crossword_generator_advanced import generate_crossword_advanced

app = Flask(__name__,
            template_folder='frontend',
            static_folder='static')

# Cache for storing the current puzzle
current_puzzle = None


@app.route('/')
def index():
    """Serve the main page."""
    return render_template('index.html')


@app.route('/api/generate', methods=['POST'])
def generate():
    """
    Generate a new crossword puzzle.

    Request body (optional):
        {
            "grid_size": 9,  // Size of the grid (default: 9)
            "difficulty": "medium"  // Difficulty level: "easy", "medium", or "hard" (default: "medium")
        }

    Returns:
        JSON with puzzle data or error message
    """
    global current_puzzle

    try:
        # Get parameters from request
        data = request.get_json() or {}
        grid_size = data.get('grid_size', 9)
        difficulty = data.get('difficulty', 'medium')
        mode = data.get('mode', 'standard')  # 'standard' or 'advanced'

        # Validate grid size
        if not isinstance(grid_size, int) or grid_size < 5 or grid_size > 15:
            return jsonify({
                'error': 'Grid size must be between 5 and 15'
            }), 400

        # Validate difficulty
        if difficulty not in ['easy', 'medium', 'hard']:
            return jsonify({
                'error': 'Difficulty must be "easy", "medium", or "hard"'
            }), 400

        # Validate mode
        if mode not in ['standard', 'advanced']:
            return jsonify({
                'error': 'Mode must be "standard" or "advanced"'
            }), 400

        # Load word list
        word_list_path = os.path.join(os.path.dirname(__file__), 'data', 'words.json')
        with open(word_list_path, 'r') as f:
            word_list = json.load(f)

        # Generate puzzle with timing
        print(f"[DEBUG] Attempting to generate {grid_size}x{grid_size} puzzle (difficulty: {difficulty}, mode: {mode})")
        print(f"[DEBUG] Word list size: {len(word_list)}")

        start_time = time.time()

        if mode == 'advanced':
            puzzle = generate_crossword_advanced(word_list, grid_size=grid_size, difficulty=difficulty)
        else:
            puzzle = generate_crossword(word_list, grid_size=grid_size, difficulty=difficulty)

        generation_time = time.time() - start_time

        if puzzle is None:
            print(f"[DEBUG] Generator returned None - unable to create valid puzzle")
            return jsonify({
                'error': 'Failed to generate puzzle. Please try again.'
            }), 500

        word_count = len(puzzle['clues']['across']) + len(puzzle['clues']['down'])
        print(f"[DEBUG] Puzzle generated successfully in {generation_time:.2f}s!")
        print(f"[DEBUG] Words placed: {word_count}")

        # Store puzzle in cache
        current_puzzle = puzzle

        # Return puzzle without solution + metrics
        response_data = {
            'grid': puzzle['grid'],
            'size': puzzle['size'],
            'clues': {
                'across': [
                    {
                        'number': clue['number'],
                        'clue': clue['clue'],
                        'length': clue['length'],
                        'row': clue['row'],
                        'col': clue['col']
                    }
                    for clue in puzzle['clues']['across']
                ],
                'down': [
                    {
                        'number': clue['number'],
                        'clue': clue['clue'],
                        'length': clue['length'],
                        'row': clue['row'],
                        'col': clue['col']
                    }
                    for clue in puzzle['clues']['down']
                ]
            },
            'metrics': {
                'mode': mode,
                'generation_time': round(generation_time, 2),
                'word_count': word_count,
                'success': True,
                'grid_size': grid_size,
                'difficulty': difficulty
            }
        }

        return jsonify(response_data)

    except FileNotFoundError:
        return jsonify({
            'error': 'Word list file not found'
        }), 500
    except Exception as e:
        print(f"Error generating puzzle: {e}")
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500


@app.route('/api/check', methods=['POST'])
def check_solution():
    """
    Check if the user's solution is correct.

    Request body:
        {
            "grid": [["A", "B", ...], ...]  // User's answers
        }

    Returns:
        JSON with correctness information
    """
    global current_puzzle

    if current_puzzle is None:
        return jsonify({
            'error': 'No active puzzle. Generate a puzzle first.'
        }), 400

    try:
        data = request.get_json()
        user_grid = data.get('grid', [])

        # Check dimensions
        if len(user_grid) != current_puzzle['size']:
            return jsonify({
                'error': 'Invalid grid dimensions'
            }), 400

        # Compare with solution
        solution = current_puzzle['solution']
        size = current_puzzle['size']

        # Check each cell
        errors = []
        correct_count = 0
        total_count = 0

        for row in range(size):
            for col in range(size):
                # Skip blocked cells
                if solution[row][col] == '':
                    continue

                total_count += 1
                user_letter = user_grid[row][col].upper() if user_grid[row][col] else ''
                correct_letter = solution[row][col]

                if user_letter == correct_letter:
                    correct_count += 1
                elif user_letter != '':  # Only mark as error if user entered something
                    errors.append({
                        'row': row,
                        'col': col,
                        'expected': correct_letter,
                        'got': user_letter
                    })

        is_complete = correct_count == total_count

        return jsonify({
            'correct': is_complete,
            'errors': errors,
            'correctCount': correct_count,
            'totalCount': total_count,
            'percentage': round((correct_count / total_count * 100) if total_count > 0 else 0, 1)
        })

    except Exception as e:
        print(f"Error checking solution: {e}")
        return jsonify({
            'error': f'Error checking solution: {str(e)}'
        }), 500


@app.route('/api/reveal', methods=['POST'])
def reveal_solution():
    """
    Reveal the solution or a hint.

    Request body (optional):
        {
            "row": 0,  // Reveal specific cell
            "col": 0
        }

    Returns:
        Full solution or single cell
    """
    global current_puzzle

    if current_puzzle is None:
        return jsonify({
            'error': 'No active puzzle. Generate a puzzle first.'
        }), 400

    try:
        data = request.get_json() or {}

        # If specific cell requested
        if 'row' in data and 'col' in data:
            row = data['row']
            col = data['col']

            if 0 <= row < current_puzzle['size'] and 0 <= col < current_puzzle['size']:
                letter = current_puzzle['solution'][row][col]
                return jsonify({
                    'row': row,
                    'col': col,
                    'letter': letter
                })
            else:
                return jsonify({
                    'error': 'Invalid cell coordinates'
                }), 400

        # Return full solution
        return jsonify({
            'solution': current_puzzle['solution']
        })

    except Exception as e:
        print(f"Error revealing solution: {e}")
        return jsonify({
            'error': f'Error revealing solution: {str(e)}'
        }), 500


@app.route('/api/puzzle', methods=['GET'])
def get_puzzle():
    """Get the current puzzle data."""
    global current_puzzle

    if current_puzzle is None:
        return jsonify({
            'error': 'No active puzzle. Generate a puzzle first.'
        }), 400

    # Return puzzle without solution
    response_data = {
        'grid': current_puzzle['grid'],
        'size': current_puzzle['size'],
        'clues': {
            'across': [
                {
                    'number': clue['number'],
                    'clue': clue['clue'],
                    'length': clue['length'],
                    'row': clue['row'],
                    'col': clue['col']
                }
                for clue in current_puzzle['clues']['across']
            ],
            'down': [
                {
                    'number': clue['number'],
                    'clue': clue['clue'],
                    'length': clue['length'],
                    'row': clue['row'],
                    'col': clue['col']
                }
                for clue in current_puzzle['clues']['down']
            ]
        }
    }

    return jsonify(response_data)


if __name__ == '__main__':
    # Run in development mode
    app.run(debug=True, host='0.0.0.0', port=5000)
