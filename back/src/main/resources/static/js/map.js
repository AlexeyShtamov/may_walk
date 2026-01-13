const map = L.map("map").setView([56.8389, 60.6057], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

let points = [];
let polyline = L.polyline([], { color: "red" }).addTo(map);

map.on("click", (e) => {
  points.push(e.latlng);
  polyline.setLatLngs(points);
  updateDistance();
});

function updateDistance() {
  let dist = 0;
  for (let i = 1; i < points.length; i++) {
    dist += points[i - 1].distanceTo(points[i]);
  }
  document.getElementById("distance").textContent = (dist / 1000).toFixed(2);
}
