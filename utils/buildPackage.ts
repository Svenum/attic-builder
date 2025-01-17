import type {Logger} from "./logger.ts";
import {$} from "bun"
import * as os from "node:os";
import type {nixOSArchitecture, nixOSPackage} from "./types";
export default async function buildPackage(arch:string, packages:{[key:string]:nixOSPackage}, flake_dir:string, parentLogger:Logger):Promise<void>{

    //we want this function to be blocking, as we want to wait for the system to be built
    //in the future we could parallelize (bun sub processes) this, but for now we'll keep it simple
    return new Promise(async (resolve, reject)=>{
        parentLogger.log("DEBUG", `Getting System Arch`)
        //get the system arch and exit if it's not supported by the current arch
        let system = os.platform()
        parentLogger.log("DEBUG", `Nixos Package Arch: ${system}`)
        parentLogger.log("DEBUG", `Running on: ${os.arch()} ${os.platform()}`)

        //TODO: Implement QEMU Option for cross compiling
        if(arch.includes("x86_64-linux") && os.arch() == "x64" && os.platform() == "linux"){
            parentLogger.log("INFO", `Building x86 System Packages`)
        }
        else if(arch.includes("aarch64-linux") && os.arch() == "arm64" && os.platform() == "linux"){
            parentLogger.log("INFO", `Building ARM System Packages`)
        }
        else{
            parentLogger.log("ERROR", `System Arch: ${arch} does not match the current system arch: ${os.arch()} ${os.platform()}. Building this system is currently not implemented`)
            reject()
        }

        //check the max jobs
        let maxJobs = 2
        if(process.env.MAX_JOBS){
            parentLogger.log("DEBUG", `Setting max jobs to: ${process.env.MAX_JOBS}`)
            maxJobs = parseInt(process.env.MAX_JOBS)
            if(!maxJobs || maxJobs < 1 || isNaN(maxJobs)){
                parentLogger.log("ERROR", `MAX_JOBS is set to an invalid value: ${process.env.MAX_JOBS}, will use default value of 2`)
                maxJobs = 2
            }
        }
        for(let pkg of Object.keys(packages)){
            parentLogger.log("INFO", `Building Package: ${pkg}`)
            let nixPKG:nixOSPackage = packages[pkg]
            if(!nixPKG.description && !nixPKG.name && !nixPKG.type){
                parentLogger.log("WARN", `Package: ${nixPKG.name} does not have a description, name and type. Skipping.`)
                continue
            }

            //build the package and push that to attic
            await $`
                cd ${flake_dir}
                pwd
                nix build --accept-flake-config .#packages.${arch}.${pkg} --max-jobs ${maxJobs} ${process.env.DONT_FAIL && process.env.DONT_FAIL =="true" ? "--keep-going" : ""}
            `.catch((err)=>{
                parentLogger.log("ERROR", `Failed to build package: ${nixPKG.name} with error: ${err}`)
                parentLogger.log("DEBUG", `Used Command: nix build --accept-flake-config .\\#packages.${arch}.${pkg} --max-jobs ${maxJobs} ${process.env.DONT_FAIL && process.env.DONT_FAIL =="true" ? "--keep-going" : ""}`)
            })
            .finally(()=>{
                parentLogger.log("INFO", `Done with package: ${nixPKG.name}`)
            })

            await $`
                cd ${flake_dir}
                attic push ${process.env.ATTIC_CACHE_NAME} ./result
            `.catch((err)=>{
                parentLogger.log("ERROR", `Failed to push package: ${nixPKG.name} with error: ${err}`)
            })
            .finally(()=>{
                parentLogger.log("INFO", `Pushed package: ${nixPKG.name}`)
            })
            //cleanup phase (if we are supposed too)
            if(process.env.LITTLE_SPACE && process.env.LITTLE_SPACE == "true"){
                parentLogger.log("INFO", `Cleaning up old paths...`)
                await $`
                rm -rf ./result 
                rm -rf ~/.cache/nix 
                rm -rf /homeless-shelter
                nix store gc 
                nix store optimise
            `.catch((err)=>{
                    parentLogger.log("ERROR", `Failed to cleanup: ${err}`)
            })
            .finally(()=>{
                parentLogger.log("INFO", `Cleaned up old paths`)
            })
            }
            parentLogger.log("INFO", `Done with package: ${nixPKG.name}`)
        }
        parentLogger.log("INFO", `Built packages for arch: ${arch}`)
        resolve()
    })
}