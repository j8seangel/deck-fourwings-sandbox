import DeckGL from '@deck.gl/react';
import { MapViewState } from '@deck.gl/core';
import { FourwingsHeatmapTileLayerProps } from './layers/fourwings-heatmap.types';
import { FourwingsHeatmapTileLayer } from './layers/FourwingsHeatmapTileLayer';

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -122.41669,
  latitude: 37.7853,
  zoom: 13,
};

const fourwingsLayerProps: FourwingsHeatmapTileLayerProps = {
  id: 'ais',
  startTime: 1722124800000,
  endTime: 1730073600000,
  sublayers: [
    {
      id: 'ais',
      visible: true,
      datasets: ['public-global-fishing-effort:v3.0'],
      color: '#00FFBC',
      colorRamp: 'teal',
      unit: 'hours',
      extentStart: 1325376000000,
      extentEnd: 1730073600000,
    },
  ],
  visible: true,
  extentStart: 1325376000000,
  extentEnd: 1730073600000,
  maxZoom: 12,
};

function App() {
  const layers = [new FourwingsHeatmapTileLayer(fourwingsLayerProps)];

  return (
    <DeckGL initialViewState={INITIAL_VIEW_STATE} controller layers={layers} />
  );
}

export default App;
