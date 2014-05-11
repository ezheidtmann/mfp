var data = require('./lib/data.js')
  , cache = require('./lib/cache.js')
  ;

module.exports = function (app) {

  app.get('/trails_within_fp', function(req, res) {
    cache.cacheFunction('trails_within_fp', data.trails_within_fp, function(err, ways) {
      if (err) { res.send(500, { error: err }); return; }
      data.util.sendWays(res, ways);
    });
  });

  app.get('/segments', function(req, res) {
    cache.cacheFunction('trails_within_fp', data.trails_within_fp, function(err, ways) {
      if (err) { res.send(500, { error: err }); return; }

      data.util.segmentize(ways, function(err, segments) {
        if (err) { res.send(500, { error: err }); return; }
        data.util.sendWays(res, segments); 
      });
    });
  });
};
