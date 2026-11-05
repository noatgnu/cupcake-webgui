"""Both web apps are served, with every script and stylesheet their page refers to."""

import re
from urllib.parse import urljoin

import pytest
import requests

ASSET = re.compile(r'(?:src|href)="([^"]+\.(?:js|css))"')


@pytest.mark.parametrize("site, title", [("vanilla_url", "Cupcake Vanilla"), ("cupcake_url", "Cupcake")])
def test_site_serves_its_app_and_assets(request, site, title):
    url = request.getfixturevalue(site)
    page = requests.get(url, timeout=30)
    assert page.status_code == 200
    assert f"<title>{title}</title>" in page.text, f"{url} does not serve {title}"
    assets = sorted(set(ASSET.findall(page.text)))
    assert assets, f"{url} refers to no scripts or stylesheets"
    missing = [a for a in assets if requests.get(urljoin(url, a), timeout=30).status_code != 200]
    assert not missing, f"assets that do not load: {missing}"
