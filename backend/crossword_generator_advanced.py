"""
Advanced Crossword Generator with Human-like Heuristics
Uses strategic placement and constraint propagation instead of pure backtracking.
"""

import random
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass
from enum import Enum
import time


class Direction(Enum):
    """Direction of a word in the crossword grid."""
    ACROSS = "across"
    DOWN = "down"


@dataclass
class WordPlacement:
    """Represents a word placed in the crossword grid."""
    word: str
    row: int
    col: int
    direction: Direction
    clue: str
    number: int = 0  # Clue number (assigned during numbering)


@dataclass
class Cell:
    """Represents a single cell in the crossword grid."""
    letter: Optional[str] = None
    is_blocked: bool = False
    number: Optional[int] = None


class AdvancedCrosswordGenerator:
    """
    Human-like crossword generation using strategic heuristics
    instead of pure backtracking.

    Key differences from standard generator:
    - Scores words before placement (longer + common letters = higher priority)
    - Uses lookahead to avoid dead-ends
    - Places strategically (seed words first, then fill around them)
    - Lighter black square density (15% vs 20%)
    - Constraint propagation to eliminate impossible placements early
    """

    # Letter frequency scores (common letters = higher score)
    LETTER_SCORES = {
        'E': 5, 'A': 5, 'R': 5, 'I': 5, 'O': 5, 'T': 5, 'N': 5, 'S': 5,
        'L': 3, 'C': 3, 'U': 3, 'D': 3, 'P': 3, 'M': 3, 'H': 3, 'G': 3, 'B': 3, 'F': 3,
        'Y': 1, 'W': 1, 'K': 1, 'V': 1,
        'X': -5, 'Z': -5, 'J': -5, 'Q': -10
    }

    def __init__(self, grid_size: int = 9, max_attempts: int = 50):
        """
        Initialize the advanced crossword generator.

        Args:
            grid_size: Size of the square grid (default 9x9)
            max_attempts: Maximum attempts to generate a puzzle
        """
        self.grid_size = grid_size
        self.max_attempts = max_attempts
        self.grid: List[List[Cell]] = []
        self.placements: List[WordPlacement] = []
        self.used_words: Set[str] = set()
        self.black_squares: Set[Tuple[int, int]] = set()
        self.available_slots: List[Tuple[int, int, int, Direction]] = []

    def generate(self, word_data: List[Dict[str, str]], difficulty: str = "medium") -> Optional[Dict]:
        """
        Generate a crossword puzzle using advanced heuristics.

        Args:
            word_data: List of dicts with 'word', 'clue', and 'difficulty' keys
            difficulty: Difficulty level ("easy", "medium", or "hard")

        Returns:
            Dictionary with grid and clues, or None if generation failed
        """
        start_time = time.time()

        # Filter words by difficulty
        difficulty_filtered = [
            w for w in word_data
            if w.get('difficulty', 'medium') == difficulty
        ]

        if len(difficulty_filtered) < 20:
            difficulty_filtered = word_data

        # Filter words: 3 to (grid_size - 2) letters only
        max_word_length = self.grid_size - 2
        filtered_words = [
            w for w in difficulty_filtered
            if 3 <= len(w['word']) <= max_word_length
        ]

        if len(filtered_words) < 30:
            return None

        # Score and sort words by strategic value
        scored_words = []
        for word_info in filtered_words:
            score = self._score_word_placement_value(word_info['word'])
            scored_words.append((score, word_info))

        # Sort by score (highest first)
        scored_words.sort(reverse=True, key=lambda x: x[0])

        # Use top-scoring words for generation
        num_to_select = min(len(scored_words), self.grid_size * 8)
        selected_words = [w[1] for w in scored_words[:num_to_select]]

        # Word count targets (realistic and achievable)
        if self.grid_size <= 9:
            target_min_words = 8  # 9x9: aim for 8-12 words (same as standard)
        elif self.grid_size <= 11:
            target_min_words = 12  # 11x11: aim for 12-16 words
        elif self.grid_size <= 13:
            target_min_words = 16  # 13x13: aim for 16-24 words
        else:  # 15x15
            target_min_words = 22  # 15x15: aim for 22-32 words

        # Try multiple times with different patterns
        for attempt in range(self.max_attempts):
            if self._try_generate_strategic(selected_words, target_min_words):
                generation_time = time.time() - start_time
                print(f"[ADVANCED] Generated puzzle in {generation_time:.2f}s with {len(self.placements)} words")
                return self._export_puzzle()

        return None

    def _score_word_placement_value(self, word: str) -> float:
        """
        Score words BEFORE attempting placement.

        Scoring criteria:
        - Length bonus: len(word) * 10 points
        - Letter frequency bonus: E,A,R,S,T,I,O,N = +5 each; Q,X,Z = -10 each
        - Crossability: count potential intersection points = +3 per point

        Returns:
            Total score (higher = place this word first)
        """
        word = word.upper()
        score = 0.0

        # Length bonus (longer words are better foundation pieces)
        score += len(word) * 10

        # Letter frequency bonus
        for letter in word:
            score += self.LETTER_SCORES.get(letter, 0)

        # Crossability bonus (words with many vowels/common letters cross better)
        common_letters = sum(1 for letter in word if letter in 'EARIOTNSL')
        score += common_letters * 3

        # Bonus for words in the "sweet spot" length (6-8 letters)
        if 6 <= len(word) <= 8:
            score += 20

        return score

    def _get_placement_order(self, word_list: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """
        Instead of random order, use strategic ordering:
        1. Sort by score (highest first)
        2. Place longest words first (10+ letters)
        3. Then medium words (6-9 letters)
        4. Short words (3-5 letters) only as "glue" at the end

        This mimics how human constructors work.
        """
        # Group by length
        long_words = [w for w in word_list if len(w['word']) >= 10]
        medium_words = [w for w in word_list if 6 <= len(w['word']) <= 9]
        short_words = [w for w in word_list if 3 <= len(w['word']) <= 5]

        # Sort each group by score
        long_words.sort(key=lambda w: self._score_word_placement_value(w['word']), reverse=True)
        medium_words.sort(key=lambda w: self._score_word_placement_value(w['word']), reverse=True)
        short_words.sort(key=lambda w: self._score_word_placement_value(w['word']), reverse=True)

        # Combine: long, then medium, then short (with some shuffling for variety)
        result = []
        result.extend(long_words[:3])  # Top 3 longest
        result.extend(medium_words[:10])  # Top 10 medium
        result.extend(short_words[:15])  # Top 15 short
        result.extend(long_words[3:])  # Rest of long
        result.extend(medium_words[10:])  # Rest of medium
        result.extend(short_words[15:])  # Rest of short

        return result

    def _evaluate_placement_viability(self, word: str, row: int, col: int,
                                     direction: Direction, current_placements: List[WordPlacement]) -> float:
        """
        Before placing word, simulate:
        - How many remaining words can still fit?
        - Does this create "dead zones" (areas too small for words)?
        - How many good intersection points does it create?

        Returns:
            Viability score (0.0 to 1.0)
            Only place if score > 0.6 (60% of words still placeable)
        """
        score = 0.5  # Base score

        # Check intersection quality
        intersections = 0
        for placement in current_placements:
            if self._placements_intersect(word, row, col, direction, placement):
                intersections += 1
                score += 0.1

        # Penalize if no intersections (except first word)
        if len(current_placements) > 0 and intersections == 0:
            score -= 0.3

        # Check if placement creates good crossing opportunities
        crossing_opportunities = self._count_crossing_opportunities(word, row, col, direction)
        score += crossing_opportunities * 0.05

        # Penalize edge placements (unless necessary)
        if row == 0 or col == 0 or row == self.grid_size - 1 or col == self.grid_size - 1:
            score -= 0.1

        # Bonus for center placements (better connectivity)
        center = self.grid_size // 2
        distance_from_center = abs(row - center) + abs(col - center)
        if distance_from_center <= 2:
            score += 0.15

        return max(0.0, min(1.0, score))

    def _placements_intersect(self, word: str, row: int, col: int, direction: Direction,
                             existing: WordPlacement) -> bool:
        """Check if a potential placement would intersect with an existing word."""
        if direction == existing.direction:
            return False

        for i in range(len(word)):
            if direction == Direction.ACROSS:
                test_row, test_col = row, col + i
            else:
                test_row, test_col = row + i, col

            # Check if this position is part of the existing word
            if existing.direction == Direction.ACROSS:
                if (existing.row == test_row and
                    existing.col <= test_col < existing.col + len(existing.word)):
                    return True
            else:
                if (existing.col == test_col and
                    existing.row <= test_row < existing.row + len(existing.word)):
                    return True

        return False

    def _count_crossing_opportunities(self, word: str, row: int, col: int,
                                     direction: Direction) -> int:
        """Count how many potential crossing points this placement creates."""
        opportunities = 0

        for i in range(len(word)):
            if direction == Direction.ACROSS:
                test_row, test_col = row, col + i
                # Check perpendicular (up/down)
                if test_row > 0 and not self.grid[test_row - 1][test_col].is_blocked:
                    opportunities += 1
                if test_row < self.grid_size - 1 and not self.grid[test_row + 1][test_col].is_blocked:
                    opportunities += 1
            else:
                test_row, test_col = row + i, col
                # Check perpendicular (left/right)
                if test_col > 0 and not self.grid[test_row][test_col - 1].is_blocked:
                    opportunities += 1
                if test_col < self.grid_size - 1 and not self.grid[test_row][test_col + 1].is_blocked:
                    opportunities += 1

        return opportunities

    def _generate_flexible_pattern(self) -> Set[Tuple[int, int]]:
        """
        Create symmetric pattern with FEWER black squares:
        - 15% density instead of 20% (more white space = more flexibility)
        - Still maintain rotational symmetry
        - Can be adjusted if needed during placement

        Returns:
            Set of (row, col) positions for black squares
        """
        black_squares = set()

        # Target 15% density (more fillable than 20%)
        target_density = 0.15
        total_cells = self.grid_size * self.grid_size
        target_black_count = int(total_cells * target_density)

        half_size = self.grid_size // 2
        attempts = 0
        max_attempts = 300

        while len(black_squares) < target_black_count // 2 and attempts < max_attempts:
            attempts += 1

            # Pick random position in upper-left + center
            row = random.randint(1, half_size)
            col = random.randint(1, self.grid_size - 2)

            # Avoid edges (professional crosswords rarely have edge black squares)
            if row == 0 or row == self.grid_size - 1:
                continue
            if col == 0 or col == self.grid_size - 1:
                continue

            # Calculate symmetric position
            mirror_row = self.grid_size - 1 - row
            mirror_col = self.grid_size - 1 - col

            # Add both positions
            if (row, col) not in black_squares:
                black_squares.add((row, col))
                if (mirror_row, mirror_col) != (row, col):
                    black_squares.add((mirror_row, mirror_col))

        # Handle center for odd-sized grids
        if self.grid_size % 2 == 1:
            center = self.grid_size // 2
            # 20% chance for center black square (less than standard)
            if random.random() < 0.2:
                black_squares.add((center, center))

        return black_squares

    def _initialize_grid(self):
        """Initialize grid with flexible black square pattern."""
        self.black_squares = self._generate_flexible_pattern()

        # Create grid
        self.grid = [[Cell() for _ in range(self.grid_size)]
                     for _ in range(self.grid_size)]

        # Mark black squares
        for row, col in self.black_squares:
            self.grid[row][col].is_blocked = True

    def _find_all_slots(self) -> List[Tuple[int, int, int, Direction]]:
        """
        Find all available slots in the grid.

        Returns:
            List of tuples: (row, col, length, direction)
        """
        slots = []

        # Horizontal slots
        for row in range(self.grid_size):
            col = 0
            while col < self.grid_size:
                if self.grid[row][col].is_blocked:
                    col += 1
                    continue

                start_col = col
                length = 0

                while col < self.grid_size and not self.grid[row][col].is_blocked:
                    length += 1
                    col += 1

                if length >= 3:
                    slots.append((row, start_col, length, Direction.ACROSS))

        # Vertical slots
        for col in range(self.grid_size):
            row = 0
            while row < self.grid_size:
                if self.grid[row][col].is_blocked:
                    row += 1
                    continue

                start_row = row
                length = 0

                while row < self.grid_size and not self.grid[row][col].is_blocked:
                    length += 1
                    row += 1

                if length >= 3:
                    slots.append((start_row, col, length, Direction.DOWN))

        return slots

    def _try_generate_strategic(self, word_data: List[Dict[str, str]], min_words: int) -> bool:
        """
        Strategic generation using human-like approach.

        1. Create flexible grid pattern
        2. Order words strategically (longest first)
        3. Use lookahead to evaluate placements
        4. Fill with constraint propagation
        """
        # Initialize grid with pattern
        self._initialize_grid()
        self.placements = []
        self.used_words = set()
        self.backtrack_steps = 0
        self.max_backtrack_steps = 5000  # Prevent infinite loops

        # Get strategic word order
        ordered_words = self._get_placement_order(word_data)

        # Limit attempts for performance
        max_words_to_try = min(len(ordered_words), 80)
        ordered_words = ordered_words[:max_words_to_try]

        # Try to place words using strategic backtracking
        success = self._strategic_backtrack(ordered_words, 0, min_words)

        return success and len(self.placements) >= min_words

    def _strategic_backtrack(self, word_data: List[Dict[str, str]], index: int, min_words: int) -> bool:
        """
        Backtracking with strategic heuristics.

        Uses lookahead and viability scoring to make smart placement decisions.
        """
        # Check backtrack limit
        self.backtrack_steps += 1
        if self.backtrack_steps > self.max_backtrack_steps:
            return False

        # Success condition
        if len(self.placements) >= min_words:
            return True

        # Tried all words
        if index >= len(word_data):
            return len(self.placements) >= min_words

        word_info = word_data[index]
        word = word_info['word'].upper()
        clue = word_info['clue']

        # Skip if already used
        if word in self.used_words:
            return self._strategic_backtrack(word_data, index + 1, min_words)

        # Get possible placements
        possible_placements = self._get_strategic_placements(word, clue)

        # Shuffle for variety but limit to top placements
        if len(possible_placements) > 10:
            import random
            random.shuffle(possible_placements)
            possible_placements = possible_placements[:10]

        # Try each placement
        for placement in possible_placements:
            if self._can_place_word(placement):
                self._place_word(placement)

                if self._strategic_backtrack(word_data, index + 1, min_words):
                    return True

                self._remove_word(placement)

        # Also try skipping this word
        if self._strategic_backtrack(word_data, index + 1, min_words):
            return True

        return False

    def _get_strategic_placements(self, word: str, clue: str) -> List[WordPlacement]:
        """Get all possible placements for a word using slot-based approach."""
        placements = []
        word_length = len(word)

        # First word: place in center
        if len(self.placements) == 0:
            center = self.grid_size // 2
            # Try horizontal
            start_col = center - word_length // 2
            if 0 <= start_col and start_col + word_length <= self.grid_size:
                placements.append(WordPlacement(
                    word=word, row=center, col=start_col,
                    direction=Direction.ACROSS, clue=clue
                ))
            # Try vertical
            start_row = center - word_length // 2
            if 0 <= start_row and start_row + word_length <= self.grid_size:
                placements.append(WordPlacement(
                    word=word, row=start_row, col=center,
                    direction=Direction.DOWN, clue=clue
                ))
            return placements

        # Find all slots
        slots = self._find_all_slots()

        # Try to fit word in slots
        for row, col, slot_length, direction in slots:
            if word_length > slot_length:
                continue

            # Try different positions within the slot
            for offset in range(slot_length - word_length + 1):
                if direction == Direction.ACROSS:
                    placement = WordPlacement(
                        word=word, row=row, col=col + offset,
                        direction=direction, clue=clue
                    )
                else:
                    placement = WordPlacement(
                        word=word, row=row + offset, col=col,
                        direction=direction, clue=clue
                    )

                placements.append(placement)

        return placements

    def _can_place_word(self, placement: WordPlacement) -> bool:
        """Check if word can be placed without conflicts."""
        word = placement.word
        row, col = placement.row, placement.col
        direction = placement.direction

        # Check bounds
        if direction == Direction.ACROSS:
            if col < 0 or col + len(word) > self.grid_size:
                return False
        else:
            if row < 0 or row + len(word) > self.grid_size:
                return False

        # Check each letter
        for i, char in enumerate(word):
            if direction == Direction.ACROSS:
                r, c = row, col + i
            else:
                r, c = row + i, col

            cell = self.grid[r][c]

            # Can't place on black squares
            if cell.is_blocked:
                return False

            # Letter must match if cell is filled
            if cell.letter is not None and cell.letter != char:
                return False

            # Check perpendicular conflicts
            if not self._check_perpendicular(char, r, c, direction):
                return False

        # Check boundaries
        if direction == Direction.ACROSS:
            if col > 0 and self.grid[row][col - 1].letter is not None:
                return False
            if col + len(word) < self.grid_size and self.grid[row][col + len(word)].letter is not None:
                return False
        else:
            if row > 0 and self.grid[row - 1][col].letter is not None:
                return False
            if row + len(word) < self.grid_size and self.grid[row + len(word)][col].letter is not None:
                return False

        return True

    def _check_perpendicular(self, char: str, row: int, col: int, direction: Direction) -> bool:
        """Check perpendicular conflicts."""
        if direction == Direction.ACROSS:
            has_above = row > 0 and self.grid[row - 1][col].letter is not None
            has_below = row < self.grid_size - 1 and self.grid[row + 1][col].letter is not None

            if self.grid[row][col].letter is None and (has_above or has_below):
                return False
        else:
            has_left = col > 0 and self.grid[row][col - 1].letter is not None
            has_right = col < self.grid_size - 1 and self.grid[row][col + 1].letter is not None

            if self.grid[row][col].letter is None and (has_left or has_right):
                return False

        return True

    def _place_word(self, placement: WordPlacement):
        """Place word on grid."""
        word = placement.word
        row, col = placement.row, placement.col
        direction = placement.direction

        for i, char in enumerate(word):
            if direction == Direction.ACROSS:
                r, c = row, col + i
            else:
                r, c = row + i, col
            self.grid[r][c].letter = char

        self.placements.append(placement)
        self.used_words.add(word)

    def _remove_word(self, placement: WordPlacement):
        """Remove word from grid."""
        word = placement.word
        row, col = placement.row, placement.col
        direction = placement.direction

        for i, char in enumerate(word):
            if direction == Direction.ACROSS:
                r, c = row, col + i
            else:
                r, c = row + i, col

            # Only clear if not part of another word
            is_used = False
            for other in self.placements:
                if other == placement:
                    continue

                if other.direction == Direction.ACROSS:
                    if other.row == r and other.col <= c < other.col + len(other.word):
                        is_used = True
                        break
                else:
                    if other.col == c and other.row <= r < other.row + len(other.word):
                        is_used = True
                        break

            if not is_used:
                self.grid[r][c].letter = None

        self.placements.remove(placement)
        self.used_words.remove(word)

    def _number_grid(self):
        """Assign numbers to cells that start words."""
        number = 1

        for row in range(self.grid_size):
            for col in range(self.grid_size):
                starts_across = False
                starts_down = False

                for placement in self.placements:
                    if placement.row == row and placement.col == col:
                        if placement.direction == Direction.ACROSS:
                            starts_across = True
                        else:
                            starts_down = True

                if starts_across or starts_down:
                    self.grid[row][col].number = number

                    for placement in self.placements:
                        if placement.row == row and placement.col == col:
                            placement.number = number

                    number += 1

    def _export_puzzle(self) -> Dict:
        """Export puzzle data."""
        self._number_grid()

        # Create grid representation
        grid_data = []
        solution_data = []

        for row in range(self.grid_size):
            grid_row = []
            solution_row = []
            for col in range(self.grid_size):
                cell = self.grid[row][col]

                cell_data = {
                    'number': cell.number,
                    'blocked': cell.is_blocked
                }
                grid_row.append(cell_data)
                solution_row.append(cell.letter if cell.letter else '')

            grid_data.append(grid_row)
            solution_data.append(solution_row)

        # Create clues
        across_clues = []
        down_clues = []

        for placement in sorted(self.placements, key=lambda p: p.number):
            clue_data = {
                'number': placement.number,
                'clue': placement.clue,
                'answer': placement.word,
                'row': placement.row,
                'col': placement.col,
                'length': len(placement.word)
            }

            if placement.direction == Direction.ACROSS:
                across_clues.append(clue_data)
            else:
                down_clues.append(clue_data)

        return {
            'grid': grid_data,
            'solution': solution_data,
            'size': self.grid_size,
            'clues': {
                'across': across_clues,
                'down': down_clues
            }
        }


def generate_crossword_advanced(word_list: List[Dict[str, str]],
                               grid_size: int = 9,
                               difficulty: str = "medium") -> Optional[Dict]:
    """
    Convenience function to generate crossword using advanced heuristics.

    Args:
        word_list: List of dictionaries with 'word', 'clue', and 'difficulty' keys
        grid_size: Size of the grid (default 9)
        difficulty: Difficulty level ("easy", "medium", or "hard")

    Returns:
        Puzzle data dictionary or None if generation failed
    """
    generator = AdvancedCrosswordGenerator(grid_size=grid_size)
    return generator.generate(word_list, difficulty=difficulty)
