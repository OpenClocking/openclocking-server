import { join } from "node:path";
import { readdir } from "node:fs/promises";

import express from 'express'
import * as config from "./config.json" with { type: 'json' }
global.config = config.default

import {load as dbLoad} from "./db.mjs";
await dbLoad()

const app = express()
app.set('view engine', 'ejs');
app.set('views', process.cwd());
global.app = app

const modulesPath = join(process.cwd(), "modules")
const modulesFolders = (await readdir(modulesPath, { withFileTypes: true })).filter((f) => f.isDirectory()).map(dirent => dirent.name);

for(const moduleName of modulesFolders) {
    try {
        const module = await import(`./modules/${moduleName}/index.mjs`)
        console.log(`Loaded module ${module.name}`)
    } catch (error) {
        console.error(`Failed to load module from ./modules/${moduleName}`, error)
    }
}



app.listen(global.config.port, function() { console.log(`Server started on port ${global.config.port}`) })

