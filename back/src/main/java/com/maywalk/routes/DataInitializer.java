package com.maywalk.routes;

import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.maywalk.routes.model.GeoPoint;
import com.maywalk.routes.model.Route;
import com.maywalk.routes.model.RouteSegment;
import com.maywalk.routes.model.RouteStatus;
import com.maywalk.routes.model.SurfaceType;
import com.maywalk.routes.service.RouteService;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner seedRoutes(RouteService routeService) {
        return args -> {
            routeService.deleteAll();
            RouteSegment archiveSegment = new RouteSegment(
                    "Маршрут 2023",
                    SurfaceType.FOREST_TRAIL,
                    false,
                    List.of(
                            new GeoPoint(56.839, 60.605, true),
                            new GeoPoint(56.845, 60.62, false),
                            new GeoPoint(56.85, 60.64, false),
                            new GeoPoint(56.86, 60.66, true)));
            Route archive = new Route("Архивный маршрут", RouteStatus.FINAL, List.of(archiveSegment));
            routeService.save(archive);

            RouteSegment citySegment = new RouteSegment(
                    "Городской участок",
                    SurfaceType.ASPHALT,
                    true,
                    List.of(
                            new GeoPoint(56.84, 60.59, true),
                            new GeoPoint(56.83, 60.57, false),
                            new GeoPoint(56.82, 60.55, true)));
            Route draft = new Route("Предварительный пример", RouteStatus.PRELIMINARY, List.of(citySegment));
            routeService.save(draft);
        };
    }
}
