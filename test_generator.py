"""
Quick test script to verify the crossword generator works
"""

import json
from backend.crossword_generator import generate_crossword

# Load word list
with open('data/words.json', 'r') as f:
    word_list = json.load(f)

print("Testing crossword generator...")
print(f"Loaded {len(word_list)} words")

# Test with a 9x9 grid
print("\nGenerating 9x9 crossword puzzle...")
puzzle = generate_crossword(word_list, grid_size=9)

if puzzle:
    print("✓ Puzzle generated successfully!")
    print(f"  Grid size: {puzzle['size']}x{puzzle['size']}")
    print(f"  Across clues: {len(puzzle['clues']['across'])}")
    print(f"  Down clues: {len(puzzle['clues']['down'])}")
    print(f"  Total words: {len(puzzle['clues']['across']) + len(puzzle['clues']['down'])}")

    # Display the solution grid
    print("\nSolution grid:")
    for row in puzzle['solution']:
        print('  ' + ' '.join(cell if cell else '█' for cell in row))

    print("\nSample clues:")
    print("ACROSS:")
    for clue in puzzle['clues']['across'][:3]:
        print(f"  {clue['number']}. {clue['clue']} ({clue['length']} letters)")

    print("\nDOWN:")
    for clue in puzzle['clues']['down'][:3]:
        print(f"  {clue['number']}. {clue['clue']} ({clue['length']} letters)")

    print("\n✓ All tests passed!")
else:
    print("✗ Failed to generate puzzle")
    exit(1)
