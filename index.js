"use strict";
const express = require("express");
const OracleBot = require('@oracle/bots-node-sdk');
const app = express();

const Config = require('./config');
const shared = { logger: console };
Config.add(shared);

OracleBot.init(app, shared) // init the app for bot services
  .get('/', (req, res) => res.send('ok')) // add 200 for '/' request
  .use(Config.get('routes.cc'), require('./router/cc')) // custom components
  .use(Config.get('routes.alexa'), require('./router/alexa')) // alexa 

// start the server on a specified port
const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.info(`listening on :${port}`));
// export the server for testability
module.exports = server;
