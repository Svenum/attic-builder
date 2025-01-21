FROM ubuntu:latest
RUN DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && apt-get upgrade -y

# Install deps
RUN apt-get install curl wget xz-utils htop -y
# Install the current nix version
RUN wget https://nixos.org/nix/install
RUN sed "1s/.*/\#\!\/bin\/bash/" install >> install.sh
RUN bash ./install.sh --daemon --yes
# Add nix to the path
ENV PATH="$PATH:/root/.nix-profile/bin"
# Copy files
WORKDIR /builder
COPY ./docker/run.sh /builder
COPY . /builder
# Install bun
RUN nix-shell -p bun --run "bun install"
ENTRYPOINT ["nix-shell", "--run", "bun run debug-docker"]