"""Extract lowercase five-letter dictionary words and Wordle membership."""

import csv
import re
from pathlib import Path

HERE = Path(__file__).parent
SOURCE = HERE / "data" / "english-words-alpha.txt"
WORDLE = HERE / "wordlist.txt"
CSV_OUTPUT = HERE / "english_words_5.csv"
TXT_OUTPUT = HERE / "english_words_5.txt"


def main():
    words = sorted({line.strip() for line in SOURCE.open(encoding="utf-8") if re.fullmatch(r"[a-z]{5}", line.strip())})
    wordle_words = {line.strip() for line in WORDLE.open(encoding="utf-8") if re.fullmatch(r"[a-z]{5}", line.strip())}
    with CSV_OUTPUT.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["word", "wordle_valid"])
        writer.writerows((word, word in wordle_words) for word in words)
    with TXT_OUTPUT.open("w", encoding="utf-8") as output:
        output.write("word\twordle_valid\n")
        output.writelines(f"{word}\t{word in wordle_words}\n" for word in words)
    print(f"Wrote {len(words):,} words")


if __name__ == "__main__":
    main()
