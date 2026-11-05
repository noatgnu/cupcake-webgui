"""
Checks API responses against the OpenAPI 3.0 schema the appliance publishes at /api/schema/.

Covers what drf-spectacular emits: $ref, allOf / oneOf / anyOf, nullable, enum, and the object,
array, string, number, integer and boolean types. Formats and extra properties are not checked.
"""

HTTP_METHODS = ("get", "post", "put", "patch", "delete")
JSON = "application/json"


def resolve(document, node):
    """Follow $ref pointers until a concrete schema node is reached."""
    while isinstance(node, dict) and "$ref" in node:
        target = document
        for part in node["$ref"].lstrip("#/").split("/"):
            target = target[part]
        node = target
    return node


def validate(document, node, value, where="$"):
    """Return a list of differences between value and the schema node; empty when it matches."""
    node = resolve(document, node or {})
    if value is None:
        return [] if node.get("nullable") or not node else [f"{where}: null where a value is required"]
    for combined in ("oneOf", "anyOf"):
        if combined in node:
            options = [validate(document, option, value, where) for option in node[combined]]
            return [] if any(not errors for errors in options) else min(options, key=len)
    errors = []
    for part in node.get("allOf", []):
        errors += validate(document, part, value, where)
    if "enum" in node and value not in node["enum"] and not (value == "" and "" in node["enum"]):
        errors.append(f"{where}: {value!r} is not one of {node['enum']}")
    kind = node.get("type")
    checks = {
        "object": isinstance(value, dict),
        "array": isinstance(value, list),
        "string": isinstance(value, str),
        "integer": isinstance(value, int) and not isinstance(value, bool),
        "number": isinstance(value, (int, float)) and not isinstance(value, bool),
        "boolean": isinstance(value, bool),
    }
    if kind in checks and not checks[kind]:
        return errors + [f"{where}: expected {kind}, got {type(value).__name__}"]
    if kind == "object" or (kind is None and "properties" in node):
        for name in node.get("required", []):
            if name not in value:
                errors.append(f"{where}: missing required property {name!r}")
        for name, child in node.get("properties", {}).items():
            if name in value:
                errors += validate(document, child, value[name], f"{where}.{name}")
    if kind == "array":
        for index, item in enumerate(value[:20]):
            errors += validate(document, node.get("items"), item, f"{where}[{index}]")
    return errors


def operations(document):
    """Yield (path, method, operation) for every operation in the schema."""
    for path, item in sorted(document.get("paths", {}).items()):
        for method in HTTP_METHODS:
            if method in item:
                yield path, method, item[method]


def required_parameters(operation, location):
    """Names of the required parameters of an operation in the given location (path or query)."""
    return [p["name"] for p in operation.get("parameters", []) if p.get("in") == location and p.get("required")]


def documented_response(operation, status_code):
    """Return (documented, json_schema) for a status code of an operation."""
    responses = operation.get("responses", {})
    entry = responses.get(str(status_code)) or responses.get(f"{str(status_code)[0]}XX") or responses.get("default")
    if entry is None:
        return False, None
    return True, entry.get("content", {}).get(JSON, {}).get("schema")
