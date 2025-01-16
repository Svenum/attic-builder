import type {Logger} from "./logger.ts";
import {$, spawn} from "bun"
export default async function buildSystem(name:string, flake_dir:string, parentLogger:Logger):Promise<void>{
    return new Promise(async (resolve, reject)=>{
        parentLogger.log('INFO', `Building System: ${name} with flake_dir: ${flake_dir}`)
        parentLogger.log("DEBUG", `Getting System Arch`)
        const buffer = Buffer.alloc(100);
        await $`
            cd ${flake_dir}
            sh ../utils/repl.sh ${name} > ${buffer}`
        console.log(buffer.toString().replaceAll('\n', ''))
        /*
        const childProc = spawn(["bash", "../utils/repl.sh"], {
            cwd: flake_dir,
            stdin: "pipe",
            stdout: "inherit",
            env: {...process.env, "SYSTEM": name}
        })
        */
        resolve()
    })
}