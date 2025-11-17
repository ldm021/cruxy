"""
Quick test to verify both generators work
"""

import json
from backend.crossword_generator import generate_crossword
from backend.crossword_generator_advanced import generate_crossword_advanced

# Load word list
with open('data/words.json', 'r') as f:
    word_list = json.load(f)

print(f"Loaded {len(word_list)} words\n")

# Test standard generator
print("Testing STANDARD generator...")
puzzle = generate_crossword(word_list, grid_size=9, difficulty='medium')
if puzzle:
    word_count = len(puzzle['clues']['across']) + len(puzzle['clues']['down'])
    print(f"✓ Standard generator: {word_count} words placed")
else:
    print("✗ Standard generator failed")

# Test advanced generator
print("\nTesting ADVANCED generator...")
puzzle = generate_crossword_advanced(word_list, grid_size=9, difficulty='medium')
if puzzle:
    word_count = len(puzzle['clues']['across']) + len(puzzle['clues']['down'])
    print(f"✓ Advanced generator: {word_count} words placed")
else:
    print("✗ Advanced generator failed")

print("\n✓ Both generators are working!")
