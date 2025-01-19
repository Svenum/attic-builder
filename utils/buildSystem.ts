import type {Logger} from "./logger.ts";
import {$} from "bun"
import * as os from "node:os";
import type {nixOSArchitecture} from "./types";
import * as path from "node:path";
export default async function buildSystem(name:string, flake_dir:string, parentLogger:Logger):Promise<void>{

    //we want this function to be blocking, as we want to wait for the system to be built
    //in the future we could parallelize (bun sub processes) this, but for now we'll keep it simple
    return new Promise(async (resolve, reject)=>{
        parentLogger.log('INFO', `Building System: ${name} with flake_dir: ${flake_dir}`)
        parentLogger.log("DEBUG", `Getting System Arch`)

        //buffer for stdout of the repl.sh script
        const buffer = Buffer.alloc(100);
        //get the directory of the root of the project (we are currently in the nixconfig directory)
        const dir = path.join(__dirname, "..")
        parentLogger.log("DEBUG", `Dir: ${dir}`)
        //get the system arch of the system we're supposed to be building
        await $`
            cd ${flake_dir}
            bash ${dir}/utils/repl.sh ${name} > ${buffer}`.catch((err)=>{
            parentLogger.log("ERROR", `Failed to get system arch: ${err.stderr.toString()}`)
        })
        const system:nixOSArchitecture = buffer.toString().replaceAll('\n', '').replaceAll(" ", '') as nixOSArchitecture
        parentLogger.log("DEBUG", `Nixos System Arch: ${system}`)
        parentLogger.log("DEBUG", `Running on: ${os.arch()} ${os.platform()}`)

        //TODO: Implement QEMU Option for cross compiling
        if(system.includes("x86_64-linux") && os.arch() == "x64" && os.platform() == "linux"){
            parentLogger.log("INFO", `Building x86 System: ${name}`)
        }
        else if(system.includes("aarch64-linux") && os.arch() == "arm64" && os.platform() == "linux"){
            parentLogger.log("INFO", `Building ARM System: ${name}`)
        }
        else{
            parentLogger.log("ERROR", `System Arch: ${system} does not match the current system arch: ${os.arch()} ${os.platform()}. Building this system is currently not implemented`)
            reject()
        }

        //check if we should keep going after an error or we should stop the build and continue to the next system
        let dontFail = false
        if(process.env.DONT_FAIL && process.env.DONT_FAIL == "true"){
            dontFail = true
            parentLogger.log("WARN", `DONT_FAIL is set, will try my best to build this configuration even if there are errors`)
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

        //build the system and push to attic
        await $`
            cd ${flake_dir}
            nix --extra-experimental-features nix-command --extra-experimental-features flakes build --accept-flake-config .#nixosConfigurations.${name}.config.system.build.toplevel --max-jobs ${maxJobs} ${dontFail ? "--keep-going" : ""}
        `.catch((err)=>{
            parentLogger.log("ERROR", `Failed to build system: ${name}, error: ${err}`)
            parentLogger.log("DEBUG", `Command used: nix --extra-experimental-features nix-command --extra-experimental-features flakes build --accept-flake-config \\.#nixosConfigurations.${name}.config.system.build.toplevel --max-jobs ${maxJobs} ${dontFail ? "--keep-going" : ""}`)
        })
        .finally(()=>{
            parentLogger.log("INFO", `Built System: ${name}`)
        })

        //push to attic
        parentLogger.log("INFO", "Pushing to attic")
        $`
            cd ${flake_dir}
            attic push ${process.env.ATTIC_CACHE_NAME} ./result
        `.catch((err)=>{
            parentLogger.log("ERROR", `Failed to push to attic: ${err.stderr.toString()}`)
        })
        .then(()=>{
            parentLogger.log("INFO", `Pushed to attic`)
        })
        //cleanup phase (if we are supposed too)
        if(process.env.LITTLE_SPACE && process.env.LITTLE_SPACE == "true"){
            parentLogger.log("INFO", `Cleaning up old paths...`)
            await $`
                rm -rf ./result 
                rm -rf ~/.cache/nix 
                rm -rf /homeless-shelter
                nix --extra-experimental-features nix-command --extra-experimental-features flakes store gc 
                nix --extra-experimental-features nix-command --extra-experimental-features flakes store optimise
            `.catch((err)=>{
                parentLogger.log("ERROR", `Failed to cleanup: ${err.stderr.toString()}`)
            })
            .finally(()=>{
                parentLogger.log("INFO", `Cleaned up old paths`)
            })
        }

        parentLogger.log("INFO", `Finished Building System: ${name}`)
        resolve()
    })
}