var data = require('./lib/data.js');

module.exports = function (app) {
  app.get('/segments', data.all_within_fp)
};
