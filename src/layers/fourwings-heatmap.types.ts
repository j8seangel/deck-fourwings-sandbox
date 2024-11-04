import type { ScaleLinear } from 'd3-scale';
import { _Tile2DHeader, TileLayerProps } from '@deck.gl/geo-layers';
import {
  Cell,
  FourwingsFeature,
  FourwingsInterval,
} from '../loaders/lib/types';
import { ColorRampId } from './fourwings.colors';

export type FourwingsChunk = {
  id: string;
  interval: FourwingsInterval;
  start: number;
  end: number;
  bufferedStart: number;
  bufferedEnd: number;
};

export enum FourwingsAggregationOperation {
  Sum = 'sum',
  Avg = 'avg',
}
export type FourwingsColorObject = {
  r: number;
  g: number;
  b: number;
  a: number;
};
export type ColorDomain = number[] | number[][];

type ColorRange = FourwingsColorObject[];
export type SublayerColorRanges = ColorRange[];

export type AggregateCellParams = {
  cellValues: Cell;
  startFrame: number;
  endFrame: number;
  aggregationOperation?: FourwingsAggregationOperation;
  cellStartOffsets: number[];
};

export type CompareCellParams = {
  cellValues: Cell;
  aggregationOperation?: FourwingsAggregationOperation;
};
export type FourwingsDeckSublayer = {
  id: string;
  datasets: string[];
  visible: boolean;
  color: string;
  colorRamp: ColorRampId;
  value?: number;
  unit?: string;
  filter?: string;
  positionProperties?: string[];
  vesselGroups?: string | string[];
  vesselGroupsLength?: number;
  extentStart?: number;
  extentEnd?: number;
};

type _FourwingsHeatmapTileLayerProps<DataT = FourwingsFeature> = {
  startTime: number;
  endTime: number;
  sublayers: FourwingsDeckSublayer[];
  tilesUrl?: string;
  extentStart?: number;
  extentEnd?: number;
  data?: DataT;
  aggregationOperation?: FourwingsAggregationOperation;
};

export type FourwingsHeatmapTileLayerProps = _FourwingsHeatmapTileLayerProps &
  Partial<TileLayerProps>;

export type FourwingsHeatmapTilesCache = {
  start: number;
  bufferedStart: number;
  end: number;
  interval: FourwingsInterval;
};

export type FourwinsTileLayerScale = ScaleLinear<
  FourwingsColorObject,
  FourwingsColorObject,
  never
>;
export type FourwingsTileLayerColorDomain = number[] | number[][];
export type FourwingsTileLayerColorRange =
  | FourwingsColorObject[][]
  | FourwingsColorObject[];
export type FourwingsTileLayerState = {
  error: string;
  tilesCache: FourwingsHeatmapTilesCache;
  colorDomain: FourwingsTileLayerColorDomain;
  colorRanges: FourwingsTileLayerColorRange;
  scales?: FourwinsTileLayerScale[];
  rampDirty?: boolean;
};

export type FourwingsHeatmapLayerProps = FourwingsHeatmapTileLayerProps & {
  id: string;
  tile: _Tile2DHeader;
  data: FourwingsFeature[];
  colorDomain?: ColorDomain;
  colorRanges?: SublayerColorRanges;
  tilesCache: FourwingsHeatmapTilesCache;
  scales: FourwinsTileLayerScale[];
};
