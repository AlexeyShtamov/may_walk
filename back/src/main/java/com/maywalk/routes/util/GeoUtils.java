package com.maywalk.routes.util;

import com.maywalk.routes.model.GeoPoint;

public final class GeoUtils {
    private GeoUtils() {
    }

    public static double distanceMeters(GeoPoint a, GeoPoint b) {
        final int earthRadius = 6371000;
        double latDistance = Math.toRadians(b.getLat() - a.getLat());
        double lonDistance = Math.toRadians(b.getLng() - a.getLng());
        double sinLat = Math.sin(latDistance / 2);
        double sinLon = Math.sin(lonDistance / 2);
        double aCalc = sinLat * sinLat + Math.cos(Math.toRadians(a.getLat())) * Math.cos(Math.toRadians(b.getLat())) * sinLon * sinLon;
        double c = 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1 - aCalc));
        return earthRadius * c;
    }
}
