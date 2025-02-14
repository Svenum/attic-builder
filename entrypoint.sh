#!/usr/bin/env bash

echo "Installing binfmt"
update-binfmts --enable
binfmt --install all

echo "Start docker"
nix-shell --run "bun run debug-docker"

