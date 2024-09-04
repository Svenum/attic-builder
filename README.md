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
      - uses: action/checkout@v4
      - uses: cachix/install-nix-action@v27
      - uses: Svenum/attic-builder
        with:
          build_systems: true
          build_packages: true
          attic_url: https://attic.example.tld/
          attic_cache: CACHENAME
          attic_token: ${{ secret.ATTIC_TOKEN }}
```
# Setup attic
Setting up Attic is here described: //docs.attic.rs/tutorial.html

# Generate a token
```bash
atticadm -f /path/to/server.toml --sub 'github' --push 'CACHENAME' --validity '1y'
```
