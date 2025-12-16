package com.maywalk.routes.dto;

import java.util.EnumMap;
import java.util.Map;

import com.maywalk.routes.model.SurfaceType;

public class RouteMetrics {
    private double totalKm;
    private double preliminaryKm;
    private double finalKm;
    private Map<SurfaceType, Double> bySurface = new EnumMap<>(SurfaceType.class);
    private double estimatedMinutes;

    public RouteMetrics() {
    }

    public double getTotalKm() {
        return totalKm;
    }

    public void setTotalKm(double totalKm) {
        this.totalKm = totalKm;
    }

    public Map<SurfaceType, Double> getBySurface() {
        return bySurface;
    }

    public void setBySurface(Map<SurfaceType, Double> bySurface) {
        this.bySurface = bySurface;
    }

    public double getPreliminaryKm() {
        return preliminaryKm;
    }

    public void setPreliminaryKm(double preliminaryKm) {
        this.preliminaryKm = preliminaryKm;
    }

    public double getEstimatedMinutes() {
        return estimatedMinutes;
    }

    public void setEstimatedMinutes(double estimatedMinutes) {
        this.estimatedMinutes = estimatedMinutes;
    }

    public double getFinalKm() {
        return finalKm;
    }

    public void setFinalKm(double finalKm) {
        this.finalKm = finalKm;
    }
}
