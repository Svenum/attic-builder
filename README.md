# attic-builder
This Program/Script build an flake and pushes all its dependencies to attic

# Usage
Create `.github/workflows/build.yml` in you repo with the following contents:

```yaml
name: "Build"
on:
  push:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cachix/install-nix-action@v27
        with:
          nix_path: nixpkgs=channel:nixos-unstable
      - uses: Svenum/attic-builder@v1
        with:
          build_systems: true
          build_packages: true
          attic_url: https://attic.example.tld/
          attic_cache: CACHENAME
          attic_token: ${{ secrets.ATTIC_TOKEN }}
```
# Setup attic
Setting up Attic is here described: //docs.attic.rs/tutorial.html

# Generate a token
```bash
atticadm -f /path/to/server.toml --sub 'github' --push 'CACHENAME' --validity '1y'
```

# Known Issues
- On large Flakes the build sometimes is failing 'cause of to little diskspace
    - **Workaround:** Use self-hosted GitHub runner.
        - [Self-Hosted Docker Runner](https://github.com/myoung34/docker-github-actions-runner)
        - [Self-Hosted GitHub Runner Docs](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners)

# Future Ideas
- Creating a Docker Container that automatically fetch one or more Repos and build it periotically local
- optionally updating flake with `nix flake update` before run.
- Rewrite in pyhton
