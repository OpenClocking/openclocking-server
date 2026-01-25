export const name = "default"
import express from 'express'

const router = express.Router()

router.get("/", async function(req, res) {
    if(!req.user) {
        res.redirect("/login")
        return
    }
    const [settingsDb] = await global.db.query(`SELECT * FROM settings WHERE name = "lang" OR name = "company_name"`)
    const settings = Object.fromEntries(settingsDb.map(({ name, value }) => [name, value]));
    res.render(`./modules/${name}/views/homepage.ejs`, {settings})
})

router.get("/login", async function(req, res) {
    const [settingsDb] = await global.db.query(`SELECT * FROM settings WHERE name = "lang" OR name = "company_name"`)
    const settings = Object.fromEntries(settingsDb.map(({ name, value }) => [name, value]));
    res.render(`./modules/${name}/views/login.ejs`, {settings})
})

console.log(router.stack.map(function(stack) { return { route : stack.route?.path, methods : Object.keys(stack.route?.methods || {})}}))

global.app.use(router)