import { CompositeLayer, LayersList, PickingInfo, Color } from '@deck.gl/core';
import { SolidPolygonLayer } from '@deck.gl/layers';
import { getTimeRangeKey } from '../loaders/helpers/time';
import { FourwingsFeature } from '../loaders/lib/types';
import {
  FourwingsHeatmapLayerProps,
  FourwingsColorObject,
} from './fourwings-heatmap.types';
import {
  getIntervalFrames,
  EMPTY_CELL_COLOR,
  aggregateCell,
} from './fourwings-heatmap.utils';
import { HEATMAP_ID } from './fourwings.config';

export class FourwingsHeatmapLayer extends CompositeLayer<FourwingsHeatmapLayerProps> {
  static layerName = 'FourwingsHeatmapLayer';
  timeRangeKey!: string;
  startFrame!: number;
  endFrame!: number;

  getPickingInfo = ({ info }: { info: PickingInfo<FourwingsFeature> }) => {
    const { id, tile, startTime, endTime, sublayers, tilesCache } = this.props;

    const { interval } = getIntervalFrames({
      startTime,
      endTime,
      bufferedStart: tilesCache.bufferedStart,
    });
    const object = {
      ...(info.object || ({} as FourwingsFeature)),
      layerId: this.root.id,
      id: id,
      title: id,
      tile: tile.index,
      sublayers,
      startTime,
      endTime,
      interval,
      visualizationMode: HEATMAP_ID,
    };
    if (info.object) {
      object.sublayers = object.sublayers?.map((sublayer, i) => ({
        ...sublayer,
        value: info.object?.aggregatedValues?.[i],
      }));
      if (!object.sublayers?.filter(({ value }) => value).length) {
        return { ...info, object: undefined };
      }
    }
    return { ...info, object };
  };

  getCompareFillColor = (
    feature: FourwingsFeature,
    { target }: { target: Color }
  ) => {
    const { colorDomain, colorRanges, aggregationOperation, scales } =
      this.props;
    if (!colorDomain?.length || !colorRanges?.length) {
      target = EMPTY_CELL_COLOR;
      return target;
    }
    const aggregatedCellValues =
      feature.properties.initialValues[this.timeRangeKey] ||
      aggregateCell({
        cellValues: feature.properties.values,
        startFrame: this.startFrame,
        endFrame: this.endFrame,
        aggregationOperation,
        cellStartOffsets: feature.properties.startOffsets,
      });
    let chosenValueIndex = 0;
    let chosenValue: number | undefined;
    feature.aggregatedValues = aggregatedCellValues;
    aggregatedCellValues.forEach((value, index) => {
      if (value && (!chosenValue || value > chosenValue)) {
        chosenValue = value;
        chosenValueIndex = index;
      }
    });
    if (!chosenValue) {
      target = EMPTY_CELL_COLOR;
      return target;
    }
    let color: FourwingsColorObject | undefined;
    if (scales[chosenValueIndex]) {
      const colorChosen = scales[chosenValueIndex](chosenValue);
      if (colorChosen) {
        color = colorChosen;
      }
    } else {
      const colorIndex = (colorDomain as number[]).findIndex((d, i) =>
        (chosenValue as number) <= d || i === colorRanges[0].length - 1 ? i : 0
      );
      color = colorRanges[chosenValueIndex]?.[colorIndex];
    }
    if (color) {
      target = [color.r, color.g, color.b, color.a * 255];
    } else {
      target = EMPTY_CELL_COLOR;
    }
    return target;
  };

  renderLayers() {
    const { data, endTime, startTime, colorDomain, colorRanges, tilesCache } =
      this.props;

    if (!data || !colorDomain || !colorRanges || !tilesCache) {
      return [];
    }

    const { startFrame, endFrame } = getIntervalFrames({
      startTime,
      endTime,
      bufferedStart: tilesCache.bufferedStart,
    });

    this.timeRangeKey = getTimeRangeKey(startFrame, endFrame);
    this.startFrame = startFrame;
    this.endFrame = endFrame;

    return [
      new SolidPolygonLayer(
        this.props,
        this.getSubLayerProps({
          id: `fourwings-tile`,
          pickable: true,
          getPickingInfo: this.getPickingInfo,
          getFillColor: this.getCompareFillColor,
          getPolygon: (d: FourwingsFeature) => d.geometry.coordinates[0],
          updateTriggers: {
            // This tells deck.gl to recalculate fillColor on changes
            getFillColor: [startTime, endTime, colorDomain, colorRanges],
          },
        })
      ),
    ] as LayersList;
  }

  getData() {
    return this.props.data;
  }
}
