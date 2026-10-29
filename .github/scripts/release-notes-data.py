"""
Writes the reference data section of the release notes from a snapshot manifest: the
sdrf-pipelines release the schemas and column templates come from, and the upstream version,
release date and download date of every database.

With --notes, the section replaces any earlier copy between the markers in that file, so running
it again for the same release does not repeat it.

Usage: release-notes-data.py <manifest.json> [--notes <release notes file>]
"""

import argparse
import json
import re
from pathlib import Path

START_MARKER = "<!-- reference-data -->"
END_MARKER = "<!-- /reference-data -->"


def cell(value):
    """Render a table cell, with a dash for missing values."""
    return str(value) if value else "—"


def section(manifest):
    """Build the markdown section for the given manifest."""
    lines = [START_MARKER, "## Reference data", ""]
    sdrf_version = manifest.get("sdrf_pipelines_version")
    if sdrf_version:
        lines.append(
            "SDRF schemas and column templates are derived from "
            f"[sdrf-pipelines {sdrf_version}](https://pypi.org/project/sdrf-pipelines/{sdrf_version}/)."
        )
        lines.append("")
    lines.append("| Database | Version | Released | Retrieved | Rows |")
    lines.append("|---|---|---|---|---:|")
    for table in manifest["tables"]:
        source = table.get("source") or {}
        name = f"{table['dataset']} / {table['name']}"
        if source.get("url"):
            name = f"[{name}]({source['url']})"
        retrieved = (source.get("retrieved_at") or "")[:10]
        lines.append(
            f"| {name} | {cell(source.get('version'))} | {cell(source.get('released'))} "
            f"| {cell(retrieved)} | {table['row_count']:,} |"
        )
    lines.append(END_MARKER)
    return "\n".join(lines)


def merge(notes, new_section):
    """Replace the existing reference data section in notes, or append it."""
    pattern = re.compile(re.escape(START_MARKER) + r".*?" + re.escape(END_MARKER), re.DOTALL)
    if pattern.search(notes):
        return pattern.sub(lambda _: new_section, notes)
    return f"{notes.rstrip()}\n\n{new_section}\n" if notes.strip() else f"{new_section}\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest")
    parser.add_argument("--notes", help="Release notes file to update in place")
    args = parser.parse_args()

    new_section = section(json.loads(Path(args.manifest).read_text()))
    if args.notes:
        notes_path = Path(args.notes)
        notes = notes_path.read_text() if notes_path.exists() else ""
        notes_path.write_text(merge(notes, new_section))
    else:
        print(new_section)


if __name__ == "__main__":
    main()
