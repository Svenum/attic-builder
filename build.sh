#!/run/current-system/sw/bin/bash

PWD=$(pwd)
FLAKEPATH=$1

push() {
  echo Pushing ...
  attic push holynix ./result
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
            nix build .\#packages.$ARCH.$PACKAGE
            if [ $? -eq 0 ]; then
              echo $ARCH.$PACKAGE was build!
              push
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
      nix build .\#nixosConfigurations.$SYSTEM.config.system.build.toplevel
      if [ $? -eq 0 ]; then
        echo $SYSTEM was build!
        push
      else
        echo $SYSTEM bild failed!
      fi
      echo
      echo
    done
  else
    echo No systems in flake found!
  fi
}

main() {
  if [ ! -d $FLAKEPATH ]; then 
    echo $FLAKEPATH is not a vaild path
    echo Usage: $0 [Path to Directory with flake]
    exit 1
  fi

  if [[ "$FLAKEPATH" != "" ]]; then
    cd $FLAKEPATH
  fi

  build_systems
  build_packages
  
  if [[ "$FLAKEPATH" != "" ]]; then
    cd $PWD
  fi
}

main
