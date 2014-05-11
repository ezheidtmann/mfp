var config = require('../config.js')
  , mongoose = require('./schema')(config.mongosmOptions)
  , _ = require('underscore')
  , async = require('async')
  ;

var Node = mongoose.model('node');
var Way = mongoose.model('way');
var Relation = mongoose.model('relation');

exports.util = {};

/**
 * Transform list of OSM ways into a list of segments with shared endpoints
 */
exports.util.segmentize = function(ways, cb) {
  //console.log('segmentize', ways);
  // Find intersections
  var ways_by_node = {};
  _.each(ways, function(way) {
    console.log(_.keys(way));
    _.each(way.nodes, function(nid) {
      ways_by_node[nid] = ways_by_node[nid] || { nid: nid, ways: [] };
      ways_by_node[nid].ways.push(way.osm_id);
    });
  });

  var intersections = _.filter(ways_by_node, function(node) {
    return _.uniq(node.ways).length > 1;
  });

  // build points
  var intersection_nids = _.pluck(intersections, 'nid');
  Node.find({ osm_id: { $in: intersection_nids } }, function(err, nodes) {
    cb(err, nodes.concat(ways)); 
  });
}

exports.segments = function(req, res) {
  //ways =
};

/**
 * Get all trails within Forest Park, defined by relation 1760140
 *
 * This ain't perfect, but it's a start. Currently we get the boundaries of the
 * park, find ways that are at least partly inside the boundaries, and filter
 * by type.
 *
 * Notable omissions and problems:
 *  - Parts of Firelane 10
 *  - Linnton Trail
 *  - Lower Macleay Trail
 *  - Any trails south of Cornell (including Pittock) or in the Audubon Society
 *  - Discontinuity in Wildwood crossing Germantown, due to jog in Wildwood
 *
 * @resolves with cb(err, ways), ways is an array of OSM way objects
 */
exports.trails_within_fp = function trails_within_fp(cb) {
  Relation.find(
  { osm_id: 1760140 },
  { 'members': 1 },
  function(err, relations) {
    if (err) { cb(err, null); return; }

    // get list of ids from members array; run another query
    var fpr = relations.pop();
    var ids = _.pluck(_.where(fpr.members, { type: 'way' }), 'ref');

    Way.find({ 'osm_id': { '$in': ids } }, function(err, ways) {
      if (err) { cb(err, null); return; }

      var reqs = _.map(ways, function(way) {
        return function(cb) {
          Way.find({
            'loc.type': 'LineString'
           ,'tags.highway': { '$in': [ 'footway', 'track', 'service', 'path' ] }
           //,'tags.RLIS.systemname': 'Forest Park Trails'
           ,'loc': {
              '$geoIntersects': {
                '$geometry': {
                  type: way.loc.type
                 ,coordinates: way.loc.coordinates
                }
            }}})
            .exec(cb);
        }
      });

      async.parallel(reqs, function(err, results) {
        // flatten and de-dupe results (duplicates can result if a way
        // intersects more than one of the query geometries)
        results = _.chain(results)
          .flatten()
          .uniq(function(way) { return way.osm_id; })
          .value();

        cb(err, results);
      });
    });
  });
}


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

exports.util.sendWays = function sendWays(res, ways) {
  var geojson = _.map(ways, function(w) {
    return {
      type: 'Feature'
     ,properties: w.tags
     ,geometry: w.loc
     ,osm_id: w.osm_id
    };
  });

  res.send(geojson);
}



// TODO:
// 1) Get Forest Park boundaries, search for nodes within those boundaries.
//
// FP boundary relation: 1760140
