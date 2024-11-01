import type { LoaderOptions } from '@loaders.gl/loader-utils';
import { _TileLoadProps } from '@deck.gl/geo-layers';
import { Feature, Point, Polygon } from 'geojson';

export type FourwingsRawData = number[];

export type FourwingsTileData = {
  cols: number;
  rows: number;
  cells: Cell[];
};

export type Cell = number[][];

export type TileCell = Cell & {
  coordinates: [number[]];
};

export type FourwingsInterval = 'YEAR' | 'MONTH' | 'DAY' | 'HOUR';
type FourwingsAggregationOperation = 'sum' | 'avg';

export type ParseFourwingsOptions = {
  cols: number;
  rows: number;
  tile?: _TileLoadProps;
  bufferedStartDate: number;
  initialTimeRange?: {
    start: number;
    end: number;
  };
  interval: FourwingsInterval;
  aggregationOperation: FourwingsAggregationOperation;
  scale?: number;
  offset?: number;
  noDataValue?: number;
  sublayers: number;
  buffersLength: number[];
  workerUrl?: string;
};

export type ParseFourwingsClustersOptions = Omit<
  ParseFourwingsOptions,
  | 'interval'
  | 'aggregationOperation'
  | 'sublayers'
  | 'initialTimeRange'
  | 'bufferedStartDate'
>;

export type FourwingsLoaderOptions = LoaderOptions & {
  fourwings?: ParseFourwingsOptions;
};

export type FourwingsClustersLoaderOptions = LoaderOptions & {
  fourwingsClusters?: ParseFourwingsClustersOptions;
};

export type FourwingsFeatureProperties = {
  id?: string;
  initialValues: Record<string, number[]>;
  startOffsets: number[];
  dates: number[][];
  values: number[][];
  cellId: number;
  cellNum: number;
  col: number;
  row: number;
};

export type FourwingsPositionFeatureProperties = {
  id: string;
  value: number;
};

export type FourwingsPointFeatureProperties = {
  id: number;
  value: number;
};

export type FourwingsStaticFeatureProperties = {
  count: number;
  values: number[][];
};

export type FourwingsFeature<Properties = FourwingsFeatureProperties> = Feature<
  Polygon,
  Properties
> & {
  aggregatedValues?: number[];
};

export type FourwingsValuesAndDatesFeature = [number[], number[]][]; // values in first place, dates in second
export type FourwingsStaticFeature =
  FourwingsFeature<FourwingsStaticFeatureProperties>;
export type FourwingsPositionFeature = Feature<
  Point,
  FourwingsPositionFeatureProperties
>;
export type FourwingsPointFeature = Feature<
  Point,
  FourwingsPointFeatureProperties
>;
