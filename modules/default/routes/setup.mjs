import express from "express";

import { messageManager } from "../../../utils.mjs";
import * as permissions from "../../../permissions.mjs";

var name;

export function setName(n) {
  name = n;
}

const router = express.Router();

router.get("/setup", async function (req, res) {
  if (!req.user) {
    res.redirect("/login");
    return;
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
        name = "setup_step"`);
  const settings = Object.fromEntries(
    settingsDb.map(({ name, value }) => [name, value]),
  );
  if (!parseInt(req.query.step)) {
    res.redirect(`/setup?step=${parseInt(settings.setup_step) + 1}`);
    return;
  }
  let messages = {};
  if (
    req.user.admin_only ||
    req.user.permissions & permissions.MANAGE_SETTINGS
  ) {
    res.render(`./modules/${name}/views/setup.ejs`, {
      settings,
      messages,
      step: parseInt(req.query.step),
      permissions,
    });
  } else {
    res.redirect("/");
    return;
  }
});

router.post("/setup", async function (req, res) {
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  if (!parseInt(req.query.step)) {
    res.redirect(`/setup?step=${settings.setup_step}`);
    return;
  }

  let messages = {};
  if (
    req.user.admin_only ||
    req.user.permissions & permissions.MANAGE_SETTINGS
  ) {
    const [settingsDb] = await global.db.query(`
        SELECT * FROM settings WHERE 
        name = "lang"`);
    const settings = Object.fromEntries(
      settingsDb.map(({ name, value }) => [name, value]),
    );
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
        if (
          req.body.lang &&
          Object.keys(global.i18n.languages).includes(req.body.lang)
        ) {
          await global.db.execute(
            `UPDATE settings SET value = ? WHERE name = "lang"`,
            [req.body.lang],
          );
          await global.db.execute(
            `UPDATE settings SET value = ? WHERE name = "setup_step"`,
            [parseInt(req.query.step) + 1],
          );
          res.redirect(`/setup?step=${parseInt(req.query.step) + 1}`);
          return;
        } else {
          messageManager(
            messages,
            "setup",
            `
                        <div class="alert alert-danger" role="alert">
                            ${global.i18n.translate(settings.lang, "errors_missing_fields")}
                        </div>`,
          );
        }
        break;
      case 2:
        await global.db.execute(
          `UPDATE settings SET value = ? WHERE name = "company_name"`,
          [req.body.company_name],
        );
        await global.db.execute(
          `UPDATE settings SET value = ? WHERE name = "company_domain"`,
          [req.body.company_domain],
        );
        await global.db.execute(
          `UPDATE settings SET value = ? WHERE name = "setup_step"`,
          [parseInt(req.query.step) + 1],
        );
        res.redirect(`/setup?step=${parseInt(req.query.step) + 1}`);
        return;
        break;
      case 3:
        if (req.body.service_url) {
          await global.db.execute(
            `UPDATE settings SET value = ? WHERE name = "service_url"`,
            [req.body.service_url],
          );
          await global.db.execute(
            `UPDATE settings SET value = ? WHERE name = "setup_step"`,
            [parseInt(req.query.step) + 1],
          );
          res.redirect(`/setup?step=${parseInt(req.query.step) + 1}`);
          return;
        } else {
          messageManager(
            messages,
            "setup",
            `
                        <div class="alert alert-danger" role="alert">
                            ${global.i18n.translate(settings.lang, "errors_missing_fields")}
                        </div>`,
          );
        }
        break;
      case 4:
        if (req.body.default_password) {
          await global.db.execute(
            `UPDATE settings SET value = ? WHERE name = "default_password"`,
            [req.body.default_password],
          );
        } else {
          messageManager(
            messages,
            "setup_default_password",
            `
                        <div class="alert alert-danger" role="alert">
                            ${global.i18n.translate(settings.lang, "errors_missing_fields")}
                        </div>`,
          );
        }
        await global.db.execute(
          `UPDATE settings SET value = ? WHERE name = "internal_id_required"`,
          [req.body.internal_id_required ? 1 : 0],
        );
        let default_permissions = 0;
        if (Array.isArray(req.body.default_permissions)) {
          for (const perm of req.body.default_permissions) {
            default_permissions += parseInt(perm);
          }
        } else if (req.body.default_permissions) {
          default_permissions = parseInt(req.body.default_permissions);
        }
        await global.db.execute(
          `UPDATE settings SET value = ? WHERE name = "default_permissions"`,
          [default_permissions],
        );
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
        name = "setup_step"`);
    const settings2 = Object.fromEntries(
      settingsDb2.map(({ name, value }) => [name, value]),
    );
    res.render(`./modules/${name}/views/setup.ejs`, {
      settings: settings2,
      messages,
      step: parseInt(req.query.step),
      permissions,
    });
  } else {
    res.redirect("/");
    return;
  }
});

global.app.use(router);
