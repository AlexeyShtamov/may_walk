package com.maywalk.routes.model;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class RouteSegment {
    private String id = UUID.randomUUID().toString();

    @NotBlank
    private String name;

    @NotNull
    private SurfaceType surfaceType = SurfaceType.UNKNOWN;

    private boolean preliminary;

    @Valid
    private List<GeoPoint> points = new ArrayList<>();

    public RouteSegment() {
    }

    public RouteSegment(String name, SurfaceType surfaceType, boolean preliminary, List<GeoPoint> points) {
        this.name = name;
        this.surfaceType = surfaceType;
        this.preliminary = preliminary;
        if (points != null) {
            this.points.addAll(points);
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public SurfaceType getSurfaceType() {
        return surfaceType;
    }

    public void setSurfaceType(SurfaceType surfaceType) {
        this.surfaceType = surfaceType;
    }

    public boolean isPreliminary() {
        return preliminary;
    }

    public void setPreliminary(boolean preliminary) {
        this.preliminary = preliminary;
    }

    public List<GeoPoint> getPoints() {
        return points;
    }

    public void setPoints(List<GeoPoint> points) {
        this.points = points;
    }
}
