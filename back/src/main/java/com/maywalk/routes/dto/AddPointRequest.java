package com.maywalk.routes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class AddPointRequest {
    @NotBlank
    private String segmentId;

    @NotNull
    private Double lat;

    @NotNull
    private Double lng;

    private boolean node;

    public String getSegmentId() {
        return segmentId;
    }

    public void setSegmentId(String segmentId) {
        this.segmentId = segmentId;
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
