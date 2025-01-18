export type nixOSFlake = {
    darwinModules:{[key:string]:string},
    homeConfigurations:{type:"unknown"},
    homeModules: {type: "unknown"},
    lib:{type:"unknown"},
    nixosConfigurations:{
        [key:string]:{
            type: "nixos-configurations" | "unknown"
        }
    }
    nixosModules:{
        [key:string]:{
            type: "nixos-module" | "unknown"
        }
    }
    overlays:{
        [key:string]:{
            type: "nixpkgs-overlay" | "unknown"
        }
    }
    pkgs:{
        [key:string]:{
            type: string //TODO: Make this more specific
        }
    }
    snowfall:{
        [key:string]:{
            type: unknown
        }
    }
    templates:{
        [key:string]:any //TODO: Make this more specific
    }
}
export type nixOSPackage = {
    description: string,
    name: string,
    type: string
}

export type nixOSArchitecture = "x86_64-linux" | "aarch64-darwin" | "aarch64-linux" | "unknown"
