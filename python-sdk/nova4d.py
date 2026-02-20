"""Nova4D Python SDK.

Zero-dependency client for the Nova4D Cinema 4D bridge.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional


class Nova4DError(RuntimeError):
    """Raised on bridge communication failures."""


@dataclass
class Nova4D:
    host: str = "localhost"
    port: int = 30010
    timeout: int = 60
    api_key: Optional[str] = None

    @property
    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}/nova4d"

    def _request(self, method: str, route: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        body = None
        headers = {}
        if data is not None:
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
            headers["Content-Length"] = str(len(body))
        if self.api_key:
            headers["X-API-Key"] = self.api_key

        req = urllib.request.Request(
            f"{self.base_url}{route}",
            method=method,
            data=body,
            headers=headers,
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = resp.read()
                if not payload:
                    return {"status": "ok"}
                return json.loads(payload)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise Nova4DError(f"HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise Nova4DError(f"Connection failed: {exc.reason}") from exc
        except json.JSONDecodeError as exc:
            raise Nova4DError(f"Invalid JSON response: {exc}") from exc

    def _get(self, route: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        final_route = route
        if params:
            final_route = f"{route}?{urllib.parse.urlencode(params)}"
        return self._request("GET", final_route)

    def _post(self, route: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self._request("POST", route, data or {})

    def health(self) -> Dict[str, Any]:
        return self._get("/health")

    def stats(self) -> Dict[str, Any]:
        return self._get("/stats")

    def command_status(self, command_id: str) -> Dict[str, Any]:
        return self._get(f"/commands/{urllib.parse.quote(command_id)}")

    def queue_command(
        self,
        *,
        route: str,
        action: str,
        payload: Optional[Dict[str, Any]] = None,
        category: str = "custom",
        priority: int = 0,
    ) -> Dict[str, Any]:
        return self._post(
            "/command",
            {
                "route": route,
                "action": action,
                "category": category,
                "priority": priority,
                "payload": payload or {},
            },
        )

    def spawn_object(
        self,
        *,
        object_type: str = "cube",
        name: str = "Nova4D_Object",
        position: Optional[list[float]] = None,
        rotation: Optional[list[float]] = None,
        scale: Optional[list[float]] = None,
        parent_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "object_type": object_type,
            "name": name,
            "position": position or [0.0, 100.0, 0.0],
            "rotation": rotation or [0.0, 0.0, 0.0],
            "scale": scale or [1.0, 1.0, 1.0],
        }
        if parent_name:
            payload["parent_name"] = parent_name
        return self._post("/scene/spawn-object", payload)

    def set_transform(
        self,
        *,
        target_name: str,
        position: Optional[list[float]] = None,
        rotation: Optional[list[float]] = None,
        scale: Optional[list[float]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"target_name": target_name}
        if position is not None:
            payload["position"] = position
        if rotation is not None:
            payload["rotation"] = rotation
        if scale is not None:
            payload["scale"] = scale
        return self._post("/scene/set-transform", payload)

    def create_mograph_cloner(
        self,
        *,
        name: str = "Nova4D_Cloner",
        parent_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"name": name}
        if parent_name:
            payload["parent_name"] = parent_name
        return self._post("/mograph/cloner/create", payload)

    def create_redshift_material(self, *, name: str = "Nova4D_Redshift") -> Dict[str, Any]:
        return self._post("/material/create-redshift", {"name": name})

    def assign_material(self, *, material_name: str, target_name: str) -> Dict[str, Any]:
        return self._post(
            "/material/assign",
            {
                "material_name": material_name,
                "target_name": target_name,
            },
        )

    def set_key(self, *, target_name: str, parameter: str, frame: int, value: Any) -> Dict[str, Any]:
        return self._post(
            "/animation/set-key",
            {
                "target_name": target_name,
                "parameter": parameter,
                "frame": int(frame),
                "value": value,
            },
        )

    def render_redshift_frame(
        self,
        *,
        frame: int = 0,
        output_path: Optional[str] = None,
        camera_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "frame": int(frame),
            "engine": "redshift",
        }
        if output_path:
            payload["output_path"] = output_path
        if camera_name:
            payload["camera_name"] = camera_name
        return self._post("/render/queue/redshift", payload)

    def blender_import_gltf(
        self,
        *,
        file_path: str,
        scale_factor: float = 1.0,
        parent_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "file_path": file_path,
            "scale_fix": "blender_to_c4d",
            "scale_factor": float(scale_factor),
        }
        if parent_name:
            payload["parent_name"] = parent_name
        return self._post("/blender/import-gltf", payload)

    def batch_render(
        self,
        *,
        scene_file: Optional[str] = None,
        output_path: Optional[str] = None,
        timeout_sec: int = 1800,
        args: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"timeout_sec": int(timeout_sec)}
        if scene_file:
            payload["scene_file"] = scene_file
        if output_path:
            payload["output_path"] = output_path
        if args:
            payload["args"] = args
        return self._post("/batch/render", payload)

    def batch_job_status(self, job_id: str) -> Dict[str, Any]:
        return self._get(f"/batch/jobs/{urllib.parse.quote(job_id)}")

    def test_ping(self, message: str = "Nova4D Connected") -> Dict[str, Any]:
        return self._post("/test/ping", {"message": message})
