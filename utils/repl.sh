#!/usr/bin/env bash
nix --extra-experimental-features repl-flake repl ".#nixosConfigurations.\"$1\".pkgs" <<< ":p system"  2> /dev/null