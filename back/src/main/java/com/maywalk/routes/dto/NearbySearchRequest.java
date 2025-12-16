package com.maywalk.routes.dto;

import jakarta.validation.constraints.NotNull;

public class NearbySearchRequest {
    @NotNull
    private Double lat;

    @NotNull
    private Double lng;

    private double thresholdMeters = 50d;

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

    public double getThresholdMeters() {
        return thresholdMeters;
    }

    public void setThresholdMeters(double thresholdMeters) {
        this.thresholdMeters = thresholdMeters;
    }
}
