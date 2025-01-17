# attic-builder
This Project aims to provide a Github Action and Docker container which automatically builds and pushes nix configurations and packages to an attic instance.
# Development
To get up and running with development, you can use the following commands:
```bash
nix-shell . #This will install all the necessary dependencies for you
bun install #This will install the bun dependencies for you
bun run build #This will run the script for you which does the building and pushing to attic. BEFORE you run this, fill in your .env file with the envs in the .env.example file
```
To build the Docker container, run the following command from the root of the project:
```bash
docker build . -t attic-builder
```
# Env-Vars
- `BUILD_SYSTEMS` - Set to `true` to build systems, `false` to not build systems
- `BUILD_PACKAGES` - Set to `true` to build packages, `false` to not build packages
- `FLAKE_PATH` - Path to the flake you want to build (if it's not set, the current directory will be used)
- `NO_KEEP_ATTIC_CONF` - Set to `true` to not keep the attic config (usefull if you've changed something in your conf and the config is still in the cache)
- `DONT_FAIL` - Set to `true` to not fail the build if a system fails one or two packages (appends the --keep_going flag to nix-build)
- `MAX_JOBS` - Set to the amount of jobs you want to run in parallel (appends the --max_jobs flag to nix-build)
- `LITTLE_SPACE` - Set to `true` to not fail the build if there is to little diskspace (appends the --fallback flag to nix-build)
- `ONLY_BUILD_SYSTEMS` - Set to only build the specified systems (comma separated list of hostnames)
- `ATTIC_CACHE_URL` - (Required) The URL of the attic instance
- `ATTIC_CACHE_NAME` - (Required) The name of the cache in attic
- `ATTIC_CACHE_TOKEN` - (Required) The token to authenticate with the attic instance
- `LOG_LEVEL`- Set the log level (default: INFO, possible values: DEBUG, INFO, WARNING, ERROR)
- `JSON_LOGGING` - Set to `true` to log in JSON format (default false)
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
