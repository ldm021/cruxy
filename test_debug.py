"""
Debug test - see what's happening
"""

import json
from backend.crossword_generator import CrosswordGenerator

# Load word list
with open('data/words.json', 'r') as f:
    word_list = json.load(f)

print("Creating generator...")
generator = CrosswordGenerator(grid_size=9)

# Override max_attempts to something small for testing
generator.max_attempts = 5

print(f"Max attempts: {generator.max_attempts}")
print("Generating puzzle...")

puzzle = generator.generate(word_list, difficulty="medium")

if puzzle:
    print("\n✓ SUCCESS! Puzzle generated")
    total_words = len(puzzle['clues']['across']) + len(puzzle['clues']['down'])
    print(f"Total words: {total_words}")
else:
    print("\n❌ Failed to generate puzzle in {0} attempts".format(generator.max_attempts))
    print("This suggests the constraints are too strict or there's an algorithm issue")
