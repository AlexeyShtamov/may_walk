package com.maywalk.routes.service;

import java.util.ArrayDeque;
import java.util.Deque;

import com.maywalk.routes.model.Route;

class RouteHistory {
    private final Deque<Route> undo = new ArrayDeque<>();
    private final Deque<Route> redo = new ArrayDeque<>();

    public Deque<Route> getUndo() {
        return undo;
    }

    public Deque<Route> getRedo() {
        return redo;
    }
}
