var mfp = {};

function clickLayer(ev) {
  var layer = ev.target;
  var feature = layer.mfp.feature;

  if (mfp.routeLayers && mfp.routeLayers.length) {
    mfp.startLayer = undefined;
    mfp.routeLayers = mfp.routeFeatures = mfp.dist = undefined;
    recolorRoute();
  }

  mfp.startLayer = mfp.startLayer || layer;

  if (layer != mfp.startLayer) {
    var routeInfo = routeToLayer(layer);
    _.extend(mfp, routeInfo);
    console.log(routeInfo);
  }
  recolorRoute();
}

function recolorRoute() {
  gjLayer.eachLayer(function(layer) {
    layer.setStyle({ color: 'orange' });
  });

  _.each(mfp.routeLayers, function(layer) {
    layer.setStyle({ color: 'blue' });
  });
}

/**
 * Implementation of Dijkstra's algorithm. We treat each segment ("feature") as a
 * node in the graph and as an edge. The starting feature has distance 0; each
 * additional feature has a distance equal to its length. Think of each
 * navigation step as moving us towards the "end" of the destination feature.
 * We avoid explicitly managing directionality of the search, but in a future
 * iteration we might make it explicit.
 *
 * @param destLayer Leaflet layer object for the segment. Needs property mfp.feature.
 * @returns Object with the following properties:
 *    routeFeatures: features composing the route
 *    routeLayers: layers composing the route
 *    dist: geo_length of the route, in radians
 *
 * @throws Error if there is a discontinuity in the graph
 */
function routeToLayer(destLayer) {
  if (!mfp.startLayer) {
    throw new ReferenceError('Attempted to route to a layer when there is no starting layer.');
  }

  var destFeature = destLayer.mfp.feature;

  var startFeature = mfp.startLayer.mfp.feature;

  var visited = {};
  var distTo = {};
  var routeTo = {};
  var features = {};

  _.each(mfp.graph.allFeatures(), function(feat) {
    features[feat.fid] = feat;
    distTo [feat.fid] = +Infinity;
    visited[feat.fid] = false;
    routeTo[feat.fid] = []; // list of features, starting with start
  });

  //visited[startFeature.fid] = true;
  distTo[startFeature.fid] = 0;
  routeTo[startFeature.fid].push(startFeature);

  var current = startFeature;
  while (true) {
    var neighbors = mfp.graph.allAdjacentFeatures(current);

    // Compute distances for each unvisited neighbor and keep track
    // of the route taken
    neighbors = _.reject(neighbors, function(f) { return visited[f.fid]; });
    _.each(neighbors, function(neighbor) {
      var dist = neighbor.properties.geo_length + distTo[current.fid];
      if (dist <= distTo[neighbor.fid]) {
        distTo[neighbor.fid] = dist;
        routeTo[neighbor.fid] = routeTo[current.fid].concat(current);
      }
    });

    visited[current.fid] = true;

    if (visited[destFeature.fid]) {
      break;
    }

    // move to next current unvisited
    current = _.chain(features)
      .reject(function(f) { return visited[f.fid]; })
      .sortBy(function(f) { return distTo[f.fid]; })
      .first()
      .value();

    if (distTo[current.fid] == Infinity) {
      throw new Error('Graph not connected?');
    }
  }

  // Begin constructing return value structure
  var ret = {
    routeFeatures: routeTo[destFeature.fid].concat(destFeature)
   ,dist: distTo[destFeature.fid]
  };

  // Transform features to layers
  ret.routeLayers = _.map(ret.routeFeatures, function(feat) {
    return feat.mfp.layer;
  });

  return ret;
}

function Graph() {
  var self = this;
  this._features_by_endpoint = {};
  this._all_endpoints = [];
  this._nextFid = 0;
  this._features = [];

  this.addFeature = function(feature) {
    feature.fid = this._nextFid++;
    this._features.push(feature);
    for (var i = 0; i < feature.properties.endpoints.length; ++i) {
      var nid = feature.properties.endpoints[i];
      this._features_by_endpoint[nid] = this._features_by_endpoint[nid] || [];
      this._features_by_endpoint[nid].push(feature);
      this._all_endpoints.push(nid);
    }
  }

  // Returns array of endpoints if the two features share an endpoint
  this.areFeaturesAdjacent = function(feat1, feat2) {
    var inter = _.intersection(feat1.properties.endpoints, feat2.properties.endpoints);
    return inter.length ? inter : false;
  }

  // Returns array of all features adjacent to the argument
  this.allAdjacentFeatures = function(feat) {
    var self = this;
    return _.chain(feat.properties.endpoints)
      .map(function(nid) { return self._features_by_endpoint[nid]; })
      .flatten()
      .uniq()
      .reject(function(f) { return f === feat; })
      .value();
  }

  this.allFeatures = function() {
    return this._features;
  }
}


var map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://{s}.tiles.mapbox.com/v3/ezh.i779mp4n/{z}/{x}/{y}.png', {
  attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
  maxZoom: 18
}).addTo(map);

var gjLayer = L.geoJson(null, {
  style: {
    color: '#ff7800',
    weight: 5,
    opacity: 0.65
  },
  onEachFeature: function (feature, layer) {
    feature.mfp = { layer: layer }
    layer.mfp = { feature: feature };
    mfp.graph.addFeature(feature);

    layer.on('click', clickLayer)
    //.bindPopup('<strong>' + feature.geometry.type + '</strong>' + feature.osm_id + '<pre>' + JSON.stringify(feature.properties, null, '  ') + '</pre>');
  }
}).addTo(map);

function loadData() {
  var req = new XMLHttpRequest();
  req.open('get', 'segments', true);
  req.send();
  req.onload = function() {
    var segments = JSON.parse(this.responseText);
    gjLayer.clearLayers();
    gjLayer.addData(segments);
    map.fitBounds(gjLayer.getBounds());
  };

  mfp.graph = new Graph();
};

loadData();
//setInterval(loadData, 5000);

