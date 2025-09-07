/**
 * Centralized export file for all service modules
 * 
 * This module exports all service classes and utilities for easy importing
 * throughout the application. All services are instrumented with OpenTelemetry
 * for comprehensive observability.
 */

// NBA API Services
export { NBAApiService } from './nbaApi';
export { NBAService } from './nba-service';

// Analytics and Metrics
export { NBAAnalyticsMetrics } from './nbaAnalyticsMetrics';
export { MetricsIntegration } from './metricsIntegration';

// Data Management Services
export { DataPreloader } from './dataPreloader';
export { LeagueStatsService } from './leagueStatsService';
export { ParallelDataService } from './parallelDataService';
export { SupabaseDataService } from './supabaseDataService';

// Caching
export * from './dataCache';

/**
 * Service categories for documentation:
 * 
 * API Services:
 * - NBAApiService: Legacy NBA.com API integration with caching and error handling
 * - NBAService: Enhanced NBA API service with comprehensive instrumentation,
 *   retry logic, timeout handling, rate limiting, and data quality assessment
 * 
 * Analytics & Observability:
 * - NBAAnalyticsMetrics: Business-specific metrics tracking for NBA analytics
 * - MetricsIntegration: Integration layer for metrics collection and reporting
 * 
 * Data Management:
 * - DataPreloader: Intelligent data preloading for improved UX
 * - LeagueStatsService: League-wide statistics aggregation and caching
 * - ParallelDataService: Parallel data fetching and processing optimization
 * - SupabaseDataService: Supabase database integration with query optimization
 * - dataCache: Advanced caching strategies with TTL and invalidation
 * 
 * All services include:
 * - OpenTelemetry instrumentation for distributed tracing
 * - Structured logging with correlation IDs
 * - Performance monitoring and optimization
 * - Comprehensive error handling and recovery
 * - TypeScript strict typing for reliability
 */