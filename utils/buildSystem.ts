import type {Logger} from "./logger.ts";
import {$, spawn} from "bun"
export default async function buildSystem(name:string, flake_dir:string, parentLogger:Logger):Promise<void>{
    return new Promise(async (resolve, reject)=>{
        parentLogger.log('INFO', `Building System: ${name} with flake_dir: ${flake_dir}`)
        parentLogger.log("DEBUG", `Getting System Arch`)
        const subProcess =spawn(["nix", "repl"], {
            cwd: flake_dir,
            stdin: "pipe",
            stdout: "pipe",
        })
        if(subProcess){
            parentLogger.log("DEBUG", `Subprocess started`)
            subProcess.stdin.write(`:lf .`)
            const text = await new Response(subProcess.stdout).text();

            subProcess.stdin.flush()
            console.log(text)
            subProcess.stdin.write(`:p nixosConfigurations.${name}.pkgs.system`)

        }

        resolve()
    })
}