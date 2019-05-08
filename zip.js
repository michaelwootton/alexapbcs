#! /usr/bin/env node

const child_process = require('child_process');

const OUT_FILE = 'accspackage.zip';

class Child {
  static _child(type, command, args, options) {
    return new Promise((resolve, reject) => {
      let [out, err] = ['', ''];
      const sub = child_process[type](command, args, options);
      if (sub.stdout) {
        sub.stdout.on('data', (data) => out += `${data}`);
      }
      if (sub.stderr) {
        sub.stderr.on('data', (data) => err += `${data}`);
      }
      // sub.on('error', e => reject(e));
      sub.on('exit', code => {
        console.log(command, 'exit', code);
        return code === 0 || out ? resolve(out.trim()) : reject(err);
      });
    });
  }

  static spawn(command, args, options) {
    return this._child('spawn', command, args, options);
  }
}

function concatDeps(deps) {
  let tree = Object.keys(deps).map(name => {
    return [name].concat(concatDeps(deps[name].dependencies || {}))
  });
  return [].concat(...tree);
}

function ignoreModules(list) {
  let args = list
    .filter(item => item)
    .map(item => {
      return ['-x', `node_modules/${item}/*`];
    });
  return [].concat(...args);
}

function standardIgnores() {
  return [].concat(...[
    '.*',
    'coverage/*',
    OUT_FILE,
    'node_modules/.cache/*',
  ].map(name => ['-x', name]));
}

// compile list of ignores and zip
Promise.all([
  Child.spawn('npm', ['list', '--prod', '--json']),
  Child.spawn('npm', ['list', '--dev', '--json']),
]).then(p => p.map(data => concatDeps(JSON.parse(data).dependencies)))
  .then(p => p[1].filter(v => p[0].indexOf(v) < 0)) // reduce to all non-union dev dependencies
  .then(list => ignoreModules(list)) // convert to zip ignores
  .then(ignores => standardIgnores().concat(ignores))
  .then(ignores => Child.spawn('zip', ['-r', OUT_FILE, '.'].concat(ignores), {
    stdio: 'inherit'
  }));