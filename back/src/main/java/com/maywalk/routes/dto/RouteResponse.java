package com.maywalk.routes.dto;

import com.maywalk.routes.model.Route;

public class RouteResponse {
    private Route route;
    private RouteMetrics metrics;

    public RouteResponse(Route route, RouteMetrics metrics) {
        this.route = route;
        this.metrics = metrics;
    }

    public Route getRoute() {
        return route;
    }

    public void setRoute(Route route) {
        this.route = route;
    }

    public RouteMetrics getMetrics() {
        return metrics;
    }

    public void setMetrics(RouteMetrics metrics) {
        this.metrics = metrics;
    }
}
