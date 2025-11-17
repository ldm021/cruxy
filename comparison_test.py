"""
Comparison Test Script for Standard vs Advanced Crossword Generators
Runs both generators multiple times and compares performance metrics.
"""

import json
import time
import statistics
from typing import List, Dict
from backend.crossword_generator import generate_crossword
from backend.crossword_generator_advanced import generate_crossword_advanced


def load_word_list() -> List[Dict[str, str]]:
    """Load the word list from data file."""
    with open('data/words.json', 'r') as f:
        return json.load(f)


def test_generator(generator_func, word_list: List[Dict[str, str]],
                   grid_size: int, difficulty: str, num_tests: int = 10):
    """
    Test a generator multiple times and collect metrics.

    Args:
        generator_func: Generator function to test
        word_list: List of words to use
        grid_size: Size of grid
        difficulty: Difficulty level
        num_tests: Number of test runs

    Returns:
        Dictionary with aggregated metrics
    """
    results = {
        'times': [],
        'word_counts': [],
        'successes': 0,
        'failures': 0,
        'word_length_distribution': []
    }

    for i in range(num_tests):
        print(f"  Run {i+1}/{num_tests}...", end=' ')

        start_time = time.time()
        try:
            puzzle = generator_func(word_list, grid_size=grid_size, difficulty=difficulty)
            generation_time = time.time() - start_time

            if puzzle is not None:
                word_count = len(puzzle['clues']['across']) + len(puzzle['clues']['down'])
                results['times'].append(generation_time)
                results['word_counts'].append(word_count)
                results['successes'] += 1

                # Collect word length distribution
                word_lengths = []
                for clue in puzzle['clues']['across']:
                    word_lengths.append(clue['length'])
                for clue in puzzle['clues']['down']:
                    word_lengths.append(clue['length'])
                results['word_length_distribution'].append(word_lengths)

                print(f"✓ {generation_time:.2f}s, {word_count} words")
            else:
                results['failures'] += 1
                print("✗ Failed")

        except Exception as e:
            results['failures'] += 1
            print(f"✗ Error: {e}")

    return results


def analyze_results(results: Dict, generator_name: str):
    """Print analysis of test results."""
    print(f"\n{'='*60}")
    print(f"{generator_name} - Results Summary")
    print(f"{'='*60}")

    success_rate = (results['successes'] / (results['successes'] + results['failures'])) * 100
    print(f"Success Rate: {success_rate:.1f}% ({results['successes']}/{results['successes'] + results['failures']})")

    if results['times']:
        print(f"\nGeneration Time:")
        print(f"  Average: {statistics.mean(results['times']):.2f}s")
        print(f"  Median:  {statistics.median(results['times']):.2f}s")
        print(f"  Min:     {min(results['times']):.2f}s")
        print(f"  Max:     {max(results['times']):.2f}s")
        if len(results['times']) > 1:
            print(f"  StdDev:  {statistics.stdev(results['times']):.2f}s")

    if results['word_counts']:
        print(f"\nWord Count:")
        print(f"  Average: {statistics.mean(results['word_counts']):.1f}")
        print(f"  Median:  {statistics.median(results['word_counts']):.0f}")
        print(f"  Min:     {min(results['word_counts'])}")
        print(f"  Max:     {max(results['word_counts'])}")
        if len(results['word_counts']) > 1:
            print(f"  StdDev:  {statistics.stdev(results['word_counts']):.1f}")

    if results['word_length_distribution']:
        # Flatten all word lengths
        all_lengths = []
        for lengths in results['word_length_distribution']:
            all_lengths.extend(lengths)

        print(f"\nWord Length Distribution:")
        print(f"  Average length: {statistics.mean(all_lengths):.1f}")

        # Count by length
        length_counts = {}
        for length in all_lengths:
            length_counts[length] = length_counts.get(length, 0) + 1

        for length in sorted(length_counts.keys()):
            count = length_counts[length]
            percentage = (count / len(all_lengths)) * 100
            print(f"  {length} letters: {count} ({percentage:.1f}%)")


def compare_generators(word_list: List[Dict[str, str]], grid_size: int = 9,
                       difficulty: str = 'medium', num_tests: int = 10):
    """
    Compare both generators side-by-side.

    Args:
        word_list: List of words to use
        grid_size: Size of grid to test
        difficulty: Difficulty level to test
        num_tests: Number of tests per generator
    """
    print(f"\n{'='*60}")
    print(f"CROSSWORD GENERATOR COMPARISON TEST")
    print(f"{'='*60}")
    print(f"Grid Size: {grid_size}x{grid_size}")
    print(f"Difficulty: {difficulty}")
    print(f"Number of tests: {num_tests}")
    print(f"{'='*60}\n")

    # Test Standard Generator
    print("Testing STANDARD GENERATOR...")
    standard_results = test_generator(
        generate_crossword, word_list, grid_size, difficulty, num_tests
    )

    # Test Advanced Generator
    print("\nTesting ADVANCED GENERATOR...")
    advanced_results = test_generator(
        generate_crossword_advanced, word_list, grid_size, difficulty, num_tests
    )

    # Display results
    analyze_results(standard_results, "STANDARD GENERATOR")
    analyze_results(advanced_results, "ADVANCED GENERATOR")

    # Head-to-head comparison
    print(f"\n{'='*60}")
    print("HEAD-TO-HEAD COMPARISON")
    print(f"{'='*60}")

    if standard_results['times'] and advanced_results['times']:
        std_avg_time = statistics.mean(standard_results['times'])
        adv_avg_time = statistics.mean(advanced_results['times'])

        if std_avg_time < adv_avg_time:
            faster = "Standard"
            diff = ((adv_avg_time - std_avg_time) / std_avg_time) * 100
        else:
            faster = "Advanced"
            diff = ((std_avg_time - adv_avg_time) / adv_avg_time) * 100

        print(f"Speed: {faster} is {diff:.1f}% faster")

    if standard_results['word_counts'] and advanced_results['word_counts']:
        std_avg_words = statistics.mean(standard_results['word_counts'])
        adv_avg_words = statistics.mean(advanced_results['word_counts'])

        if std_avg_words > adv_avg_words:
            better = "Standard"
            diff = std_avg_words - adv_avg_words
        else:
            better = "Advanced"
            diff = adv_avg_words - std_avg_words

        print(f"Word Count: {better} places {diff:.1f} more words on average")

    std_success = (standard_results['successes'] / num_tests) * 100
    adv_success = (advanced_results['successes'] / num_tests) * 100

    if std_success > adv_success:
        better = "Standard"
        diff = std_success - adv_success
    else:
        better = "Advanced"
        diff = adv_success - std_success

    print(f"Reliability: {better} has {diff:.1f}% better success rate")

    print(f"{'='*60}\n")


def main():
    """Run comparison tests."""
    # Load word list
    print("Loading word list...")
    word_list = load_word_list()
    print(f"Loaded {len(word_list)} words\n")

    # Run tests for different grid sizes
    test_configs = [
        {'grid_size': 9, 'difficulty': 'medium', 'num_tests': 10},
        {'grid_size': 13, 'difficulty': 'medium', 'num_tests': 5},
    ]

    for config in test_configs:
        compare_generators(word_list, **config)
        print("\n" + "="*60 + "\n")


if __name__ == '__main__':
    main()
