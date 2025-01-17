# attic-builder
This Program/Script builds a flake and pushes all its dependencies to attic
# Development
To get up and running with development, you can use the following commands:
```bash
nix-shell . #This will install all the necessary dependencies for you
bun install #This will install the bun dependencies for you
bun run build #This will run the script for you which does the building and pushing to attic. BEFORE you run this, fill in your .env file with the envs in the .env.example file
```
# Env-Vars
TODO: Add infos about env-vars
# Usage
Create `.github/workflows/build.yml` in your repo with the following contents:

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
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - uses: Svenum/attic-builder@v1
        with:
          build_systems: true
          build_packages: true
          attic_url: https://attic.example.tld/
          attic_cache: CACHENAME
          attic_token: ${{ secrets.ATTIC_TOKEN }}
          no_keep_attic_conf: false # Optional, set to true to not keep the attic config (usefull if you've changed something in your conf and the config is still in the cache)
          dont_fail: false #Optional, set to true to not fail the build if a system fails one or two packages (appends the --keep_going flag to nix-build)
          max_jobs: 2 #Optional, set to the amount of jobs you want to run in parallel (appends the --max_jobs flag to nix-build)
          only_build_systems: <hostname1>,<hostname2> #Optional, set to only build the specified systems
          
```

# Setup attic
Setting up Attic is described here: //docs.attic.rs/tutorial.html

# Generate a token
```bash
atticadm -f /path/to/server.toml --sub 'github' --push 'CACHENAME' --validity '1y'
```

# Known Issues
- On large Flakes the build sometimes is failing cause of 'to little diskspace'
    - **Workaround:** Use self-hosted GitHub runner.
        - [Self-Hosted Docker Runner](https://github.com/myoung34/docker-github-actions-runner)
        - [Self-Hosted GitHub Runner Docs](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners)

# Future Ideas
- Creating a Docker Container that automatically fetches one or more Repos and builds it localy periodically
- optionally updating flake with `nix flake update` before run.
- Rewrite in pyhton
