import json
import os
import threading
import time
from collections import deque
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest

import c4d
from c4d import gui, plugins

try:
    import requests  # type: ignore
except Exception:  # pragma: no cover
    requests = None

# Defaults are local-development IDs from the Nova4D setup scripts.
# Override via env vars for your official PluginCafe IDs when distributing.
PLUGIN_ID_COMMAND = int(os.environ.get("NOVA4D_PLUGIN_ID_COMMAND", "1234567"))
PLUGIN_ID_MESSAGE = int(os.environ.get("NOVA4D_PLUGIN_ID_MESSAGE", "1234568"))
PLUGIN_NAME = "Nova4D - OpenClaw Bridge"
SPECIAL_EVENT_ID = int(os.environ.get("NOVA4D_SPECIAL_EVENT_ID", "1234569"))

BRIDGE_HOST = os.environ.get("NOVA4D_HOST", "127.0.0.1")
BRIDGE_PORT = int(os.environ.get("NOVA4D_PORT", "30010"))
BRIDGE_API_KEY = os.environ.get("NOVA4D_API_KEY", "")
POLL_INTERVAL_SEC = float(os.environ.get("NOVA4D_POLL_SEC", "1.0"))
CLIENT_ID = os.environ.get("NOVA4D_CLIENT_ID", "cinema4d-live")

NOVA4D_XPRESSO_META_ID = 1064123001


class BridgeClient:
    def __init__(self):
        self.base_url = f"http://{BRIDGE_HOST}:{BRIDGE_PORT}"

    def _headers(self):
        headers = {"Content-Type": "application/json", "X-Client-Id": CLIENT_ID}
        if BRIDGE_API_KEY:
            headers["X-API-Key"] = BRIDGE_API_KEY
        return headers

    def _request(self, method, route, payload=None, timeout=10):
        url = f"{self.base_url}{route}"
        if requests is not None:
            response = requests.request(method, url, headers=self._headers(), json=payload, timeout=timeout)
            response.raise_for_status()
            if not response.text:
                return {"status": "ok"}
            return response.json()

        body = None
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
        req = urlrequest.Request(url, method=method, data=body, headers=self._headers())
        try:
            with urlrequest.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                if not raw:
                    return {"status": "ok"}
                return json.loads(raw)
        except urlerror.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code}: {detail}")

    def poll_commands(self, limit=25):
        query = urlparse.urlencode({"client_id": CLIENT_ID, "limit": limit})
        return self._request("GET", f"/nova4d/commands?{query}", None, timeout=15)

    def post_result(self, command_id, ok, result=None, err=None):
        payload = {
            "command_id": command_id,
            "status": "ok" if ok else "error",
            "ok": bool(ok),
            "result": result if ok else None,
            "error": None if ok else (err or "unknown error"),
        }
        return self._request("POST", "/nova4d/results", payload, timeout=15)


def _warn_plugin_id_state():
    ids = {PLUGIN_ID_COMMAND, PLUGIN_ID_MESSAGE, SPECIAL_EVENT_ID}
    if len(ids) != 3:
        print("[Nova4D] WARNING: plugin IDs must be unique.")


def _vector(values, fallback=(0.0, 0.0, 0.0)):
    if not isinstance(values, (list, tuple)) or len(values) < 3:
        values = fallback
    return c4d.Vector(float(values[0]), float(values[1]), float(values[2]))


def _rot_vector_deg(values):
    v = _vector(values)
    return c4d.Vector(c4d.utils.DegToRad(v.x), c4d.utils.DegToRad(v.y), c4d.utils.DegToRad(v.z))


def _iter_objects(root):
    while root:
        yield root
        for child in _iter_objects(root.GetDown()):
            yield child
        root = root.GetNext()


def _find_object_by_path(doc, target_path):
    if not target_path:
        return None
    parts = [part for part in str(target_path).replace("\\", "/").split("/") if part]
    if not parts:
        return None

    current = doc.GetFirstObject()
    if current is None:
        return None

    while current and current.GetName() != parts[0]:
        current = current.GetNext()
    if current is None:
        return None

    for part in parts[1:]:
        child = current.GetDown()
        while child and child.GetName() != part:
            child = child.GetNext()
        if child is None:
            return None
        current = child
    return current


def _find_object(doc, payload):
    target_path = payload.get("target_path")
    if target_path:
        found = _find_object_by_path(doc, target_path)
        if found:
            return found

    target_name = payload.get("target_name") or payload.get("name")
    if target_name:
        for obj in _iter_objects(doc.GetFirstObject()):
            if obj.GetName() == target_name:
                return obj
    return None


def _find_material(doc, name):
    if not name:
        return None
    material = doc.GetFirstMaterial()
    while material:
        if material.GetName() == name:
            return material
        material = material.GetNext()
    return None


def _insert_object(doc, obj, parent_name=None):
    if parent_name:
        parent = _find_object(doc, {"target_name": parent_name})
        if parent:
            obj.InsertUnder(parent)
            return
    doc.InsertObject(obj)


def _spawn_object(doc, payload):
    object_type = str(payload.get("object_type") or payload.get("class_name") or payload.get("type") or "cube").lower()
    object_map = {
        "cube": c4d.Ocube,
        "sphere": c4d.Osphere,
        "null": c4d.Onull,
        "cylinder": c4d.Ocylinder,
        "plane": c4d.Oplane,
        "torus": c4d.Otorus,
    }
    object_id = object_map.get(object_type, c4d.Ocube)
    obj = c4d.BaseObject(object_id)
    obj.SetName(str(payload.get("name") or f"Nova4D_{object_type}"))
    obj.SetAbsPos(_vector(payload.get("position"), (0.0, 100.0, 0.0)))
    obj.SetAbsRot(_rot_vector_deg(payload.get("rotation")))
    obj.SetAbsScale(_vector(payload.get("scale"), (1.0, 1.0, 1.0)))

    use_color = payload.get("use_color")
    color = payload.get("color")
    if use_color is not None:
        obj[c4d.ID_BASEOBJECT_USECOLOR] = int(use_color)
    if isinstance(color, (list, tuple)) and len(color) >= 3:
        obj[c4d.ID_BASEOBJECT_COLOR] = c4d.Vector(float(color[0]), float(color[1]), float(color[2]))

    _insert_object(doc, obj, payload.get("parent_name"))
    return {"object": obj.GetName(), "type": object_type}


def _set_transform(doc, payload):
    obj = _find_object(doc, payload)
    if not obj:
        raise RuntimeError("target object not found")
    if "position" in payload:
        obj.SetAbsPos(_vector(payload.get("position")))
    if "rotation" in payload:
        obj.SetAbsRot(_rot_vector_deg(payload.get("rotation")))
    if "scale" in payload:
        obj.SetAbsScale(_vector(payload.get("scale"), (1.0, 1.0, 1.0)))
    return {"updated": obj.GetName()}


def _set_property(doc, payload):
    obj = _find_object(doc, payload)
    if not obj:
        raise RuntimeError("target object not found")

    prop = payload.get("property") or payload.get("property_name")
    value = payload.get("value")
    if not prop:
        raise RuntimeError("property is required")

    if prop == "name":
        obj.SetName(str(value))
    elif prop == "position":
        obj.SetAbsPos(_vector(value))
    elif prop == "rotation":
        obj.SetAbsRot(_rot_vector_deg(value))
    elif prop == "scale":
        obj.SetAbsScale(_vector(value, (1.0, 1.0, 1.0)))
    elif str(prop).isdigit():
        obj[int(prop)] = value
    else:
        raise RuntimeError(f"unsupported property mapping: {prop}")

    return {"target": obj.GetName(), "property": prop}


def _set_visibility(doc, payload):
    obj = _find_object(doc, payload)
    if not obj:
        raise RuntimeError("target object not found")
    if "editor" in payload:
        obj[c4d.ID_BASEOBJECT_VISIBILITY_EDITOR] = int(payload.get("editor"))
    if "render" in payload:
        obj[c4d.ID_BASEOBJECT_VISIBILITY_RENDER] = int(payload.get("render"))
    return {"target": obj.GetName()}


def _set_color(doc, payload):
    obj = _find_object(doc, payload)
    if not obj:
        raise RuntimeError("target object not found")
    color = payload.get("color")
    if not isinstance(color, (list, tuple)) or len(color) < 3:
        raise RuntimeError("color must be [r,g,b]")
    obj[c4d.ID_BASEOBJECT_USECOLOR] = 2
    obj[c4d.ID_BASEOBJECT_COLOR] = c4d.Vector(float(color[0]), float(color[1]), float(color[2]))
    return {"target": obj.GetName()}


def _delete_object(doc, payload):
    obj = _find_object(doc, payload)
    if not obj:
        raise RuntimeError("target object not found")
    name = obj.GetName()
    obj.Remove()
    return {"deleted": name}


def _duplicate_object(doc, payload):
    obj = _find_object(doc, payload)
    if not obj:
        raise RuntimeError("target object not found")
    clone = obj.GetClone(c4d.COPYFLAGS_0)
    if not clone:
        raise RuntimeError("clone failed")
    clone_name = payload.get("new_name") or f"{obj.GetName()}_Copy"
    clone.SetName(str(clone_name))
    _insert_object(doc, clone, payload.get("parent_name"))
    return {"duplicate": clone.GetName()}


def _group_objects(doc, payload):
    names = payload.get("object_names") or []
    if not isinstance(names, list) or not names:
        raise RuntimeError("object_names[] is required")
    group = c4d.BaseObject(c4d.Onull)
    group.SetName(str(payload.get("group_name") or "Nova4D_Group"))
    doc.InsertObject(group)

    moved = []
    for name in names:
        obj = _find_object(doc, {"target_name": str(name)})
        if obj:
            obj.InsertUnder(group)
            moved.append(obj.GetName())

    return {"group": group.GetName(), "members": moved}


def _parent_object(doc, payload):
    child = _find_object(doc, {"target_name": payload.get("child_name")})
    parent = _find_object(doc, {"target_name": payload.get("parent_name")})
    if not child or not parent:
        raise RuntimeError("child_name and parent_name must exist")
    child.InsertUnder(parent)
    return {"child": child.GetName(), "parent": parent.GetName()}


def _rename_object(doc, payload):
    obj = _find_object(doc, payload)
    if not obj:
        raise RuntimeError("target object not found")
    new_name = payload.get("new_name")
    if not new_name:
        raise RuntimeError("new_name is required")
    old_name = obj.GetName()
    obj.SetName(str(new_name))
    return {"from": old_name, "to": obj.GetName()}


def _select_object(doc, payload):
    obj = _find_object(doc, payload)
    if not obj:
        raise RuntimeError("target object not found")
    doc.SetActiveObject(obj, c4d.SELECTION_NEW)
    return {"selected": obj.GetName()}


def _clear_selection(doc, _payload):
    doc.SetSelection(c4d.SELECTION_NEW)
    return {"selection": "cleared"}


def _create_standard_material(doc, payload):
    material = c4d.BaseMaterial(c4d.Mmaterial)
    material.SetName(str(payload.get("name") or "Nova4D_Standard"))
    color = payload.get("color")
    if isinstance(color, (list, tuple)) and len(color) >= 3:
        material[c4d.MATERIAL_COLOR_COLOR] = c4d.Vector(float(color[0]), float(color[1]), float(color[2]))
    doc.InsertMaterial(material)
    return {"material": material.GetName(), "type": "standard"}


def _create_renderer_material(doc, payload, renderer_name):
    renderer_key = str(renderer_name).lower()
    renderer_defaults = {
        "redshift": [1036224],
        "arnold": [1033991],
    }

    candidate_ids = []
    env_key = f"NOVA4D_{renderer_key.upper()}_MATERIAL_ID"
    env_value = os.environ.get(env_key, "").strip()
    if env_value.isdigit():
        candidate_ids.append(int(env_value))
    candidate_ids.extend(renderer_defaults.get(renderer_key, []))

    material = None
    material_type_id = int(c4d.Mmaterial)
    for candidate_id in candidate_ids:
        try:
            material = c4d.BaseMaterial(int(candidate_id))
            if material:
                material_type_id = int(candidate_id)
                break
        except Exception:
            continue

    if not material:
        material = c4d.BaseMaterial(c4d.Mmaterial)

    material.SetName(str(payload.get("name") or f"Nova4D_{renderer_name}"))
    doc.InsertMaterial(material)
    material.Message(c4d.MSG_UPDATE)
    return {
        "material": material.GetName(),
        "renderer": renderer_name,
        "material_type_id": int(material.GetType()) if material else material_type_id,
        "fallback_standard": material.GetType() == c4d.Mmaterial,
    }


def _assign_material(doc, payload):
    target = _find_object(doc, {"target_name": payload.get("target_name") or payload.get("object_name")})
    material = _find_material(doc, payload.get("material_name"))
    if not target or not material:
        raise RuntimeError("target object and material_name must exist")

    tag = c4d.TextureTag()
    tag.SetMaterial(material)
    target.InsertTag(tag)
    return {"target": target.GetName(), "material": material.GetName()}


def _set_material_parameter(doc, payload):
    material = _find_material(doc, payload.get("material_name"))
    if not material:
        raise RuntimeError("material not found")
    parameter = payload.get("parameter")
    value = payload.get("value")
    if parameter == "color":
        material[c4d.MATERIAL_COLOR_COLOR] = _vector(value, (1.0, 1.0, 1.0))
    elif str(parameter).isdigit():
        material[int(parameter)] = value
    else:
        raise RuntimeError("unsupported material parameter")
    material.Message(c4d.MSG_UPDATE)
    return {"material": material.GetName(), "parameter": parameter}


def _set_material_texture(doc, payload):
    material = _find_material(doc, payload.get("material_name"))
    texture_path = payload.get("texture_path")
    if not material or not texture_path:
        raise RuntimeError("material_name and texture_path required")

    shader = c4d.BaseShader(c4d.Xbitmap)
    shader[c4d.BITMAPSHADER_FILENAME] = str(texture_path)
    material.InsertShader(shader)
    material[c4d.MATERIAL_COLOR_SHADER] = shader
    material[c4d.MATERIAL_USE_COLOR] = True
    material.Message(c4d.MSG_UPDATE)
    return {"material": material.GetName(), "texture": texture_path}


def _create_mograph_object(doc, payload, object_id, default_name):
    obj = c4d.BaseObject(object_id)
    if not obj:
        raise RuntimeError("failed to create mograph object")
    obj.SetName(str(payload.get("name") or default_name))
    _insert_object(doc, obj, payload.get("parent_name"))
    return {"object": obj.GetName(), "type_id": object_id}


def _create_cloner(doc, payload):
    object_id = getattr(c4d, "Omgcloner", 1018544)
    return _create_mograph_object(doc, payload, object_id, "Nova4D_Cloner")


def _create_matrix(doc, payload):
    object_id = getattr(c4d, "Omgmatrix", 1018545)
    return _create_mograph_object(doc, payload, object_id, "Nova4D_Matrix")


def _create_random_effector(doc, payload):
    object_id = getattr(c4d, "Omgplain", 1018643)
    return _create_mograph_object(doc, payload, object_id, "Nova4D_RandomEffector")


def _create_plain_effector(doc, payload):
    object_id = getattr(c4d, "Omgplain", 1021337)
    return _create_mograph_object(doc, payload, object_id, "Nova4D_PlainEffector")


def _create_step_effector(doc, payload):
    object_id = getattr(c4d, "Omgstep", 1018933)
    return _create_mograph_object(doc, payload, object_id, "Nova4D_StepEffector")


def _assign_effector(_doc, payload):
    # MoGraph list APIs vary by version; this command is accepted as metadata for custom scripts.
    return {
        "status": "accepted",
        "cloner_name": payload.get("cloner_name"),
        "effector_name": payload.get("effector_name"),
        "note": "assign-effector is queued; implement custom ID mapping for specific C4D build",
    }


def _require_parameter_id(payload):
    parameter_id = payload.get("parameter_id")
    if parameter_id is None:
        raise RuntimeError("parameter_id is required for this action")
    return int(parameter_id)


def _set_cloner_count(doc, payload):
    cloner = _find_object(doc, {"target_name": payload.get("cloner_name") or payload.get("target_name")})
    if not cloner:
        raise RuntimeError("cloner_name or target_name must reference an existing object")
    count = int(payload.get("count", 0))
    parameter_id = _require_parameter_id(payload)
    cloner[parameter_id] = count
    return {"cloner": cloner.GetName(), "parameter_id": parameter_id, "count": count}


def _set_cloner_mode(doc, payload):
    cloner = _find_object(doc, {"target_name": payload.get("cloner_name") or payload.get("target_name")})
    if not cloner:
        raise RuntimeError("cloner_name or target_name must reference an existing object")
    mode = payload.get("mode")
    if mode is None:
        raise RuntimeError("mode is required")
    parameter_id = _require_parameter_id(payload)
    cloner[parameter_id] = int(mode)
    return {"cloner": cloner.GetName(), "parameter_id": parameter_id, "mode": int(mode)}


def _desc_for_parameter(parameter):
    if parameter is None:
        raise RuntimeError("parameter is required")
    param = str(parameter).lower().strip()

    vector_roots = {
        "position": c4d.ID_BASEOBJECT_REL_POSITION,
        "rotation": c4d.ID_BASEOBJECT_REL_ROTATION,
        "scale": c4d.ID_BASEOBJECT_REL_SCALE,
    }
    axis_map = {"x": c4d.VECTOR_X, "y": c4d.VECTOR_Y, "z": c4d.VECTOR_Z}

    if "." in param:
        root, axis = param.split(".", 1)
        if root in vector_roots and axis in axis_map:
            desc = c4d.DescID(
                c4d.DescLevel(vector_roots[root], c4d.DTYPE_VECTOR, 0),
                c4d.DescLevel(axis_map[axis], c4d.DTYPE_REAL, 0),
            )
            is_rotation = root == "rotation"
            return desc, is_rotation

    if str(parameter).isdigit():
        desc = c4d.DescID(c4d.DescLevel(int(parameter), c4d.DTYPE_REAL, 0))
        return desc, False

    raise RuntimeError(f"unsupported keyable parameter: {parameter}")


def _coerce_key_value(raw_value, is_rotation):
    value = float(raw_value)
    if is_rotation:
        value = c4d.utils.DegToRad(value)
    return value


def _set_key(doc, payload):
    obj = _find_object(doc, payload)
    if not obj:
        raise RuntimeError("target object not found")

    parameter = payload.get("parameter")
    value = payload.get("value")
    frame = int(payload.get("frame", doc.GetTime().GetFrame(doc.GetFps())))
    fps = doc.GetFps()

    if parameter in {"position", "rotation", "scale"} and isinstance(value, (list, tuple)) and len(value) >= 3:
        out = {}
        for axis, axis_value in zip(("x", "y", "z"), value[:3]):
            child_payload = dict(payload)
            child_payload["parameter"] = f"{parameter}.{axis}"
            child_payload["value"] = axis_value
            out[axis] = _set_key(doc, child_payload)
        return {"target": obj.GetName(), "parameter": parameter, "components": out}

    desc_id, is_rotation = _desc_for_parameter(parameter)
    track = obj.FindCTrack(desc_id)
    if track is None:
        track = c4d.CTrack(obj, desc_id)
        obj.InsertTrackSorted(track)

    curve = track.GetCurve()
    if curve is None:
        raise RuntimeError("failed to create/find curve")

    key_data = curve.AddKey(c4d.BaseTime(frame, fps))
    key = key_data["key"] if isinstance(key_data, dict) else key_data
    if key is None:
        raise RuntimeError("failed to create key")
    key.SetValue(curve, _coerce_key_value(value, is_rotation))

    interpolation = str(payload.get("interpolation", "")).lower()
    interp_map = {
        "step": c4d.CINTERPOLATION_STEP,
        "linear": c4d.CINTERPOLATION_LINEAR,
        "spline": c4d.CINTERPOLATION_SPLINE,
    }
    if interpolation in interp_map:
        key.SetInterpolation(curve, interp_map[interpolation])

    return {"target": obj.GetName(), "parameter": parameter, "frame": frame}


def _delete_key(doc, payload):
    obj = _find_object(doc, payload)
    if not obj:
        raise RuntimeError("target object not found")

    parameter = payload.get("parameter")
    frame = int(payload.get("frame", doc.GetTime().GetFrame(doc.GetFps())))
    desc_id, _ = _desc_for_parameter(parameter)
    track = obj.FindCTrack(desc_id)
    if track is None:
        raise RuntimeError("track not found for parameter")

    curve = track.GetCurve()
    if curve is None:
        raise RuntimeError("curve not found for parameter")

    deleted = 0
    for index in range(curve.GetKeyCount() - 1, -1, -1):
        key = curve.GetKey(index)
        if key.GetTime().GetFrame(doc.GetFps()) == frame:
            curve.DelKey(index)
            deleted += 1

    if deleted == 0:
        raise RuntimeError(f"no key found at frame {frame}")

    return {"target": obj.GetName(), "parameter": parameter, "frame": frame, "deleted": deleted}


def _find_xpresso_tag(obj):
    if not obj:
        return None
    return obj.GetTag(getattr(c4d, "Texpresso", 1018062))


def _ensure_xpresso_tag(doc, payload):
    obj = _find_object(doc, payload) or doc.GetActiveObject()
    if not obj:
        raise RuntimeError("target object not found and no active object")

    tag = _find_xpresso_tag(obj)
    created = False
    if tag is None:
        tag_id = getattr(c4d, "Texpresso", 1018062)
        tag = c4d.BaseTag(tag_id)
        if not tag:
            raise RuntimeError("failed to create XPresso tag")
        if payload.get("name"):
            tag.SetName(str(payload.get("name")))
        obj.InsertTag(tag)
        created = True
    elif payload.get("name"):
        tag.SetName(str(payload.get("name")))

    return obj, tag, created


def _xpresso_meta_load(tag):
    bc = tag.GetDataInstance()
    raw = ""
    if bc is not None:
        try:
            raw = bc.GetString(NOVA4D_XPRESSO_META_ID)
        except Exception:
            raw = ""
    if not raw:
        return {"nodes": {}, "connections": []}
    try:
        data = json.loads(raw)
    except Exception:
        data = {"nodes": {}, "connections": []}
    data.setdefault("nodes", {})
    data.setdefault("connections", [])
    return data


def _xpresso_meta_save(tag, data):
    bc = tag.GetDataInstance()
    if bc is None:
        return
    bc.SetString(NOVA4D_XPRESSO_META_ID, json.dumps(data))


def _iter_gv_nodes(parent):
    if parent is None:
        return
    node = parent.GetDown()
    while node:
        yield node
        for child in _iter_gv_nodes(node):
            yield child
        node = node.GetNext()


def _graph_master_for_tag(tag):
    try:
        return tag.GetNodeMaster()
    except Exception:
        return None


def _find_graph_node_by_name(node_master, node_name):
    if not node_master or not node_name:
        return None
    root = node_master.GetRoot()
    if root is None:
        return None
    needle = str(node_name).strip().lower()
    for node in _iter_gv_nodes(root):
        if str(node.GetName()).strip().lower() == needle:
            return node
    return None


def _xpresso_operator_id(node_type):
    if isinstance(node_type, (int, float)):
        return int(node_type)
    if str(node_type).isdigit():
        return int(node_type)

    key = str(node_type or "object").strip().lower()
    mapping = {
        "object": getattr(c4d, "ID_OPERATOR_OBJECT", 400001000),
        "time": getattr(c4d, "ID_OPERATOR_TIME", 400001107),
        "const": getattr(c4d, "ID_OPERATOR_CONST", 400001120),
        "constant": getattr(c4d, "ID_OPERATOR_CONST", 400001120),
        "result": getattr(c4d, "ID_OPERATOR_RESULT", 400001118),
        "math": getattr(c4d, "ID_OPERATOR_MATH", 400001121),
    }
    return int(mapping.get(key, mapping["object"]))


def _normalize_port_label(value):
    if value is None:
        return ""
    return str(value).strip().lower().replace(" ", "").replace("_", "")


def _resolve_port_id(value, direction, node_type):
    if isinstance(value, (int, float)):
        return int(value)
    if str(value).isdigit():
        return int(value)

    label = _normalize_port_label(value)
    node = str(node_type or "").strip().lower()
    if not label:
        return None

    if node == "time" and direction == "output":
        time_map = {
            "time": getattr(c4d, "GV_TIME_OPERATOR_OUTPUT_TIME", 1000),
            "seconds": getattr(c4d, "GV_TIME_OPERATOR_OUTPUT_REAL", 1001),
            "frame": getattr(c4d, "GV_TIME_OPERATOR_OUTPUT_FRAME", 1002),
            "fps": getattr(c4d, "GV_TIME_OPERATOR_OUTPUT_FPS", 1003),
            "start": getattr(c4d, "GV_TIME_OPERATOR_OUTPUT_START", 1004),
            "end": getattr(c4d, "GV_TIME_OPERATOR_OUTPUT_END", 1005),
            "delta": getattr(c4d, "GV_TIME_OPERATOR_OUTPUT_DELTA", 1008),
        }
        return int(time_map.get(label)) if label in time_map else None

    if node in {"const", "constant"} and direction == "output":
        if label in {"output", "value"}:
            return int(getattr(c4d, "GV_CONST_OUTPUT", 3000))

    if node == "result" and direction == "input":
        if label in {"input", "value"}:
            return int(getattr(c4d, "GV_RESULT_INPUT", 2000))
    if node == "result" and direction == "output":
        if label in {"output", "value"}:
            return int(getattr(c4d, "GV_RESULT_OUTPUT", 3000))

    if node == "object":
        object_map = {
            "local": getattr(c4d, "GV_OBJECT_OPERATOR_LOCAL_IN", 30000000) if direction == "input" else getattr(c4d, "GV_OBJECT_OPERATOR_LOCAL_OUT", 40000000),
            "global": getattr(c4d, "GV_OBJECT_OPERATOR_GLOBAL_IN", 30000001) if direction == "input" else getattr(c4d, "GV_OBJECT_OPERATOR_GLOBAL_OUT", 40000001),
            "object": getattr(c4d, "GV_OBJECT_OPERATOR_OBJECT_IN", 30000003) if direction == "input" else getattr(c4d, "GV_OBJECT_OPERATOR_OBJECT_OUT", 40000002),
        }
        if label in object_map:
            return int(object_map[label])

    return None


def _object_from_xpresso_node_meta(doc, meta_row):
    if not isinstance(meta_row, dict):
        return None
    target_path = meta_row.get("target_path")
    if target_path:
        obj = _find_object_by_path(doc, target_path)
        if obj:
            return obj
    target_name = meta_row.get("target_name")
    if target_name:
        return _find_object(doc, {"target_name": target_name})
    return None


def _find_graph_port_by_main_id(node, direction, main_id):
    if node is None:
        return None
    main_id = int(main_id)

    try:
        if direction == "output":
            count_fn = getattr(node, "GetOutPortCount", None)
            port_fn = getattr(node, "GetOutPort", None)
        else:
            count_fn = getattr(node, "GetInPortCount", None)
            port_fn = getattr(node, "GetInPort", None)
        if not callable(count_fn) or not callable(port_fn):
            return None
        count = int(count_fn())
    except Exception:
        return None

    for index in range(max(0, count)):
        try:
            port = port_fn(index)
        except Exception:
            continue
        if not port:
            continue
        get_main_id = getattr(port, "GetMainID", None)
        if not callable(get_main_id):
            continue
        try:
            if int(get_main_id()) == main_id:
                return port
        except Exception:
            continue
    return None


def _apply_parameter_to_object(obj, parameter, raw_value):
    if obj is None:
        raise RuntimeError("target object not found")
    if parameter is None:
        raise RuntimeError("parameter is required")

    param = str(parameter).strip().lower().replace(" ", "")
    if param.startswith("position"):
        axis = param.split(".")[-1] if "." in param else "x"
        vec = obj.GetAbsPos()
        value = float(raw_value)
        if axis == "x":
            vec.x = value
        elif axis == "y":
            vec.y = value
        elif axis == "z":
            vec.z = value
        else:
            raise RuntimeError(f"unsupported position axis: {axis}")
        obj.SetAbsPos(vec)
        return {"target": obj.GetName(), "parameter": parameter, "value": value}

    if param.startswith("rotation"):
        axis = param.split(".")[-1] if "." in param else "x"
        vec = obj.GetAbsRot()
        value_deg = float(raw_value)
        value_rad = c4d.utils.DegToRad(value_deg)
        if axis == "x":
            vec.x = value_rad
        elif axis == "y":
            vec.y = value_rad
        elif axis == "z":
            vec.z = value_rad
        else:
            raise RuntimeError(f"unsupported rotation axis: {axis}")
        obj.SetAbsRot(vec)
        return {"target": obj.GetName(), "parameter": parameter, "value_deg": value_deg}

    if param.startswith("scale"):
        axis = param.split(".")[-1] if "." in param else "x"
        vec = obj.GetAbsScale()
        value = float(raw_value)
        if axis == "x":
            vec.x = value
        elif axis == "y":
            vec.y = value
        elif axis == "z":
            vec.z = value
        else:
            raise RuntimeError(f"unsupported scale axis: {axis}")
        obj.SetAbsScale(vec)
        return {"target": obj.GetName(), "parameter": parameter, "value": value}

    if str(parameter).isdigit():
        obj[int(parameter)] = raw_value
        return {"target": obj.GetName(), "parameter": int(parameter), "value": raw_value}

    raise RuntimeError(f"unsupported XPresso parameter: {parameter}")


def _create_xpresso_tag(doc, payload):
    obj, _tag, created = _ensure_xpresso_tag(doc, payload)
    return {"target": obj.GetName(), "tag_type": "xpresso", "created": bool(created)}


def _add_xpresso_node(doc, payload):
    obj, tag, _ = _ensure_xpresso_tag(doc, payload)
    node_type = payload.get("node_type") or "object"
    node_name = str(payload.get("node_name") or payload.get("name") or f"{str(node_type).title()}Node")

    meta = _xpresso_meta_load(tag)
    target_obj = None
    if str(node_type).strip().lower() == "object":
        target_obj = _find_object(doc, {"target_name": payload.get("object_name")}) or _find_object(doc, payload) or obj

    meta["nodes"][node_name] = {
        "node_type": str(node_type),
        "target_name": target_obj.GetName() if target_obj else None,
        "target_path": _object_path(target_obj) if target_obj else None,
    }

    graph_node_created = False
    graph_error = None
    node_master = _graph_master_for_tag(tag)
    if node_master:
        try:
            root = node_master.GetRoot()
            if root:
                graph_node = node_master.CreateNode(root, _xpresso_operator_id(node_type), None, -1, -1)
                if graph_node:
                    graph_node.SetName(node_name)
                    if target_obj and str(node_type).strip().lower() == "object":
                        graph_node[getattr(c4d, "GV_OBJECT_OBJECT_ID", 1000)] = target_obj
                    graph_node_created = True
        except Exception as exc:
            graph_error = str(exc)

    _xpresso_meta_save(tag, meta)
    out = {
        "target": obj.GetName(),
        "node_name": node_name,
        "node_type": str(node_type),
        "graph_node_created": graph_node_created,
    }
    if graph_error:
        out["graph_error"] = graph_error
    return out


def _connect_xpresso_ports(doc, payload):
    obj, tag, _ = _ensure_xpresso_tag(doc, payload)
    from_node = str(payload.get("from_node") or "").strip()
    to_node = str(payload.get("to_node") or "").strip()
    if not from_node or not to_node:
        raise RuntimeError("from_node and to_node are required")

    from_port = payload.get("from_port")
    to_port = payload.get("to_port")

    meta = _xpresso_meta_load(tag)
    meta["connections"].append({
        "from_node": from_node,
        "from_port": from_port,
        "to_node": to_node,
        "to_port": to_port,
    })
    _xpresso_meta_save(tag, meta)

    graph_connected = False
    graph_error = None
    node_master = _graph_master_for_tag(tag)
    if node_master:
        try:
            source_node = _find_graph_node_by_name(node_master, from_node)
            dest_node = _find_graph_node_by_name(node_master, to_node)
            if source_node and dest_node:
                source_type = meta.get("nodes", {}).get(from_node, {}).get("node_type", "")
                dest_type = meta.get("nodes", {}).get(to_node, {}).get("node_type", "")
                source_port_id = _resolve_port_id(payload.get("from_port_id", from_port), "output", source_type)
                dest_port_id = _resolve_port_id(payload.get("to_port_id", to_port), "input", dest_type)
                if source_port_id is not None and dest_port_id is not None:
                    source_port = _find_graph_port_by_main_id(source_node, "output", int(source_port_id))
                    if source_port is None:
                        source_port = source_node.AddPort(getattr(c4d, "GV_PORT_OUTPUT", 2), int(source_port_id))
                    dest_port = _find_graph_port_by_main_id(dest_node, "input", int(dest_port_id))
                    if dest_port is None:
                        dest_port = dest_node.AddPort(getattr(c4d, "GV_PORT_INPUT", 1), int(dest_port_id))
                    if source_port and dest_port:
                        result_port = source_node.AddConnection(source_node, source_port, dest_node, dest_port)
                        graph_connected = result_port is not None
        except Exception as exc:
            graph_error = str(exc)

    out = {
        "target": obj.GetName(),
        "from_node": from_node,
        "from_port": from_port,
        "to_node": to_node,
        "to_port": to_port,
        "graph_connected": graph_connected,
    }
    if graph_error:
        out["graph_error"] = graph_error
    return out


def _set_xpresso_parameter(doc, payload):
    obj, tag, _ = _ensure_xpresso_tag(doc, payload)
    node_name = str(payload.get("node_name") or "").strip()
    parameter = payload.get("parameter")
    value = payload.get("value")
    if value is None:
        raise RuntimeError("value is required")

    meta = _xpresso_meta_load(tag)
    node_meta = meta.get("nodes", {}).get(node_name, {}) if node_name else {}
    target = _object_from_xpresso_node_meta(doc, node_meta) or _find_object(doc, payload) or obj
    applied = _apply_parameter_to_object(target, parameter, value)

    graph_updated = False
    graph_error = None
    node_master = _graph_master_for_tag(tag)
    if node_master and node_name:
        try:
            graph_node = _find_graph_node_by_name(node_master, node_name)
            if graph_node and str(node_meta.get("node_type", "")).lower() in {"const", "constant"}:
                graph_node[getattr(c4d, "GV_CONST_VALUE", 1000)] = float(value)
                graph_updated = True
        except Exception as exc:
            graph_error = str(exc)

    out = {
        "target": obj.GetName(),
        "node_name": node_name or None,
        "applied": applied,
        "graph_updated": graph_updated,
    }
    if graph_error:
        out["graph_error"] = graph_error
    return out


def _set_camera(doc, payload):
    base_draw = doc.GetActiveBaseDraw()
    if base_draw is None:
        raise RuntimeError("no active viewport")

    camera_name = payload.get("camera_name") or payload.get("target_name") or payload.get("name")
    if not camera_name:
        raise RuntimeError("camera_name or target_name is required")

    camera = _find_object(doc, {"target_name": camera_name})
    if camera is None:
        raise RuntimeError("camera not found")
    base_draw.SetSceneCamera(camera)
    return {"camera": camera.GetName()}


def _focus_object(doc, payload):
    target = _find_object(doc, payload)
    if target:
        doc.SetActiveObject(target, c4d.SELECTION_NEW)
    c4d.CallCommand(12148)  # Frame Selected
    return {"focused": target.GetName() if target else "selection"}


def _set_display_mode(doc, payload):
    base_draw = doc.GetActiveBaseDraw()
    if base_draw is None:
        raise RuntimeError("no active viewport")

    mode = payload.get("mode")
    if mode is None:
        mode = payload.get("display_mode")
    if mode is None:
        raise RuntimeError("mode is required")

    if isinstance(mode, str):
        mode_map = {
            "gouraud": getattr(c4d, "BASEDRAW_DISPLAYMODE_GOURAUDSHADING", 8),
            "quick": getattr(c4d, "BASEDRAW_DISPLAYMODE_QUICKSHADING", 6),
            "wireframe": getattr(c4d, "BASEDRAW_DISPLAYMODE_WIREFRAME", 1),
            "hiddenline": getattr(c4d, "BASEDRAW_DISPLAYMODE_HIDDENLINE", 4),
        }
        mapped = mode_map.get(mode.lower())
        if mapped is None:
            raise RuntimeError(f"unsupported display mode: {mode}")
        mode = mapped
    base_draw[c4d.BASEDRAW_DISPLAYMODE] = int(mode)
    return {"display_mode": int(mode)}


def _default_output_path(file_name):
    export_dir = os.environ.get("NOVA4D_EXPORT_DIR", "/tmp/nova4d-exports")
    os.makedirs(export_dir, exist_ok=True)
    return os.path.join(export_dir, file_name)


def _save_bitmap(bitmap, output_path):
    ext = os.path.splitext(output_path)[1].lower()
    filter_map = {
        ".png": getattr(c4d, "FILTER_PNG", 1023671),
        ".jpg": getattr(c4d, "FILTER_JPG", 1023670),
        ".jpeg": getattr(c4d, "FILTER_JPG", 1023670),
        ".tif": getattr(c4d, "FILTER_TIF", 1023686),
        ".tiff": getattr(c4d, "FILTER_TIF", 1023686),
        ".bmp": getattr(c4d, "FILTER_BMP", getattr(c4d, "FILTER_PNG", 1023671)),
    }
    bitmap_filter = filter_map.get(ext, getattr(c4d, "FILTER_PNG", 1023671))
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    if not bitmap.Save(output_path, bitmap_filter):
        raise RuntimeError("failed to save rendered bitmap")


def _render_single_frame(doc, frame, output_path):
    render_data = doc.GetActiveRenderData()
    if not render_data:
        raise RuntimeError("no active render settings")

    render_bc = render_data.GetData()
    frame_time = c4d.BaseTime(frame, doc.GetFps())
    render_bc[c4d.RDATA_FRAMEFROM] = frame_time
    render_bc[c4d.RDATA_FRAMETO] = frame_time
    render_bc[c4d.RDATA_FRAMESTEP] = 1

    bitmap = c4d.bitmaps.BaseBitmap()
    flags = getattr(c4d, "RENDERFLAGS_EXTERNAL", 0)
    result = c4d.documents.RenderDocument(doc, render_bc, bitmap, flags, None)
    if result != getattr(c4d, "RENDERRESULT_OK", 1):
        raise RuntimeError(f"render failed with code {result}")

    _save_bitmap(bitmap, output_path)
    return {"frame": frame, "output_path": output_path}


def _render_frame(doc, payload):
    frame = int(payload.get("frame", doc.GetTime().GetFrame(doc.GetFps())))
    output_path = payload.get("output_path") or _default_output_path(f"nova4d-frame-{frame}.png")
    return _render_single_frame(doc, frame, str(output_path))


def _render_sequence(doc, payload):
    start = int(payload.get("start_frame", 0))
    end = int(payload.get("end_frame", start))
    step = max(1, int(payload.get("step", 1)))
    output_pattern = str(payload.get("output_path") or _default_output_path("nova4d-seq-####.png"))

    rendered = []
    for frame in range(start, end + 1, step):
        if "####" in output_pattern:
            output_path = output_pattern.replace("####", f"{frame:04d}")
        else:
            stem, ext = os.path.splitext(output_pattern)
            ext = ext or ".png"
            output_path = f"{stem}-{frame:04d}{ext}"
        rendered.append(_render_single_frame(doc, frame, output_path))
    return {"start_frame": start, "end_frame": end, "step": step, "rendered": rendered}


def _capture_screenshot(doc, payload):
    frame = int(payload.get("frame", doc.GetTime().GetFrame(doc.GetFps())))
    output_path = payload.get("output_path") or _default_output_path(f"nova4d-viewport-{frame}.png")
    return _render_single_frame(doc, frame, str(output_path))


def _queue_renderer_render(doc, payload, renderer_name):
    # Renderer IDs are installation-specific. If engine_id is provided we apply it first.
    if payload.get("engine_id") is not None:
        _set_render_engine(doc, payload)
    if payload.get("start_frame") is not None or payload.get("end_frame") is not None:
        result = _render_sequence(doc, payload)
    else:
        result = _render_frame(doc, payload)
    result["renderer"] = renderer_name
    return result


def _test_ping(_doc, payload):
    return {"message": payload.get("message") or "Nova4D Connected"}


def _generic_ack(_doc, payload, action):
    return {
        "status": "accepted",
        "action": action,
        "payload": payload,
        "note": "Command accepted but not implemented in this build.",
    }


def _import_document(doc, payload, label):
    file_path = payload.get("file_path")
    if not file_path:
        raise RuntimeError("file_path is required")
    flags = c4d.SCENEFILTER_OBJECTS | c4d.SCENEFILTER_MATERIALS
    ok = c4d.documents.MergeDocument(doc, str(file_path), flags, None)
    if not ok:
        raise RuntimeError(f"{label} import failed")
    return {"imported": file_path, "format": label}


def _export_document(doc, payload, label):
    file_path = payload.get("file_path") or payload.get("output_path")
    if not file_path:
        raise RuntimeError("file_path or output_path is required")

    ext = os.path.splitext(str(file_path))[1].lower()

    def _first_available(*names):
        for name in names:
            value = getattr(c4d, name, None)
            if isinstance(value, int):
                return value, name
        return None, None

    format_map = {
        ".c4d": (getattr(c4d, "FORMAT_C4DEXPORT", None), "FORMAT_C4DEXPORT"),
        ".gltf": _first_available("FORMAT_GLTFEXPORT", "FORMAT_GLTF2EXPORT", "FORMAT_GLTF_EXPORT"),
        ".glb": _first_available("FORMAT_GLTFEXPORT", "FORMAT_GLTF2EXPORT", "FORMAT_GLTF_EXPORT"),
        ".fbx": _first_available("FORMAT_FBX_EXPORT", "FORMAT_FBXEXPORT", "FORMAT_FBX_EXPORTPLUGIN"),
        ".obj": _first_available("FORMAT_OBJ2EXPORT", "FORMAT_OBJEXPORT"),
        ".abc": _first_available("FORMAT_ABCEXPORT", "FORMAT_ALEMBICEXPORT"),
        ".alembic": _first_available("FORMAT_ABCEXPORT", "FORMAT_ALEMBICEXPORT"),
    }
    format_id, format_name = format_map.get(ext, (None, None))
    if format_id is None:
        format_id = c4d.FORMAT_C4DEXPORT
        format_name = "FORMAT_C4DEXPORT"

    os.makedirs(os.path.dirname(str(file_path)) or ".", exist_ok=True)
    ok = c4d.documents.SaveDocument(doc, str(file_path), c4d.SAVEDOCUMENTFLAGS_DONTADDTORECENTLIST, format_id)
    if not ok:
        raise RuntimeError(f"{label} export failed")
    return {"exported": file_path, "format": label, "format_id": int(format_id), "format_name": format_name}


def _set_timeline_range(doc, payload):
    fps = float(doc.GetFps())
    start_frame = float(payload.get("start_frame", 0))
    end_frame = float(payload.get("end_frame", 90))
    doc.SetMinTime(c4d.BaseTime(start_frame / fps))
    doc.SetMaxTime(c4d.BaseTime(end_frame / fps))
    return {"start_frame": start_frame, "end_frame": end_frame}


def _set_fps(doc, payload):
    fps = int(payload.get("fps", 30))
    doc.SetFps(max(1, fps))
    return {"fps": doc.GetFps()}


def _command_candidates_from_env(env_key, fallback):
    raw = os.environ.get(env_key, "")
    out = []
    if raw:
        for token in raw.split(","):
            token = token.strip()
            if token.lstrip("-").isdigit():
                out.append(int(token))
    return out if out else list(fallback)


def _call_first_command(command_ids):
    attempted = []
    for command_id in command_ids:
        try:
            command_id = int(command_id)
        except Exception:
            continue
        attempted.append(command_id)
        try:
            if c4d.CallCommand(command_id):
                return command_id, attempted
        except Exception:
            continue
    return None, attempted


def _play_animation(doc, payload):
    from_frame = payload.get("from_frame")
    if from_frame is None:
        from_frame = payload.get("frame")
    if from_frame is None:
        from_frame = payload.get("start_frame")
    if from_frame is not None:
        doc.SetTime(c4d.BaseTime(int(from_frame), doc.GetFps()))

    play_ids = _command_candidates_from_env("NOVA4D_PLAY_COMMAND_IDS", [12002, 12412])
    command_id, attempted = _call_first_command(play_ids)
    return {
        "playing": bool(command_id),
        "from_frame": int(from_frame) if from_frame is not None else doc.GetTime().GetFrame(doc.GetFps()),
        "command_id": command_id,
        "attempted_command_ids": attempted,
    }


def _stop_animation(_doc, _payload):
    stop_ids = _command_candidates_from_env("NOVA4D_STOP_COMMAND_IDS", [12003, 12413, 12414])
    command_id, attempted = _call_first_command(stop_ids)
    return {
        "stopped": bool(command_id),
        "command_id": command_id,
        "attempted_command_ids": attempted,
    }


def _set_render_engine(doc, payload):
    render_data = doc.GetActiveRenderData()
    if not render_data:
        raise RuntimeError("no active render data")
    engine = payload.get("engine_id")
    if engine is None:
        engine = payload.get("engine")
    if engine is None:
        raise RuntimeError("engine or engine_id required")
    try:
        render_data[c4d.RDATA_RENDERENGINE] = int(engine)
    except Exception:
        raise RuntimeError("engine must be numeric renderer ID")
    return {"engine_id": int(engine)}


def _publish_team_render(doc, payload):
    scene_path = str(payload.get("scene_path") or _default_output_path("nova4d-team-render.c4d"))
    os.makedirs(os.path.dirname(scene_path) or ".", exist_ok=True)
    ok = c4d.documents.SaveDocument(doc, scene_path, c4d.SAVEDOCUMENTFLAGS_DONTADDTORECENTLIST, c4d.FORMAT_C4DEXPORT)
    if not ok:
        raise RuntimeError("failed to save scene for team render publish")

    publish_ids = _command_candidates_from_env("NOVA4D_TEAM_RENDER_COMMAND_IDS", [])
    command_id, attempted = _call_first_command(publish_ids) if publish_ids else (None, [])
    return {
        "published": True,
        "scene_path": scene_path,
        "team_render_machine": payload.get("team_render_machine"),
        "publish_command_id": command_id,
        "attempted_command_ids": attempted,
    }


def _save_scene(doc, payload):
    file_path = payload.get("file_path")
    if not file_path:
        raise RuntimeError("file_path required")
    ok = c4d.documents.SaveDocument(doc, str(file_path), c4d.SAVEDOCUMENTFLAGS_DONTADDTORECENTLIST, c4d.FORMAT_C4DEXPORT)
    if not ok:
        raise RuntimeError("save failed")
    return {"saved": file_path}


def _open_scene(_doc, payload):
    file_path = payload.get("file_path")
    if not file_path:
        raise RuntimeError("file_path required")
    loaded = c4d.documents.LoadDocument(str(file_path), c4d.SCENEFILTER_OBJECTS | c4d.SCENEFILTER_MATERIALS, None)
    if not loaded:
        raise RuntimeError("open failed")
    c4d.documents.InsertBaseDocument(loaded)
    c4d.documents.SetActiveDocument(loaded)
    return {"opened": file_path}


def _new_scene(doc, _payload):
    if doc:
        c4d.documents.KillDocument(doc)
    new_doc = c4d.documents.BaseDocument()
    c4d.documents.InsertBaseDocument(new_doc)
    c4d.documents.SetActiveDocument(new_doc)
    return {"scene": "new"}


def _object_path(obj):
    names = []
    current = obj
    while current:
        names.append(current.GetName())
        current = current.GetUp()
    names.reverse()
    return "/".join(names)


def _vec_to_list(value):
    return [float(value.x), float(value.y), float(value.z)]


def _rot_to_deg_list(value):
    return [
        float(c4d.utils.RadToDeg(value.x)),
        float(c4d.utils.RadToDeg(value.y)),
        float(c4d.utils.RadToDeg(value.z)),
    ]


def _collect_child_names(obj):
    out = []
    child = obj.GetDown()
    while child:
        out.append(child.GetName())
        child = child.GetNext()
    return out


def _introspect_scene(doc, payload):
    if not doc:
        raise RuntimeError("no active document")

    max_objects = int(payload.get("max_objects", 500))
    max_materials = int(payload.get("max_materials", 300))
    include_paths = bool(payload.get("include_paths", True))
    max_objects = max(1, min(max_objects, 5000))
    max_materials = max(1, min(max_materials, 2000))

    objects = []
    total_objects = 0
    for obj in _iter_objects(doc.GetFirstObject()):
        total_objects += 1
        if len(objects) >= max_objects:
            continue
        path = _object_path(obj)
        parent = obj.GetUp()
        parent_path = _object_path(parent) if parent else None
        abs_pos = obj.GetAbsPos()
        abs_rot = obj.GetAbsRot()
        abs_scale = obj.GetAbsScale()
        child_names = _collect_child_names(obj)
        row = {
            "name": obj.GetName(),
            "path": path if include_paths else None,
            "parent_path": parent_path if include_paths else None,
            "type_id": int(obj.GetType()),
            "selected": bool(obj.GetBit(c4d.BIT_ACTIVE)),
            "position": _vec_to_list(abs_pos),
            "rotation_deg": _rot_to_deg_list(abs_rot),
            "scale": _vec_to_list(abs_scale),
            "child_count": len(child_names),
            "children": child_names,
        }
        try:
            row["visibility_editor"] = int(obj[c4d.ID_BASEOBJECT_VISIBILITY_EDITOR])
            row["visibility_render"] = int(obj[c4d.ID_BASEOBJECT_VISIBILITY_RENDER])
        except Exception:
            row["visibility_editor"] = None
            row["visibility_render"] = None
        objects.append(row)

    materials = []
    total_materials = 0
    material = doc.GetFirstMaterial()
    while material:
        total_materials += 1
        if len(materials) < max_materials:
            materials.append({
                "name": material.GetName(),
                "type_id": int(material.GetType()),
            })
        material = material.GetNext()

    render_data = doc.GetActiveRenderData()
    render_engine = None
    if render_data:
        try:
            render_engine = int(render_data[c4d.RDATA_RENDERENGINE])
        except Exception:
            render_engine = None

    active_obj = doc.GetActiveObject()
    active_object_path = _object_path(active_obj) if active_obj else None
    roots = []
    root = doc.GetFirstObject()
    while root:
        roots.append(_object_path(root))
        root = root.GetNext()

    return {
        "document_name": doc.GetDocumentName(),
        "fps": int(doc.GetFps()),
        "render_engine_id": render_engine,
        "counts": {
            "objects_total": total_objects,
            "materials_total": total_materials,
            "objects_returned": len(objects),
            "materials_returned": len(materials),
        },
        "active_object": active_obj.GetName() if active_obj else None,
        "active_object_path": active_object_path,
        "root_paths": roots,
        "objects": objects,
        "materials": materials,
    }


class Nova4DEngine:
    def __init__(self):
        self.client = BridgeClient()
        self.running = False
        self._queue = deque()
        self._queue_lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread = None

        self._action_map = {
            "spawn-object": _spawn_object,
            "set-transform": _set_transform,
            "set-property": _set_property,
            "set-visibility": _set_visibility,
            "set-color": _set_color,
            "delete-object": _delete_object,
            "duplicate-object": _duplicate_object,
            "group-objects": _group_objects,
            "parent-object": _parent_object,
            "rename-object": _rename_object,
            "select-object": _select_object,
            "clear-selection": _clear_selection,
            "create-standard-material": _create_standard_material,
            "create-redshift-material": lambda d, p: _create_renderer_material(d, p, "Redshift"),
            "create-arnold-material": lambda d, p: _create_renderer_material(d, p, "Arnold"),
            "assign-material": _assign_material,
            "set-material-parameter": _set_material_parameter,
            "set-material-texture": _set_material_texture,
            "create-cloner": _create_cloner,
            "create-matrix": _create_matrix,
            "create-random-effector": _create_random_effector,
            "create-plain-effector": _create_plain_effector,
            "create-step-effector": _create_step_effector,
            "assign-effector": _assign_effector,
            "set-cloner-count": _set_cloner_count,
            "set-cloner-mode": _set_cloner_mode,
            "create-xpresso-tag": _create_xpresso_tag,
            "add-xpresso-node": _add_xpresso_node,
            "connect-xpresso-ports": _connect_xpresso_ports,
            "set-xpresso-parameter": _set_xpresso_parameter,
            "import-gltf": lambda d, p: _import_document(d, p, "gltf"),
            "import-fbx": lambda d, p: _import_document(d, p, "fbx"),
            "import-obj": lambda d, p: _import_document(d, p, "obj"),
            "import-blender-gltf": lambda d, p: _import_document(d, p, "blender-gltf"),
            "import-blender-fbx": lambda d, p: _import_document(d, p, "blender-fbx"),
            "export-gltf": lambda d, p: _export_document(d, p, "gltf"),
            "export-fbx": lambda d, p: _export_document(d, p, "fbx"),
            "export-obj": lambda d, p: _export_document(d, p, "obj"),
            "export-alembic": lambda d, p: _export_document(d, p, "alembic"),
            "set-range": _set_timeline_range,
            "set-fps": _set_fps,
            "set-key": _set_key,
            "delete-key": _delete_key,
            "play": _play_animation,
            "stop": _stop_animation,
            "set-render-engine": _set_render_engine,
            "render-frame": _render_frame,
            "render-sequence": _render_sequence,
            "queue-redshift-render": lambda d, p: _queue_renderer_render(d, p, "redshift"),
            "queue-arnold-render": lambda d, p: _queue_renderer_render(d, p, "arnold"),
            "publish-team-render": _publish_team_render,
            "set-camera": _set_camera,
            "focus-object": _focus_object,
            "capture-screenshot": _capture_screenshot,
            "set-display-mode": _set_display_mode,
            "test-ping": _test_ping,
            "save-scene": _save_scene,
            "open-scene": _open_scene,
            "new-scene": _new_scene,
            "introspect-scene": _introspect_scene,
        }

        self._ack_actions = {
            "headless-render-queue",
            "run-c4dpy-script",
        }

    def start(self):
        if self.running:
            return
        self.running = True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._poll_loop, name="Nova4DPoller", daemon=True)
        self._thread.start()

    def stop(self):
        if not self.running:
            return
        self.running = False
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def enqueue_command(self, command):
        with self._queue_lock:
            self._queue.append(command)

    def _pop_command(self):
        with self._queue_lock:
            if not self._queue:
                return None
            return self._queue.popleft()

    def _poll_loop(self):
        while not self._stop_event.is_set():
            try:
                response = self.client.poll_commands(limit=25)
                commands = response.get("commands") or []
                for command in commands:
                    self.enqueue_command(command)
                if commands:
                    c4d.SpecialEventAdd(SPECIAL_EVENT_ID)
            except Exception as exc:
                print(f"[Nova4D] Poll error: {exc}")
            self._stop_event.wait(max(0.25, POLL_INTERVAL_SEC))

    def process_pending(self):
        processed = 0
        while processed < 25:
            command = self._pop_command()
            if not command:
                break
            processed += 1
            self._execute_command(command)

    def _execute_command(self, command):
        command_id = command.get("id")
        action = command.get("action")
        payload = command.get("payload") or {}
        doc = c4d.documents.GetActiveDocument()

        if not command_id:
            return

        try:
            if action in self._action_map:
                result = self._action_map[action](doc, payload)
            elif action in self._ack_actions:
                result = _generic_ack(doc, payload, action)
            else:
                raise RuntimeError(f"unknown action: {action}")
            c4d.EventAdd()
            self.client.post_result(command_id, True, result=result)
        except Exception as exc:
            self.client.post_result(command_id, False, err=str(exc))


ENGINE = Nova4DEngine()


class Nova4DCommand(plugins.CommandData):
    def Execute(self, _doc):
        if ENGINE.running:
            ENGINE.stop()
            gui.MessageDialog("Nova4D bridge polling stopped.")
        else:
            ENGINE.start()
            gui.MessageDialog("Nova4D bridge polling started.")
        return True


class Nova4DMessage(plugins.MessageData):
    def CoreMessage(self, msg_id, _bc):
        if msg_id == SPECIAL_EVENT_ID:
            ENGINE.process_pending()
        return True


if __name__ == "__main__":
    _warn_plugin_id_state()
    plugins.RegisterCommandPlugin(
        id=PLUGIN_ID_COMMAND,
        str=PLUGIN_NAME,
        info=0,
        icon=None,
        help="Toggle Nova4D bridge polling",
        dat=Nova4DCommand(),
    )
    plugins.RegisterMessagePlugin(
        id=PLUGIN_ID_MESSAGE,
        str="Nova4D Bridge Message",
        info=0,
        dat=Nova4DMessage(),
    )
