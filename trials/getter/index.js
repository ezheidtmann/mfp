var osm2geojson = require('osm2geojson')
  , fs = require('fs')
  ;

// one corner of FP
//bbox = [-122.7518, 45.542, -122.726, 45.5526];
//input = request('http://api.openstreetmap.org/api/0.6/map?bbox=' + bbox.join(','));

var input = fs.createReadStream('map.osm');

var types = [];
var transform = osm2geojson(function(feature) {
  return feature.geometry.type == 'Polygon';
}, function(feature) {
  delete feature.geometry.coordinates
  return feature
});

input.pipe(transform).pipe(process.stdout);

// This is producing multiple results with the same id; am I getting revisions?
