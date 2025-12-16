package com.maywalk.routes.model;

import jakarta.validation.constraints.NotNull;

public class GeoPoint {
    @NotNull
    private Double lat;
    @NotNull
    private Double lng;
    private boolean node;

    public GeoPoint() {
    }

    public GeoPoint(Double lat, Double lng, boolean node) {
        this.lat = lat;
        this.lng = lng;
        this.node = node;
    }

    public Double getLat() {
        return lat;
    }

    public void setLat(Double lat) {
        this.lat = lat;
    }

    public Double getLng() {
        return lng;
    }

    public void setLng(Double lng) {
        this.lng = lng;
    }

    public boolean isNode() {
        return node;
    }

    public void setNode(boolean node) {
        this.node = node;
    }
}
