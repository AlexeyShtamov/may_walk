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
      activeMarkers: [],
      currentSegment: {
        name: 'Новый участок',
        surfaceType: 'UNKNOWN',
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
      mode: 'point',
      showOldRoutes: false,
      focusOnRoute: false,
      coverageMode: 'none',

      isDrawing: false,
      skipNextClick: false,
      freeDrawMinDistance: 8,

      undoStack: [],
      redoStack: [],
      restoring: false,
    };
  },
  mounted() {
    this.map = L.map('map').setView([56.8389, 60.6057], 11);
    this.baseLayer = this.createTileLayer(this.tileLayer).addTo(this.map);

    this.activePolyline = L.polyline([], { color: '#d32f2f', weight: 4 }).addTo(this.map);
    this.map.on('click', this.handleMapClick);
    this.map.on('mousedown', this.handleMouseDown);
    this.map.on('mousemove', this.handleMouseMove);
    this.map.on('mouseup', this.handleMouseUp);
    this.updateMapInteraction();
    this.loadRoutes();
    this.pushHistory();
  },
  watch: {
    status(newStatus) {
      this.handleStatusChange(newStatus);
    },
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
      if (this.routes.length && (!this.selectedRouteId || !this.routes.find(r => r.id === this.selectedRouteId))) {
        this.selectedRouteId = this.routes[0].id;
      }
      if (!this.routes.length) {
        this.selectedRouteId = '';
      }
    },

    resetSegment() {
      this.currentSegment = {
        name: 'Участок ' + (this.segments.length + 1),
        surfaceType: 'UNKNOWN',
        preliminary: true,
        points: [],
      };
      this.activePolyline.setLatLngs([]);
      this.clearActiveMarkers();
    },

    setMode(newMode) {
      const allowed = ['point', 'free', 'pan'];
      if (!allowed.includes(newMode)) return;
      if (!this.allowAddPoints && newMode !== 'pan') return;
      this.mode = newMode;
      this.isDrawing = false;
      this.skipNextClick = false;
      this.updateMapInteraction();
    },

    updateMapInteraction() {
      if (!this.map) return;
      if (this.mode === 'pan') {
        this.map.dragging.enable();
        this.map.keyboard.enable();
      } else {
        this.map.dragging.disable();
        this.map.keyboard.disable();
      }
    },

    handleStatusChange(status) {
      if (this.restoring) return;
      if (status === 'FINAL') {
        this.finalizeCurrentSegment();
        this.markSegmentsFinal();
        this.allowAddPoints = false;
        this.setMode('pan');
        this.drawSegments();
        this.refreshMetricsFromBackend();
      } else {
        this.allowAddPoints = true;
        if (this.mode === 'pan') {
          this.setMode('point');
        }
        this.updateMetricsDraft();
      }
      this.pushHistory();
    },

    markSegmentsFinal() {
      this.segments = this.segments.map(seg => ({ ...seg, preliminary: false }));
    },

    finalizeCurrentSegment() {
      if (this.currentSegment.points.length) {
        this.segments.push({ ...this.currentSegment, id: this.currentSegment.id || crypto.randomUUID() });
        this.currentSegment = { name: 'Новый участок', surfaceType: 'UNKNOWN', preliminary: true, points: [] };
        this.activePolyline.setLatLngs([]);
        this.clearActiveMarkers();
        this.drawSegments();
      }
    },

    async handleMapClick(e) {
      if (this.mode === 'pan') return;
      if (this.mode === 'free') {
        if (this.skipNextClick) {
          this.skipNextClick = false;
          return;
        }
      }
      this.addPointToCurrent(e.latlng);
    },

    async addPointToCurrent(latlng) {
      if (!this.allowAddPoints) return;

      let chosenPoint = latlng;
      if (this.snapToArchive) {
        const candidate = await this.searchNearest(latlng);
        if (candidate) {
          this.notice = `Привязали к архивному маршруту: ${candidate.routeName}`;
          chosenPoint = L.latLng(candidate.point.lat, candidate.point.lng);
        }
      }
      this.currentSegment.points.push({ lat: chosenPoint.lat, lng: chosenPoint.lng, node: false });
      this.activePolyline.setLatLngs(this.currentSegment.points.map(p => [p.lat, p.lng]));
      this.redrawActiveMarkers();
      this.updateMetricsDraft();
      this.pushHistory();
    },

    async handleMouseDown(e) {
      if (!this.allowAddPoints || this.mode !== 'free') return;
      this.isDrawing = true;
      this.skipNextClick = true;
      await this.addPointToCurrent(e.latlng);
    },

    async handleMouseMove(e) {
      if (!this.isDrawing || this.mode !== 'free') return;
      const last = this.currentSegment.points[this.currentSegment.points.length - 1];
      const latlng = e.latlng;
      if (last) {
        const lastLatLng = L.latLng(last.lat, last.lng);
        if (lastLatLng.distanceTo(latlng) < this.freeDrawMinDistance) {
          return;
        }
      }
      await this.addPointToCurrent(latlng);
    },

    handleMouseUp() {
      if (this.mode !== 'free') return;
      this.isDrawing = false;
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
      this.pushHistory();
    },

    removeSegment(index) {
      this.segments.splice(index, 1);
      this.drawSegments();
      this.updateMetricsDraft();
      this.pushHistory();
    },

    clearRenderedSegments() {
      this.drawnSegments.forEach(entry => {
        this.map.removeLayer(entry.line);
        entry.markers.forEach(marker => this.map.removeLayer(marker));
      });
      this.drawnSegments = [];
    },

    clearRoute(message = 'Маршрут сохранен') {
      this.restoring = true;
      this.segments = [];
      this.resetSegment();
      this.metrics = null;
      this.notice = message;
      this.routeName = 'Черновик маршрута';
      this.clearRenderedSegments();
      this.status = 'PRELIMINARY';
      this.restoring = false;
      this.allowAddPoints = true;
      this.setMode('point');
      this.snapToArchive = true;
      this.snapToRoads = false;
      this.showOldRoutes = false;
      this.updateMapInteraction();
      this.undoStack = [];
      this.redoStack = [];
      this.pushHistory();
    },

    async saveRoute() {
      if (this.status === 'PRELIMINARY') {
        window.alert('Нельзя сохранить предварительный маршрут. Выберите статус "Окончательный".');
        return;
      }
      this.loading = true;
      try {
        const payload = {
          name: this.routeName,
          status: this.status,
          segments: this.collectSegments(),
        };
        const response = await api.post('/routes', payload);
        this.metrics = response.data.metrics;
        this.selectedRouteId = response.data.route.id;
        await this.loadRoutes();
        this.clearRoute('Маршрут сохранен');
      } catch (e) {
        this.notice = 'Не удалось сохранить маршрут';
      } finally {
        this.loading = false;
      }
    },

    async openRoute() {
      if (!this.selectedRouteId) {
        this.notice = this.routes.length ? 'Выберите маршрут из списка' : 'Нет сохраненных маршрутов';
        return;
      }

      this.restoring = true;
      const response = await api.get(`/routes/${this.selectedRouteId}`);
      const loaded = response.data.route;
      this.routeName = loaded.name;
      this.status = loaded.status;
      this.segments = loaded.segments;
      this.currentSegment = { name: 'Новый участок', surfaceType: 'UNKNOWN', preliminary: true, points: [] };
      this.metrics = response.data.metrics;
      this.activePolyline.setLatLngs([]);
      this.clearActiveMarkers();
      this.drawSegments();
      this.undoStack = [];
      this.redoStack = [];
      this.allowAddPoints = this.status !== 'FINAL';
      this.setMode(this.allowAddPoints ? 'point' : 'pan');
      this.restoring = false;
      this.updateMapInteraction();
      this.notice = '';
      this.pushHistory();
    },

    drawSegments() {
      if (!this.map) return;
      this.clearRenderedSegments();
      this.segments.forEach(segment => {
        const color = segment.preliminary ? '#ffa726' : '#1976d2';
        const polyline = L.polyline(segment.points.map(p => [p.lat, p.lng]), {
          color,
          weight: 4,
        }).addTo(this.map);
        const markers = this.createPointMarkers(segment.points, color);
        markers.forEach(m => m.addTo(this.map));
        this.drawnSegments.push({ line: polyline, markers });
      });
    },

    createPointMarkers(points, color) {
      const radius = 4;
      return points.map(p => L.circleMarker([p.lat, p.lng], {
        radius,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.85,
      }));
    },

    redrawActiveMarkers() {
      this.clearActiveMarkers();
      this.activeMarkers = this.createPointMarkers(this.currentSegment.points, '#d32f2f');
      this.activeMarkers.forEach(m => m.addTo(this.map));
    },

    clearActiveMarkers() {
      this.activeMarkers.forEach(marker => this.map.removeLayer(marker));
      this.activeMarkers = [];
    },

    updateMetricsDraft() {
      const draftSegments = this.collectSegments();
      if (!draftSegments.length) {
        this.metrics = null;
        return;
      }

      let total = 0;
      draftSegments.forEach(seg => {
        for (let i = 1; i < seg.points.length; i++) {
          const a = seg.points[i - 1];
          const b = seg.points[i];
          total += this.haversine(a.lat, a.lng, b.lat, b.lng);
        }
      });

      const formatKm = m => +(m / 1000).toFixed(1);
      this.metrics = {
        totalKm: formatKm(total),
        estimatedMinutes: Math.round((total / 1000) / 4.5 * 60) || 0,
        preliminaryKm: formatKm(total),
        finalKm: 0,
        bySurface: {},
        coverageFallback: false,
      };
    },

    async refreshMetricsFromBackend() {
      const payload = {
        name: this.routeName,
        status: this.status,
        segments: this.collectSegments(),
      };
      const response = await api.post('/routes/metrics', payload);
      this.metrics = response.data;
    },

    collectSegments() {
      const draft = [...this.cloneSegments(this.segments)];
      if (this.currentSegment.points.length) {
        draft.push(this.cloneSegment(this.currentSegment));
      }
      return draft;
    },

    cloneSegments(list) {
      return list.map(seg => this.cloneSegment(seg));
    },

    cloneSegment(seg) {
      return {
        ...seg,
        points: seg.points.map(p => ({ ...p })),
      };
    },

    snapshotRoute() {
      return {
        segments: this.cloneSegments(this.segments),
        currentSegment: this.cloneSegment(this.currentSegment),
        status: this.status,
        routeName: this.routeName,
      };
    },

    applySnapshot(state) {
      this.restoring = true;
      this.segments = this.cloneSegments(state.segments);
      this.currentSegment = this.cloneSegment(state.currentSegment);
      this.status = state.status;
      this.routeName = state.routeName;
      this.restoring = false;
      this.activePolyline.setLatLngs(this.currentSegment.points.map(p => [p.lat, p.lng]));
      this.redrawActiveMarkers();
      this.drawSegments();
      this.allowAddPoints = this.status !== 'FINAL';
      if (!this.allowAddPoints && this.mode !== 'pan') {
        this.setMode('pan');
      } else if (this.allowAddPoints && this.mode === 'pan') {
        this.setMode('point');
      } else {
        this.updateMapInteraction();
      }
      if (this.status === 'FINAL') {
        this.refreshMetricsFromBackend();
      } else {
        this.updateMetricsDraft();
      }
    },

    pushHistory() {
      if (this.restoring) return;
      this.undoStack.push(this.snapshotRoute());
      this.redoStack = [];
    },

    undoAction() {
      if (this.undoStack.length < 2) return;
      const current = this.undoStack.pop();
      this.redoStack.push(current);
      const previous = this.undoStack[this.undoStack.length - 1];
      this.applySnapshot(previous);
    },

    redoAction() {
      if (!this.redoStack.length) return;
      const next = this.redoStack.pop();
      this.undoStack.push(next);
      this.applySnapshot(next);
    },

    surfaceLabel(type) {
      if (this.status !== 'FINAL') {
        return '0 км';
      }
      if (this.metrics?.coverageFallback && type !== 'ASPHALT') {
        return 'no sup. MVP';
      }
      const value = this.metrics?.bySurface?.[type] ?? 0;
      return `${value} км`;
    },

    haversine(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2
          + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    async exportRoute(type) {
      if (this.status === 'PRELIMINARY') {
        window.alert('Нельзя экспортировать предварительный маршрут. Установите статус "Окончательный" и сохраните маршрут.');
        return;
      }
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
