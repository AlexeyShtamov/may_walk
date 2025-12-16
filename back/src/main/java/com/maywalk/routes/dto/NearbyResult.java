package com.maywalk.routes.dto;

import com.maywalk.routes.model.GeoPoint;
import com.maywalk.routes.model.Route;

public class NearbyResult {
    private Route route;
    private GeoPoint point;
    private double distanceMeters;

    public NearbyResult(Route route, GeoPoint point, double distanceMeters) {
        this.route = route;
        this.point = point;
        this.distanceMeters = distanceMeters;
    }

    public Route getRoute() {
        return route;
    }

    public GeoPoint getPoint() {
        return point;
    }

    public double getDistanceMeters() {
        return distanceMeters;
    }
}
