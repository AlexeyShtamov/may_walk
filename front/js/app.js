const api = axios.create({ baseURL: 'http://localhost:8080/api' });

const app = Vue.createApp({
  data() {
    return {
      map: null,
      baseLayer: null,
      tileLayer: 'osm',
      drawnSegments: [],
      allowAddPoints: true,
      activePolyline: null,
      currentSegment: {
        name: 'Новый участок',
        surfaceType: 'FOREST_TRAIL',
        preliminary: true,
        points: [],
      },
      segments: [],
      routeName: 'Черновик маршрута',
      status: 'PRELIMINARY',
      snapToArchive: true,
      snapToRoads: false,
      archiveThreshold: 40,
      metrics: null,
      routes: [],
      selectedRouteId: null,
      loading: false,
      notice: '',
      mode: 'free',
      showOldRoutes: false,
      focusOnRoute: false,
      coverageMode: 'none',
      surfaces: {
        asphalt: true,
        trail: true,
        field: true,
        rail: true,
      },
    };
  },
  mounted() {
    this.map = L.map('map').setView([56.8389, 60.6057], 11);
    this.baseLayer = this.createTileLayer(this.tileLayer).addTo(this.map);

    this.activePolyline = L.polyline([], { color: '#d32f2f', weight: 4 }).addTo(this.map);
    this.map.on('click', this.handleMapClick);
    this.loadRoutes();
  },
  methods: {
    createTileLayer(key) {
      const providers = {
        osm: {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '© OpenStreetMap',
        },
        arcgis: {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          attribution: '© Esri',
        },
        wikimapia: {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '© OpenStreetMap',
        },
        google: {
          url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
          attribution: 'Tiles © OSM France',
        },
        yandex: {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '© OpenStreetMap',
        },
        satellite: {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: '© Esri World Imagery',
        },
      };
      const provider = providers[key] || providers.osm;
      return L.tileLayer(provider.url, { attribution: provider.attribution });
    },
    setTile(tile) {
      if (tile === this.tileLayer) return;
      this.tileLayer = tile;
      if (this.baseLayer) {
        this.map.removeLayer(this.baseLayer);
      }
      this.baseLayer = this.createTileLayer(tile).addTo(this.map);
    },
    async loadRoutes() {
      const response = await api.get('/routes');
      this.routes = response.data;
      if (!this.selectedRouteId && this.routes.length) {
        this.selectedRouteId = this.routes[0].id;
      }
    },
    resetSegment() {
      this.currentSegment = {
        name: 'Участок ' + (this.segments.length + 1),
        surfaceType: 'FOREST_TRAIL',
        preliminary: true,
        points: [],
      };
      this.activePolyline.setLatLngs([]);
    },
    togglePointMode() {
      this.allowAddPoints = !this.allowAddPoints;
      this.notice = this.allowAddPoints ? 'Режим добавления точек включён' : 'Добавление точек временно отключено';
    },
    async handleMapClick(e) {
      if (!this.allowAddPoints) return;
      let chosenPoint = e.latlng;
      if (this.snapToArchive) {
        const candidate = await this.searchNearest(e.latlng);
        if (candidate) {
          this.notice = `Привязали к архивному маршруту: ${candidate.routeName}`;
          chosenPoint = L.latLng(candidate.point.lat, candidate.point.lng);
        }
      }
      this.currentSegment.points.push({ lat: chosenPoint.lat, lng: chosenPoint.lng, node: false });
      this.activePolyline.setLatLngs(this.currentSegment.points.map(p => [p.lat, p.lng]));
      this.updateMetricsDraft();
    },
    async searchNearest(latlng) {
      try {
        const payload = { lat: latlng.lat, lng: latlng.lng, thresholdMeters: this.archiveThreshold };
        const response = await api.post('/routes/nearest', payload);
        return response.data;
      } catch (e) {
        return null;
      }
    },
    addSegment() {
      if (this.currentSegment.points.length === 0) return;
      this.segments.push({ ...this.currentSegment, id: crypto.randomUUID() });
      this.resetSegment();
      this.drawSegments();
      this.updateMetricsDraft();
    },
    removeSegment(index) {
      this.segments.splice(index, 1);
      this.drawSegments();
      this.updateMetricsDraft();
    },
    clearRenderedSegments() {
      this.drawnSegments.forEach(layer => this.map.removeLayer(layer));
      this.drawnSegments = [];
    },
    clearRoute() {
      this.segments = [];
      this.resetSegment();
      this.metrics = null;
      this.notice = 'Маршрут очищен';
      this.clearRenderedSegments();
    },
    async saveRoute() {
      this.loading = true;
      try {
        const payload = {
          name: this.routeName,
          status: this.status,
          segments: [...this.segments, this.currentSegment],
        };
        const response = await api.post('/routes', payload);
        this.metrics = response.data.metrics;
        this.notice = 'Маршрут сохранён и проанализирован';
        this.selectedRouteId = response.data.route.id;
        await this.loadRoutes();
      } catch (e) {
        this.notice = 'Не удалось сохранить маршрут';
      } finally {
        this.loading = false;
      }
    },
    async openRoute() {
      if (!this.selectedRouteId && this.routes.length) {
        this.selectedRouteId = this.routes[0].id;
      }
      if (!this.selectedRouteId) return;

      const response = await api.get(`/routes/${this.selectedRouteId}`);
      const loaded = response.data.route;
      this.routeName = loaded.name;
      this.status = loaded.status;
      this.segments = loaded.segments;
      this.currentSegment = { name: 'Новый участок', surfaceType: 'FOREST_TRAIL', preliminary: true, points: [] };
      this.metrics = response.data.metrics;
      this.activePolyline.setLatLngs([]);
      this.drawSegments();
    },
    drawSegments() {
      if (!this.map) return;
      this.clearRenderedSegments();
      this.segments.forEach(segment => {
        const polyline = L.polyline(segment.points.map(p => [p.lat, p.lng]), {
          color: segment.preliminary ? '#ffa726' : '#1976d2',
          weight: 4,
        }).addTo(this.map);
        this.drawnSegments.push(polyline);
      });
    },
    updateMetricsDraft() {
      const draftSegments = [...this.segments];
      if (this.currentSegment.points.length) {
        draftSegments.push(this.currentSegment);
      }
      if (!draftSegments.length) {
        this.metrics = null;
        return;
      }

      let total = 0;
      let preliminary = 0;
      let final = 0;
      const bySurfaceMeters = {};

      draftSegments.forEach(seg => {
        let segMeters = 0;
        for (let i = 1; i < seg.points.length; i++) {
          const a = seg.points[i - 1];
          const b = seg.points[i];
          const d = this.haversine(a.lat, a.lng, b.lat, b.lng);
          segMeters += d;
        }
        total += segMeters;
        const km = segMeters / 1000;
        bySurfaceMeters[seg.surfaceType] = (bySurfaceMeters[seg.surfaceType] || 0) + segMeters;
        if (seg.preliminary) {
          preliminary += segMeters;
        } else {
          final += segMeters;
        }
      });

      const formatKm = m => +(m / 1000).toFixed(1);

      this.metrics = {
        totalKm: formatKm(total),
        preliminaryKm: formatKm(preliminary),
        finalKm: formatKm(final),
        estimatedMinutes: Math.round((total / 1000) / 4.5 * 60) || 0,
        bySurface: Object.fromEntries(Object.entries(bySurfaceMeters).map(([k, v]) => [k, formatKm(v)])),
      };
    },
    haversine(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },
    async exportRoute(type) {
      if (!this.selectedRouteId) {
        this.notice = 'Сначала сохраните маршрут';
        return;
      }
      const endpoint = `/routes/${this.selectedRouteId}/export/${type}`;
      const response = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `route-${this.selectedRouteId}.${type}`;
      link.click();
    },
  },
});

app.mount('#app');
