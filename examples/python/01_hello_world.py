from pathlib import Path
import sys

SDK_DIR = Path(__file__).resolve().parents[2] / "python-sdk"
sys.path.insert(0, str(SDK_DIR))

from nova4d import Nova4D  # noqa: E402

bridge = Nova4D(host="localhost", port=30010)
print(bridge.health())
print(bridge.spawn_object(object_type="cube", name="HelloWorldCube", position=[0, 100, 0]))
print(bridge.create_mograph_cloner(name="HelloCloner"))
