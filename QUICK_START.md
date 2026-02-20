# Quick Start

```bash
cd /home/nova/Nova4D
npm install
npm start
```

```bash
curl -s http://localhost:30010/nova4d/health | jq .
curl -s -X POST http://localhost:30010/nova4d/test/ping \
  -H 'Content-Type: application/json' \
  -d '{"message":"Nova4D Connected"}' | jq .
```

For local simulation without Cinema 4D:

```bash
node examples/mock/mock_c4d_client.js
```
