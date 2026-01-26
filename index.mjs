import { join } from "node:path";
import { readdir } from "node:fs/promises";

import express from 'express';
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";

import jwt from "jsonwebtoken";

import * as config from "./config.json" with { type: 'json' };
global.config = config.default;

import * as i18n from "./i18n.js";
global.i18n = i18n.default
global.i18n.init()

import {load as dbLoad} from "./db.mjs";
await dbLoad();

const app = express();
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', process.cwd());

app.use(async (req, res, next) => {
    if (req.cookies.token) {
        const [settingsDb] = await global.db.query(`
        SELECT * FROM settings WHERE name = "jwt_key"`)
        const settings = Object.fromEntries(settingsDb.map(({ name, value }) => [name, value]));
        let token = {}
        try {
            token = jwt.verify(req.cookies.token, settings.jwt_key);
        } catch (error) {}
        if (token.user_id) {
            let [user] = await global.db.query("SELECT * FROM users WHERE id = ?", [token.user_id])
            req.user = user[0]
            req.user.session = token
        }
    }
    next()
})

global.app = app

const modulesPath = join(process.cwd(), "modules");
const modulesFolders = (await readdir(modulesPath, { withFileTypes: true })).filter((f) => f.isDirectory()).map(dirent => dirent.name);

for(const moduleName of modulesFolders) {
    try {
        const module = await import(`./modules/${moduleName}/index.mjs`);
        console.log(`Loaded module ${module.name}`);
    } catch (error) {
        console.error(`Failed to load module from ./modules/${moduleName}`, error);
    }
}

app.listen(global.config.port, function() { console.log(`Server started on port ${global.config.port}`) });

