"""Create a popularity-ranked review list from Kaggle's unigram frequencies.

The resulting list is intentionally separate from the Wordle-valid answer list.
It is a candidate source for choosing a popularity cutoff, not a runtime
dictionary.
"""

import csv
import re
from pathlib import Path


HERE = Path(__file__).parent
SOURCE = HERE / "data" / "unigram_freq.csv"
CSV_OUTPUT = HERE / "frequency_candidates.csv"
TXT_OUTPUT = HERE / "frequency_candidates.txt"
WORDLE_LIST = HERE / "answerlist.txt"


def candidates():
    best_counts = {}
    with SOURCE.open(newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            word = row["word"].strip().lower()
            if not re.fullmatch(r"[a-z]{5}", word) or not any(letter in "abcdefgh" for letter in word):
                continue
            count = int(row["count"])
            best_counts[word] = max(best_counts.get(word, 0), count)
    return sorted(best_counts.items(), key=lambda item: (-item[1], item[0]))


def main():
    rows = candidates()
    wordle_words = {line.strip().lower() for line in WORDLE_LIST.open(encoding="utf-8") if line.strip()}
    with CSV_OUTPUT.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["rank", "word", "count", "wordle_answer"])
        writer.writerows((rank, word, count, word in wordle_words) for rank, (word, count) in enumerate(rows, 1))
    with TXT_OUTPUT.open("w", encoding="utf-8") as output:
        output.write("rank\tword\tcount\twordle_answer\n")
        output.writelines(f"{rank}\t{word}\t{count}\t{word in wordle_words}\n" for rank, (word, count) in enumerate(rows, 1))
    print(f"Wrote {len(rows):,} candidates to {CSV_OUTPUT.name} and {TXT_OUTPUT.name}")


if __name__ == "__main__":
    main()
