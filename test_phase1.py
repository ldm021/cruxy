"""
Test script for Phase 1 professional crossword generator upgrades.

Tests:
1. Black square symmetry
2. Word count targets
3. Word length distribution (no 2-letter, max 20% 3-letter)
4. Grid density and fill
"""

import json
from backend.crossword_generator import CrosswordGenerator

def test_symmetry(puzzle_data, grid_size):
    """Test that black squares have 180° rotational symmetry."""
    grid = puzzle_data['grid']

    symmetric = True
    asymmetric_pairs = []

    for row in range(grid_size):
        for col in range(grid_size):
            is_blocked = grid[row][col]['blocked']

            # Calculate mirror position (180° rotation)
            mirror_row = grid_size - 1 - row
            mirror_col = grid_size - 1 - col

            mirror_blocked = grid[mirror_row][mirror_col]['blocked']

            if is_blocked != mirror_blocked:
                symmetric = False
                asymmetric_pairs.append(((row, col), (mirror_row, mirror_col)))

    return symmetric, asymmetric_pairs


def test_word_lengths(puzzle_data):
    """Test word length distribution."""
    across_clues = puzzle_data['clues']['across']
    down_clues = puzzle_data['clues']['down']
    all_clues = across_clues + down_clues

    word_lengths = [clue['length'] for clue in all_clues]

    two_letter_count = sum(1 for length in word_lengths if length == 2)
    three_letter_count = sum(1 for length in word_lengths if length == 3)
    total_words = len(word_lengths)

    three_letter_percentage = (three_letter_count / total_words * 100) if total_words > 0 else 0

    # Count by length
    from collections import Counter
    length_dist = Counter(word_lengths)

    return {
        'total_words': total_words,
        'two_letter_count': two_letter_count,
        'three_letter_count': three_letter_count,
        'three_letter_percentage': round(three_letter_percentage, 1),
        'distribution': dict(sorted(length_dist.items())),
        'avg_word_length': round(sum(word_lengths) / len(word_lengths), 1) if word_lengths else 0
    }


def test_grid_fill(puzzle_data):
    """Test that all non-blocked cells are filled."""
    grid = puzzle_data['grid']
    solution = puzzle_data['solution']
    size = puzzle_data['size']

    total_cells = size * size
    blocked_cells = sum(1 for row in grid for cell in row if cell['blocked'])
    white_cells = total_cells - blocked_cells

    filled_cells = 0
    empty_cells = []

    for row in range(size):
        for col in range(size):
            if not grid[row][col]['blocked']:
                if solution[row][col]:
                    filled_cells += 1
                else:
                    empty_cells.append((row, col))

    black_square_percentage = (blocked_cells / total_cells * 100)

    return {
        'total_cells': total_cells,
        'blocked_cells': blocked_cells,
        'white_cells': white_cells,
        'filled_cells': filled_cells,
        'empty_cells': empty_cells,
        'black_square_percentage': round(black_square_percentage, 1),
        'fill_percentage': round((filled_cells / white_cells * 100) if white_cells > 0 else 0, 1)
    }


def print_grid_with_black_squares(puzzle_data):
    """Print the grid showing black squares."""
    grid = puzzle_data['grid']
    solution = puzzle_data['solution']
    size = puzzle_data['size']

    print("\nGrid visualization (█ = black square):")
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


def run_test(grid_size, difficulty="medium"):
    """Run a complete test for a given grid size."""
    print(f"\n{'='*70}")
    print(f"Testing {grid_size}x{grid_size} grid (difficulty: {difficulty})")
    print('='*70)

    # Load word list
    with open('data/words.json', 'r') as f:
        word_list = json.load(f)

    # Generate puzzle
    generator = CrosswordGenerator(grid_size=grid_size)
    puzzle = generator.generate(word_list, difficulty=difficulty)

    if not puzzle:
        print("❌ FAILED: Could not generate puzzle")
        return False

    print("✓ Puzzle generated successfully")

    # Test 1: Symmetry
    is_symmetric, asymmetric_pairs = test_symmetry(puzzle, grid_size)
    if is_symmetric:
        print("✓ Black squares are symmetric (180° rotational)")
    else:
        print(f"❌ FAILED: Asymmetric black squares found: {len(asymmetric_pairs)} pairs")
        for pair in asymmetric_pairs[:3]:
            print(f"   {pair[0]} <-> {pair[1]}")

    # Test 2: Word lengths
    word_stats = test_word_lengths(puzzle)
    print(f"\n📊 Word Statistics:")
    print(f"   Total words: {word_stats['total_words']}")
    print(f"   2-letter words: {word_stats['two_letter_count']} {'✓' if word_stats['two_letter_count'] == 0 else '❌ FAILED'}")
    print(f"   3-letter words: {word_stats['three_letter_count']} ({word_stats['three_letter_percentage']}%) {'✓' if word_stats['three_letter_percentage'] <= 20 else '❌ FAILED'}")
    print(f"   Average word length: {word_stats['avg_word_length']} letters")
    print(f"   Length distribution: {word_stats['distribution']}")

    # Test 3: Grid fill
    fill_stats = test_grid_fill(puzzle)
    print(f"\n🎯 Grid Fill Statistics:")
    print(f"   Total cells: {fill_stats['total_cells']}")
    print(f"   Black squares: {fill_stats['blocked_cells']} ({fill_stats['black_square_percentage']}%)")
    print(f"   White cells: {fill_stats['white_cells']}")
    print(f"   Filled cells: {fill_stats['filled_cells']} ({fill_stats['fill_percentage']}%)")

    if fill_stats['empty_cells']:
        print(f"   ❌ FAILED: {len(fill_stats['empty_cells'])} empty white cells")
    else:
        print(f"   ✓ All white cells filled")

    # Check target word counts
    if grid_size == 9:
        target_range = "15-20"
        meets_target = 15 <= word_stats['total_words'] <= 20
    elif grid_size == 11:
        target_range = "20-25"
        meets_target = 20 <= word_stats['total_words'] <= 25
    elif grid_size == 13:
        target_range = "25-35"
        meets_target = 25 <= word_stats['total_words'] <= 35
    elif grid_size == 15:
        target_range = "35-45"
        meets_target = 35 <= word_stats['total_words'] <= 45
    else:
        target_range = "N/A"
        meets_target = True

    print(f"\n🎯 Target word count: {target_range}")
    if meets_target:
        print(f"   ✓ Meets target ({word_stats['total_words']} words)")
    else:
        print(f"   ⚠️  Outside target range ({word_stats['total_words']} words)")

    # Print grid
    print_grid_with_black_squares(puzzle)

    # Overall success
    all_pass = (
        is_symmetric and
        word_stats['two_letter_count'] == 0 and
        word_stats['three_letter_percentage'] <= 20 and
        len(fill_stats['empty_cells']) == 0
    )

    print(f"\n{'✓ ALL TESTS PASSED' if all_pass else '❌ SOME TESTS FAILED'}")

    return all_pass


if __name__ == "__main__":
    print("Phase 1 Professional Crossword Generator Test Suite")
    print("Testing symmetric patterns, word counts, and quality metrics\n")

    # Test different grid sizes
    test_configs = [
        (9, "medium"),
        (11, "medium"),
        (13, "medium"),
    ]

    results = []
    for grid_size, difficulty in test_configs:
        success = run_test(grid_size, difficulty)
        results.append((grid_size, success))

    # Summary
    print(f"\n\n{'='*70}")
    print("SUMMARY")
    print('='*70)
    for grid_size, success in results:
        status = "✓ PASS" if success else "❌ FAIL"
        print(f"{grid_size}x{grid_size}: {status}")

    total_pass = sum(1 for _, success in results if success)
    print(f"\nTotal: {total_pass}/{len(results)} tests passed")
