const path = require('path');
const express = require('express');
const OracleBot = require('@oracle/bots-node-sdk');
const Config = require('../config');

const router = express.Router();

Config.get('logger').info(`Custom component services: ${Config.get('routes.cc')}`);
OracleBot.Middleware.customComponent(router, {
  cwd: path.resolve(__dirname, '..'), // registry is relative to this path
  register: 'components', // path to components directory
});

module.exports = router;
