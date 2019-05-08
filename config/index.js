require('dotenv').config();
const _ = require('underscore');
const store = require('./config.json');

class ConfigManager {

  constructor() {
    // construct with defaults from config.json
    this._store = _.assign({}, store);
    // add from environment under the 'env' property
    this.add(process.env, 'env');
  }

  /**
   * Add source data to supplement configuration store
   * @param {object} source - configuration object to add
   * @param {string} [key] - key to which configurations are added
   */
  add(source, key) {
    if (key) {
      this._store[key] = _.extend(this._store[key] || {}, source);
    } else {
      this._store = _.extend(this._store, source);
    }
    return this;
  }

  /**
   * Get configuration by dot-separated object path
   * @param {string} [key] - Configuration item path dot or : delimited
   * @example
   * 
   * const dir = Config.get('cli.commandDir');
   */
  get(key){
    return (key || '').split(/[:\.]/)
      .filter(k => !!k)
      .reduce((last, k) => {
        if (!!last && typeof last === 'object') {
          return last[k]
        }
      }, this._store);
  }
}

// export singleton config manager
module.exports = new ConfigManager();
