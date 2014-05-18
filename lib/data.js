var config = require('../config.js')
  , mongoose = require('./schema')(config.mongosmOptions)
  , _ = require('underscore')
  , async = require('async')
  , d3 = require('d3')
  ;

var Node = mongoose.model('node');
var Way = mongoose.model('way');
var Relation = mongoose.model('relation');

exports.util = {};

/**
 * Transform list of OSM ways into a list of segments with shared endpoints
 */
exports.util.segmentize = function(ways, cb) {
  // Find intersections
  var ways_by_node = {};
  _.each(ways, function(way) {
    _.each(way.nodes, function(nid) {
      ways_by_node[nid] = ways_by_node[nid] || { nid: nid, ways: [] };
      ways_by_node[nid].ways.push(way);
    });
  });

  var intersections = _.chain(ways_by_node)
    .filter(function(node) {
      return _.uniq(node.ways).length > 1;
    })
    .indexBy('nid').value();

  // build points
  var intersection_nids = _.pluck(intersections, 'nid');

  // starting at each intersection, walk down each way that goes through that
  // intersection, creating a segment for each piece of the way between
  // intersections.
  var segments = []; // each segment is an array of nids
  _.each(intersections, function(intersection) {
    var nid = intersection.nid;
    _.each(ways_by_node[nid].ways, function(way) {

      // For this way, go forwards and backwards. Stop at the first
      // intersection; the rest of the way will be traversed by a different
      // iteration.
      var nid_index = _.indexOf(way.nodes, nid);
      if (nid_index == -1) {
        // raise hell
        return;
      }
      var left = _.first(way.nodes, nid_index).reverse();
      var right = _.rest(way.nodes, nid_index + 1);
      _.each([ left, right ], function(nids) {
        var segment = [nid];
        for (var i = 0; i < nids.length; ++i) {
          segment.push(nids[i]);
          if (intersections[nids[i]]) {
            // TODO
            // if:
            // 1) this is an end node on this way
            // 2) there is only one other way on this intersection
            // 3) this is also an end node on this way
            // then continue traversing.
            //
            // For now we don't do that.
            segments.push(segment);
            break;
          }
          if (i == nids.length - 1) {
            segments.push(segment);
            break;
          }
        }
      });

    });
  });

  // The previous algorithm generated a huge number of duplicates. De-dupe by
  // considering the first two and the last two node ids.
  segments = _.uniq(segments, function(segment) {
    // TODO: this will break if this is a zero-length or 1-length segment.
    var nids = [ segment[0], segment[1], segment[segment.length - 2], segment[segment.length - 1] ];
    return nids.sort().join('_');
  });

  // Finally, get geometry and convert to OSM features for display
  Node.find(
    { osm_id: { $in: _.flatten(segments) } },
    { loc: 1, osm_id: 1 },
    function(err, nodes) {
      nodes = _.indexBy(nodes, 'osm_id');
      pseudo_ways = _.map(segments, function(segment) {
        var coords = _.map(segment, function(nid) {
          return nodes[nid].loc.coordinates
        });

        // This segment should come from exactly one way, so its tags
        // are the tags from the first way on the second node.
        //
        // TODO: add checking and error handling for this assumption.

        var tags = _.extend({}, ways_by_node[segment[1]].ways[0].tags);

        var feature = {
          type: 'Feature'
         ,properties: ways_by_node[segment[1]].ways[0].tags
         ,geometry: {
            type: "LineString"
           ,coordinates: coords
          }
        };

        // add endpoints for client-side graph construction
        feature.properties.endpoints = [ segment[0], segment[segment.length - 1] ];

        // add length for client-side weighted graph
        feature.properties.geo_length = d3.geo.length(feature);

        return feature;
      });

      cb(null, pseudo_ways);
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
