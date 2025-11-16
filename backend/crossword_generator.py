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
        self.max_attempts = max_attempts
        self.grid: List[List[Cell]] = []
        self.placements: List[WordPlacement] = []
        self.used_words: Set[str] = set()

    def generate(self, word_data: List[Dict[str, str]]) -> Optional[Dict]:
        """
        Generate a crossword puzzle.

        Args:
            word_data: List of dicts with 'word' and 'clue' keys

        Returns:
            Dictionary with grid and clues, or None if generation failed
        """
        # Filter words that are too long for the grid
        max_word_length = self.grid_size - 1  # Leave some room
        filtered_words = [
            w for w in word_data
            if 3 <= len(w['word']) <= max_word_length
        ]

        if len(filtered_words) < 10:
            # Not enough suitable words
            return None

        # Sort by length - use mix of longer and shorter words
        # Group by length and sample from each group
        by_length = {}
        for word_info in filtered_words:
            length = len(word_info['word'])
            if length not in by_length:
                by_length[length] = []
            by_length[length].append(word_info)

        # Build a balanced word list
        selected_words = []
        for length in sorted(by_length.keys(), reverse=True):
            # Take a few words from each length category
            words_of_length = by_length[length]
            sample_size = min(len(words_of_length), max(3, self.grid_size // 2))
            selected_words.extend(random.sample(words_of_length, sample_size))

        # Try multiple times to generate a valid puzzle
        for attempt in range(self.max_attempts):
            if self._try_generate(selected_words):
                return self._export_puzzle()

        return None

    def _try_generate(self, word_data: List[Dict[str, str]]) -> bool:
        """
        Attempt to generate a crossword puzzle.

        Returns:
            True if successful, False otherwise
        """
        # Reset state
        self._initialize_grid()
        self.placements = []
        self.used_words = set()

        # Use available words
        words_to_use = list(word_data)

        # Shuffle to get variety
        random.shuffle(words_to_use)

        # Try to place words using backtracking
        # Aim for at least 6-8 words for a reasonable puzzle
        min_words = max(6, min(8, len(words_to_use) // 3))
        return self._backtrack(words_to_use, 0, min_words=min_words)

    def _initialize_grid(self):
        """Initialize an empty grid."""
        self.grid = [[Cell() for _ in range(self.grid_size)]
                     for _ in range(self.grid_size)]

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

        # Shuffle to get variety
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

    def _get_possible_placements(self, word: str, clue: str) -> List[WordPlacement]:
        """Get all possible placements for a word."""
        placements = []

        # If this is the first word, place it in the center
        if len(self.placements) == 0:
            center = self.grid_size // 2
            # Try horizontal placement
            start_col = center - len(word) // 2
            if start_col >= 0 and start_col + len(word) <= self.grid_size:
                placements.append(WordPlacement(
                    word=word, row=center, col=start_col,
                    direction=Direction.ACROSS, clue=clue
                ))
            return placements

        # For subsequent words, find intersection points
        for existing in self.placements:
            intersections = self._find_intersections(word, existing)
            for row, col, direction in intersections:
                placements.append(WordPlacement(
                    word=word, row=row, col=col,
                    direction=direction, clue=clue
                ))

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
        """Check if a word can be placed without conflicts."""
        word = placement.word
        row, col = placement.row, placement.col
        direction = placement.direction

        # Check if position is valid
        if not self._is_valid_position(word, row, col, direction):
            return False

        # Check each letter
        for i, char in enumerate(word):
            if direction == Direction.ACROSS:
                r, c = row, col + i
            else:
                r, c = row + i, col

            cell = self.grid[r][c]

            # If cell already has a letter, it must match
            if cell.letter is not None and cell.letter != char:
                return False

            # Check perpendicular conflicts
            if not self._check_perpendicular(char, r, c, direction, i == 0, i == len(word) - 1):
                return False

        # Check before and after the word for conflicts
        if direction == Direction.ACROSS:
            # Check cell before
            if col > 0 and self.grid[row][col - 1].letter is not None:
                return False
            # Check cell after
            if col + len(word) < self.grid_size and self.grid[row][col + len(word)].letter is not None:
                return False
        else:  # DOWN
            # Check cell before
            if row > 0 and self.grid[row - 1][col].letter is not None:
                return False
            # Check cell after
            if row + len(word) < self.grid_size and self.grid[row + len(word)][col].letter is not None:
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
        """Export the puzzle data."""
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
                    'blocked': cell.letter is None
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


def generate_crossword(word_list: List[Dict[str, str]], grid_size: int = 9) -> Optional[Dict]:
    """
    Convenience function to generate a crossword puzzle.

    Args:
        word_list: List of dictionaries with 'word' and 'clue' keys
        grid_size: Size of the grid (default 9)

    Returns:
        Puzzle data dictionary or None if generation failed
    """
    generator = CrosswordGenerator(grid_size=grid_size)
    return generator.generate(word_list)
