import {$} from 'bun'
import dotenv from 'dotenv'
import {Logger} from "./utils/logger.ts";
import buildSystem from "./utils/buildSystem.ts";
import type {nixOSFlake} from "./utils/types";
const log = new Logger()
log.setLogLevel('DEBUG')
log.setJsonLogging(false)
dotenv.config()
//check env vars
let flake_path= "./"
//check if flake_path exists and set it
if(process.env.FLAKE_PATH && await $`cd ${process.env.FLAKE_PATH}`.catch(()=>{return false}).finally(()=>{return true})){
    log.log("DEBUG", "FLAKE_PATH is set and exists!")
    flake_path = process.env.FLAKE_PATH
}
else if(process.env.FLAKE_PATH
    && !await $`cd ${process.env.FLAKE_PATH}`.catch(()=>{return false}).finally(()=>{return true})
    || !process.env.FLAKE_PATH){
    log.log("DEBUG", "FLAKE_PATH has not been set or is faulty, will use default path")
}

//remove the attic conf if it should not be kept
if(process.env.NO_KEEP_ATTIC_CONF || process.env.NO_KEEP_ATTIC_CONF == 'true'){
    log.log("DEBUG", "NO_KEEP_ATTIC_CONF is set, will try remove config dir")
    await $`rm -rf ~/.config/attic`
}

//check if deps should be installed and then install them if configured
if(process.env.INSTALL_DEPS && process.env.INSTALL_DEPS != "false"){
    //install deps
    log.log("INFO", "Installing Dependencies")
    $`nix-env -iA attic-client -f '<nixpkgs>' || exit 1`.catch((err)=>{
        log.log("ERROR", `Failed to install attic-client dependency: ${err}`)
    }).finally(()=>{
        log.log("DEBUG", "Done with installing deps")
    })
} else{
    log.log("WARN", `You have chosen **not** to install deps or you have forgotten to set the env var, if you see any problems with this, try rerunning with the $INSTALL_DEPS env var set to true`)
}

//change directory to the flake dir
await $`cd ${flake_path}`.catch((err)=>{
    log.log("ERROR", `Cannot cd to flake path: ${flake_path}, this is unexpected. The Programm cannot continue`)
    process.exit(1)
})
//fetch the systems
log.log("INFO", "Fetching Systems")
const systems = await $`
    cd ${flake_path} 
    nix flake show --json
    `.json().then((systems:nixOSFlake)=>{
        return systems.nixosConfigurations
    })
    .catch((err)=>{
        log.log("ERROR", `Error whilst fetching system configurations ${err}`)
        if(process.env.BUILD_SYSTEMS && process.env.BUILD_SYSTEMS == "true"){
            log.log("WARN", "Ignored previous error due to user not requesting to build systems (set $BUILD_PACKAGES to true if you wish to build systems)")
        }
        else{
            process.exit(1)
        }
    })

//if the BUILD_SYSTEMS var is set to true, then we need to build each system
if(process.env.BUILD_SYSTEMS && process.env.BUILD_SYSTEMS == 'true' && systems){
    for (let system of Object.keys(systems)) {
        log.log('DEBUG', `Building ${system}`)
        await buildSystem(system, flake_path, log)
    }
}