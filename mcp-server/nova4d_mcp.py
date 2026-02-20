#!/usr/bin/env python3
"""Nova4D MCP server."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

SDK_DIR = Path(__file__).resolve().parents[1] / "python-sdk"
if str(SDK_DIR) not in sys.path:
    sys.path.insert(0, str(SDK_DIR))

from nova4d import Nova4D, Nova4DError  # noqa: E402

try:
    from mcp.server.fastmcp import FastMCP
except Exception as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: mcp\n"
        "Install with: pip install mcp\n"
        f"Import error: {exc}"
    )

HOST = os.environ.get("NOVA4D_HOST", "localhost")
PORT = int(os.environ.get("NOVA4D_PORT", "30010"))
API_KEY = os.environ.get("NOVA4D_API_KEY")

mcp = FastMCP("nova4d")
client = Nova4D(host=HOST, port=PORT, api_key=API_KEY)


def _wrap(func):
    try:
        return func()
    except Nova4DError as exc:
        return {"status": "error", "error": str(exc)}
    except Exception as exc:  # pragma: no cover
        return {"status": "error", "error": f"Unexpected error: {exc}"}


@mcp.tool()
def c4d_health() -> Dict[str, Any]:
    """Check Nova4D bridge health."""
    return _wrap(client.health)


@mcp.tool()
def c4d_spawn_object(
    object_type: str = "cube",
    name: str = "MCPCube",
    x: float = 0.0,
    y: float = 100.0,
    z: float = 0.0,
) -> Dict[str, Any]:
    """Queue object spawn in Cinema 4D."""
    return _wrap(lambda: client.spawn_object(object_type=object_type, name=name, position=[x, y, z]))


@mcp.tool()
def c4d_set_transform(
    target_name: str,
    position: Optional[list[float]] = None,
    rotation: Optional[list[float]] = None,
    scale: Optional[list[float]] = None,
) -> Dict[str, Any]:
    """Queue transform update for an object."""
    return _wrap(
        lambda: client.set_transform(
            target_name=target_name,
            position=position,
            rotation=rotation,
            scale=scale,
        )
    )


@mcp.tool()
def c4d_create_mograph_cloner(name: str = "MCPCloner") -> Dict[str, Any]:
    """Queue MoGraph cloner creation."""
    return _wrap(lambda: client.create_mograph_cloner(name=name))


@mcp.tool()
def c4d_create_redshift_material(name: str = "MCPRedshift") -> Dict[str, Any]:
    """Queue Redshift material creation."""
    return _wrap(lambda: client.create_redshift_material(name=name))


@mcp.tool()
def c4d_assign_material(material_name: str, target_name: str) -> Dict[str, Any]:
    """Queue material assignment to object."""
    return _wrap(lambda: client.assign_material(material_name=material_name, target_name=target_name))


@mcp.tool()
def c4d_set_key(target_name: str, parameter: str, frame: int, value: Any) -> Dict[str, Any]:
    """Queue keyframe insertion command."""
    return _wrap(lambda: client.set_key(target_name=target_name, parameter=parameter, frame=frame, value=value))


@mcp.tool()
def c4d_render_redshift_frame(
    frame: int = 0,
    output_path: Optional[str] = None,
    camera_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Queue Redshift frame render."""
    return _wrap(
        lambda: client.render_redshift_frame(
            frame=frame,
            output_path=output_path,
            camera_name=camera_name,
        )
    )


@mcp.tool()
def c4d_blender_import_gltf(file_path: str, scale_factor: float = 1.0) -> Dict[str, Any]:
    """Queue Blender glTF import with scale fix."""
    return _wrap(lambda: client.blender_import_gltf(file_path=file_path, scale_factor=scale_factor))


@mcp.tool()
def c4d_batch_render(scene_file: Optional[str] = None, output_path: Optional[str] = None) -> Dict[str, Any]:
    """Launch immediate headless c4dpy render job."""
    return _wrap(lambda: client.batch_render(scene_file=scene_file, output_path=output_path))


@mcp.tool()
def c4d_command_status(command_id: str) -> Dict[str, Any]:
    """Get status of queued command."""
    return _wrap(lambda: client.command_status(command_id))


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
