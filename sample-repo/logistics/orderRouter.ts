// hello.forge sample repository — OrderRouter
// Clean, type-correct module for AST symbol exploration.

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Route {
  id: string;
  waypoints: GeoPoint[];
  estimatedMinutes: number;
  distanceMeters: number;
}

export class OrderRouter {
  private routes: Map<string, Route> = new Map();

  planRoute(orderId: string, origin: GeoPoint, dest: GeoPoint): Route {
    const distanceMeters = this.distance(origin, dest);
    const route: Route = {
      id: orderId,
      waypoints: [origin, dest],
      distanceMeters,
      estimatedMinutes: Math.max(1, Math.round(distanceMeters / 600)),
    };
    this.routes.set(orderId, route);
    return route;
  }

  getRoute(orderId: string): Route | undefined {
    return this.routes.get(orderId);
  }

  reroute(orderId: string, newDest: GeoPoint): Route | undefined {
    const existing = this.routes.get(orderId);
    if (!existing) return undefined;
    const origin = existing.waypoints[0];
    return this.planRoute(orderId, origin, newDest);
  }

  private distance(a: GeoPoint, b: GeoPoint): number {
    const dLat = a.lat - b.lat;
    const dLng = a.lng - b.lng;
    return Math.sqrt(dLat * dLat + dLng * dLng) * 111000;
  }
}
