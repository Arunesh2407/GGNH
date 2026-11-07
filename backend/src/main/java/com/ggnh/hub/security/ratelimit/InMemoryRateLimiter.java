package com.ggnh.hub.security.ratelimit;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class InMemoryRateLimiter {

    private final Map<String, Deque<Long>> requestWindows = new ConcurrentHashMap<>();

    public synchronized boolean tryAcquire(String key, int maxRequestsPerMinute) {
        if (maxRequestsPerMinute <= 0) {
            return false;
        }

        long now = System.currentTimeMillis();
        long windowStart = now - 60_000L;

        Deque<Long> timestamps = requestWindows.computeIfAbsent(key, k -> new ArrayDeque<>());

        // Evict expired timestamps outside the 1-minute sliding window
        while (!timestamps.isEmpty() && timestamps.peekFirst() <= windowStart) {
            timestamps.pollFirst();
        }

        if (timestamps.size() >= maxRequestsPerMinute) {
            return false;
        }

        timestamps.addLast(now);
        return true;
    }

    public synchronized void reset() {
        requestWindows.clear();
    }
}

