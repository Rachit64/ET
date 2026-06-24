import React, { useState, useEffect, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { _GlobeView as GlobeView, LinearInterpolator } from "@deck.gl/core";
import {
  ScatterplotLayer,
  SolidPolygonLayer,
  GeoJsonLayer,
  PathLayer,
  ArcLayer,
} from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";

// Frontend selection key -> backend corridor string
const CORRIDOR_MAPPINGS = {
  strait_of_hormuz: "Strait of Hormuz",
  bab_el_mandeb: "Bab-el-Mandeb",
  suez_canal: "Suez Canal",
  strait_of_malacca: "Strait of Malacca",
};

// Natural Earth country polygons (deck.gl public CDN); failure just leaves the bare sphere.
const COUNTRIES_URL =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_0_scale_rank.geojson";

// Whole-globe background polygon (dark ocean sphere)
const BACKGROUND = [
  [
    [-180, 90], [-90, 90], [0, 90], [90, 90], [180, 90],
    [180, -90], [90, -90], [0, -90], [-90, -90], [-180, -90],
  ],
];

// Build a lon/lat graticule so the globe reads even before countries load
function buildGraticule() {
  const lines = [];
  for (let lon = -180; lon <= 180; lon += 30) {
    const path = [];
    for (let lat = -90; lat <= 90; lat += 5) path.push([lon, lat]);
    lines.push({ path });
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const path = [];
    for (let lon = -180; lon <= 180; lon += 5) path.push([lon, lat]);
    lines.push({ path });
  }
  return lines;
}

// Spherical linear interpolation along a great circle for rendering on a globe
function interpolateGreatCircle(source, dest, segments = 40) {
  if (!source || !dest) return [];
  const [lon1, lat1] = source;
  const [lon2, lat2] = dest;
  if (lon1 === undefined || lat1 === undefined || lon2 === undefined || lat2 === undefined) return [];

  const rLat1 = (lat1 * Math.PI) / 180;
  const rLon1 = (lon1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const rLon2 = (lon2 * Math.PI) / 180;

  // Angular distance between points
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.pow(Math.sin((rLat1 - rLat2) / 2), 2) +
          Math.cos(rLat1) *
            Math.cos(rLat2) *
            Math.pow(Math.sin((rLon1 - rLon2) / 2), 2)
      )
    );

  if (d === 0) return [[lon1, lat1, 5000]];

  const path = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);

    const x = a * Math.cos(rLat1) * Math.cos(rLon1) + b * Math.cos(rLat2) * Math.cos(rLon2);
    const y = a * Math.cos(rLat1) * Math.sin(rLon1) + b * Math.cos(rLat2) * Math.sin(rLon2);
    const z = a * Math.sin(rLat1) + b * Math.sin(rLat2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * (180 / Math.PI);
    const lon = Math.atan2(y, x) * (180 / Math.PI);
    
    // Add small elevation offset (5000 meters) to raise the path slightly above land/ocean polygons
    path.push([lon, lat, 5000]);
  }
  return path;
}

const colorForScore = (score) => {
  if (score >= 75) return [34, 211, 238]; // cyan – strong option
  if (score >= 60) return [16, 185, 129]; // emerald
  if (score >= 45) return [245, 158, 11]; // amber
  return [239, 68, 68]; // red – weak option
};

export default function GlobeMap({
  ships = [],
  chokePoints = {},
  selectedChokePoint,
  focusCoords = null,
  solutionArcs = [],
  onShipClick,
  onArcClick,
  mode = "operations",
}) {
  const [countries, setCountries] = useState(null);
  const graticule = useMemo(buildGraticule, []);

  const [viewState, setViewState] = useState({
    longitude: 55.8,
    latitude: 22.0,
    zoom: 1.7,
    minZoom: 0,
    maxZoom: 6,
  });

  // Fetch country polygons once
  useEffect(() => {
    let cancelled = false;
    fetch(COUNTRIES_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((geo) => { if (!cancelled && geo) setCountries(geo); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Spin the globe toward the selected corridor
  useEffect(() => {
    if (selectedChokePoint && chokePoints[selectedChokePoint]) {
      const [lat, lon] = chokePoints[selectedChokePoint].center; // stored [lat, lon]
      setViewState((prev) => ({
        ...prev,
        longitude: lon,
        latitude: lat,
        zoom: mode === "scenario" ? 2.0 : 2.6,
        transitionDuration: 1800,
        transitionInterpolator: new LinearInterpolator(["longitude", "latitude", "zoom"]),
      }));
    }
  }, [selectedChokePoint, chokePoints, mode]);

  // Spin the globe toward an explicit [lon, lat] focus (dynamic scenarios have no
  // fixed corridor, so they pass the centroid of the generated source ports).
  useEffect(() => {
    if (focusCoords && Number.isFinite(focusCoords[0]) && Number.isFinite(focusCoords[1])) {
      setViewState((prev) => ({
        ...prev,
        longitude: focusCoords[0],
        latitude: focusCoords[1],
        zoom: 1.7,
        transitionDuration: 1800,
        transitionInterpolator: new LinearInterpolator(["longitude", "latitude", "zoom"]),
      }));
    }
  }, [focusCoords]);

  const activeCorridorName = CORRIDOR_MAPPINGS[selectedChokePoint];

  const layers = [
    // Ocean sphere
    new SolidPolygonLayer({
      id: "globe-background",
      data: BACKGROUND,
      getPolygon: (d) => d,
      stroked: false,
      filled: true,
      getFillColor: [7, 13, 26],
    }),
    // Graticule
    new PathLayer({
      id: "graticule",
      data: graticule,
      getPath: (d) => d.path,
      getColor: [40, 60, 90, 120],
      getWidth: 1,
      widthUnits: "pixels",
    }),
    // Countries
    countries &&
      new GeoJsonLayer({
        id: "countries",
        data: countries,
        stroked: true,
        filled: true,
        getFillColor: [24, 33, 53],
        getLineColor: [56, 89, 120, 160],
        getLineWidth: 1,
        lineWidthUnits: "pixels",
      }),
    // Choke-point risk zones
    ...Object.entries(chokePoints).map(([key, data]) => {
      const bbox = data.bbox; // [[lat_min, lon_min], [lat_max, lon_max]]
      const latMin = bbox[0][0], lonMin = bbox[0][1];
      const latMax = bbox[1][0], lonMax = bbox[1][1];
      const polygon = [
        [lonMin, latMin], [lonMax, latMin],
        [lonMax, latMax], [lonMin, latMax], [lonMin, latMin],
      ];
      const isSelected = key === selectedChokePoint;
      return new SolidPolygonLayer({
        id: `zone-${key}`,
        data: [{ polygon }],
        getPolygon: (d) => d.polygon,
        getFillColor: isSelected ? [239, 68, 68, 70] : [239, 68, 68, 25],
        stroked: true,
        filled: true,
        getLineColor: isSelected ? [239, 68, 68, 220] : [239, 68, 68, 90],
        getLineWidth: 2,
        lineWidthUnits: "pixels",
        pickable: false,
        updateTriggers: { getFillColor: [selectedChokePoint], getLineColor: [selectedChokePoint] },
      });
    }),
    // Ships
    new ScatterplotLayer({
      id: "ships-layer",
      data: ships,
      getPosition: (d) => [d.lon, d.lat],
      getRadius: (d) => (d.corridor === activeCorridorName ? 38000 : 26000),
      radiusMinPixels: 2.5,
      radiusMaxPixels: 9,
      getFillColor: (d) => {
        const sel = d.corridor === activeCorridorName;
        if (d.speed < 3.0) return sel ? [239, 68, 68, 255] : [249, 115, 22, 210];
        return sel ? [34, 211, 238, 255] : [14, 116, 144, 190];
      },
      getLineColor: [8, 12, 24, 255],
      lineWidthMinPixels: 0.5,
      stroked: true,
      pickable: true,
      updateTriggers: { getFillColor: [selectedChokePoint], getRadius: [selectedChokePoint] },
    }),
    // Solution: source ports
    solutionArcs.length > 0 &&
      new ScatterplotLayer({
        id: "source-ports",
        data: solutionArcs,
        getPosition: (d) => d.source_coords,
        getRadius: 60000,
        radiusMinPixels: 4,
        radiusMaxPixels: 12,
        getFillColor: (d) => [...colorForScore(d.score), 255],
        getLineColor: [255, 255, 255, 220],
        lineWidthMinPixels: 1,
        stroked: true,
        pickable: true,
        onClick: (info) => info.object && onArcClick && onArcClick(info.object),
      }),
    // Solution: procurement arcs (great-circle flows toward refineries)
    solutionArcs.length > 0 &&
      (mode === "scenario" ? (
        new PathLayer({
          id: "solution-paths",
          data: solutionArcs,
          getPath: (d) => interpolateGreatCircle(d.source_coords, d.dest_coords, 40),
          getColor: (d) => [...colorForScore(d.score), 230],
          getWidth: (d) => Math.max(3, (d.score / 100) * 8),
          widthUnits: "pixels",
          pickable: true,
          onClick: (info) => info.object && onArcClick && onArcClick(info.object),
          getDashArray: [3, 3], // Dotted style
          dashJustified: true,
          extensions: [new PathStyleExtension({dash: true})],
          updateTriggers: { getWidth: [solutionArcs] },
        })
      ) : (
        new ArcLayer({
          id: "solution-arcs",
          data: solutionArcs,
          getSourcePosition: (d) => d.source_coords,
          getTargetPosition: (d) => d.dest_coords,
          getSourceColor: (d) => [...colorForScore(d.score), 230],
          getTargetColor: (d) => [...colorForScore(d.score), 230],
          getWidth: (d) => Math.max(2, (d.score / 100) * 7),
          getHeight: 0.5,
          widthUnits: "pixels",
          greatCircle: true,
          pickable: true,
          onClick: (info) => info.object && onArcClick && onArcClick(info.object),
          updateTriggers: { getWidth: [solutionArcs] },
        })
      )),
    // Solution: refinery endpoints
    solutionArcs.length > 0 &&
      new ScatterplotLayer({
        id: "refinery-endpoints",
        data: solutionArcs,
        getPosition: (d) => d.dest_coords,
        getRadius: 50000,
        radiusMinPixels: 3,
        radiusMaxPixels: 10,
        getFillColor: [226, 232, 240, 255],
        getLineColor: [34, 211, 238, 255],
        lineWidthMinPixels: 1.5,
        stroked: true,
      }),
  ].filter(Boolean);

  return (
    <DeckGL
      views={new GlobeView({ resolution: 12 })}
      viewState={viewState}
      onViewStateChange={(e) => setViewState(e.viewState)}
      controller={{ dragRotate: true, doubleClickZoom: false }}
      layers={layers}
      getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
      onClick={(info) => {
        if (info.layer && info.layer.id === "ships-layer" && info.object) {
          onShipClick && onShipClick(info.object);
        } else if (
          info.layer &&
          (info.layer.id === "solution-arcs" || info.layer.id === "solution-paths" || info.layer.id === "source-ports") &&
          info.object
        ) {
          onArcClick && onArcClick(info.object);
        } else if (onShipClick) {
          onShipClick(null);
        }
      }}
    />
  );
}
