#!/usr/bin/env bash

echo "Enable binfmt"
update-binfmts --enable
echo ':qemu-aarch64:M::\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00\xb7\x00:\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff:/usr/bin/qemu-aarch64-static:' >> /proc/sys/fs/binfmt_misc/register

echo "Start docker"
nix-shell --run "bun run debug-docker"

