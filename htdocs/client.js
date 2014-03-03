
var map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('http://{s}.tile.cloudmade.com/616a3b76c74a4e54b9ac6033ffc22a0a/997/256/{z}/{x}/{y}.png', {
  attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
  maxZoom: 18
}).addTo(map);

var gjLayer = L.geoJson(null, {
  style: {
    color: '#ff7800',
    weight: 5,
    opacity: 0.65
  }
}).addTo(map);

var req = new XMLHttpRequest();
req.open('get', 'segments', true);
req.send();
req.onload = function() {
  var segments = JSON.parse(this.responseText);
  gjLayer.addData(segments);
  map.fitBounds(gjLayer.getBounds());
};

