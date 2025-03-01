import {$} from 'bun'
import dotenv from 'dotenv'
import {Logger} from "./utils/logger.ts";
import buildSystem from "./utils/buildSystem.ts";
import type {nixOSFlake, nixOSPackage} from "./utils/types";
import buildPackage from "./utils/buildPackage.ts";
const log = new Logger()
dotenv.config()
log.setLogLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL as any : "DEBUG")
log.setJsonLogging(process.env.JSON_LOGGING && process.env.JSON_LOGGING == "true" ? true : false)

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
    log.log("DEBUG", "NO_KEEP_ATTIC_CONF is set, will try to remove config dir")
    await $`rm -rf ~/.config/attic`
}

//validate the attic conf and configure attic for our use cases
log.log("INFO", "Configuring Attic")
if(!process.env.ATTIC_CACHE_URL || !process.env.ATTIC_CACHE_TOKEN || !process.env.ATTIC_CACHE_NAME){
    log.log("ERROR", "attic cache env vars aren't set, this is required for attic to work. Please set the env variables ATTIC_CACHE_NAME ATTIC_CACHE_URL ATTIC_CACHE_TOKEN to your attic cache.")
    process.exit(1)
}
await $`
    attic login local ${process.env.ATTIC_CACHE_URL} ${process.env.ATTIC_CACHE_TOKEN}
`.catch((err)=>{
    log.log("ERROR", `Failed to login to attic: ${err}`)
    process.exit(1)
})

// check if cache exists and create if not
await $`
  attic cache info ${process.env.ATTIC_CACHE_NAME}
`.catch(async (err)=>{
  log.log("WARN", `Cache ${process.env.ATTIC_CACHE_NAME} not found`)
    log.log("INFO", `Creating cache ${process.env.ATTIC_CACHE_NAME}`)
    await $`
      attic cache create ${process.env.ATTIC_CACHE_NAME}
    `.catch((err)=>{
      log.log("ERROR", `Failed to create cache: ${process.env.ATTIC_CACHE_NAME}`)
    })
})

//change directory to the flake dir
await $`cd ${flake_path}`.catch((err)=>{
    log.log("ERROR", `Cannot cd to flake path: ${flake_path}, this is unexpected. The Program cannot continue. (Error was: ${err})`)
    process.exit(1)
})
//fetch the systems
log.log("INFO", "Fetching Systems")

const {systems} = await $`
    cd ${flake_path} 
    nix --extra-experimental-features nix-command --extra-experimental-features flakes flake show --json
    `.json().then((systems:nixOSFlake):{systems:object}=>{
        log.log("DEBUG", `Fetched Systems: ${JSON.stringify(systems.nixosConfigurations)}`)
        return {systems: systems.nixosConfigurations}
    })
    .catch((err):any=>{
        log.log("ERROR", `Error whilst fetching system configurations: ${err.stderr.toString()}, ${err.stdout.toString()}`)
        if(process.env.BUILD_SYSTEMS && process.env.BUILD_SYSTEMS == "false"){
            log.log("WARN", "Ignored previous error due to user not requesting to build systems (set $BUILD_PACKAGES to true if you wish to build systems)")
        }
        else{
            process.exit(1)
        }
    })
let systemNames = Object.keys(systems)
//check if we should build only specific systems
if(process.env.ONLY_BUILD_SYSTEMS && (!process.env.BUILD_SYSTEMS || process.env.BUILD_SYSTEMS == 'false')){
    //log an error, because this is a contradiction and most likely a mistake
    log.log("WARN", "You have chosen **not** to build systems but you have also set the ONLY_BUILD_SYSTEMS env var, this is a contradiction, please set BUILD_SYSTEMS to true if you wish to build systems (will skip building systems this run)")
}
if(process.env.ONLY_BUILD_SYSTEMS){
    //set the new systems array
    let newSystems = []
    for(let requestedSystemName of process.env.ONLY_BUILD_SYSTEMS.split(',')){
        if(!systemNames.includes(requestedSystemName)){
            log.log("WARN", `The requested system: ${requestedSystemName} is not in the list of available systems: ${systemNames}, will ignore this system`)
            continue
        }
        newSystems.push(requestedSystemName)
    }
    systemNames = newSystems
}

//if the BUILD_SYSTEMS var is set to true, then we need to build each system
if(process.env.BUILD_SYSTEMS && process.env.BUILD_SYSTEMS == 'true' && systems){
    log.log("DEBUG", `Systems to build: ${systemNames}`)
    for (let system of systemNames) {
        log.log('DEBUG', `Building ${system}`)
        await buildSystem(system, flake_path, log).catch((err)=>{
            log.log("ERROR", `Failed to build system: ${system}, error: ${err}. This doesn't indicate a catastrophic failure, so will continue the building of other systems`)
        })
        log.log("INFO", `Done with system: ${system}`)
    }
}

//fetch the packages
log.log("INFO", "Fetching Packages")
const packages:{ [p: string]: { [p: string]: nixOSPackage } } | void = await $`
    cd ${flake_path}
    nix --extra-experimental-features nix-command --extra-experimental-features flakes flake show --json 2> /dev/null | jq -r '.packages'
`.json().then((packages:{[key:string]:{[key:string]:nixOSPackage}})=>{
    return packages
}).catch((err)=>{
    log.log("ERROR", `Failed to fetch packages: ${err.stderr.toString()}`)
})

//if the BUILD_PACKAGES var is set to true, then we need to build each package
if(process.env.BUILD_PACKAGES && process.env.BUILD_PACKAGES == 'true' && packages){
    log.log("DEBUG", `Packages to build: ${Object.keys(packages)}`)
    for(let arch of Object.keys(packages)){
        log.log("INFO", `Building Packages for Arch: ${arch}`)
        await buildPackage(arch, packages[arch], flake_path, log).catch((err)=>{
            log.log("ERROR", `Failed to build packages for Arch: ${arch}, error: ${err}. This doesn't indicate a catastrophic failure, so will continue the building of other arches`)
        })
        log.log("INFO", `Done with packages for Arch: ${arch}`)
    }
}

log.log("INFO", "Done!")
