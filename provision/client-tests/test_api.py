"""
Logged-in API checks driven by the schema the appliance publishes.

Every GET operation without required parameters must answer without a server error. Operations
under CONTRACT_PATHS, the parts of the API whose custom actions are fully documented, must also
answer with a status code the schema lists and a body matching its schema. Permission refusals
(401 and 403) are accepted without being listed, as the schema leaves them out.
"""

import pytest

from openapi_contract import documented_response, operations, required_parameters, validate

CORE_PATHS = (
    "annotation-folders",
    "annotations",
    "appliance",
    "auth",
    "deletions",
    "device",
    "device-tokens",
    "lab-group-invitations",
    "lab-group-permissions",
    "lab-groups",
    "plugins",
    "remote-hosts",
    "resource-permissions",
    "site-config",
    "users",
)
METADATA_PATHS = (
    "async-export",
    "async-import",
    "async-tasks",
    "async-validation",
    "column-templates",
    "excel-launch",
    "favourite-options",
    "metadata-columns",
    "metadata-management",
    "metadata-table-templates",
    "metadata-tables",
    "ontology",
    "sample-pools",
    "schemas",
    "sdrf-defaults",
    "shared-tables",
    "template-shares",
)
PROTOCOL_PATHS = (
    "instrument-usage-session-annotations",
    "instrument-usage-step-annotations",
    "projects",
    "protocol-reagents",
    "protocols",
    "ratings",
    "sections",
    "session-annotation-folders",
    "session-annotations",
    "sessions",
    "step-annotations",
    "step-reagents",
    "step-variations",
    "steps",
    "time-keepers",
)
INSTRUMENT_PATHS = (
    "external-contact-details",
    "external-contacts",
    "instrument-annotations",
    "instrument-job-annotations",
    "instrument-jobs",
    "instrument-permissions",
    "instrument-usage",
    "instrument-usage-job-annotations",
    "instruments",
    "maintenance-log-annotations",
    "maintenance-logs",
    "reagent-actions",
    "reagent-subscriptions",
    "reagents",
    "storage-objects",
    "stored-reagent-annotations",
    "stored-reagents",
    "support-information",
)
COMMUNICATION_PATHS = ("messages", "notifications", "participants", "threads", "webrtc-sessions")
BILLING_PATHS = ("billable-item-types", "billing-records", "service-prices", "service-tiers")
PROTOCOLS_IO_PATHS = ("protocols-io",)
CONTRACT_PATHS = tuple(
    f"/api/v1/{name}/"
    for name in CORE_PATHS
    + METADATA_PATHS
    + PROTOCOL_PATHS
    + INSTRUMENT_PATHS
    + COMMUNICATION_PATHS
    + BILLING_PATHS
    + PROTOCOLS_IO_PATHS
)
PAGE_LIMIT = {"limit": 10}
REFUSALS = (401, 403)

pytestmark = pytest.mark.login


def _get_operations(schema):
    return [
        (path, operation)
        for path, method, operation in operations(schema)
        if method == "get" and not required_parameters(operation, "path") and not required_parameters(operation, "query")
    ]


def _params(operation):
    names = {p["name"] for p in operation.get("parameters", [])}
    return PAGE_LIMIT if "limit" in names else {}


def test_token_can_be_refreshed_and_verified(api_url, tokens, api):
    refreshed = api.post(api_url + "auth/token/refresh/", json={"refresh": tokens["refresh"]}, timeout=30)
    assert refreshed.status_code == 200 and refreshed.json().get("access")
    verified = api.post(api_url + "auth/token/verify/", json={"token": tokens["access"]}, timeout=30)
    assert verified.status_code == 200


def test_schema_is_openapi_3(schema):
    assert schema["openapi"].startswith("3.")
    assert "/api/v1/auth/token/" in schema["paths"]


def test_get_endpoints_answer_without_server_errors(api, vanilla_url, schema):
    failures = []
    for path, operation in _get_operations(schema):
        response = api.get(vanilla_url.rstrip("/") + path, params=_params(operation), timeout=60)
        documented, _ = documented_response(operation, response.status_code)
        if response.status_code >= 500 and not documented:
            failures.append(f"GET {path}: {response.status_code} {response.text[:120]}")
    assert not failures, "\n".join(failures)


def test_documented_endpoints_match_their_schema(api, vanilla_url, schema):
    checked, failures = 0, []
    for path, operation in _get_operations(schema):
        if not path.startswith(CONTRACT_PATHS):
            continue
        response = api.get(vanilla_url.rstrip("/") + path, params=_params(operation), timeout=60)
        documented, body_schema = documented_response(operation, response.status_code)
        checked += 1
        if not documented and response.status_code in REFUSALS:
            continue
        if not documented:
            failures.append(f"GET {path}: status {response.status_code} is not in the schema")
            continue
        if body_schema and "json" in response.headers.get("Content-Type", ""):
            failures += [f"GET {path}: {error}" for error in validate(schema, body_schema, response.json())]
    assert checked, f"no GET operations found under {CONTRACT_PATHS}"
    assert not failures, "\n".join(failures)
