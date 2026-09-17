"""Sidecar entrypoint (W7)."""
import os
from urllib.parse import urlparse

try:
    from . import server
    from . import sandbox_routes  # noqa: F401  (registers /sandbox on import)
    from . import cost_routes  # noqa: F401  (registers /cost on import)
    from . import jobs  # noqa: F401
except ImportError:
    import importlib.util as _ilu
    import pathlib as _pathlib
    _here = _pathlib.Path(__file__).parent

    def _load(name):
        spec = _ilu.spec_from_file_location(name, str(_here / (name.split(".")[-1] + ".py")))
        mod = _ilu.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    server = _load("server")
    sandbox_routes = _load("sandbox_routes")
    cost_routes = _load("cost_routes")  # noqa: F841  (registers /cost on import)
    jobs = _load("jobs")

server.register_router("/sandbox", sandbox_routes.handler)
# /cost is registered on import by cost_routes (DP-LEDGER) through the same
# register_router; the import above is what serves it.


def _port_default():
    raw = os.environ.get("MERGEREADY_SIDECAR_URL", "")
    if raw:
        try:
            port = urlparse(raw).port
            if port:
                return port
        except Exception:
            pass
    return 8787


def main():
    server.serve(_port_default())


if __name__ == "__main__":
    main()
