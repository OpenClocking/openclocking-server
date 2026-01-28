import express from "express";

import { messageManager } from "../../../utils.mjs";
import * as permissions from "../../../permissions.mjs";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

var name;

export function setName(n) {
  name = n;
}

const router = express.Router();

router.get("/change_password", async function (req, res) {
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  const [settingsDb] = await global.db.query(`
        SELECT * FROM settings WHERE 
        name = "lang" OR 
        name = "company_name" OR 
        name = "first_login" OR 
        name = "default_password" OR 
        name = "company_domain"`);
  const settings = Object.fromEntries(
    settingsDb.map(({ name, value }) => [name, value]),
  );
  res.render(`./modules/${name}/views/change_password.ejs`, {
    settings,
    messages: {},
  });
});

router.post("/change_password", async function (req, res) {
  if (!req.user) {
    res.redirect("/login");
    return;
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
        name = "setup_step"`);
  const settings = Object.fromEntries(
    settingsDb.map(({ name, value }) => [name, value]),
  );
  let messages = {};
  if (req.body.old_password && req.body.password && req.body.password_repeat) {
    if (await bcrypt.compare(req.body.old_password, req.user.password_hash)) {
      if (req.body.password === req.body.password_repeat) {
        let password_recycled = false;
        for (const password_hash of JSON.parse(req.user.password_history)) {
          if (await bcrypt.compare(req.body.password, password_hash)) {
            password_recycled = true;
            break;
          }
        }
        if (!password_recycled) {
          const bcrypt_hash = await bcrypt.hash(
            req.body.password,
            parseInt(settings.bcrypt_salt_rounds),
          );
          await global.db.execute(
            `UPDATE users SET password_hash = ?, change_password = false, password_history = ? WHERE id = ?`,
            [
              bcrypt_hash,
              JSON.stringify(
                [bcrypt_hash, ...JSON.parse(req.user.password_history)].slice(
                  0,
                  parseInt(settings.anti_password_recycle_count || 1),
                ),
              ),
              req.user.id,
            ],
          );
          if (req.user.id === 1 && parseInt(settings.first_login)) {
            await global.db.execute(
              `UPDATE settings SET value = 0 WHERE name = "first_login"`,
            );
          }
          const token = jwt.sign(
            { user_id: req.user.id, remember: req.user.session.remember },
            settings.jwt_key,
          );
          res.cookie("token", token, {
            httpOnly: true,
            maxAge: req.user.session.remember
              ? 1 * 24 * 60 * 60 * 1000
              : undefined,
          });
          if (
            parseInt(settings.setup_step) < global.setupSteps &&
            (req.user.admin_only ||
              req.user.permissions & permissions.MANAGE_SETTINGS)
          ) {
            res.redirect(`/setup?step=${parseInt(settings.setup_step) + 1}`);
          } else {
            res.redirect("/");
          }
          return;
        } else {
          messageManager(
            messages,
            "change_password",
            `
            <div class="alert alert-danger" role="alert">
                ${global.i18n.translate(settings.lang, "errors_change_password_recycled", { count: settings.anti_password_recycle_count || 1 })}
            </div>`,
          );
        }
      } else {
        messageManager(
          messages,
          "change_password",
          `
            <div class="alert alert-danger" role="alert">
                ${global.i18n.translate(settings.lang, "errors_change_passwords_mismatch")}
            </div>`,
        );
      }
    } else {
      messageManager(
        messages,
        "change_password",
        `
        <div class="alert alert-danger" role="alert">
            ${global.i18n.translate(settings.lang, "errors_change_password_wrong_old_password")}
        </div>`,
      );
    }
  } else {
    messageManager(
      messages,
      "change_password",
      `
        <div class="alert alert-danger" role="alert">
            ${global.i18n.translate(settings.lang, "errors_missing_fields")}
        </div>`,
    );
  }

  res.render(`./modules/${name}/views/change_password.ejs`, {
    settings,
    messages,
  });
});

global.app.use(router);
