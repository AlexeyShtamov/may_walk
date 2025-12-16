let map;
let points = [];
let polyline = null;
let drawMode = "point";

// Инициализация карты
map = L.map("map").setView([56.8389, 60.6057], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

// Клик по карте
map.on("click", (e) => {
  if (drawMode === "point") {
    addPoint(e.latlng);
  }
});

// Добавить точку
function addPoint(latlng) {
  L.marker(latlng).addTo(map);
  points.push(latlng);
  drawRoute();
}

// Нарисовать маршрут
function drawRoute() {
  if (polyline) {
    map.removeLayer(polyline);
  }

  if (points.length > 1) {
    polyline = L.polyline(points, {
      color: "blue",
      weight: 4,
    }).addTo(map);

    updateDistance();
  }
}

// Подсчёт расстояния
function updateDistance() {
  let dist = 0;
  for (let i = 1; i < points.length; i++) {
    dist += points[i - 1].distanceTo(points[i]);
  }
  document.getElementById("distance").innerText = (dist / 1000).toFixed(2);
}

// Кнопки
document.getElementById("draw-point").onclick = () => {
  drawMode = "point";
};

document.getElementById("draw-line").onclick = () => {
  drawMode = "point"; // MVP — линия из точек
};

document.getElementById("clear").onclick = () => {
  points = [];
  if (polyline) map.removeLayer(polyline);
  polyline = null;
  document.getElementById("distance").innerText = "0";
  map.eachLayer((l) => {
    if (l instanceof L.Marker) map.removeLayer(l);
  });
};
