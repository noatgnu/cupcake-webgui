#!/bin/bash
set -eux

cd /opt/cupcake/backend
set -a
source /opt/cupcake/.env
set +a

MANAGE="/opt/cupcake/venv/bin/python manage.py"

echo "=== Loading UniProt controlled vocabularies ==="
$MANAGE load_species
$MANAGE load_tissue
$MANAGE load_human_disease
$MANAGE load_subcellular_location

echo "=== Loading MS ontologies ==="
$MANAGE load_ms_mod
$MANAGE load_ms_term

echo "=== Loading OBO ontologies (including NCBI taxonomy and ChEBI) ==="
$MANAGE load_ontologies --ontology all --no-limit

echo "=== Ontology loading complete ==="
