package com.maywalk.routes.service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import javax.xml.parsers.DocumentBuilderFactory;

import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import com.maywalk.routes.dto.NearbyResult;
import com.maywalk.routes.dto.RouteMetrics;
import com.maywalk.routes.model.GeoPoint;
import com.maywalk.routes.model.Route;
import com.maywalk.routes.model.RouteSegment;
import com.maywalk.routes.model.RouteStatus;
import com.maywalk.routes.model.SurfaceType;
import com.maywalk.routes.util.GeoUtils;

@Service
public class RouteService {
    private final Map<UUID, Route> routes = new ConcurrentHashMap<>();
    private final Map<UUID, RouteHistory> histories = new ConcurrentHashMap<>();

    public List<Route> findAll() {
        return new ArrayList<>(routes.values());
    }

    public Optional<Route> findById(UUID id) {
        return Optional.ofNullable(routes.get(id));
    }

    public Route save(Route route) {
        route.setUpdatedAt(LocalDateTime.now());
        routes.put(route.getId(), route);
        pushSnapshot(route);
        return route;
    }

    public void deleteAll() {
        routes.clear();
    }

    public RouteMetrics buildMetrics(Route route) {
        RouteMetrics metrics = new RouteMetrics();
        Map<SurfaceType, Double> bySurface = metrics.getBySurface();
        double total = 0;
        double prelim = 0;
        double finalMeters = 0;
        boolean finalStatus = route.getStatus() == RouteStatus.FINAL;
        for (RouteSegment segment : route.getSegments()) {
            double segmentMeters = distance(segment.getPoints());
            total += segmentMeters;
            if (segment.isPreliminary()) {
                prelim += segmentMeters;
            }
            if (finalStatus) {
                bySurface.merge(segment.getSurfaceType(), segmentMeters / 1000d, Double::sum);
            }
            if (!segment.isPreliminary()) {
                finalMeters += segmentMeters;
            }
        }
        metrics.setTotalKm(round(total / 1000d));
        metrics.setPreliminaryKm(round(prelim / 1000d));
        metrics.setFinalKm(round(finalMeters / 1000d));
        metrics.setEstimatedMinutes(round(estimateMinutes(total / 1000d, bySurface, finalStatus)));
        return metrics;
    }

    private double estimateMinutes(double totalKm, Map<SurfaceType, Double> bySurfaceKm, boolean useSurface) {
        if (!useSurface) {
            return (totalKm / 4.5) * 60d;
        }
        return minutesBySurface(bySurfaceKm);
    }

    private double minutesBySurface(Map<SurfaceType, Double> bySurfaceKm) {
        // Simple speed map in km/h
        Map<SurfaceType, Double> speeds = Map.of(
                SurfaceType.ASPHALT, 5.5,
                SurfaceType.FOREST_TRAIL, 4.0,
                SurfaceType.FIELD_PATH, 4.3,
                SurfaceType.RAILWAY, 5.0,
                SurfaceType.UNKNOWN, 4.5);
        double minutes = 0;
        for (Map.Entry<SurfaceType, Double> entry : bySurfaceKm.entrySet()) {
            double speed = speeds.getOrDefault(entry.getKey(), 4.5);
            minutes += (entry.getValue() / speed) * 60d;
        }
        return minutes;
    }

    public double distance(List<GeoPoint> points) {
        double dist = 0;
        for (int i = 1; i < points.size(); i++) {
            dist += GeoUtils.distanceMeters(points.get(i - 1), points.get(i));
        }
        return dist;
    }

    public Optional<GeoPoint> addPoint(UUID routeId, String segmentId, GeoPoint point) {
        Route route = routes.get(routeId);
        if (route == null) {
            return Optional.empty();
        }
        for (RouteSegment segment : route.getSegments()) {
            if (segment.getId().equals(segmentId)) {
                pushSnapshot(route);
                segment.getPoints().add(point);
                route.setUpdatedAt(LocalDateTime.now());
                return Optional.of(point);
            }
        }
        return Optional.empty();
    }

    public Optional<NearbyResult> findNearest(GeoPoint target, double thresholdMeters) {
        NearbyResult nearest = null;
        double best = thresholdMeters;
        for (Route route : routes.values()) {
            for (RouteSegment segment : route.getSegments()) {
                for (GeoPoint point : segment.getPoints()) {
                    double dist = GeoUtils.distanceMeters(target, point);
                    if (dist <= best) {
                        best = dist;
                        nearest = new com.maywalk.routes.dto.NearbyResult(route, point, dist);
                    }
                }
            }
        }
        return Optional.ofNullable(nearest);
    }

    public Optional<RouteSegment> findSegment(UUID routeId, String segmentId) {
        Route route = routes.get(routeId);
        if (route == null) return Optional.empty();
        return route.getSegments().stream().filter(s -> s.getId().equals(segmentId)).findFirst();
    }

    public Optional<Route> undo(UUID routeId) {
        Route route = routes.get(routeId);
        RouteHistory history = histories.get(routeId);
        if (route == null || history == null || history.getUndo().size() < 2) {
            return Optional.empty();
        }
        Route current = history.getUndo().pop();
        history.getRedo().push(cloneRoute(current));
        Route previous = cloneRoute(history.getUndo().peek());
        routes.put(routeId, previous);
        return Optional.of(previous);
    }

    public Optional<Route> redo(UUID routeId) {
        RouteHistory history = histories.get(routeId);
        if (history == null || history.getRedo().isEmpty()) {
            return Optional.empty();
        }
        Route next = cloneRoute(history.getRedo().pop());
        histories.get(routeId).getUndo().push(cloneRoute(next));
        routes.put(routeId, next);
        return Optional.of(next);
    }

    public RouteMetrics evaluate(List<RouteSegment> segments, RouteStatus status, String name) {
        Route temp = new Route(name, status, segments);
        return buildMetrics(temp);
    }

    public String exportGpx(Route route) {
        StringBuilder builder = new StringBuilder();
        builder.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        builder.append("<gpx version=\"1.1\" creator=\"MayWalk\" xmlns=\"http://www.topografix.com/GPX/1/1\">\n");
        for (RouteSegment segment : route.getSegments()) {
            builder.append("  <trk><name>").append(segment.getName()).append("</name><trkseg>\n");
            for (GeoPoint point : segment.getPoints()) {
                builder.append("    <trkpt lat=\"").append(point.getLat()).append("\" lon=\"").append(point.getLng()).append("\">");
                if (point.isNode()) {
                    builder.append("<type>node</type>");
                }
                builder.append("</trkpt>\n");
            }
            builder.append("  </trkseg></trk>\n");
        }
        builder.append("</gpx>");
        return builder.toString();
    }

    public String exportKml(Route route) {
        StringBuilder builder = new StringBuilder();
        builder.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        builder.append("<kml xmlns=\"http://www.opengis.net/kml/2.2\"><Document>\n");
        builder.append("<name>").append(route.getName()).append("</name>\n");
        for (RouteSegment segment : route.getSegments()) {
            builder.append("<Placemark><name>").append(segment.getName()).append("</name><LineString><coordinates>\n");
            for (GeoPoint point : segment.getPoints()) {
                builder.append(point.getLng()).append(",").append(point.getLat()).append(",0 ");
            }
            builder.append("</coordinates></LineString></Placemark>\n");
        }
        builder.append("</Document></kml>");
        return builder.toString();
    }

    public byte[] exportKmz(Route route) throws IOException {
        String kml = exportKml(route);
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zos = new ZipOutputStream(baos)) {
            zos.putNextEntry(new ZipEntry("route.kml"));
            zos.write(kml.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
            zos.finish();
            return baos.toByteArray();
        }
    }

    public Route importGpx(String base64Gpx, String name, RouteStatus status) {
        byte[] decoded = Base64.getDecoder().decode(base64Gpx);
        List<GeoPoint> points = parseGpx(decoded);
        RouteSegment segment = new RouteSegment(name + " трек", SurfaceType.UNKNOWN, status == RouteStatus.PRELIMINARY, points);
        Route route = new Route(name, status, List.of(segment));
        save(route);
        return route;
    }

    public Route importKml(String base64Kml, String name, RouteStatus status) {
        byte[] decoded = Base64.getDecoder().decode(base64Kml);
        List<GeoPoint> points = parseKml(decoded);
        RouteSegment segment = new RouteSegment(name + " трасса", SurfaceType.UNKNOWN, status == RouteStatus.PRELIMINARY, points);
        Route route = new Route(name, status, List.of(segment));
        save(route);
        return route;
    }

    private List<GeoPoint> parseGpx(byte[] content) {
        List<GeoPoint> points = new ArrayList<>();
        try {
            Document doc = DocumentBuilderFactory.newInstance().newDocumentBuilder()
                    .parse(new ByteArrayInputStream(content));
            NodeList nodeList = doc.getElementsByTagName("trkpt");
            for (int i = 0; i < nodeList.getLength(); i++) {
                var node = nodeList.item(i);
                double lat = Double.parseDouble(node.getAttributes().getNamedItem("lat").getNodeValue());
                double lon = Double.parseDouble(node.getAttributes().getNamedItem("lon").getNodeValue());
                points.add(new GeoPoint(lat, lon, false));
            }
        } catch (Exception e) {
            // keep empty list on parse error
        }
        return points;
    }

    private List<GeoPoint> parseKml(byte[] content) {
        List<GeoPoint> points = new ArrayList<>();
        try {
            Document doc = DocumentBuilderFactory.newInstance().newDocumentBuilder()
                    .parse(new ByteArrayInputStream(content));
            NodeList coords = doc.getElementsByTagName("coordinates");
            for (int i = 0; i < coords.getLength(); i++) {
                String[] rawPoints = coords.item(i).getTextContent().trim().split(" ");
                for (String raw : rawPoints) {
                    String[] parts = raw.split(",");
                    if (parts.length >= 2) {
                        double lon = Double.parseDouble(parts[0]);
                        double lat = Double.parseDouble(parts[1]);
                        points.add(new GeoPoint(lat, lon, false));
                    }
                }
            }
        } catch (Exception e) {
            // keep empty list
        }
        return points;
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private void pushSnapshot(Route route) {
        RouteHistory history = histories.computeIfAbsent(route.getId(), key -> new RouteHistory());
        history.getUndo().push(cloneRoute(route));
        history.getRedo().clear();
    }

    private Route cloneRoute(Route source) {
        Route copy = new Route();
        copy.setId(source.getId());
        copy.setName(source.getName());
        copy.setStatus(source.getStatus());
        copy.setUpdatedAt(source.getUpdatedAt());
        copy.setSegments(cloneSegments(source.getSegments()));
        return copy;
    }

    private List<RouteSegment> cloneSegments(List<RouteSegment> segments) {
        List<RouteSegment> copy = new ArrayList<>();
        for (RouteSegment segment : segments) {
            RouteSegment newSeg = new RouteSegment();
            newSeg.setId(segment.getId());
            newSeg.setName(segment.getName());
            newSeg.setSurfaceType(segment.getSurfaceType());
            newSeg.setPreliminary(segment.isPreliminary());
            List<GeoPoint> points = new ArrayList<>();
            for (GeoPoint p : segment.getPoints()) {
                points.add(new GeoPoint(p.getLat(), p.getLng(), p.isNode()));
            }
            newSeg.setPoints(points);
            copy.add(newSeg);
        }
        return copy;
    }
}
