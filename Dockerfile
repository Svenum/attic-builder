FROM tonistiigi/binfmt:latest AS binfmt

FROM ubuntu:latest AS base
# Install deps
ENV DEBIAN_FRONTEND=noninteractive
RUN <<EOF
  apt-get update -y && apt-get upgrade -y
  apt-get install --no-install-recommends curl wget xz-utils htop ca-certificates -y
  apt-get install --no-install-recommends qemu-user-static binfmt-support -y
  curl -L https://nixos.org/nix/install | sh -s -- --daemon --yes
  apt-get auto-clean
EOF

# Copy files
WORKDIR /builder
COPY ./docker/run.sh /builder
COPY . /builder

# Add nix to the path
ENV PATH="$PATH:/root/.nix-profile/bin"

# Configure Nix
RUN <<EOF
    echo extra-platforms = aarch64-linux i686-linux >> /etc/nix/nix.conf
    echo system-features = nixos-test benchmark big-parallel kvm >> /etc/nix/nix.conf
    echo extra-sandbox-paths = /usr/bin/qemu-aarch64 >> /etc/nix/nix.conf
    echo extra-experimental-features = nix-command flakes >> /etc/nix/nix.conf
    echo always-allow-substitutes = true >> /etc/nix/nix.conf
EOF


COPY --from=binfmt /usr/bin/ /usr/bin/

# Install bun and qemu
RUN nix-shell -p bun --run "bun install"

ENTRYPOINT [ "./entrypoint.sh" ]
