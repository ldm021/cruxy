"""
Simple test for Phase 1 - just test 9x9 grid
"""

import json
from backend.crossword_generator import CrosswordGenerator

# Load word list
with open('data/words.json', 'r') as f:
    word_list = json.load(f)

print("Testing 9x9 grid with Phase 1 improvements...")
print("="*60)

# Generate puzzle
generator = CrosswordGenerator(grid_size=9)
puzzle = generator.generate(word_list, difficulty="medium")

if not puzzle:
    print("❌ FAILED: Could not generate puzzle")
    exit(1)

print("✓ Puzzle generated successfully\n")

# Get clues
across_clues = puzzle['clues']['across']
down_clues = puzzle['clues']['down']
all_clues = across_clues + down_clues

total_words = len(all_clues)
word_lengths = [clue['length'] for clue in all_clues]

# Check word lengths
two_letter_count = sum(1 for length in word_lengths if length == 2)
three_letter_count = sum(1 for length in word_lengths if length == 3)
three_letter_percentage = (three_letter_count / total_words * 100) if total_words > 0 else 0

print(f"📊 Word Statistics:")
print(f"   Total words: {total_words}")
print(f"   Target for 9x9: 15-20 words")
print(f"   Status: {'✓ PASS' if 15 <= total_words <= 20 else f'⚠️  Got {total_words}'}")
print()
print(f"   2-letter words: {two_letter_count} {'✓ PASS' if two_letter_count == 0 else '❌ FAIL'}")
print(f"   3-letter words: {three_letter_count} ({three_letter_percentage:.1f}%) {'✓ PASS' if three_letter_percentage <= 20 else '❌ FAIL'}")
print()

# Count by length
from collections import Counter
length_dist = Counter(word_lengths)
print(f"   Length distribution: {dict(sorted(length_dist.items()))}")
print(f"   Average word length: {sum(word_lengths) / len(word_lengths):.1f} letters")
print()

# Check black square symmetry
grid = puzzle['grid']
size = puzzle['size']

symmetric = True
for row in range(size):
    for col in range(size):
        is_blocked = grid[row][col]['blocked']
        mirror_row = size - 1 - row
        mirror_col = size - 1 - col
        mirror_blocked = grid[mirror_row][mirror_col]['blocked']

        if is_blocked != mirror_blocked:
            symmetric = False
            print(f"   ❌ Asymmetry at ({row},{col}) vs ({mirror_row},{mirror_col})")
            break
    if not symmetric:
        break

if symmetric:
    print("✓ Black squares are symmetric (180° rotational)")
else:
    print("❌ Black squares are NOT symmetric")
print()

# Check grid fill
total_cells = size * size
blocked_cells = sum(1 for row in grid for cell in row if cell['blocked'])
black_percentage = (blocked_cells / total_cells * 100)

print(f"🎯 Grid Statistics:")
print(f"   Total cells: {total_cells}")
print(f"   Black squares: {blocked_cells} ({black_percentage:.1f}%)")
print(f"   Target black square %: 15-20%")
print(f"   Status: {'✓ PASS' if 15 <= black_percentage <= 20 else f'⚠️  Got {black_percentage:.1f}%'}")
print()

# Print grid
solution = puzzle['solution']
print("Grid visualization (█ = black square):")
for row in range(size):
    line = ""
    for col in range(size):
        if grid[row][col]['blocked']:
            line += "█ "
        elif solution[row][col]:
            line += solution[row][col] + " "
        else:
            line += "· "
    print(line)

print()
print("="*60)
if total_words >= 15 and two_letter_count == 0 and three_letter_percentage <= 20 and symmetric:
    print("✓ ALL TESTS PASSED")
else:
    print("⚠️  Some targets not met (may need tuning)")
