# Setup (Linux)

Cinema 4D GUI is not officially available on Linux for most users, but Nova4D server, SDK, and mock worker run natively.

## Server + Mock Validation

```bash
cd /home/nova/Nova4D
npm install
npm start
```

In another shell:

```bash
node examples/mock/mock_c4d_client.js
```

Queue commands:

```bash
bash examples/curl/golden_path.sh
```

For headless automation on Linux hosts, point `NOVA4D_C4D_PATH` to your accessible `c4dpy` binary.
