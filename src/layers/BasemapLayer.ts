/* eslint-disable @typescript-eslint/no-explicit-any */
import { BitmapLayer } from '@deck.gl/layers';
import { CompositeLayer, LayerContext } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { MVTLayer } from '@deck.gl/geo-layers';

export class BaseMapLayer extends CompositeLayer {
  static layerName = 'BasemapLayer';
  initializeState(context: LayerContext): void {
    super.initializeState(context);
  }

  _getBathimetryLayer() {
    return new TileLayer({
      id: 'basemap-bathimetry',
      data: 'https://storage.googleapis.com/public-tiles/basemap/bathymetry/{z}/{x}/{y}.png',
      minZoom: 0,
      maxZoom: 9,
      maxRequests: 100,
      debounceTime: 200,
      renderSubLayers: (props: any) => {
        const {
          bbox: { west, south, east, north },
        } = props.tile as any;
        return new BitmapLayer(props, {
          data: undefined,
          image: props.data,
          bounds: [west, south, east, north],
        });
      },
    });
  }

  _getLandMassLayer() {
    return new MVTLayer({
      id: 'basemap-landmass',
      minZoom: 0,
      maxZoom: 8,
      maxRequests: 100,
      debounceTime: 200,
      getFillColor: [39, 70, 119],
      getLineWidth: 0,
      data: 'https://storage.googleapis.com/public-tiles/basemap/default/{z}/{x}/{y}.pbf',
    });
  }

  renderLayers() {
    return [this._getBathimetryLayer(), this._getLandMassLayer()];
  }
}
