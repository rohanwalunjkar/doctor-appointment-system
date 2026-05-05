#!/bin/bash
###############################################################################
#  Oracle Linux — Prerequisites Setup Script
#  Installs: Docker, Git, kubectl, Kind
#  Tested on: Oracle Linux 8 / 9 (OCI Compute)
###############################################################################
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Ensure /usr/local/bin is in PATH
export PATH=$PATH:/usr/local/bin

echo "=========================================="
echo "  Oracle Linux — Prerequisites Installer"
echo "  Date : $(date)"
echo "  Host : $(hostname)"
echo "  OS   : $(cat /etc/oracle-release 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2)"
echo "=========================================="
echo ""

# ─── 1. Git ──────────────────────────────────────────────────────────────────
echo ""
echo "=== [1/5] Installing Git ==="
if command -v git &>/dev/null; then
    warn "Git already installed: $(git --version)"
else
    sudo dnf install -y git
    log "Git installed: $(git --version)"
fi

# ─── 3. Docker ───────────────────────────────────────────────────────────────
echo ""
echo "=== [2/5] Installing Docker ==="
if command -v docker &>/dev/null; then
    warn "Docker already installed: $(docker --version)"
else
    # Remove old/conflicting packages
    sudo dnf remove -y docker docker-client docker-client-latest \
        docker-common docker-latest docker-latest-logfiles \
        docker-logfiles docker-engine podman runc 2>/dev/null || true

    # Add Docker CE repo
    sudo dnf install -y dnf-utils
    sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

    # Install Docker CE
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    log "Docker installed: $(docker --version)"
fi

# Start & enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group (avoids needing sudo for docker)
if ! groups "$USER" | grep -q docker; then
    sudo usermod -aG docker "$USER"
    warn "Added $USER to docker group. You may need to log out/in for this to take effect."
fi

log "Docker is running: $(sudo docker info --format '{{.ServerVersion}}')"

# ─── 4. kubectl ──────────────────────────────────────────────────────────────
echo ""
echo "=== [3/5] Installing kubectl ==="
if command -v kubectl &>/dev/null; then
    warn "kubectl already installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
else
    # Download latest stable kubectl
    KUBECTL_VERSION=$(curl -fsSL https://dl.k8s.io/release/stable.txt)
    echo "Downloading kubectl ${KUBECTL_VERSION}..."
    curl -fsSLO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"

    # Verify checksum
    curl -fsSLO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl.sha256"
    echo "$(cat kubectl.sha256)  kubectl" | sha256sum --check
    rm -f kubectl.sha256

    # Install
    sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
    rm -f kubectl

    log "kubectl installed: $(kubectl version --client 2>/dev/null | head -1)"
fi

# ─── 5. Kind (Kubernetes in Docker) ──────────────────────────────────────────
echo ""
echo "=== [4/5] Installing Kind ==="
if command -v kind &>/dev/null; then
    warn "Kind already installed: $(kind version)"
else
    # Detect architecture
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)  KIND_ARCH="amd64" ;;
        aarch64) KIND_ARCH="arm64" ;;
        *)       err "Unsupported architecture: $ARCH" ;;
    esac

    KIND_VERSION=$(curl -fsSL https://api.github.com/repos/kubernetes-sigs/kind/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
    echo "Downloading Kind ${KIND_VERSION} (${KIND_ARCH})..."
    curl -fsSLo kind "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-${KIND_ARCH}"

    sudo install -o root -g root -m 0755 kind /usr/local/bin/kind
    rm -f kind

    log "Kind installed: $(/usr/local/bin/kind version)"
fi

# ─── 6. Create Kind Cluster ──────────────────────────────────────────────────
echo ""
echo "=== [5/5] Creating Kind Cluster ==="
if /usr/local/bin/kind get clusters 2>/dev/null | grep -q "^docbook$"; then
    warn "Kind cluster 'docbook' already exists"
else
    echo "Creating Kind cluster 'docbook' with NodePort mapping..."

    cat <<'EOF' > /tmp/kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30000
        hostPort: 30000
        protocol: TCP
      - containerPort: 30001
        hostPort: 8000
        protocol: TCP
  - role: worker
  - role: worker
EOF

    /usr/local/bin/kind create cluster --name docbook --config /tmp/kind-config.yaml
    rm -f /tmp/kind-config.yaml

    # Copy kubeconfig to the actual user if running as sudo
    if [ -n "$SUDO_USER" ]; then
        REAL_HOME=$(eval echo "~$SUDO_USER")
        mkdir -p "$REAL_HOME/.kube"
        cp /root/.kube/config "$REAL_HOME/.kube/config"
        chown "$(id -u $SUDO_USER):$(id -g $SUDO_USER)" "$REAL_HOME/.kube/config"
        log "Kubeconfig copied to $REAL_HOME/.kube/config"
    fi

    log "Kind cluster 'docbook' created"
fi

# Set kubectl context
kubectl cluster-info --context kind-docbook

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "  INSTALLATION COMPLETE"
echo "=========================================="
echo ""
echo "  Git     : $(git --version 2>/dev/null || echo 'N/A')"
echo "  Docker  : $(docker --version 2>/dev/null || echo 'N/A')"
echo "  kubectl : $(kubectl version --client --short 2>/dev/null || echo 'N/A')"
echo "  Kind    : $(/usr/local/bin/kind version 2>/dev/null || echo 'N/A')"
echo "  Cluster : $(/usr/local/bin/kind get clusters 2>/dev/null || echo 'N/A')"
echo ""
echo "  Next steps:"
echo "    1. Log out and back in (for docker group)"
echo "    2. Clone your repo:  git clone <your-repo-url> ~/doctor-appointment-system"
echo "    3. Run deployment:   Your GitHub Actions workflow will handle the rest"
echo ""
echo "=========================================="

