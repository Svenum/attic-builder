//This file serves as a perpetual check for the docker container
//It will check if the upstream git repository has been updated
//If it has, it will pull the changes and trigger a rebuild of the configuration and then push that to attic

//This script takes in the following environment variables:
//  - GITHUB_TOKEN: The token used to authenticate with the GitHub API
//  - GITHUB_REPO: The repository to check for changes
//  - GITHUB_BRANCH: The branch to check for changes, defaults to main
//  - GITHUB_USER: The user to check for changes, defaults to the user associated with the token
//  - FLAKE_PATH: The path to the git repository, defaults to /builder
//  - FREQUENCY: The frequency to check for changes in milliseconds format - Keep in mind that GitHub has limits on the number of requests that can be made in a given timeframe (5000 Requests per Hour), defaults to 1 Minute
//  - LOG_LEVEL: The level of logging to output, defaults to INFO
//  - JSON_LOGGING: The format of the logs, defaults to false
import { Octokit } from "@octokit/rest";
import {$} from "bun";
import {Logger} from "../utils/logger.ts";
import dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";
dotenv.config();

const log = new Logger();

//Set the log level (Defaults to INFO)
log.setLogLevel(process.env.LOG_LEVEL ? Bun.env.LOG_LEVEL : "INFO")
log.setJsonLogging(process.env.JSON_LOGGING == "true")

//Verify that the required environment variables are set
if (!process.env.GITHUB_TOKEN){
    log.log("ERROR", "GITHUB_TOKEN is not set, this is required to authenticate with the Github API.");
    process.exit(1)
}

if(!process.env.GITHUB_REPO){
    log.log("ERROR", "GITHUB_REPO is not set, this is required to check the repository for changes.");
    process.exit(1)
}
if(!process.env.GITHUB_USER){
    log.log("ERROR", "GITHUB_USER is not set, this is required to check the repository for changes.");
    process.exit(1)
}

//Set the required environment variables
const repo = process.env.GITHUB_REPO;
const branch = process.env.GITHUB_BRANCH ? process.env.GITHUB_BRANCH : "main";
const user = process.env.GITHUB_USER;
const gitPath = process.env.FLAKE_PATH ? process.env.FLAKE_PATH : "/builder";
const token = process.env.GITHUB_TOKEN;
//if the GIT_INIT is set to true and GIT_PATH is set, we will pull the repository
if(process.env.GIT_INIT == "true"){
    //Check if the git path exists
    let exists = await fs.existsSync(gitPath)
    if(exists){
        log.log("ERROR", `GIT_PATH exists, please check the path: ${gitPath} or set the GIT_INIT var to false`);
        process.exit(1)
    }
    await $`
        git clone https://${user}:${token}@github.com/${user}/${repo}.git ${gitPath}
    `.catch((err)=>{
        log.log("ERROR", `Failed to clone the repository, please check the repository: ${repo} and the user: ${user}`);
        log.log("DEBUG", `Error was: ${err.stderr.toString()}`)
        process.exit(1)
    })
}

//check if the git path exists
await $`
    cd ${gitPath}
`.catch((err)=>{
    log.log("ERROR", `GIT_PATH does not exist, please check the path: ${gitPath}`);
    process.exit(1)
})

//check if the git path exists and is a git repository
await $`
    cd ${gitPath}
    git rev-parse --is-inside-work-tree
`.quiet().catch((err)=>{
    log.log("ERROR", `GIT_PATH is not a git repository, please check the path: ${gitPath}. If you want me to clone the repository, please set the GIT_PATH to your desired path and the GIT_INIT to true`);
    process.exit(1)
})

log.log("INFO", `Checking for changes in the repository: ${repo} on branch: ${branch} for user: ${user}`)
log.log("DEBUG", `Also updating the repository upload url to avoid authentication issues`)
//Switch to the correct branch and pull the changes to the current version
await $`
    cd ${gitPath}
    git checkout ${branch}
    #Update the push url to avoid authentication issues
    git remote set-url --push origin https://${user}:${token}@github.com/${user}/${repo}
    git pull
`.quiet().catch((err)=>{
    log.log("ERROR", `Failed to switch to branch: ${branch}, please check the branch and the repository: ${repo}`);
    log.log("DEBUG", `Error was: ${err.stderr.toString()}`)
    process.exit(1)
})

//Fetch the current commit hash
let currentCommit = await $`
    cd ${gitPath}
    git rev-parse HEAD
`.quiet().catch((err)=>{
    log.log("ERROR", `Failed to fetch the current commit hash, please check the repository: ${repo}`);
    log.log("DEBUG", `Error was: ${err.stderr.toString()}`)
    process.exit(1)
})
currentCommit = currentCommit.stdout.toString().trim()
log.log("INFO", `Current commit hash is: ${currentCommit}`)

//Set the frequency to check for changes (Defaults to 1 Minute)
let frequency = process.env.FREQUENCY ? process.env.FREQUENCY : 60000;
log.log("DEBUG", `Checking for changes every ${frequency} milliseconds`)

//Create the Octokit instance
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

const headers = await octokit.request('HEAD /')
    .then((res)=>{
        log.log("INFO", `Passed authentication Test with the GitHub API`)
        return res.headers
    })
    .catch((err)=>{
        log.log("ERROR", `Failed to authenticate with the GitHub API, please check your credentials`);
        log.log("DEBUG", `Error was: ${err}`)
        process.exit(1)
    })
const scopes = headers['x-oauth-scopes'].split(", ");
if(!scopes.includes("repo")){
    log.log("ERROR", `The token does not have the required permissions to access the repository, please re-run with a token with the repo scope`);
    process.exit(1)
}
//Main Loop
setInterval(async ()=>{
    log.log("INFO", "Checking for changes in the repository")
    log.log("DEBUG", `Checking for changes in the repository: ${repo} on branch: ${branch} for user: ${user}`)
    //Fetch the latest commit hash
    const commits = await octokit.request(`GET /repos/${user}/${repo}/commits/${branch}`, {
        owner: user,
        repo: repo,
        headers: {
            'X-GitHub-Api-Version': '2022-11-28'
        }
    }).catch((err)=>{
        log.log("ERROR", `Failed to fetch the latest commit hash, please check the repository: ${repo} and your credentials`);
        log.log("DEBUG", `Error was: ${err}`)
    })
    .then((res)=>{
        return res.data
    })
    let latestCommit = commits.sha;
    log.log("DEBUG", `Latest commit hash is: ${latestCommit}`)
    log.log("DEBUG", `Latest commit message I stored: ${currentCommit}`)
    //Check if the latest commit is different from the current commit
    if(!currentCommit.includes(latestCommit)){
        log.log("INFO", "New changes in Upstream, pulling and rebuilding the config")
        //set the current commit to the latest commit
        currentCommit = latestCommit;
        //Pull the changes and rebuild the configuration
        await $`
            cd ${gitPath}
            git pull
        `.quiet().catch((err)=>{
            log.log("ERROR", `Failed to pull the changes, please check the logs or re-run with DEBUG enabled`);
            log.log("DEBUG", `Error was: ${err}`)
            process.exit(1)
        })
        //Rebuild the configuration
        await $`
            FLAKE_PATH=${gitPath} bun run build
        `.catch((err)=>{
            log.log("ERROR", `Failed to rebuild the configuration, please check the logs for more information`);
            log.log("DEBUG", `Error was: ${err}`)
            process.exit(1)
        })
        log.log("INFO", "Configuration rebuilt and pushed to attic. Please bear in mind that there could've been still some errors. To be sure please check the logs")
    }
    else{
        log.log("DEBUG", "No changes in the repository")
    }
}, frequency)