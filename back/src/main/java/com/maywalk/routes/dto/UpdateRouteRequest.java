package com.maywalk.routes.dto;

import java.util.ArrayList;
import java.util.List;

import com.maywalk.routes.model.RouteSegment;
import com.maywalk.routes.model.RouteStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class UpdateRouteRequest {
    @NotBlank
    private String name;

    @NotNull
    private RouteStatus status;

    @Valid
    private List<RouteSegment> segments = new ArrayList<>();

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public RouteStatus getStatus() {
        return status;
    }

    public void setStatus(RouteStatus status) {
        this.status = status;
    }

    public List<RouteSegment> getSegments() {
        return segments;
    }

    public void setSegments(List<RouteSegment> segments) {
        this.segments = segments;
    }
}
