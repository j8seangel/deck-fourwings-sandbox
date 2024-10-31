import { Color } from '@deck.gl/core';
import { stringify } from 'qs';
import { ckmeans } from 'simple-statistics';
import { Feature } from '@loaders.gl/schema';
import { DateTime, DurationUnits } from 'luxon';
import { TileCell } from '../loaders/lib/types';
import {
  FourwingsAggregationOperation,
  AggregateCellParams,
  CompareCellParams,
  FourwingsChunk,
  FourwingsDeckSublayer,
} from './fourwings-heatmap.types';
import {
  BASE_API_TILES_URL,
  getChunkByInterval,
} from './fourwings.config';
import {
  CONFIG_BY_INTERVAL,
  getFourwingsInterval,
} from '../loaders/helpers/time';
import { COLOR_RAMP_DEFAULT_NUM_STEPS } from './fourwings.colors';

export function getSteps(
  values: number[],
  numSteps = COLOR_RAMP_DEFAULT_NUM_STEPS
) {
  if (!values?.length) return [];
  const steps = Math.min(values.length, numSteps);
  const buckets = ckmeans(values, steps).map((step) => step[0]);
  const filteredBuckets = buckets.filter(
    (bucket, index) => bucket !== buckets[index - 1]
  );
  if (filteredBuckets.length < numSteps) {
    // add one at the end to avoid using white when only one value is present
    filteredBuckets.push(filteredBuckets[filteredBuckets.length - 1] + 0.5);
    for (let i = filteredBuckets.length; i < numSteps; i++) {
      // add values at the beginning so more opaque colors are used for lower values
      filteredBuckets.unshift(filteredBuckets[0] - 0.1);
    }
  }
  return filteredBuckets;
}

// TODO debug why import doesn't work
// import { TileIndex } from '@deck.gl/geo-layers/dist/tileset-2d/types';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TileIndex = any;

export function aggregateSublayerValues(
  values: number[],
  aggregationOperation = FourwingsAggregationOperation.Sum
) {
  if (aggregationOperation === FourwingsAggregationOperation.Avg) {
    let nonEmptyValuesLength = 0;
    return (
      values.reduce((acc: number, value = 0) => {
        if (value) nonEmptyValuesLength++;
        return acc + value;
      }, 0) / (nonEmptyValuesLength || 1)
    );
  }
  return values.reduce((acc: number, value = 0) => {
    return acc + value;
  }, 0);
}

export const aggregateCell = ({
  cellValues,
  startFrame,
  endFrame,
  cellStartOffsets,
  aggregationOperation = FourwingsAggregationOperation.Sum,
}: AggregateCellParams): number[] => {
  return cellValues.map((sublayerValues, sublayerIndex) => {
    if (!sublayerValues || !cellStartOffsets) {
      return 0;
    }
    const startOffset = cellStartOffsets[sublayerIndex];
    if (
      // all values are before time range
      endFrame - startOffset < 0 ||
      // all values are after time range
      startFrame - startOffset >= sublayerValues.length
    ) {
      return 0;
    }
    return aggregateSublayerValues(
      sliceCellValues({
        values: sublayerValues,
        startFrame,
        endFrame,
        startOffset,
      }),
      aggregationOperation
    );
  });
};

export const sliceCellValues = ({
  values,
  startFrame,
  endFrame,
  startOffset,
}: {
  values: number[];
  startFrame: number;
  endFrame: number;
  startOffset: number;
}): number[] => {
  return values?.slice(
    Math.max(startFrame - startOffset, 0),
    endFrame - startOffset < values.length ? endFrame - startOffset : undefined
  );
};

export const compareCell = ({
  cellValues,
  aggregationOperation = FourwingsAggregationOperation.Sum,
}: CompareCellParams): number[] => {
  const [initialValue, comparedValue] = cellValues.map((sublayerValues) => {
    if (!sublayerValues || !sublayerValues?.length) {
      return 0;
    }
    const value = aggregateSublayerValues(sublayerValues, aggregationOperation);
    return value ?? 0;
  });
  if (!initialValue && !comparedValue) {
    return [];
  }
  if (!comparedValue) {
    return [-initialValue];
  }
  if (!initialValue) {
    return [comparedValue];
  }
  return [comparedValue - initialValue];
};

function stringHash(s: string): number {
  return Math.abs(
    s.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
  );
}
// Copied from deck.gl as the import doesn't work
export function getURLFromTemplate(
  template: string | string[],
  tile: {
    index: TileIndex;
    id: string;
  }
): string {
  if (!template || !template.length) {
    return '';
  }
  const { index, id } = tile;

  if (Array.isArray(template)) {
    const i = stringHash(id) % template.length;
    template = template[i];
  }

  let url = decodeURI(template);
  for (const key of Object.keys(index)) {
    const regex = new RegExp(`{${key}}`, 'g');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    url = url.replace(regex, String((index as any)[key]));
  }

  // Back-compatible support for {-y}
  if (Number.isInteger(index.y) && Number.isInteger(index.z)) {
    url = url.replace(/\{-y\}/g, String(Math.pow(2, index.z) - index.y - 1));
  }
  return url;
}

type GetDataUrlByChunk = {
  tile: {
    index: TileIndex;
    id: string;
  };
  chunk: FourwingsChunk;
  sublayer: FourwingsDeckSublayer;
  filter?: string;
  vesselGroups?: string[];
  tilesUrl?: string;
  extentStart?: number;
};

export const getDataUrlBySublayer = ({
  tile,
  chunk,
  sublayer,
  tilesUrl = BASE_API_TILES_URL,
  extentStart,
}: // extentEnd,
GetDataUrlByChunk) => {
  const vesselGroup = Array.isArray(sublayer.vesselGroups)
    ? sublayer.vesselGroups[0]
    : sublayer.vesselGroups;
  const start =
    extentStart && extentStart > chunk.start
      ? extentStart
      : chunk.bufferedStart;
  const tomorrow = DateTime.now()
    .toUTC()
    .endOf('day')
    .plus({ millisecond: 1 })
    .toMillis();
  // const end = extentEnd && extentEnd < chunk.end ? extentEnd : chunk.bufferedEnd

  const end = tomorrow && tomorrow < chunk.end ? tomorrow : chunk.bufferedEnd;
  const params = {
    format: '4WINGS',
    interval: chunk.interval,
    'temporal-aggregation': false,
    datasets: [sublayer.datasets.join(',')],
    ...(sublayer.filter && { filters: [sublayer.filter] }),
    ...(vesselGroup && { 'vessel-groups': [vesselGroup] }),
    ...(chunk.interval !== 'YEAR' && {
      'date-range': [
        getISODateFromTS(start < end ? start : end),
        getISODateFromTS(end),
      ].join(','),
    }),
  };
  const url = `${tilesUrl}?${stringify(params, {
    arrayFormat: 'indices',
  })}`;

  return getURLFromTemplate(url, tile);
};

export interface Bounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

export const getUTCDateTime = (d: string | number) =>
  typeof d === 'string'
    ? DateTime.fromISO(d, { zone: 'utc' })
    : DateTime.fromMillis(d, { zone: 'utc' });

export const getTimeRangeDuration = (
  timeRange: { start: string; end: string },
  unit: DurationUnits = 'years'
) => {
  if (timeRange && timeRange.start && timeRange.start) {
    const startDateTime = getUTCDateTime(timeRange.start);
    const endDateTime = getUTCDateTime(timeRange.end);
    return endDateTime.diff(startDateTime, unit);
  }
  throw new Error('Invalid time range');
};

export function getISODateFromTS(ts: number) {
  return getUTCDateTime(ts).toISODate();
}

export const filterCellsByBounds = (cells: TileCell[], bounds: Bounds) => {
  if (!bounds || cells?.length === 0) {
    return [];
  }
  const { north, east, south, west } = bounds;
  const rightWorldCopy = east >= 180;
  const leftWorldCopy = west <= -180;
  return cells.filter((c) => {
    if (!c) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [lon, lat] = (c.coordinates as any)[0][0];
    if (lat < south || lat > north) {
      return false;
    }
    // This tries to translate features longitude for a proper comparison against the viewport
    // when they fall in a left or right copy of the world but not in the center one
    // but... https://c.tenor.com/YwSmqv2CZr8AAAAd/dog-mechanic.gif
    const featureInLeftCopy = lon > 0 && lon - 360 >= west;
    const featureInRightCopy = lon < 0 && lon + 360 <= east;
    const leftOffset =
      leftWorldCopy && !rightWorldCopy && featureInLeftCopy ? -360 : 0;
    const rightOffset =
      rightWorldCopy && !leftWorldCopy && featureInRightCopy ? 360 : 0;
    return (
      lon + leftOffset + rightOffset > west &&
      lon + leftOffset + rightOffset < east
    );
  });
};

const getMillisFromHtime = (htime: number) => {
  return htime * 1000 * 60 * 60;
};

export const aggregatePositionsTimeseries = (positions: Feature[]) => {
  if (!positions) {
    return [];
  }
  const timeseries = positions.reduce((acc, position) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { htime, value } = position.properties as any;
    const activityStart = getMillisFromHtime(htime);
    if (acc[activityStart]) {
      acc[activityStart] += value;
    } else {
      acc[activityStart] = value;
    }
    return acc;
  }, {} as Record<number, number>);
  return timeseries;
};

export const EMPTY_CELL_COLOR: Color = [0, 0, 0, 0];

export function getFourwingsChunk(minDate: number, maxDate: number) {
  const interval = getFourwingsInterval(minDate, maxDate);
  return getChunkByInterval(minDate, maxDate, interval);
}

export function getIntervalFrames({
  startTime,
  endTime,
  bufferedStart,
}: {
  startTime: number;
  endTime: number;
  bufferedStart: number;
}) {
  const interval = getFourwingsInterval(startTime, endTime);
  const tileStartFrame = Math.ceil(
    CONFIG_BY_INTERVAL[interval].getIntervalFrame(bufferedStart)
  );
  const startFrame = Math.ceil(
    CONFIG_BY_INTERVAL[interval].getIntervalFrame(startTime) - tileStartFrame
  );
  const endFrame = Math.ceil(
    CONFIG_BY_INTERVAL[interval].getIntervalFrame(endTime) - tileStartFrame
  );
  return { interval, tileStartFrame, startFrame, endFrame };
}
