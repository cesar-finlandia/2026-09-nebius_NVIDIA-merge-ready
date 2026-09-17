import sys
import traceback
from pathlib import Path


def main():
    try:
        lines = []
        lines.append("SDK")
        lines.append("===")
        try:
            import contree_sdk
            sdk_version = getattr(contree_sdk, "__version__", "unknown")
            lines.append(f"contree_sdk: present version={sdk_version}")
        except Exception as e:
            contree_sdk = None
            lines.append(f"contree_sdk: missing ({type(e).__name__}: {e})")
        try:
            from contree_client.httpx import ContreeAsyncClient
            lines.append("ContreeAsyncClient import: success")
        except Exception as e:
            ContreeAsyncClient = None
            lines.append(f"ContreeAsyncClient import: failed ({type(e).__name__}: {e})")
        try:
            from contree_sdk import Contree, ContreeSync
            lines.append("Contree/ContreeSync import: success")
        except Exception as e:
            Contree = None
            ContreeSync = None
            lines.append(f"Contree/ContreeSync import: failed ({type(e).__name__}: {e})")
        if contree_sdk is not None:
            try:
                lines.append(f"dir(contree_sdk): {sorted(dir(contree_sdk))}")
            except Exception as e:
                lines.append(f"dir(contree_sdk): failed ({type(e).__name__}: {e})")
        else:
            lines.append("dir(contree_sdk): skipped (module missing)")
        if Contree is not None:
            try:
                lines.append(f"dir(Contree): {sorted(dir(Contree))}")
            except Exception as e:
                lines.append(f"dir(Contree): failed ({type(e).__name__}: {e})")
        else:
            lines.append("dir(Contree): skipped (import failed)")
        lines.append("")
        lines.append("IMAGES")
        lines.append("======")
        client = None
        if ContreeAsyncClient is not None:
            try:
                client = ContreeAsyncClient.from_profile()
                lines.append(f"ContreeAsyncClient.from_profile(): success type={type(client).__name__}")
            except Exception as e:
                lines.append(f"ContreeAsyncClient.from_profile(): {type(e).__name__}: {e}")
        else:
            lines.append("ContreeAsyncClient.from_profile(): skipped (import failed)")
        if client is not None:
            try:
                lines.append(f"dir(client): {sorted(dir(client))}")
            except Exception as e:
                lines.append(f"dir(client): failed ({type(e).__name__}: {e})")
            try:
                images = getattr(client, "images", None)
                if images is not None:
                    lines.append(f"dir(client.images): {sorted(dir(images))}")
                else:
                    lines.append("dir(client.images): skipped (no images attribute)")
            except Exception as e:
                lines.append(f"dir(client.images): failed ({type(e).__name__}: {e})")
        else:
            lines.append("dir(client): skipped (no client)")
            lines.append("dir(client.images): skipped (no client)")
        lines.append("")
        lines.append("RUN_RESULT")
        lines.append("==========")
        lines.append("run/result surface: no network client constructed beyond from_profile();")
        lines.append("no run() invocation attempted (offline probe only).")
        if client is not None:
            try:
                names = sorted(dir(client))
                run_names = [n for n in names if any(k in n.lower() for k in ("run", "exec", "shell", "result"))]
                lines.append(f"client run-related names: {run_names}")
            except Exception as e:
                lines.append(f"client run-related names: failed ({type(e).__name__}: {e})")
        else:
            lines.append("client run-related names: skipped (no client)")
        lines.append("")
        lines.append("ADAPTATION")
        lines.append("==========")
        lines.append('Assumed baseline: images.use("ubuntu:latest")')
        lines.append("Assumed baseline: run(shell=..., tag=..., disposable=False)")
        lines.append("Assumed baseline: images.use(tag, strict=True)")
        lines.append("Rule: later work uses probed names when they differ from the assumed baseline.")
        here = Path(__file__).resolve()
        out = None
        for parent in [here.parent, *here.parents]:
            candidate = parent / "docs" / "sandbox-probe.txt"
            if (parent / "docs").exists() or parent.name != "sandbox":
                pass
            if (parent / "src" / "mergeready").exists() or (parent / "docs").exists():
                out = candidate
                break
        if out is None:
            out = Path.cwd() / "docs" / "sandbox-probe.txt"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print("probe written to docs/sandbox-probe.txt")
    except Exception as e:
        try:
            kind = type(e).__name__
            msg = traceback.format_exc(limit=5)
            here2 = Path(__file__).resolve()
            out2 = None
            for parent in [here2.parent, *here2.parents]:
                if (parent / "src" / "mergeready").exists() or (parent / "docs").exists():
                    out2 = parent / "docs" / "sandbox-probe.txt"
                    break
            if out2 is None:
                out2 = Path.cwd() / "docs" / "sandbox-probe.txt"
            out2.parent.mkdir(parents=True, exist_ok=True)
            out2.write_text(f"{{\"error\": \"{kind}\"}}\n{msg}\n", encoding="utf-8")
        except Exception:
            pass
        print("probe written to docs/sandbox-probe.txt")
        sys.exit(0)


if __name__ == "__main__":
    main()
