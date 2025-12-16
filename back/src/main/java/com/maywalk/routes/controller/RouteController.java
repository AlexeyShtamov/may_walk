package com.maywalk.routes.controller;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.maywalk.routes.dto.AddPointRequest;
import com.maywalk.routes.dto.CreateRouteRequest;
import com.maywalk.routes.dto.EvaluateRouteRequest;
import com.maywalk.routes.dto.NearbyPointResponse;
import com.maywalk.routes.dto.NearbySearchRequest;
import com.maywalk.routes.dto.RouteResponse;
import com.maywalk.routes.dto.UpdateRouteRequest;
import com.maywalk.routes.model.GeoPoint;
import com.maywalk.routes.model.Route;
import com.maywalk.routes.model.RouteStatus;
import com.maywalk.routes.service.RouteService;

@RestController
@RequestMapping("/api/routes")
public class RouteController {

    private final RouteService routeService;

    public RouteController(RouteService routeService) {
        this.routeService = routeService;
    }

    @GetMapping
    public List<Route> list() {
        return routeService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<RouteResponse> get(@PathVariable("id") UUID id) {
        return routeService.findById(id)
                .map(route -> ResponseEntity.ok(new RouteResponse(route, routeService.buildMetrics(route))))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<RouteResponse> create(@RequestBody @Validated CreateRouteRequest request) {
        Route route = new Route(request.getName(), request.getStatus(), request.getSegments());
        routeService.save(route);
        return ResponseEntity.ok(new RouteResponse(route, routeService.buildMetrics(route)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RouteResponse> update(@PathVariable("id") UUID id, @RequestBody @Validated UpdateRouteRequest request) {
        Optional<Route> existing = routeService.findById(id);
        if (existing.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Route route = existing.get();
        route.setName(request.getName());
        route.setStatus(request.getStatus());
        route.setSegments(request.getSegments());
        routeService.save(route);
        return ResponseEntity.ok(new RouteResponse(route, routeService.buildMetrics(route)));
    }

    @PostMapping("/{id}/points")
    public ResponseEntity<GeoPoint> addPoint(@PathVariable("id") UUID id, @RequestBody @Validated AddPointRequest request) {
        GeoPoint point = new GeoPoint(request.getLat(), request.getLng(), request.isNode());
        return routeService.addPoint(id, request.getSegmentId(), point)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/metrics")
    public ResponseEntity<?> metrics(@RequestBody @Validated EvaluateRouteRequest request) {
        return ResponseEntity.ok(routeService.evaluate(request.getSegments(), request.getStatus(), request.getName()));
    }

    @PostMapping("/nearest")
    public ResponseEntity<NearbyPointResponse> nearest(@RequestBody @Validated NearbySearchRequest request) {
        GeoPoint target = new GeoPoint(request.getLat(), request.getLng(), false);
        return routeService.findNearest(target, request.getThresholdMeters())
                .map(result -> {
                    NearbyPointResponse response = new NearbyPointResponse();
                    response.setPoint(result.getPoint());
                    response.setRouteId(result.getRoute().getId().toString());
                    response.setRouteName(result.getRoute().getName());
                    response.setDistanceMeters(result.getDistanceMeters());
                    return ResponseEntity.ok(response);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/status")
    public ResponseEntity<RouteResponse> status(@PathVariable("id") UUID id, @RequestBody RouteStatus status) {
        return routeService.findById(id)
                .map(route -> {
                    route.setStatus(status);
                    routeService.save(route);
                    return ResponseEntity.ok(new RouteResponse(route, routeService.buildMetrics(route)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/undo")
    public ResponseEntity<RouteResponse> undo(@PathVariable("id") UUID id) {
        return routeService.undo(id)
                .map(route -> ResponseEntity.ok(new RouteResponse(route, routeService.buildMetrics(route))))
                .orElse(ResponseEntity.badRequest().build());
    }

    @PostMapping("/{id}/redo")
    public ResponseEntity<RouteResponse> redo(@PathVariable("id") UUID id) {
        return routeService.redo(id)
                .map(route -> ResponseEntity.ok(new RouteResponse(route, routeService.buildMetrics(route))))
                .orElse(ResponseEntity.badRequest().build());
    }

    @GetMapping("/{id}/export/gpx")
    public ResponseEntity<String> exportGpx(@PathVariable("id") UUID id) {
        return routeService.findById(id)
                .map(route -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=route-" + route.getId() + ".gpx")
                        .contentType(MediaType.APPLICATION_XML)
                        .body(routeService.exportGpx(route)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/export/kml")
    public ResponseEntity<String> exportKml(@PathVariable("id") UUID id) {
        return routeService.findById(id)
                .map(route -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=route-" + route.getId() + ".kml")
                        .contentType(MediaType.APPLICATION_XML)
                        .body(routeService.exportKml(route)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/export/kmz")
    public ResponseEntity<byte[]> exportKmz(@PathVariable("id") UUID id) {
        return routeService.findById(id)
                .map(route -> {
                    try {
                        return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_DISPOSITION,
                                        "attachment; filename=route-" + route.getId() + ".kmz")
                                .contentType(MediaType.parseMediaType("application/vnd.google-earth.kmz"))
                                .body(routeService.exportKmz(route));
                    } catch (IOException e) {
                        return ResponseEntity.internalServerError().<byte[]>build();
                    }
                })
                .orElse(ResponseEntity.notFound().<byte[]>build());
    }

    @PostMapping("/import/gpx")
    public ResponseEntity<RouteResponse> importGpx(@RequestBody String base64Payload) {
        Route route = routeService.importGpx(base64Payload, "Импорт GPX", RouteStatus.PRELIMINARY);
        return ResponseEntity.ok(new RouteResponse(route, routeService.buildMetrics(route)));
    }

    @PostMapping("/import/kml")
    public ResponseEntity<RouteResponse> importKml(@RequestBody String base64Payload) {
        Route route = routeService.importKml(base64Payload, "Импорт KML", RouteStatus.PRELIMINARY);
        return ResponseEntity.ok(new RouteResponse(route, routeService.buildMetrics(route)));
    }
}
