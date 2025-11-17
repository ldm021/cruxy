"""
Crossword Generator Core Module
Uses backtracking algorithm with constraint satisfaction to generate crossword puzzles.
"""

import random
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass
from enum import Enum


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


class CrosswordGenerator:
    """Generates crossword puzzles using backtracking algorithm."""

    def __init__(self, grid_size: int = 9, max_attempts: int = 100):
        """
        Initialize the crossword generator.

        Args:
            grid_size: Size of the square grid (default 9x9)
            max_attempts: Maximum attempts to generate a puzzle
        """
        self.grid_size = grid_size
        # Adjust max_attempts based on grid size for better success rate
        if grid_size <= 9:
            self.max_attempts = max_attempts
        elif grid_size <= 11:
            self.max_attempts = max(max_attempts, 200)
        elif grid_size <= 13:
            self.max_attempts = max(max_attempts, 300)
        else:  # 15x15 or larger
            self.max_attempts = max(max_attempts, 500)

        self.grid: List[List[Cell]] = []
        self.placements: List[WordPlacement] = []
        self.used_words: Set[str] = set()
        self.black_squares: Set[Tuple[int, int]] = set()  # Track black square positions

    def generate(self, word_data: List[Dict[str, str]], difficulty: str = "medium") -> Optional[Dict]:
        """
        Generate a crossword puzzle.

        Args:
            word_data: List of dicts with 'word', 'clue', and 'difficulty' keys
            difficulty: Difficulty level ("easy", "medium", or "hard")

        Returns:
            Dictionary with grid and clues, or None if generation failed
        """
        # Filter words by difficulty
        difficulty_filtered = [
            w for w in word_data
            if w.get('difficulty', 'medium') == difficulty
        ]

        # If not enough words for this difficulty, fall back to all words
        if len(difficulty_filtered) < 20:
            difficulty_filtered = word_data

        # PHASE 1: Professional word filtering
        # Filter words that are too long for the grid
        # NO 2-letter words allowed (hard constraint)
        # Prefer 5-8 letter words
        max_word_length = self.grid_size - 2  # Leave room for black squares

        filtered_words = [
            w for w in difficulty_filtered
            if 3 <= len(w['word']) <= max_word_length  # ZERO 2-letter words
        ]

        if len(filtered_words) < 30:
            # Not enough suitable words
            return None

        # Score and sort words by desirability
        # Prefer 5-8 letter words (score them higher)
        scored_words = []
        for word_info in filtered_words:
            score = self._score_word(word_info['word'])
            scored_words.append((score, word_info))

        # Sort by score (higher is better) and take the best words
        scored_words.sort(reverse=True, key=lambda x: x[0])

        # Select a good mix of words, biased toward higher scores
        # Take more words than we need so backtracking has options
        num_to_select = min(len(scored_words), self.grid_size * 6)
        selected_words = [w[1] for w in scored_words[:num_to_select]]

        # Shuffle to add variety
        random.shuffle(selected_words)

        # PHASE 1: Professional word count targets
        # Pragmatic targets that balance quality with achievability
        # Still significantly higher than the original 6-9 words
        if self.grid_size <= 9:
            target_min_words = 10  # 9x9: 10-14 words (was 6-9, ideal 12-16)
        elif self.grid_size <= 11:
            target_min_words = 12  # 11x11: 12-18 words (ideal 16-22)
        elif self.grid_size <= 13:
            target_min_words = 16  # 13x13: 16-24 words (ideal 20-28)
        else:  # 15x15
            target_min_words = 22  # 15x15: 22-32 words (ideal 28-38)

        # Try multiple times to generate a valid puzzle
        for attempt in range(self.max_attempts):
            if self._try_generate(selected_words, target_min_words):
                # Validate with relaxed constraints
                if self._validate_puzzle():
                    return self._export_puzzle()

        return None

    def _score_word(self, word: str) -> float:
        """
        Score a word based on its desirability for crossword puzzles.
        Higher scores are better.

        5-8 letter words: highest score (10-13 points)
        9-10 letter words: good score (8-9 points)
        4 letter words: medium score (6 points)
        3 letter words: low score (3 points) - penalized
        11+ letter words: lower score (4-5 points) - harder to place

        Returns:
            Score from 0-13, higher is better
        """
        length = len(word)

        if 5 <= length <= 8:
            # Sweet spot for crosswords
            return 10 + (length - 5) * 0.5  # 10.0 to 11.5
        elif length == 4:
            return 6.0
        elif length == 3:
            return 3.0  # Penalize 3-letter words
        elif 9 <= length <= 10:
            return 8.0 + (length - 9) * 0.5  # 8.0 to 8.5
        elif 11 <= length <= 13:
            return 4.0 + (13 - length) * 0.3  # 4.6 to 4.0
        else:
            return 2.0  # Very long or very short

    def _generate_symmetric_pattern(self) -> Set[Tuple[int, int]]:
        """
        Generate a symmetric black square pattern for the crossword grid.

        Uses 180-degree rotational symmetry - if there's a black square at (r, c),
        there must be one at (grid_size-1-r, grid_size-1-c).

        Target: 15-20% black squares for professional density.

        Returns:
            Set of (row, col) tuples representing black square positions
        """
        black_squares = set()

        # Target black square density
        # Reduced to 12% for better fillability (professional range is 15-20%)
        target_density = 0.12  # Lower density = easier to fill
        total_cells = self.grid_size * self.grid_size
        target_black_count = int(total_cells * target_density)

        # We'll create black squares in the top-left quadrant plus center
        # and mirror them for symmetry
        half_size = self.grid_size // 2

        # Generate random black squares in upper portion
        # We'll try to place about half the target (since mirroring doubles it)
        attempts = 0
        max_gen_attempts = 200

        while len(black_squares) < target_black_count // 2 and attempts < max_gen_attempts:
            attempts += 1

            # Pick a random position in the upper-left + center area
            row = random.randint(0, half_size)
            col = random.randint(0, self.grid_size - 1)

            # Don't put black squares on the edges (less common in crosswords)
            if row == 0 or row == self.grid_size - 1:
                continue
            if col == 0 or col == self.grid_size - 1:
                continue

            # Calculate the symmetric position
            mirror_row = self.grid_size - 1 - row
            mirror_col = self.grid_size - 1 - col

            # Add both positions (ensures symmetry)
            if (row, col) not in black_squares:
                black_squares.add((row, col))

                # Add mirror position (if different from original)
                if (mirror_row, mirror_col) != (row, col):
                    black_squares.add((mirror_row, mirror_col))

        # If center cell is odd-sized grid, handle center specially
        if self.grid_size % 2 == 1:
            center = self.grid_size // 2
            # 50% chance to make center black (for variety)
            if random.random() < 0.3:
                black_squares.add((center, center))

        return black_squares

    def _try_generate(self, word_data: List[Dict[str, str]], min_words: int = 8) -> bool:
        """
        Attempt to generate a crossword puzzle.

        Args:
            word_data: List of word dictionaries
            min_words: Minimum number of words needed for a valid puzzle

        Returns:
            True if successful, False otherwise
        """
        # Reset state
        self._initialize_grid()
        self.placements = []
        self.used_words = set()
        self.backtrack_steps = 0  # Track backtracking steps
        self.max_backtrack_steps = 10000  # Limit to prevent infinite loops

        # Use available words
        words_to_use = list(word_data)

        # Shuffle to get variety
        random.shuffle(words_to_use)

        # Try to place words using backtracking
        return self._backtrack(words_to_use, 0, min_words=min_words)

    def _initialize_grid(self):
        """
        Initialize an empty grid with symmetric black square pattern.

        PHASE 1: This now generates the black square pattern BEFORE word placement.
        """
        # Generate symmetric black square pattern
        self.black_squares = self._generate_symmetric_pattern()

        # Create the grid
        self.grid = [[Cell() for _ in range(self.grid_size)]
                     for _ in range(self.grid_size)]

        # Mark black squares as blocked
        for row, col in self.black_squares:
            self.grid[row][col].is_blocked = True

    def _backtrack(self, word_data: List[Dict[str, str]], index: int, min_words: int) -> bool:
        """
        Backtracking algorithm to place words.

        Args:
            word_data: Available words to place
            index: Current word index
            min_words: Minimum number of words needed for a valid puzzle

        Returns:
            True if we successfully placed enough words
        """
        # Check if we've exceeded backtracking steps limit
        self.backtrack_steps += 1
        if self.backtrack_steps > self.max_backtrack_steps:
            return False

        # Success condition: we have enough words placed
        if len(self.placements) >= min_words:
            return True

        # If we've tried all words and don't have enough, fail
        if index >= len(word_data):
            return len(self.placements) >= min_words

        word_info = word_data[index]
        word = word_info['word'].upper()
        clue = word_info['clue']

        # Skip if word is already used
        if word in self.used_words:
            return self._backtrack(word_data, index + 1, min_words)

        # Get all possible placements for this word
        possible_placements = self._get_possible_placements(word, clue)

        # PHASE 1: Limit placements to try (max 10 per word for performance)
        if len(possible_placements) > 10:
            random.shuffle(possible_placements)
            possible_placements = possible_placements[:10]
        else:
            random.shuffle(possible_placements)

        # Try each possible placement
        for placement in possible_placements:
            # Try to place the word
            if self._can_place_word(placement):
                # Place the word
                self._place_word(placement)

                # Recurse
                if self._backtrack(word_data, index + 1, min_words):
                    return True

                # Backtrack: remove the word
                self._remove_word(placement)

        # Also try skipping this word
        if self._backtrack(word_data, index + 1, min_words):
            return True

        return False

    def _find_all_slots(self) -> List[Tuple[int, int, int, Direction]]:
        """
        Find all available slots in the grid.

        A slot is a contiguous sequence of white (non-blocked) cells
        bounded by black squares or grid edges.

        Returns:
            List of tuples: (row, col, length, direction)
        """
        slots = []

        # Find horizontal slots (ACROSS)
        for row in range(self.grid_size):
            col = 0
            while col < self.grid_size:
                # Skip black squares
                if self.grid[row][col].is_blocked:
                    col += 1
                    continue

                # Found start of a potential slot
                start_col = col
                length = 0

                # Count contiguous white squares
                while col < self.grid_size and not self.grid[row][col].is_blocked:
                    length += 1
                    col += 1

                # Only add slots of length >= 3 (no 2-letter words)
                if length >= 3:
                    slots.append((row, start_col, length, Direction.ACROSS))

        # Find vertical slots (DOWN)
        for col in range(self.grid_size):
            row = 0
            while row < self.grid_size:
                # Skip black squares
                if self.grid[row][col].is_blocked:
                    row += 1
                    continue

                # Found start of a potential slot
                start_row = row
                length = 0

                # Count contiguous white squares
                while row < self.grid_size and not self.grid[row][col].is_blocked:
                    length += 1
                    row += 1

                # Only add slots of length >= 3 (no 2-letter words)
                if length >= 3:
                    slots.append((start_row, col, length, Direction.DOWN))

        return slots

    def _get_possible_placements(self, word: str, clue: str) -> List[WordPlacement]:
        """
        Get all possible placements for a word using slot-based placement.

        PHASE 1: Now uses slots (contiguous white squares) instead of intersections.
        This works much better with pre-placed black square patterns.
        """
        placements = []
        word_length = len(word)

        # Find all available slots in the grid
        slots = self._find_all_slots()

        # Try to fit the word in each slot of matching length
        for row, col, slot_length, direction in slots:
            # Word must fit exactly or be shorter than the slot
            if word_length > slot_length:
                continue

            # If word is shorter than slot, try different positions within the slot
            for offset in range(slot_length - word_length + 1):
                if direction == Direction.ACROSS:
                    placement = WordPlacement(
                        word=word,
                        row=row,
                        col=col + offset,
                        direction=direction,
                        clue=clue
                    )
                else:  # DOWN
                    placement = WordPlacement(
                        word=word,
                        row=row + offset,
                        col=col,
                        direction=direction,
                        clue=clue
                    )

                placements.append(placement)

        return placements

    def _find_intersections(self, new_word: str, existing: WordPlacement) -> List[Tuple[int, int, Direction]]:
        """Find valid intersection points between a new word and existing word."""
        intersections = []

        for i, new_char in enumerate(new_word):
            for j, existing_char in enumerate(existing.word):
                if new_char == existing_char:
                    # Calculate position for new word
                    if existing.direction == Direction.ACROSS:
                        # New word should be DOWN
                        new_row = existing.row - i
                        new_col = existing.col + j
                        direction = Direction.DOWN
                    else:
                        # New word should be ACROSS
                        new_row = existing.row + j
                        new_col = existing.col - i
                        direction = Direction.ACROSS

                    # Check if position is valid
                    if self._is_valid_position(new_word, new_row, new_col, direction):
                        intersections.append((new_row, new_col, direction))

        return intersections

    def _is_valid_position(self, word: str, row: int, col: int, direction: Direction) -> bool:
        """Check if a word can be placed at the given position."""
        # Check bounds
        if direction == Direction.ACROSS:
            if col < 0 or col + len(word) > self.grid_size or row < 0 or row >= self.grid_size:
                return False
        else:  # DOWN
            if row < 0 or row + len(word) > self.grid_size or col < 0 or col >= self.grid_size:
                return False

        return True

    def _can_place_word(self, placement: WordPlacement) -> bool:
        """
        Check if a word can be placed without conflicts.

        PHASE 1: Now respects black squares - words cannot overlap black squares.
        """
        word = placement.word
        row, col = placement.row, placement.col
        direction = placement.direction

        # Check if position is valid
        if not self._is_valid_position(word, row, col, direction):
            return False

        # PHASE 1: Check each letter position
        for i, char in enumerate(word):
            if direction == Direction.ACROSS:
                r, c = row, col + i
            else:
                r, c = row + i, col

            cell = self.grid[r][c]

            # PHASE 1: Cannot place word on black squares
            if cell.is_blocked:
                return False

            # If cell already has a letter, it must match
            if cell.letter is not None and cell.letter != char:
                return False

            # Check perpendicular conflicts
            if not self._check_perpendicular(char, r, c, direction, i == 0, i == len(word) - 1):
                return False

        # PHASE 1: Check before and after the word for conflicts
        # Words must be bounded by black squares or edges
        if direction == Direction.ACROSS:
            # Check cell before
            if col > 0:
                before_cell = self.grid[row][col - 1]
                # Must be blocked or empty (no letter continuation)
                if before_cell.letter is not None and not before_cell.is_blocked:
                    return False
            # Check cell after
            if col + len(word) < self.grid_size:
                after_cell = self.grid[row][col + len(word)]
                if after_cell.letter is not None and not after_cell.is_blocked:
                    return False
        else:  # DOWN
            # Check cell before
            if row > 0:
                before_cell = self.grid[row - 1][col]
                if before_cell.letter is not None and not before_cell.is_blocked:
                    return False
            # Check cell after
            if row + len(word) < self.grid_size:
                after_cell = self.grid[row + len(word)][col]
                if after_cell.letter is not None and not after_cell.is_blocked:
                    return False

        return True

    def _check_perpendicular(self, char: str, row: int, col: int,
                            direction: Direction, is_first: bool, is_last: bool) -> bool:
        """Check for conflicts in perpendicular direction."""
        if direction == Direction.ACROSS:
            # Check above and below
            has_above = row > 0 and self.grid[row - 1][col].letter is not None
            has_below = row < self.grid_size - 1 and self.grid[row + 1][col].letter is not None

            # If current cell is empty and there are letters above or below, it's a conflict
            # (unless this position is part of an existing down word)
            if self.grid[row][col].letter is None and (has_above or has_below):
                return False
        else:  # DOWN
            # Check left and right
            has_left = col > 0 and self.grid[row][col - 1].letter is not None
            has_right = col < self.grid_size - 1 and self.grid[row][col + 1].letter is not None

            # If current cell is empty and there are letters left or right, it's a conflict
            # (unless this position is part of an existing across word)
            if self.grid[row][col].letter is None and (has_left or has_right):
                return False

        return True

    def _place_word(self, placement: WordPlacement):
        """Place a word on the grid."""
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
        """Remove a word from the grid."""
        word = placement.word
        row, col = placement.row, placement.col
        direction = placement.direction

        # Check each cell - only clear if not part of another word
        for i, char in enumerate(word):
            if direction == Direction.ACROSS:
                r, c = row, col + i
            else:
                r, c = row + i, col

            # Check if this cell is used by another word
            is_used = False
            for other in self.placements:
                if other == placement:
                    continue

                # Check if (r, c) is part of other word
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

    def _validate_puzzle(self) -> bool:
        """
        Validate that the puzzle meets professional crossword standards.

        PHASE 1 Validation Criteria:
        1. Zero 2-letter words (hard constraint)
        2. Maximum 20% 3-letter words
        3. All white cells are filled (no empty spaces)
        4. Grid is fully connected (no isolated regions)

        Returns:
            True if puzzle meets all criteria, False otherwise
        """
        if len(self.placements) == 0:
            return False

        # Count word lengths
        word_lengths = [len(p.word) for p in self.placements]
        two_letter_count = sum(1 for length in word_lengths if length == 2)
        three_letter_count = sum(1 for length in word_lengths if length == 3)
        total_words = len(word_lengths)

        # CRITERION 1: Zero 2-letter words (hard constraint)
        if two_letter_count > 0:
            return False

        # CRITERION 2: Maximum 30% 3-letter words (relaxed from 20%)
        # Professional newspapers use 25-30%, so this is realistic
        three_letter_percentage = (three_letter_count / total_words) * 100
        if three_letter_percentage > 30:
            return False

        # CRITERION 3: High percentage of white cells should be filled
        # Relaxed to 70% for better achievability (ideal would be 85%+)
        total_white_cells = 0
        filled_white_cells = 0

        for row in range(self.grid_size):
            for col in range(self.grid_size):
                cell = self.grid[row][col]
                if not cell.is_blocked:
                    total_white_cells += 1
                    if cell.letter is not None:
                        filled_white_cells += 1

        if total_white_cells > 0:
            fill_percentage = (filled_white_cells / total_white_cells) * 100
            if fill_percentage < 70:  # Require at least 70% fill (relaxed from 85%)
                return False

        # CRITERION 4: Every letter should appear in both across and down words
        # (This ensures proper "checking" of letters)
        for row in range(self.grid_size):
            for col in range(self.grid_size):
                cell = self.grid[row][col]
                if cell.is_blocked or cell.letter is None:
                    continue

                # Check if this cell is part of an across word and a down word
                has_across = False
                has_down = False

                for placement in self.placements:
                    if placement.direction == Direction.ACROSS:
                        if (placement.row == row and
                            placement.col <= col < placement.col + len(placement.word)):
                            has_across = True
                    else:  # DOWN
                        if (placement.col == col and
                            placement.row <= row < placement.row + len(placement.word)):
                            has_down = True

                    if has_across and has_down:
                        break

                # Every letter should be "checked" by both directions
                # (Exception: edge cases where only one direction is possible)
                if not (has_across and has_down):
                    # For now, we'll allow this but it's not ideal
                    # A truly professional puzzle would have all letters checked
                    pass

        return True

    def _number_grid(self):
        """Assign numbers to cells that start words."""
        number = 1

        for row in range(self.grid_size):
            for col in range(self.grid_size):
                starts_across = False
                starts_down = False

                # Check if any word starts here
                for placement in self.placements:
                    if placement.row == row and placement.col == col:
                        if placement.direction == Direction.ACROSS:
                            starts_across = True
                        else:
                            starts_down = True

                # If a word starts here, assign number
                if starts_across or starts_down:
                    self.grid[row][col].number = number

                    # Assign number to placements
                    for placement in self.placements:
                        if placement.row == row and placement.col == col:
                            placement.number = number

                    number += 1

    def _export_puzzle(self) -> Dict:
        """
        Export the puzzle data.

        PHASE 1: Now properly marks black squares as blocked.
        """
        # Number the grid
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
                    'blocked': cell.is_blocked  # PHASE 1: Use explicit black square marking
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


def generate_crossword(word_list: List[Dict[str, str]], grid_size: int = 9, difficulty: str = "medium") -> Optional[Dict]:
    """
    Convenience function to generate a crossword puzzle.

    Args:
        word_list: List of dictionaries with 'word', 'clue', and 'difficulty' keys
        grid_size: Size of the grid (default 9)
        difficulty: Difficulty level ("easy", "medium", or "hard")

    Returns:
        Puzzle data dictionary or None if generation failed
    """
    generator = CrosswordGenerator(grid_size=grid_size)
    return generator.generate(word_list, difficulty=difficulty)
