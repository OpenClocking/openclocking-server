import express from "express";

var name;

export function setName(n) {
  name = n;
}

const router = express.Router();



global.app.use(router);