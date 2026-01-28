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

router.get("/login", async function (req, res) {
  const [settingsDb] = await global.db.query(`
        SELECT * FROM settings WHERE 
        name = "lang" OR 
        name = "company_name" OR 
        name = "company_domain" OR 
        name = "first_login" OR 
        name = "default_password"`);
  const settings = Object.fromEntries(
    settingsDb.map(({ name, value }) => [name, value]),
  );
  res.render(`./modules/${name}/views/login.ejs`, { settings, messages: {} });
});

router.post("/login", async function (req, res) {
  const [settingsDb] = await global.db.query(`
        SELECT * FROM settings WHERE 
        name = "lang" OR 
        name = "company_name" OR 
        name = "company_domain" OR 
        name = "first_login" OR 
        name = "default_password" OR 
        name = "jwt_key"`);
  const settings = Object.fromEntries(
    settingsDb.map(({ name, value }) => [name, value]),
  );
  let messages = {};
  if (req.body.email && req.body.password) {
    const [user] = await global.db.query(
      "SELECT id, email, password_hash, change_password FROM users where email = ?",
      [req.body.email],
    );
    if (
      user.length &&
      (await bcrypt.compare(req.body.password, user[0].password_hash))
    ) {
      const token = jwt.sign(
        {
          user_id: user[0].id,
          change_password: user[0].change_password,
          remember: req.body.remember ? true : false,
        },
        settings.jwt_key,
      );
      res.cookie("token", token, {
        httpOnly: true,
        maxAge: req.body.remember ? 1 * 24 * 60 * 60 * 1000 : undefined,
      });

      if (user[0].change_password) {
        res.redirect("/change_password");
        return;
      } else if (
        parseInt(settings.setup_step) < global.setupSteps &&
        (req.user.admin_only ||
          req.user.permissions & permissions.MANAGE_SETTINGS)
      ) {
        res.redirect(`/setup?step=${parseInt(settings.setup_step) + 1}`);
      } else {
        res.redirect("/");
      }
    } else {
      messageManager(
        messages,
        "login",
        `
            <div class="alert alert-danger" role="alert">
                ${global.i18n.translate(settings.lang, "errors_login_credentials")}
            </div>`,
      );
    }
  } else {
    messageManager(
      messages,
      "login",
      `
        <div class="alert alert-danger" role="alert">
            ${global.i18n.translate(settings.lang, "errors_missing_fields")}
        </div>`,
    );
  }
  res.render(`./modules/${name}/views/login.ejs`, { settings, messages });
});

global.app.use(router);
