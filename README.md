# attic-builder
This Project aims to provide a Github Action and Docker container which automatically builds and pushes nix configurations and packages to an attic instance.
# Development
To get up and running with development, you can use the following commands:
```bash
nix-shell . #This will install all the necessary dependencies for you
bun install #This will install the bun dependencies for you
bun run build #This will run the script for you which does the building and pushing to attic. BEFORE you run this, fill in your .env file with the envs in the .env.example file
docker-compose up --build #This will build the docker container and run it for you (you have to provide the docker-compose.yml file)
```
# Environment Variables
```bash
# Env-Vars
```dotenv
#Docker variables
GIT_INIT: "false" #Set to true if you want the fetcher to clone the nixconfig repo
GITHUB_REPO: "" #The git repo to clone (NOT the link just the name of the repo)
GITHUB_BRANCH: "" #The branch to clone
GITHUB_USER: "" #The username of your GIT_TOKEN
GITHUB_TOKEN: "" #The token of your GIT_USER
BUILD_ON_STARTUP: "false" #If set to true, the script will run the build on startup of the container
FREQUENCY: "60000" #The frequency in which the script will check for new commits in the repo (in ms) (defaults to 60000)
MINIMUM_INTERVAL_BETWEEN_BUILDS: "2d" #The minimum interval between two builds (defaults to 2d) (can be in ms, s, m, h, d)

#General variables
FLAKE_PATH: "" #The path to your git repo (defaults to /builder in the container and ./ in the github action)
BUILD_SYSTEMS: "true" #If set to true, the script will build the systems
BUILD_PACKAGES: "true" #If set to true, the script will build the packages
INSTALL_DEPS: "true" #If set to true, the script will install the dependencies
NO_KEEP_ATTIC_CONF: "true" #If set to true, the script will not keep the attic.conf file and remove it before re-configuring
LITTLE_SPACE: "true" #Recommended to set this to true in the Docker, cleans up the nix store after each build
ONLY_BUILD_SYSTEMS: "comma,seperated,list,of,hosts" #Only build the systems in this list, if you do not provide this, all will be built
ATTIC_CACHE_NAME: "" #REQUIRED: The name of the attic cache
ATTIC_CACHE_URL: "http://attic:8080" #REQUIRED: The url of the attic cache (in a docker-compose setup it's recommended to use the service name, to avoid bandwidth hits)
ATTIC_CACHE_TOKEN: "" #REQUIRED: The token to use for the attic cache
MAX_JOBS: 2 #The maximum number of jobs to run at once
DONT_FAIL: "true" #If set to true, the script will append the --keep-going to nix build

LOG_LEVEL: "DEBUG" #The log level of the script (can be DEBUG, INFO, WARNING, ERROR)
JSON_LOGGING: "false" #If set to true, the script will log in json format
```

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
# Docker
If you want to run this project in a docker container that periodically fetches a git repo and builds it, you can use the docker-compose file:
```yaml
services:
  attic:
    image: ghcr.io/zhaofengli/attic:latest
    volumes:
      - ./attic/server.toml:/attic/server.toml
      - ./attic/server.db:/attic/server.db
      - ./attic-storage:/attic/storage
    command: [ "-f", "/attic/server.toml" ]
    ports:
      - 8080:8080
  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: attic
      POSTGRES_USER: attic
      POSTGRES_PASSWORD: attic
    volumes:
      - ~/attic/attic/postgres:/var/lib/postgresql/data
    ports:
      - 5432:5432
  fetcher:
    build: .
    volumes:
      - ./nixconfig:/nixconfig #You can provide your own nixconfig either as a volume, or you can skip this and set the GIT_INIT var to true so that the fetcher will clone the nixconfig repo
    environment:
      GIT_INIT: "true" #Set to true if you want the fetcher to clone the nixconfig repo
      GITHUB_REPO: "" #The git repo to clone (NOT the link just the name of the repo)
      GITHUB_BRANCH: "" #The branch to clone
      GITHUB_USER: "" #The username of your GIT_TOKEN
      GITHUB_TOKEN: "" #The token of your GIT_USER
      FLAKE_PATH: "" #The path to your git repo (defaults to /builder in the container and ./ in the github action)
      BUILD_ON_STARTUP: "true" #If set to true, the script will build all systems on startup of the container
      FREQUENCY: "60000" #The frequency in milliseconds to check for new commits in milliseconds (defaults to 60 Seconds)
      #You can also provide all the environment variables supported by the Github action
      #For a more detailed explanation of what these do, please refer to the readme.md
      BUILD_SYSTEMS: "true"
      BUILD_PACKAGES: "true"
      INSTALL_DEPS: "true"
      NO_KEEP_ATTIC_CONF: "true"
      LITTLE_SPACE: "true" #Recommended to set this to true in the Docker
      ONLY_BUILD_SYSTEMS: "" #Only build the systems in this list, if you do not provide this, all will be built
      ATTIC_CACHE_NAME: "" #REQUIRED: The name of the attic cache
      ATTIC_CACHE_URL: "http://attic:8080" #REQUIRED: The url of the attic cache (in a docker-compose setup it's recommended to use the service name, to avoid bandwidth hits)
      ATTIC_CACHE_TOKEN: "" #REQUIRED: The token to use for the attic cache
      MAX_JOBS: 2 #The maximum number of jobs to run at once
      DONT_FAIL: "true" #If set to true, the script will append the --keep-going to nix build
      LOG_LEVEL: "DEBUG" #The log level of the script (can be DEBUG, INFO, WARNING, ERROR)
      JSON_LOGGING: "false" #If set to true, the script will log in json format
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
