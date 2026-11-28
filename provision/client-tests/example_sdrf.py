"""
A real experiment's metadata, read from the example SDRF file, for the data the tests create.

The example covers PXD018883 and PXD036453: dormant (D-HEp3) and proliferating (T-HEp3) HEp-3 head and neck
squamous cell carcinoma cells, digested with trypsin, Lys-C and PNGase F, and measured label free on an LTQ Orbitrap
Velos.
"""

import csv
from pathlib import Path

EXAMPLE_SDRF = Path(__file__).parent / "examples" / "PXD019185_PXD018883.sdrf.tsv"


def _rows():
    with EXAMPLE_SDRF.open(newline="") as handle:
        rows = list(csv.reader(handle, delimiter="\t"))
    return rows[0], rows[1:]


HEADERS, ROWS = _rows()


def values(column):
    """The distinct values of every column of that name, in the order they first appear."""
    found = []
    for index, header in enumerate(HEADERS):
        if header == column:
            for row in ROWS:
                value = row[index].strip()
                if value not in found:
                    found.append(value)
    return found


def term_name(value):
    """The term name of an SDRF value such as NT=Trypsin;AC=MS:1001251, or the value itself."""
    for part in value.split(";"):
        if part.startswith("NT="):
            return part[3:]
    return value


ACCESSION = values("comment[proteomexchange accession number]")[0]
ORGANISM = values("characteristics[organism]")[0]
CELL_LINE = term_name(values("characteristics[cell line]")[0])
DISEASE = values("characteristics[disease]")[0]
INSTRUMENT_VALUE = values("comment[instrument]")[0]
INSTRUMENT = term_name(INSTRUMENT_VALUE)
ENZYMES = [term_name(value) for value in values("comment[cleavage agent details]")]
SAMPLES = values("source name")
DATA_FILES = values("comment[data file]")
LABEL = values("comment[label]")[0]
PRECURSOR_TOLERANCE = values("comment[precursor mass tolerance]")[0]
STUDY = f"HEp-3 dormancy ({ACCESSION})"
