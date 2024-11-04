import { Color } from '@deck.gl/core';
import { stringify } from 'qs';
import { ckmeans, mean, standardDeviation } from 'simple-statistics';
import { DateTime } from 'luxon';
import {
  FourwingsAggregationOperation,
  AggregateCellParams,
  FourwingsChunk,
  FourwingsDeckSublayer,
} from './fourwings-heatmap.types';
import { BASE_API_TILES_URL, getChunkByInterval } from './fourwings.config';
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

function aggregateSublayerValues(
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

const sliceCellValues = ({
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

function stringHash(s: string): number {
  return Math.abs(
    s.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
  );
}
// Copied from deck.gl as the import doesn't work
function getURLFromTemplate(
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

function getISODateFromTS(ts: number) {
  return getUTCDateTime(ts).toISODate();
}

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

export function removeOutliers({
  allValues,
  aggregationOperation,
}: {
  allValues: number[];
  /* FourwingsAggregationOperation */
  aggregationOperation?: 'avg' | 'sum';
}) {
  const allValuesCleaned = allValues.filter(Boolean);
  if (!allValuesCleaned.length) return [];
  const meanValue = mean(allValuesCleaned);
  const deviationScale = aggregationOperation === 'avg' ? 2 : 1;
  const standardDeviationValue = standardDeviation(allValuesCleaned);
  const upperCut = meanValue + standardDeviationValue * deviationScale;
  const lowerCut = meanValue - standardDeviationValue * deviationScale;
  return allValuesCleaned.filter((a) => a >= lowerCut && a <= upperCut);
}
