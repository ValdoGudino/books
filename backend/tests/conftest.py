# Disable MongoDB for all test runs so tests never use the DB (unit tests use mocks,
# integration tests hit the real APIs every time). This overrides direnv/.env.
import os
os.environ.pop("MONGODB_URI", None)

import pytest

pytest_plugins = ["pytest_asyncio"]
