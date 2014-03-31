var config = require('../config.js')
  , mongoose = require('./schema')(config.mongosmOptions)
  , _ = require('underscore')
  ;

var Way = mongoose.model('way');
var Relation = mongoose.model('relation');

/**
 * Get all ways within Forest Park, defined by relation 1760140
 *
 * First iteration: all ways listed
 */
exports.all_within_fp = function(req, res) {
  Relation.find(
  { osm_id: 1760140 },
  { 'members': 1 },
  function(err, relations) {
    // get list of ids from members array; run another query
    var fpr = relations.pop();
    var ids = _.pluck(_.where(fpr.members, { type: 'way' }), 'ref');

    Way.find({ 'osm_id': { '$in': ids } }, function(err, ways) {
      if (err) { res.send(500, { error: err }); }
      else {
        sendWays(res, ways);
      }
    });
  });
};

/**
 * Direct extraction of OSM data; all "footway|track|service" ways.
 */
exports.all_tracks_direct = function(req, res) {
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
    else {
      sendWays(res, ways);
    }
  });
};

function sendWays(res, ways) {
  var geojson = _.map(ways, function(w) {
    return {
      type: 'Feature',
      properties: w.tags,
      geometry: w.loc,
    };
  });

  res.send(geojson);
}

// TODO:
// 1) Get Forest Park boundaries, search for nodes within those boundaries.
//
// FP boundary relation: 1760140
