
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
    layer.on('click', function(e) {
      layer.selected = !layer.selected;
      if (layer.selected) {
        layer.setStyle({ color: 'blue' });
      }
      else {
        layer.setStyle({ color: '#ff7800' });
      }
    })
    .bindPopup('<strong>' + feature.geometry.type + '</strong><pre>' + JSON.stringify(feature.properties, null, '  ') + '</pre>');
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
};

loadData();
//setInterval(loadData, 5000);

