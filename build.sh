#!/usr/bin/env bash

PWD=$(pwd)
FLAKE_PATH=$1

install_deps() {
  nix-env -iA attic-client -f '<nixpkgs>'
}

free_space() {
  if [[ $INPUTS_LITTLE_SPACE == 'true' ]]; then
    echo Deleting old paths...
    rm -rf \
      ./result \
      ~/.cache/nix

    nix store gc 
    nix store optimise
  fi
}

login() {
  if ! attic cache info $INPUTS_ATTIC_CACHE; then
    echo Configuring attic client...
    attic login local $INPUTS_ATTIC_URL $INPUTS_ATTIC_TOKEN
  fi
}

push() {
  echo Pushing ...
  attic push $INPUTS_ATTIC_CACHE ./result
}

build_packages() {
  # Prepare VARS
  PACKAGE_ARCHS=$(nix flake show --json 2> /dev/null | jq -r '.packages | keys[]' | tr '\n' ' ')
  SUPPORTED_ARCHS_REGEX="^($(echo $system$(cat /etc/nix/nix.conf | grep extra-platforms | cut -d "=" -f 2) | tr " " "|"))$"

  # Build Packages
  if [[ "$PACKAGE_ARCHS" != "" ]]; then
    for ARCH in $PACKAGE_ARCHS; do
      if [[ "$ARCH" =~ $SUPPORTED_ARCHS_REGEX ]]; then
        PACKAGES=$(nix flake show --json 2> /dev/null | jq -r '.packages["'"$ARCH"'"] | keys[]' | tr '\n' ' ')

        if [[ "$PACKAGES" != "" ]]; then
          for PACKAGE in $PACKAGES; do
            echo Building $ARCH.$PACKAGE
            nix build --accept-flake-config .\#packages.$ARCH.$PACKAGE --max-jobs 2
            if [ $? -eq 0 ]; then
              echo $ARCH.$PACKAGE was build!
              push
              # Frees up space if $INPUTS_LITTLE_SPACE is true
              free_space
            else
              echo $ARCH.$PACKAGE build failed!
            fi
              echo
              echo
          done
        else
          echo No packages for arch $ARCH in flake found!
        fi
      else
        echo $ARCH is not supported on your system!
      fi
    done
  else
    echo No packages in flake found!
  fi
}

build_systems() {
  # Prepare VARS
  SYSTEMS=$(nix flake show --json 2> /dev/null | jq -r '.nixosConfigurations | keys[]' | tr '\n' ' ')
  
  if [[ "$SYSTEMS" != "" ]]; then
    # Build systems
    for SYSTEM in $SYSTEMS; do
      echo Building $SYSTEM ...
      if [[ $INPUTS_SHOW_TRACE == 'true' ]] 
      then
        echo Building with show-trace
        ls -la
        nix build --accept-flake-config .\#nixosConfigurations.$SYSTEM.config.system.build.toplevel --max-jobs 2 --show-trace -L
      else
        nix build --accept-flake-config .\#nixosConfigurations.$SYSTEM.config.system.build.toplevel --max-jobs 2
      fi
      if [ $? -eq 0 ]; then
        echo $SYSTEM was build!
        push
        # Frees up space if $INPUTS_LITTLE_SPACE is true
        free_space
      else
        echo $SYSTEM build failed!
        exit 1
      fi
      echo
      echo
    done
  else
    echo No systems in flake found!
  fi
}

main() {
  if [ ! -d $FLAKE_PATH ]; then 
    echo $FLAKE_PATH is not a vaild path
    echo Usage: $0 [Path to Directory with flake]
    exit 1
  fi

  if [[ $INPUTS_INSTALL_DEPS == true ]]; then
    install_deps
  fi
  login

  if [[ "$FLAKE_PATH" != "" ]]; then
    cd $FLAKE_PATH
  fi

  if [[ ($INPUTS_BUILD_SYSTEMS == 'true') || ($INPUTS_BUILD_SYSTEMS == '') ]]; then
    build_systems
  fi

  if [[ $INPUTS_BUILD_PACKAGES == 'true' || ($INPUTS_BUILD_PACKAGES == '') ]]; then
    build_packages
  fi
  
  if [[ "$FLAKE_PATH" != "" ]]; then
    cd $PWD
  fi
}

main

