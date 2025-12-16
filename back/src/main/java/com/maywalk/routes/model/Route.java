package com.maywalk.routes.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class Route {
    private UUID id = UUID.randomUUID();

    @NotBlank
    private String name;

    @NotNull
    private RouteStatus status = RouteStatus.PRELIMINARY;

    @Valid
    private List<RouteSegment> segments = new ArrayList<>();

    private LocalDateTime updatedAt = LocalDateTime.now();

    public Route() {
    }

    public Route(String name, RouteStatus status, List<RouteSegment> segments) {
        this.name = name;
        this.status = status;
        if (segments != null) {
            this.segments.addAll(segments);
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

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

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
