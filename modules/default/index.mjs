export const name = "default"
import express from 'express'

import { messageManager } from '../../utils.mjs'
import * as permissions from "../../permissions.mjs"

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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
    const [settingsDb] = await global.db.query(`
        SELECT * FROM settings WHERE 
        name = "lang" OR 
        name = "company_name" OR 
        name = "company_domain" OR 
        name = "first_login" OR 
        name = "default_password"`)
    const settings = Object.fromEntries(settingsDb.map(({ name, value }) => [name, value]));
    res.render(`./modules/${name}/views/login.ejs`, {settings, messages : {}})
})

router.post("/login", async function(req, res) {
    const [settingsDb] = await global.db.query(`
        SELECT * FROM settings WHERE 
        name = "lang" OR 
        name = "company_name" OR 
        name = "company_domain" OR 
        name = "first_login" OR 
        name = "default_password" OR 
        name = "jwt_key"`)
    const settings = Object.fromEntries(settingsDb.map(({ name, value }) => [name, value]));
    let messages = {}
    if(req.body.email && req.body.password) {
        const [user] = await global.db.query("SELECT id, email, password_hash, change_password FROM users where email = ?", [req.body.email])
        if(user.length && await bcrypt.compare(req.body.password, user[0].password_hash)) {
            const token = jwt.sign({user_id : user[0].id, change_password : user[0].change_password, remember : req.body.remember ? true : false}, settings.jwt_key)
            res.cookie("token", token, {httpOnly : true, maxAge : req.body.remember ? 1 * 24 * 60 * 60 * 1000 : undefined})

            if(user[0].change_password) {
                res.redirect("/change_password")
                return
            } else {
                res.redirect("/")
                return
            }
        } else {
            messageManager(messages, "login", `
                <div class="alert alert-danger" role="alert">
                    ${global.i18n.translate(settings.lang, "errors_login_credentials")}
                </div>`)
        }  
    } else {
        messageManager(messages, "login", `
            <div class="alert alert-danger" role="alert">
                ${global.i18n.translate(settings.lang, "errors_missing_fields")}
            </div>`)
    }
    res.render(`./modules/${name}/views/login.ejs`, {settings, messages})
})

router.get("/change_password", async function(req, res) {
    if(!req.user) {
        res.redirect("/login")
        return
    }
    const [settingsDb] = await global.db.query(`
        SELECT * FROM settings WHERE 
        name = "lang" OR 
        name = "company_name" OR 
        name = "first_login" OR 
        name = "default_password" OR 
        name = "company_domain"`)
    const settings = Object.fromEntries(settingsDb.map(({ name, value }) => [name, value]));
    res.render(`./modules/${name}/views/change_password.ejs`, {settings, messages : {}})
})

router.post("/change_password", async function(req, res) {
    if(!req.user) {
        res.redirect("/login")
        return
    }
    const [settingsDb] = await global.db.query(`
        SELECT * FROM settings WHERE 
        name = "lang" OR 
        name = "company_name" OR 
        name = "company_domain" OR 
        name = "first_login" OR 
        name = "default_password" OR 
        name = "jwt_key" OR 
        name = "bcrypt_salt_rounds" OR 
        name = "anti_password_recycle_count" OR
        name = "setup_step"`)
    const settings = Object.fromEntries(settingsDb.map(({ name, value }) => [name, value]));
    let messages = {}
    if(req.body.old_password && req.body.password && req.body.password_repeat) {
        if(await bcrypt.compare(req.body.old_password, req.user.password_hash)) {
            if(req.body.password === req.body.password_repeat) {
                let password_recycled = false
                for(const password_hash of JSON.parse(req.user.password_history)) {
                    if(await bcrypt.compare(req.body.password, password_hash)) {
                        password_recycled = true
                        break;
                    }
                }
                if(!password_recycled) {
                    const bcrypt_hash = await bcrypt.hash(req.body.password, parseInt(settings.bcrypt_salt_rounds))
                    await global.db.execute(`UPDATE users SET password_hash = ?, change_password = false, password_history = ? WHERE id = ?`, 
                    [
                        bcrypt_hash,
                        JSON.stringify([bcrypt_hash, ...JSON.parse(req.user.password_history)].slice(0, parseInt(settings.anti_password_recycle_count || 1))),
                        req.user.id
                    ])
                    if(req.user.id === 1 && parseInt(settings.first_login)) {
                        await global.db.execute(`UPDATE settings SET value = 0 WHERE name = "first_login"`)
                    }
                    const token = jwt.sign({user_id : req.user.id, remember : req.user.session.remember}, settings.jwt_key)
                    res.cookie("token", token, {httpOnly : true, maxAge : req.user.session.remember ? 1 * 24 * 60 * 60 * 1000 : undefined})
                    if(parseInt(settings.setup_step) < global.setupSteps && (req.user.admin_only || req.user.permissions & permissions.MANAGE_SETTINGS)) {
                        res.redirect(`/setup?step=${settings.setup_step}`)
                    } else {
                        res.redirect("/")
                    }
                    return;
                } else {
                    messageManager(messages, "change_password", `
                        <div class="alert alert-danger" role="alert">
                            ${global.i18n.translate(settings.lang, "errors_change_password_recycled", {count : settings.anti_password_recycle_count || 1})}
                        </div>`)
                }
            } else {
                messageManager(messages, "change_password", `
                    <div class="alert alert-danger" role="alert">
                        ${global.i18n.translate(settings.lang, "errors_change_passwords_mismatch")}
                    </div>`)
            }
        } else {
            messageManager(messages, "change_password", `
                <div class="alert alert-danger" role="alert">
                    ${global.i18n.translate(settings.lang, "errors_change_password_wrong_old_password")}
                </div>`)
        }
    } else {
         messageManager(messages, "change_password", `
            <div class="alert alert-danger" role="alert">
                ${global.i18n.translate(settings.lang, "errors_missing_fields")}
            </div>`)
    }

    res.render(`./modules/${name}/views/change_password.ejs`, {settings, messages})
})

router.get("/setup", async function(req, res) {
    if(!req.user) {
        res.redirect("/login")
        return
    }
    const [settingsDb] = await global.db.query(`
        SELECT * FROM settings WHERE 
        name = "lang" OR 
        name = "company_name" OR 
        name = "company_domain" OR 
        name = "service_url" OR 
        name = "default_password" OR 
        name = "internal_id_required" OR 
        name = "default_permissions" OR 
        name = "setup_step"`)
    const settings = Object.fromEntries(settingsDb.map(({ name, value }) => [name, value]));
    if(!parseInt(req.query.step)) {
        res.redirect(`/setup?step=${settings.setup_step}`)
        return;
    }
    let messages = {}
    if(req.user.admin_only || req.user.permissions & permissions.MANAGE_SETTINGS) {
        res.render(`./modules/${name}/views/setup.ejs`, {settings, messages, step : parseInt(req.query.step), permissions})
    } else {
        res.redirect("/")
        return
    }
})

router.post("/setup", async function(req, res) {
    if(!req.user) {
        res.redirect("/login")
        return
    }
    if(!parseInt(req.query.step)) {
        res.redirect(`/setup?step=${settings.setup_step}`)
        return;
    }

    let messages = {}
    if(req.user.admin_only || req.user.permissions & permissions.MANAGE_SETTINGS) {
        const [settingsDb] = await global.db.query(`
        SELECT * FROM settings WHERE 
        name = "lang"`)
    const settings = Object.fromEntries(settingsDb.map(({ name, value }) => [name, value]));
        // step 1 = lang, required
        // default lang used on the app
        // step 2.1 = company_name, optional
        // company name, displayed on the app
        // step 2.2 = company_domain, optional
        // company domain, displayed on the app for emails (login)
        // step 3.1 = service_url, required, default http://host:port,
        // the app's url, can be local, can be public, but i strongly suggest using a dns entry for easier access
        // step 4.1 = default_password, required, default changeme,
        // default password used for every new account, it will be asked to change the password at first login
        // step 4.2 = internal_id_required
        // id set on users to identify them,
        // this can be useful for big entities that wants a way to easily identify employees across different solutions
        // step 4.3 = default_permissions
        // permissions set by default to all the users, idependently of individual permissions.
        // some highly critical permissions can't be set here, like the MANAGE_SETTINGS or MANAGE_USERS permissions.
        switch (parseInt(req.query.step)) {
            case 1:
                if(req.body.lang && Object.keys(global.i18n.languages).includes(req.body.lang)) {
                    await global.db.execute(`UPDATE settings SET value = ? WHERE name = "lang"`, [req.body.lang]);
                    await global.db.execute(`UPDATE settings SET value = ? WHERE name = "setup_step"`, [parseInt(req.query.step) + 1]);
                    res.redirect(`/setup?step=${parseInt(req.query.step) + 1}`);
                    return;
                } else {
                    messageManager(messages, "setup", `
                        <div class="alert alert-danger" role="alert">
                            ${global.i18n.translate(settings.lang, "errors_missing_fields")}
                        </div>`)
                }
                break;
            case 2:
                await global.db.execute(`UPDATE settings SET value = ? WHERE name = "company_name"`, [req.body.company_name]);
                await global.db.execute(`UPDATE settings SET value = ? WHERE name = "company_domain"`, [req.body.company_domain]);
                await global.db.execute(`UPDATE settings SET value = ? WHERE name = "setup_step"`, [parseInt(req.query.step) + 1]);
                res.redirect(`/setup?step=${parseInt(req.query.step) + 1}`);
                return;
                break;
            case 3:
                if(req.body.service_url){
                    await global.db.execute(`UPDATE settings SET value = ? WHERE name = "service_url"`, [req.body.service_url]);
                    await global.db.execute(`UPDATE settings SET value = ? WHERE name = "setup_step"`, [parseInt(req.query.step) + 1]);
                    res.redirect(`/setup?step=${parseInt(req.query.step) + 1}`);
                    return;
                } else {
                    messageManager(messages, "setup", `
                        <div class="alert alert-danger" role="alert">
                            ${global.i18n.translate(settings.lang, "errors_missing_fields")}
                        </div>`)
                }
                break;
            case 4:
                if(req.body.default_password) {
                    await global.db.execute(`UPDATE settings SET value = ? WHERE name = "default_password"`, [req.body.default_password]);
                } else {
                    messageManager(messages, "setup_default_password", `
                        <div class="alert alert-danger" role="alert">
                            ${global.i18n.translate(settings.lang, "errors_missing_fields")}
                        </div>`)
                }
                await global.db.execute(`UPDATE settings SET value = ? WHERE name = "internal_id_required"`, [req.body.internal_id_required ? 1 : 0]);
                let default_permissions = 0;
                if(Array.isArray(req.body.default_permissions)) {
                    for(const perm of req.body.default_permissions) {
                        default_permissions += parseInt(perm)
                    }    
                } else if(req.body.default_permissions) {
                    default_permissions = parseInt(req.body.default_permissions)
                }
                await global.db.execute(`UPDATE settings SET value = ? WHERE name = "default_permissions"`, [default_permissions]);
                break;
            default:
                break;
        }
    const [settingsDb2] = await global.db.query(`
        SELECT * FROM settings WHERE 
        name = "lang" OR 
        name = "company_name" OR 
        name = "company_domain" OR 
        name = "service_url" OR 
        name = "default_password" OR 
        name = "internal_id_required" OR 
        name = "default_permissions" OR 
        name = "setup_step"`)
    const settings2 = Object.fromEntries(settingsDb2.map(({ name, value }) => [name, value]));
        res.render(`./modules/${name}/views/setup.ejs`, {settings : settings2, messages, step : parseInt(req.query.step), permissions})
    } else {
        res.redirect("/")
        return
    }
})


//console.log(router.stack.map(function(stack) { return { route : stack.route?.path, methods : Object.keys(stack.route?.methods || {})}}))

global.app.use(router)