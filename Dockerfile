FROM ubuntu:latest

# Install deps
RUN <<EOF
  DEBIAN_FRONTEND=noninteractive
  apt-get update -y && apt-get upgrade -y
  apt-get install curl wget xz-utils htop binfmt-support -y
  update-binfmts --enable
  wget https://nixos.org/nix/install
  sed "1s/.*/\#\!\/bin\/bash/" install >> install.sh
  bash ./install.sh --daemon --yes 
  wget https://github.com/multiarch/qemu-user-static/releases/download/v7.2.0-1/qemu-aarch64-static -o /usr/bin/qemu-aarch64-static
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
    echo extra-sandbox-paths = /usr/bin/qemu-aarch64-static >> /etc/nix/nix.conf
    echo extra-experimental-features = nix-command flakes >> /etc/nix/nix.conf
    echo always-allow-substitutes = true >> /etc/nix/nix.conf
EOF

# Install bun
RUN nix-shell -p bun --run "bun install"
ENTRYPOINT ["nix-shell", "--run", "bun run debug-docker"]
