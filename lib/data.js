var config = require('../config.js')
  , mongoose = require('./schema')(config.mongosmOptions)
  , _ = require('underscore')
  ;

var Way = mongoose.model('way');

exports.segments = function(req, res) {
  Way.find(
  { // MongoDB Query
    'tags.highway': { 
      '$in': [ 'footway', 'track', 'service' ] 
    } 
  }, { // MongoDB Projection
    'loc.coordinates': 1,
    'loc.type': 1,
    'tags': 1
  }, function(err, ways) {
    if (err) { res.send(500, { error: err }); }
    
    var geojson = _.map(ways, function(w) {
      return {
        type: 'Feature',
        properties: w.tags,
        geometry: w.loc,
      };
    });

    res.send(geojson);
  });
};
