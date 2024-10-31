import DeckGL from '@deck.gl/react';
import { MapViewState } from '@deck.gl/core';
import { FourwingsHeatmapTileLayerProps } from './layers/fourwings-heatmap.types';
import { FourwingsHeatmapTileLayer } from './layers/FourwingsHeatmapTileLayer';
import { BaseMapLayer } from './layers/BasemapLayer';

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -30,
  latitude: 30,
  zoom: 3,
};

const fourwingsLayerProps: FourwingsHeatmapTileLayerProps = {
  id: 'ais',
  startTime: 1722124800000,
  endTime: 1730073600000,
  sublayers: [
    {
      id: 'ais',
      visible: true,
      datasets: ['public-global-presence:v3.0'],
      color: '#FF64CE',
      colorRamp: 'magenta',
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
  const layers = [
    new BaseMapLayer(),
    new FourwingsHeatmapTileLayer(fourwingsLayerProps),
  ];

  return (
    <DeckGL initialViewState={INITIAL_VIEW_STATE} controller layers={layers} />
  );
}

export default App;
