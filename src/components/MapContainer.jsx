import React, { useState, useEffect } from "react";
import GlobeMap from "./GlobeMap";

// Small labeled stat used in the ship info panel
function ShipStat({ label, value }) {
  return (
    <div>
      <p className="text-slate-500 uppercase tracking-wider text-[9px]">{label}</p>
      <p className="text-slate-200 font-medium">{value}</p>
    </div>
  );
}

export default function MapContainer({ ships, selectedChokePoint, chokePoints }) {
  // Currently selected ship (clicked on the globe)
  const [selectedShip, setSelectedShip] = useState(null);

  // Keep the selected ship's info fresh as positions stream in
  useEffect(() => {
    if (!selectedShip) return;
    const latest = ships.find((s) => s.mmsi === selectedShip.mmsi);
    if (latest) setSelectedShip(latest);
  }, [ships]);

  return (
    <div className="relative w-full h-full">
      <GlobeMap
        ships={ships}
        chokePoints={chokePoints}
        selectedChokePoint={selectedChokePoint}
        mode="operations"
        onShipClick={(ship) => setSelectedShip(ship)}
      />

      {/* Ship Info Panel (shown when a vessel is clicked) */}
      {selectedShip && (
        <div className="absolute top-6 right-6 z-20 w-72 bg-slate-900/95 border border-slate-700 backdrop-blur-md p-4 rounded-xl shadow-2xl text-xs space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-slate-100 text-sm leading-tight">{selectedShip.name}</h4>
              <p className="text-slate-400 text-[10px] mt-0.5">MMSI {selectedShip.mmsi} · {selectedShip.flag}</p>
            </div>
            <button
              onClick={() => setSelectedShip(null)}
              className="text-slate-400 hover:text-slate-100 leading-none text-base"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {selectedShip.is_anomaly && (
            <div className="bg-red-500/15 border border-red-500/40 text-red-300 rounded-lg px-2 py-1.5 font-medium">
              ⚠ AIS Anomaly: {selectedShip.anomaly_type}
            </div>
          )}

          <div className="grid grid-cols-2 gap-y-2 gap-x-3">
            <ShipStat label="Status" value={selectedShip.status} />
            <ShipStat label="Speed" value={`${selectedShip.speed} kn`} />
            <ShipStat label="Heading" value={`${selectedShip.heading}°`} />
            <ShipStat label="Cargo" value={selectedShip.cargo_type} />
            <ShipStat label="Destination" value={selectedShip.destination} />
            <ShipStat label="Corridor" value={selectedShip.corridor} />
            <ShipStat label="Capacity" value={`${selectedShip.capacity_kbd} kbd`} />
            <ShipStat label="Draft" value={`${selectedShip.draft} m`} />
            <ShipStat label="Position" value={`${selectedShip.lat.toFixed(2)}, ${selectedShip.lon.toFixed(2)}`} />
            <ShipStat label="Progress" value={`${Math.round((selectedShip.progress || 0) * 100)}%`} />
          </div>
        </div>
      )}

      {/* Legend / Status Overlay */}
      <div className="absolute bottom-6 left-6 z-10 bg-slate-900/90 border border-slate-800 backdrop-blur-md p-4 rounded-xl shadow-2xl text-xs space-y-3 pointer-events-none">
        <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[10px]">Geospatial Legend</h4>
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-cyan-400 border border-slate-950 inline-block"></span>
            <span className="text-slate-300">Vessel Underway</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-red-500 border border-slate-950 inline-block"></span>
            <span className="text-slate-300">Vessel Loitering / Stopped</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="w-4 h-2 border border-red-500 bg-red-500/20 inline-block"></span>
            <span className="text-slate-300">Choke Point Risk Zone</span>
          </div>
          <div className="text-[9px] text-slate-500 pt-1 border-t border-slate-800/60 mt-1">
            Drag to rotate · scroll to zoom
          </div>
        </div>
      </div>
    </div>
  );
}
