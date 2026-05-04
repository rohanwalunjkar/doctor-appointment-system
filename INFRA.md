# DocBook — Kubernetes & Infrastructure Logic Explained

---

## Cluster Architecture Diagram

```
                    Internet / User Browser
                            │
                            ▼
               ┌────────────────────────┐
               │  OCI Instance (Host)   │
               │  IP: 132.226.217.217   │
               │        Port 30000      │
               └────────┬───────────────┘
                        │ Kind Cluster (1 control-plane + 2 workers)
                        ▼
    ┌──────── Namespace: docbook ────────────────────────────────┐
    │                                                            │
    │  ┌──────────────────┐   ┌────────────────┐   ┌─────────┐  │
    │  │ frontend (×2)    │──►│ backend (×2)   │──►│ mysql(×1)│  │
    │  │ NodePort :30000  │   │ ClusterIP:8000 │   │ ClIP:3306│  │
    │  │ Vite dev server  │   │ FastAPI/Uvicorn│   │ MySQL 8.0│  │
    │  └──────────────────┘   └────────────────┘   └────┬─────┘  │
    │                                                   │        │
    │                                              ┌────┴─────┐  │
    │                                              │ PVC 1Gi  │  │
    │                                              │(local-path)│ │
    │                                              └──────────┘  │
    │                                                            │
    │  ConfigMap: docbook-config    Secret: docbook-secrets       │
    └────────────────────────────────────────────────────────────┘
```

---

## File-by-File Explanation

### 1. `k8s/namespace.yaml` — Isolation Boundary

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: docbook
  labels:
    app: docbook
```

**What it does:** Creates a dedicated Kubernetes namespace called `docbook`. All resources (pods, services, secrets) live inside this namespace, keeping them isolated from other workloads running in the same cluster.

**Why:** Without a namespace, everything goes into `default`. Using `docbook` means you can do `kubectl delete namespace docbook` to wipe the entire app cleanly, and it prevents name collisions with other deployments.

---

### 2. `k8s/secrets.yaml` — Sensitive Config

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: docbook-secrets
  namespace: docbook
type: Opaque
stringData:
  MYSQL_ROOT_PASSWORD: "root123"
  SECRET_KEY: "your-super-secret-key-change-this-in-production"
  DATABASE_URL: "mysql+pymysql://root:root123@mysql-service.docbook.svc.cluster.local:3306/doctor_appointment_db"
```

**What it does:** Stores three sensitive values that should not be hardcoded in Dockerfiles or manifests:

| Key | Used By | Purpose |
|-----|---------|---------|
| `MYSQL_ROOT_PASSWORD` | MySQL pod | Root login password for the MySQL server |
| `SECRET_KEY` | Backend pod | Key used to sign/verify JWT tokens |
| `DATABASE_URL` | Backend pod | Full SQLAlchemy connection string to reach MySQL |

**Key detail in `DATABASE_URL`:**
```
mysql+pymysql://root:root123@mysql-service.docbook.svc.cluster.local:3306/doctor_appointment_db
                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                              This is the Kubernetes DNS name for the MySQL Service
```
- `mysql-service` = the Service name (defined in mysql.yaml)
- `docbook` = the namespace
- `svc.cluster.local` = K8s internal DNS suffix

This means the backend pod can reach MySQL at this DNS name from anywhere in the cluster, without knowing which node or IP MySQL is actually running on.

**`stringData` vs `data`:** Using `stringData` lets you write secrets as plain text in the YAML. Kubernetes automatically base64-encodes them at storage time. (Using `data` would require you to base64-encode values yourself.)

---

### 3. `k8s/configmap.yaml` — Non-Sensitive Config

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: docbook-config
  namespace: docbook
data:
  MYSQL_DATABASE: "doctor_appointment_db"
  FRONTEND_URL: "http://localhost:3000"
  DEBUG: "true"
  APP_NAME: "DocBook - Doctor Appointment System"
  APP_VERSION: "1.0.0"
```

**What it does:** Stores non-sensitive configuration as key-value pairs. Pods reference these via `configMapKeyRef`.

| Key | Used By | Purpose |
|-----|---------|---------|
| `MYSQL_DATABASE` | MySQL pod | The database name MySQL creates on first startup |
| `FRONTEND_URL` | Backend pod | CORS allowed origin |
| `DEBUG` | Backend pod | Enables SQLAlchemy SQL logging |
| `APP_NAME` / `APP_VERSION` | Backend pod | App metadata returned at `/` endpoint |

**Why separate from Secrets?** ConfigMaps are for non-sensitive data. They can be freely inspected (`kubectl get configmap -o yaml`) without security risk. Secrets are stored encrypted at rest (in etcd) and are restricted by RBAC.

---

### 4. `k8s/mysql.yaml` — Database Layer (3 resources)

This single file creates three Kubernetes objects separated by `---`:

#### 4a. PersistentVolumeClaim (PVC)

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-pvc
  namespace: docbook
spec:
  storageClassName: standard
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

**What it does:** Requests 1 GB of persistent storage from the cluster. The `standard` StorageClass (Kind's `rancher.io/local-path` provisioner) automatically creates a directory on the node's filesystem and mounts it into the pod.

**Why PVC matters:** Without this, if the MySQL pod restarts or gets rescheduled to another node, **all data is lost**. The PVC ensures the MySQL data directory (`/var/lib/mysql`) survives pod restarts. The data lives on the node's disk, not inside the container.

**`ReadWriteOnce`:** Only one pod can mount this volume at a time — which is correct since we run only 1 MySQL replica (databases shouldn't be scaled horizontally without special clustering).

#### 4b. Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mysql
  namespace: docbook
  labels:
    app: docbook
    tier: database
spec:
  replicas: 1
  strategy:
    type: Recreate
```

**`replicas: 1`:** Only ONE MySQL instance (no horizontal scaling). Running multiple MySQL pods pointing at the same data would corrupt the database.

**`strategy: Recreate`:** The default strategy is `RollingUpdate` (start new, then kill old). But MySQL can't have two instances accessing the same data files simultaneously — it would corrupt the database. `Recreate` ensures the old pod is **fully terminated** before the new one starts.

**Container config:**
```yaml
containers:
  - name: mysql
    image: mysql:8.0
    ports:
      - containerPort: 3306
    env:
      - name: MYSQL_ROOT_PASSWORD
        valueFrom:
          secretKeyRef:
            name: docbook-secrets
            key: MYSQL_ROOT_PASSWORD
      - name: MYSQL_DATABASE
        valueFrom:
          configMapKeyRef:
            name: docbook-config
            key: MYSQL_DATABASE
    volumeMounts:
      - name: mysql-storage
        mountPath: /var/lib/mysql
```

- `MYSQL_ROOT_PASSWORD` is pulled from the Secret (not hardcoded).
- `MYSQL_DATABASE` is pulled from the ConfigMap — MySQL auto-creates this database on first boot.
- `/var/lib/mysql` is mounted to the PVC, so data persists across restarts.

**Health probes:**
```yaml
readinessProbe:
  exec:
    command: [mysqladmin, ping, -h, localhost, -u, root, -proot123]
  initialDelaySeconds: 20
  periodSeconds: 10
  timeoutSeconds: 5

livenessProbe:
  exec:
    command: [mysqladmin, ping, -h, localhost, -u, root, -proot123]
  initialDelaySeconds: 30
  periodSeconds: 15
  timeoutSeconds: 5
```

- **Readiness probe:** Until this passes, Kubernetes will NOT send traffic to the pod via the Service. Other pods trying to connect will get routed only to "ready" pods.
- **Liveness probe:** If this fails multiple times, Kubernetes **kills and restarts** the container. This catches cases where MySQL is running but hung/deadlocked.
- **`initialDelaySeconds` difference:** Liveness delay (30s) is longer than readiness (20s) to avoid killing a pod that's still legitimately booting up.

#### 4c. Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql-service
  namespace: docbook
spec:
  type: ClusterIP
  selector:
    app: docbook
    tier: database
  ports:
    - port: 3306
      targetPort: 3306
```

**What it does:** Creates a stable internal DNS name `mysql-service.docbook.svc.cluster.local` that always points to the MySQL pod, regardless of the pod's actual IP address (which changes on every restart).

**`ClusterIP` type:** This is a cluster-internal IP only. No external access — only other pods in the cluster can reach MySQL. This is a security best practice for databases.

**How label-based routing works:**
```
Service selector:  { app: docbook, tier: database }
        ↓ matches ↓
Pod labels:        { app: docbook, tier: database }
```
When backend pods connect to `mysql-service:3306`, K8s routes the traffic to any pod matching these labels.

---

### 5. `k8s/backend.yaml` — API Layer (2 resources)

#### 5a. Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: docbook
  labels:
    app: docbook
    tier: backend
spec:
  replicas: 2
```

**Why 2 replicas:** If one pod crashes or gets OOM-killed, the other continues serving requests. Kubernetes load-balances traffic across both via the Service.

**Init Container (runs BEFORE the main container):**
```yaml
initContainers:
  - name: wait-for-mysql
    image: alpine:3.19
    command:
      - sh
      - -c
      - |
        apk add --no-cache netcat-openbsd > /dev/null 2>&1
        echo "Waiting for MySQL..."
        until nc -z mysql-service.docbook.svc.cluster.local 3306; do
          echo "MySQL not ready, retrying in 3s..."
          sleep 3
        done
        echo "MySQL is ready!"
```

**What it does:** Before the FastAPI container starts, this lightweight Alpine container repeatedly tries to open a TCP connection to MySQL on port 3306. It loops every 3 seconds until MySQL responds.

**Why this is needed:** Kubernetes starts all pods roughly simultaneously. Without this, the backend would boot up, try to connect to MySQL (which isn't ready yet), and crash with a connection error. The init container guarantees MySQL is accepting TCP connections before FastAPI even starts.

**Pod status during wait:** Shows `Init:0/1` in `kubectl get pods` while it's waiting.

**Main container:**
```yaml
containers:
  - name: backend
    image: rohan2747/docbook-backend:latest
    imagePullPolicy: Always
    ports:
      - containerPort: 8000
    env:
      - name: DATABASE_URL
        valueFrom:
          secretKeyRef:
            name: docbook-secrets
            key: DATABASE_URL
      - name: SECRET_KEY
        valueFrom:
          secretKeyRef:
            name: docbook-secrets
            key: SECRET_KEY
      - name: FRONTEND_URL
        valueFrom:
          configMapKeyRef:
            name: docbook-config
            key: FRONTEND_URL
      - name: DEBUG
        valueFrom:
          configMapKeyRef:
            name: docbook-config
            key: DEBUG
```

**`imagePullPolicy: Always`:** Every time a pod starts, it pulls the image from Docker Hub. This ensures you always get the latest build after doing `docker push`. Without this, Kubernetes might use a cached old version.

**Environment variable injection:** Sensitive values (`DATABASE_URL`, `SECRET_KEY`) come from the Secret. Non-sensitive values (`FRONTEND_URL`, `DEBUG`) come from the ConfigMap. Inside the container, FastAPI's Pydantic `BaseSettings` picks these up via `os.environ`, overriding default values in `config.py`.

**Health probes:**
```yaml
readinessProbe:
  httpGet:
    path: /api/health
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 10

livenessProbe:
  httpGet:
    path: /api/health
    port: 8000
  initialDelaySeconds: 15
  periodSeconds: 20
```

Uses HTTP health checks (instead of exec commands like MySQL). FastAPI has a `GET /api/health` endpoint that returns `{ "status": "healthy" }` with a 200 OK if the server is up.

#### 5b. Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: docbook
spec:
  type: ClusterIP
  selector:
    app: docbook
    tier: backend
  ports:
    - port: 8000
      targetPort: 8000
```

Creates `backend-service.docbook.svc.cluster.local:8000`. The frontend pods use this DNS name to proxy API requests to the backend. Since there are 2 backend replicas, the Service automatically **round-robin load-balances** across them.

**`ClusterIP`:** The backend is NOT directly accessible from outside the cluster. Users cannot call `http://132.226.217.217:8000/api/...` directly. All API traffic must go through the frontend's Vite proxy.

---

### 6. `k8s/frontend.yaml` — UI Layer (2 resources)

#### 6a. Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: docbook
  labels:
    app: docbook
    tier: frontend
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: frontend
          image: rohan2747/docbook-frontend:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 3000
          env:
            - name: VITE_API_TARGET
              value: "http://backend-service.docbook.svc.cluster.local:8000"
```

**How the frontend talks to the backend:**

The Vite dev server runs inside the container and proxies `/api/*` requests. During Docker build, the Dockerfile runs:
```dockerfile
RUN sed -i "s|http://localhost:8000|http://backend-service:8000|g" vite.config.js
```
This rewrites the Vite proxy target from `localhost:8000` to `backend-service:8000` (the K8s Service DNS name). So when a user's browser loads the page and makes an API call to `/api/auth/login`, the flow is:

```
Browser (user's machine)
    │
    │  GET http://132.226.217.217:30000/api/auth/login
    │
    ▼
Frontend Pod (Vite dev server on port 3000)
    │
    │  Vite proxy: /api/* → http://backend-service:8000
    │
    ▼
Backend Service (ClusterIP, load-balances to 2 backend pods)
    │
    │  FastAPI handles the request, queries MySQL
    │
    ▼
MySQL Service (ClusterIP → single MySQL pod)
```

**Health probes:**
```yaml
readinessProbe:
  httpGet:
    path: /
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10

livenessProbe:
  httpGet:
    path: /
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 20
```

Checks if the Vite dev server responds on `/` (the React app's index page).

#### 6b. Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: docbook
spec:
  type: NodePort
  selector:
    app: docbook
    tier: frontend
  ports:
    - port: 3000
      targetPort: 3000
      nodePort: 30000
```

**`NodePort` — the ONLY externally accessible Service:**

This is the key difference from ClusterIP. A NodePort Service opens a port (30000) on **every node** in the cluster. Any traffic hitting `<any-node-IP>:30000` gets routed to the frontend pods.

```
ClusterIP (internal only):   mysql-service:3306      ← pods-only access
ClusterIP (internal only):   backend-service:8000    ← pods-only access
NodePort  (external):        <node-IP>:30000         ← world can access
```

**Port mapping explained:**
| Port Type | Value | Meaning |
|-----------|-------|---------|
| `nodePort: 30000` | 30000 | The port on the host machine (what users type in their browser) |
| `port: 3000` | 3000 | The port on the Service's ClusterIP (used for pod-to-pod internally) |
| `targetPort: 3000` | 3000 | The actual port the Vite container is listening on |

**Valid NodePort range:** Kubernetes only allows NodePorts between 30000–32767.

---

## Docker Images

### Backend Dockerfile (`backend/Dockerfile`)

```dockerfile
FROM python:3.11-slim
WORKDIR /app

# System deps for MySQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc default-libmysqlclient-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- Base image: `python:3.11-slim` (Debian-based, minimal)
- Installs gcc + MySQL C headers (needed to compile `mysqlclient` Python package)
- Copies requirements first (for Docker layer caching — deps only reinstall if `requirements.txt` changes)
- Runs Uvicorn ASGI server on `0.0.0.0:8000` (binds to all interfaces so K8s can reach it)

### Frontend Dockerfile (`frontend/Dockerfile`)

```dockerfile
FROM node:18-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Rewrite Vite proxy to point to K8s backend service
RUN sed -i "s|http://localhost:8000|http://backend-service:8000|g" vite.config.js

EXPOSE 3000
CMD ["npx", "vite", "--host", "0.0.0.0"]
```

- Base image: `node:18-alpine` (lightweight Alpine Linux)
- `sed` command at build time rewrites `vite.config.js` to proxy API calls to the Kubernetes backend service instead of `localhost`
- Runs Vite dev server on `0.0.0.0:3000`

---

## Deployment Order & Dependency Chain

```
1. kubectl apply -f k8s/namespace.yaml     ← Namespace must exist first
2. kubectl apply -f k8s/secrets.yaml       ← Must exist before pods reference it
3. kubectl apply -f k8s/configmap.yaml     ← Must exist before pods reference it
4. kubectl apply -f k8s/mysql.yaml         ← Database starts first
5. kubectl apply -f k8s/backend.yaml       ← Init container waits for MySQL
6. kubectl apply -f k8s/frontend.yaml      ← Vite proxies to backend
```

Or all at once: `kubectl apply -f k8s/` (Kubernetes handles dependencies via init containers + readiness probes).

**Startup timeline in practice:**
```
t=0s   MySQL pod starts → pulling mysql:8.0 image
t=0s   Backend pod starts → init container begins: "Waiting for MySQL..."
t=0s   Frontend pod starts → pulling frontend image
t=~20s MySQL passes readiness probe → now accepting connections
t=~20s Backend init container detects MySQL → "MySQL is ready!" → main container starts
t=~25s Backend FastAPI boots, auto-creates DB tables, passes /api/health probe
t=~10s Frontend Vite server starts (independent of backend)
t=~30s All pods in Ready state → System fully operational ✅
```

---

## Network Topology Summary

| Service | K8s Type | Port | Internal DNS | Accessible From |
|---------|----------|------|--------------|-----------------|
| `mysql-service` | ClusterIP | 3306 | `mysql-service.docbook.svc.cluster.local` | Backend pods only |
| `backend-service` | ClusterIP | 8000 | `backend-service.docbook.svc.cluster.local` | Frontend pods only |
| `frontend-service` | NodePort | 30000 | `<node-IP>:30000` | Anyone (internet) |

**Security layering:** MySQL and the backend are **never directly exposed** to the outside. The only entry point is port 30000 (frontend). All API calls go through the Vite proxy inside the frontend pod, which forwards them to the backend internally.

---

## Config Injection Pattern

Both Secrets and ConfigMaps are injected into pods as **environment variables** (not mounted as files):

```yaml
env:
  - name: DATABASE_URL           # ← env var name inside the container
    valueFrom:
      secretKeyRef:              # ← pull from a Secret
        name: docbook-secrets    # ← which Secret object
        key: DATABASE_URL        # ← which key inside that Secret
```

Inside the FastAPI container, `os.environ["DATABASE_URL"]` returns the full MySQL connection string. Pydantic `BaseSettings` picks this up automatically, overriding the default value in `config.py`.

---

## Label System

All resources use a consistent two-label system:

| Label | Values | Purpose |
|-------|--------|---------|
| `app: docbook` | Always `docbook` | Groups all resources for this application |
| `tier: frontend / backend / database` | Varies | Distinguishes the three layers |

Services use these labels in their `selector` to route traffic to the correct pods:
```
frontend-service  selector: { app: docbook, tier: frontend }  → frontend pods
backend-service   selector: { app: docbook, tier: backend }   → backend pods
mysql-service     selector: { app: docbook, tier: database }  → mysql pod
```

You can use labels for bulk operations:
```bash
kubectl get pods -n docbook -l tier=backend    # Show only backend pods
kubectl delete pods -n docbook -l app=docbook  # Delete ALL docbook pods
```

---

## Health Check Strategy Summary

| Component | Probe Type | Method | Endpoint/Command | Initial Delay | Period |
|-----------|-----------|--------|------------------|---------------|--------|
| MySQL | Readiness | exec | `mysqladmin ping` | 20s | 10s |
| MySQL | Liveness | exec | `mysqladmin ping` | 30s | 15s |
| Backend | Readiness | httpGet | `GET /api/health:8000` | 10s | 10s |
| Backend | Liveness | httpGet | `GET /api/health:8000` | 15s | 20s |
| Frontend | Readiness | httpGet | `GET /:3000` | 10s | 10s |
| Frontend | Liveness | httpGet | `GET /:3000` | 15s | 20s |

**Readiness vs Liveness:**
- **Readiness:** "Can this pod accept traffic?" — If it fails, the pod is removed from the Service's endpoint list (no traffic routed to it), but the pod is NOT restarted.
- **Liveness:** "Is this pod still alive?" — If it fails consecutively (default 3 times), Kubernetes **kills and restarts** the container.

---

## Common Operations

```bash
# Deploy the full stack
kubectl apply -f k8s/

# Check all pods
kubectl get pods -n docbook -o wide

# Watch pods starting up in real-time
kubectl get pods -n docbook -w

# Check logs for a specific pod
kubectl logs -n docbook deployment/backend --tail=50 -f

# Restart a deployment (pulls latest image)
kubectl rollout restart deployment/backend -n docbook

# Scale backend to 3 replicas
kubectl scale deployment backend -n docbook --replicas=3

# Seed the database
kubectl exec -n docbook deployment/backend -- python -m seed

# Open a shell inside a backend pod
kubectl exec -n docbook -it deployment/backend -- bash

# Delete everything
kubectl delete namespace docbook

# Check events (useful for debugging)
kubectl get events -n docbook --sort-by='.lastTimestamp'
```

---

## Pod Replicas Summary

| Component | Replicas | Why |
|-----------|----------|-----|
| MySQL | 1 | Databases need single-writer access to data files. Scaling requires specialized clustering (Galera, InnoDB Cluster). |
| Backend | 2 | Stateless API — safe to run multiple instances. Provides high availability and load distribution. |
| Frontend | 2 | Stateless UI server — safe to run multiple instances. Provides high availability. |

---

## Port Forwarding (Kind-Specific)

### Why NodePort Doesn't Work Directly in Kind

Kind runs the Kubernetes cluster **inside Docker containers** on the host. This creates an extra networking layer:

```
Normal K8s (cloud VM, bare-metal):
    User → Host:30000 → Pod:3000                     ← NodePort works directly

Kind K8s (runs inside Docker):
    User → OCI Host → Docker Container (Kind node) → Pod:3000
                  ↑
          This gap blocks NodePort traffic!
```

**Without `extraPortMappings`** (current setup):
```
OCI Host (132.226.217.217)
    │
    │  Port 30000 → ❌ Nothing listening on the HOST
    │
    └── Docker Container "kind-control-plane"
            │
            │  Port 30000 → ✅ NodePort works INSIDE the container
            │
            └── Frontend Pod :3000
```

The NodePort opens on the Kind Docker container, NOT the OCI host. The host has no mapping, so external requests to `:30000` fail.

**With `extraPortMappings`** (requires cluster recreation):
```yaml
# kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30000
        hostPort: 30000
        protocol: TCP
  - role: worker
  - role: worker
```
```bash
kind delete cluster
kind create cluster --config kind-config.yaml
```

This tells Kind to run: `docker run -p 30000:30000 ...` — bridging the host to the container.

```
OCI Host (132.226.217.217)
    │
    │  Port 30000 → ✅ Docker -p flag maps to Kind container
    │
    └── Docker Container "kind-control-plane" (-p 30000:30000)
            │
            │  Port 30000 → ✅ NodePort routes to frontend pods
            │
            └── Frontend Pod :3000
```

### Port-Forward Commands (Current Workaround)

Port-forward creates a direct tunnel from the host to the pod through the K8s API server, bypassing Docker networking entirely:

```bash
# Forward frontend — access at http://132.226.217.217:3000
kubectl port-forward -n docbook svc/frontend-service 3000:3000 --address 0.0.0.0

# Forward backend — access at http://132.226.217.217:8000 (for debugging)
kubectl port-forward -n docbook svc/backend-service 8000:8000 --address 0.0.0.0

# Forward MySQL — access at localhost:3306 (for DB client debugging)
kubectl port-forward -n docbook svc/mysql-service 3306:3306
```

**`--address 0.0.0.0`:** Required to allow external access. Without it, port-forward only binds to `127.0.0.1` (localhost), meaning only the server itself can access it — not your browser from another machine.

### Running Port-Forward in Background

Port-forward stops when the terminal closes. To keep it running persistently:

```bash
# Run in background with nohup (survives terminal close)
nohup kubectl port-forward -n docbook svc/frontend-service 3000:3000 --address 0.0.0.0 > /dev/null 2>&1 &

# Check if it's running
ps aux | grep port-forward

# Kill it
kill $(pgrep -f "port-forward.*frontend")
```

Or use `screen`/`tmux` for an interactive session you can detach from.

### Comparison: NodePort vs Port-Forward

| | NodePort + extraPortMappings | Port-Forward |
|---|---|---|
| **Requires cluster recreation** | Yes | No |
| **Survives terminal close** | Yes (always on) | No (needs `nohup` or `screen`) |
| **Access URL** | `http://<host-ip>:30000` | `http://<host-ip>:3000` |
| **Performance** | Native networking | Slight overhead (tunneled via K8s API) |
| **Extra setup** | Kind config YAML | One command |
| **Good for** | Production-like setup | Quick access & debugging |
