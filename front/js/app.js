const api = axios.create({ baseURL: 'http://localhost:8080/api' });

const app = Vue.createApp({
  data() {
    return {
      map: null,
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
    };
  },
  mounted() {
    this.map = L.map('map').setView([56.8389, 60.6057], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(this.map);

    this.activePolyline = L.polyline([], { color: '#d32f2f', weight: 4 }).addTo(this.map);
    this.map.on('click', this.handleMapClick);
    this.loadRoutes();
  },
  methods: {
    async loadRoutes() {
      const response = await api.get('/routes');
      this.routes = response.data;
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
    async handleMapClick(e) {
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
      this.updateMetricsDraft();
    },
    removeSegment(index) {
      this.segments.splice(index, 1);
      this.updateMetricsDraft();
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
      this.segments.forEach(segment => {
        L.polyline(segment.points.map(p => [p.lat, p.lng]), {
          color: segment.preliminary ? '#ffa726' : '#1976d2',
          weight: 4,
        }).addTo(this.map);
      });
    },
    updateMetricsDraft() {
      if (!this.segments.length && !this.currentSegment.points.length) return;
      const draftRoute = {
        name: this.routeName,
        status: this.status,
        segments: [...this.segments, this.currentSegment],
      };
      const km = this.distanceKm(draftRoute.segments);
      this.metrics = {
        totalKm: km,
        preliminaryKm: draftRoute.segments.filter(s => s.preliminary).length ? km : 0,
        estimatedMinutes: Math.round(km / 4.5 * 60),
        bySurface: {},
      };
    },
    distanceKm(segments) {
      let dist = 0;
      segments.forEach(seg => {
        for (let i = 1; i < seg.points.length; i++) {
          const a = seg.points[i - 1];
          const b = seg.points[i];
          const d = this.haversine(a.lat, a.lng, b.lat, b.lng);
          dist += d;
        }
      });
      return +(dist / 1000).toFixed(2);
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
