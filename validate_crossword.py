"""
Crossword Quality Validation Script
Tests the generator against professional standards
"""

import sys
from backend.crossword_generator import generate_crossword
from typing import Dict, List
import json


class CrosswordValidator:
    """Validates crossword puzzle quality."""
    
    def __init__(self):
        self.results = []
    
    def validate_puzzle(self, puzzle: Dict, puzzle_num: int) -> Dict:
        """Validate a single puzzle and return metrics."""
        if puzzle is None:
            return {
                'puzzle_num': puzzle_num,
                'success': False,
                'error': 'Generation failed'
            }
        
        grid_size = puzzle['size']
        across_clues = puzzle['clues']['across']
        down_clues = puzzle['clues']['down']
        solution = puzzle['solution']
        
        # Count metrics
        total_words = len(across_clues) + len(down_clues)
        word_lengths = {}
        
        for clue in across_clues + down_clues:
            length = clue['length']
            word_lengths[length] = word_lengths.get(length, 0) + 1
        
        # Calculate percentages
        two_letter_count = word_lengths.get(2, 0)
        three_letter_count = word_lengths.get(3, 0)
        three_letter_pct = (three_letter_count / total_words * 100) if total_words > 0 else 0
        
        # Check symmetry
        is_symmetric = self._check_symmetry(solution, grid_size)
        
        # Count black squares
        black_square_count = sum(1 for row in solution for cell in row if cell == '')
        total_cells = grid_size * grid_size
        black_square_pct = (black_square_count / total_cells * 100)
        
        # Check connectivity
        is_connected = self._check_connectivity(solution, grid_size)
        
        # Check for unchecked squares (letters appearing in only one word)
        unchecked_squares = self._count_unchecked_squares(puzzle)
        
        # Word length distribution
        long_words = sum(count for length, count in word_lengths.items() if length >= 5)
        long_word_pct = (long_words / total_words * 100) if total_words > 0 else 0
        
        # Determine targets based on grid size
        if grid_size == 9:
            target_words = (15, 20)
        elif grid_size == 11:
            target_words = (20, 25)
        elif grid_size == 13:
            target_words = (25, 35)
        elif grid_size == 15:
            target_words = (35, 45)
        else:
            target_words = (10, 15)
        
        # Quality assessment
        passes_quality = (
            two_letter_count == 0 and
            three_letter_pct <= 20 and
            is_symmetric and
            is_connected and
            unchecked_squares == 0 and
            total_words >= target_words[0]
        )
        
        meets_target = target_words[0] <= total_words <= target_words[1]
        
        return {
            'puzzle_num': puzzle_num,
            'success': True,
            'grid_size': grid_size,
            'total_words': total_words,
            'target_range': f"{target_words[0]}-{target_words[1]}",
            'meets_target': meets_target,
            'word_lengths': word_lengths,
            'two_letter_words': two_letter_count,
            'three_letter_words': three_letter_count,
            'three_letter_pct': round(three_letter_pct, 1),
            'long_word_pct': round(long_word_pct, 1),
            'black_squares': black_square_count,
            'black_square_pct': round(black_square_pct, 1),
            'is_symmetric': is_symmetric,
            'is_connected': is_connected,
            'unchecked_squares': unchecked_squares,
            'passes_quality': passes_quality
        }
    
    def _check_symmetry(self, solution: List[List[str]], size: int) -> bool:
        """Check if black squares have 180° rotational symmetry."""
        for row in range(size):
            for col in range(size):
                cell = solution[row][col]
                opposite_cell = solution[size - 1 - row][size - 1 - col]
                
                # Both should be black or both should be white
                if (cell == '') != (opposite_cell == ''):
                    return False
        
        return True
    
    def _check_connectivity(self, solution: List[List[str]], size: int) -> bool:
        """Check if all white squares are connected."""
        # Find first white square
        start = None
        for row in range(size):
            for col in range(size):
                if solution[row][col] != '':
                    start = (row, col)
                    break
            if start:
                break
        
        if not start:
            return False
        
        # Flood fill to find all connected white squares
        visited = set()
        stack = [start]
        
        while stack:
            row, col = stack.pop()
            if (row, col) in visited:
                continue
            
            visited.add((row, col))
            
            # Check adjacent cells
            for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                new_row, new_col = row + dr, col + dc
                if (0 <= new_row < size and 0 <= new_col < size and
                    solution[new_row][new_col] != '' and
                    (new_row, new_col) not in visited):
                    stack.append((new_row, new_col))
        
        # Count total white squares
        total_white = sum(1 for row in solution for cell in row if cell != '')
        
        return len(visited) == total_white
    
    def _count_unchecked_squares(self, puzzle: Dict) -> int:
        """Count letters that appear in only one word."""
        grid_size = puzzle['size']
        letter_count = [[0 for _ in range(grid_size)] for _ in range(grid_size)]
        
        # Count how many words each cell belongs to
        for clue in puzzle['clues']['across']:
            row, col = clue['row'], clue['col']
            for i in range(clue['length']):
                letter_count[row][col + i] += 1
        
        for clue in puzzle['clues']['down']:
            row, col = clue['row'], clue['col']
            for i in range(clue['length']):
                letter_count[row + i][col] += 1
        
        # Count cells with only 1 word
        unchecked = 0
        for row in letter_count:
            for count in row:
                if count == 1:
                    unchecked += 1
        
        return unchecked
    
    def print_summary(self, results: List[Dict]):
        """Print summary of validation results."""
        print("\n" + "="*70)
        print("CROSSWORD QUALITY VALIDATION REPORT")
        print("="*70)
        
        successful = [r for r in results if r['success']]
        failed = len(results) - len(successful)
        
        if not successful:
            print(f"\n❌ All {len(results)} generation attempts failed!")
            return
        
        print(f"\n📊 Generation Success Rate: {len(successful)}/{len(results)} ({len(successful)/len(results)*100:.1f}%)")
        
        if failed > 0:
            print(f"⚠️  Failed generations: {failed}")
        
        # Aggregate statistics
        avg_words = sum(r['total_words'] for r in successful) / len(successful)
        avg_3letter_pct = sum(r['three_letter_pct'] for r in successful) / len(successful)
        avg_black_pct = sum(r['black_square_pct'] for r in successful) / len(successful)
        
        total_with_2letter = sum(1 for r in successful if r['two_letter_words'] > 0)
        total_symmetric = sum(1 for r in successful if r['is_symmetric'])
        total_connected = sum(1 for r in successful if r['is_connected'])
        total_meeting_target = sum(1 for r in successful if r['meets_target'])
        total_quality = sum(1 for r in successful if r['passes_quality'])
        
        print(f"\n📈 AVERAGE METRICS:")
        print(f"   Words per puzzle: {avg_words:.1f}")
        print(f"   3-letter words: {avg_3letter_pct:.1f}%")
        print(f"   Black squares: {avg_black_pct:.1f}%")
        
        print(f"\n✓ QUALITY CHECKS:")
        print(f"   Zero 2-letter words: {len(successful) - total_with_2letter}/{len(successful)} {'✅' if total_with_2letter == 0 else '❌'}")
        print(f"   3-letter words ≤20%: {sum(1 for r in successful if r['three_letter_pct'] <= 20)}/{len(successful)}")
        print(f"   Perfect symmetry: {total_symmetric}/{len(successful)} {'✅' if total_symmetric == len(successful) else '❌'}")
        print(f"   Fully connected: {total_connected}/{len(successful)} {'✅' if total_connected == len(successful) else '❌'}")
        print(f"   Meets word target: {total_meeting_target}/{len(successful)} {'⚠️' if total_meeting_target < len(successful) else '✅'}")
        print(f"   Overall quality: {total_quality}/{len(successful)} {'✅' if total_quality == len(successful) else '⚠️'}")
        
        # Detailed breakdown
        print(f"\n📋 INDIVIDUAL PUZZLE DETAILS:")
        print(f"{'#':<4} {'Words':<8} {'Target':<12} {'2-L':<5} {'3-L%':<7} {'Sym':<5} {'Conn':<5} {'Quality':<8}")
        print("-" * 70)
        
        for r in successful:
            quality_mark = "✅ PASS" if r['passes_quality'] else "⚠️  NEEDS WORK"
            target_mark = "✓" if r['meets_target'] else "✗"
            
            print(f"{r['puzzle_num']:<4} "
                  f"{r['total_words']:<8} "
                  f"{r['target_range']:<12} "
                  f"{r['two_letter_words']:<5} "
                  f"{r['three_letter_pct']:<7.1f} "
                  f"{'✓' if r['is_symmetric'] else '✗':<5} "
                  f"{'✓' if r['is_connected'] else '✗':<5} "
                  f"{quality_mark}")
        
        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")

        target_min = int(successful[0]['target_range'].split('-')[0])
        if avg_words < target_min:
            print(f"   ⚠️  Word count too low. Consider:")
            print(f"      - Reducing black square percentage")
            print(f"      - Improving backtracking heuristics")
            print(f"      - Expanding word list")
        
        if avg_3letter_pct > 20:
            print(f"   ⚠️  Too many 3-letter words. Improve word selection scoring.")
        
        if total_with_2letter > 0:
            print(f"   ❌ CRITICAL: 2-letter words detected! Fix filtering logic.")
        
        if total_symmetric < len(successful):
            print(f"   ❌ CRITICAL: Symmetry broken! Check black square generation.")
        
        if total_quality == len(successful):
            print(f"   ✅ All quality checks passed! Ready for Phase 2 (clue improvements).")
        
        print("\n" + "="*70)


def run_validation(num_puzzles: int = 10, grid_size: int = 13, difficulty: str = "medium"):
    """Run validation on multiple generated puzzles."""

    # Load word list from data/words.json
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    words_file = os.path.join(script_dir, 'data', 'words.json')

    try:
        with open(words_file, 'r') as f:
            word_list = json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find word list at {words_file}")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in {words_file}")
        sys.exit(1)
    
    print(f"\nLoaded {len(word_list)} words from word list")
    print(f"Generating {num_puzzles} crosswords ({grid_size}x{grid_size}, {difficulty} difficulty)...")
    print("This may take a minute...\n")

    validator = CrosswordValidator()
    results = []

    for i in range(1, num_puzzles + 1):
        print(f"Generating puzzle {i}/{num_puzzles}...", end='\r')
        puzzle = generate_crossword(word_list, grid_size=grid_size, difficulty=difficulty)
        result = validator.validate_puzzle(puzzle, i)
        results.append(result)
    
    print()  # New line after progress
    validator.print_summary(results)
    
    # Save detailed results to JSON
    with open('validation_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n💾 Detailed results saved to: validation_results.json")


if __name__ == "__main__":
    # Parse command line arguments
    import argparse
    
    parser = argparse.ArgumentParser(description='Validate crossword generator quality')
    parser.add_argument('-n', '--num', type=int, default=10, help='Number of puzzles to generate (default: 10)')
    parser.add_argument('-s', '--size', type=int, default=13, help='Grid size (default: 13)')
    parser.add_argument('-d', '--difficulty', choices=['easy', 'medium', 'hard'], default='medium', help='Difficulty level')
    
    args = parser.parse_args()
    
    run_validation(num_puzzles=args.num, grid_size=args.size, difficulty=args.difficulty)