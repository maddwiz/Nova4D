# Nova4D Python SDK

```python
from nova4d import Nova4D

client = Nova4D(host="localhost", port=30010, api_key="")
print(client.health())
print(client.spawn_object(object_type="cube", name="SDKCube"))
print(client.create_mograph_cloner(name="CubeCloner"))
```

Environment defaults are `NOVA4D_HOST`, `NOVA4D_PORT`, and `NOVA4D_API_KEY`.
