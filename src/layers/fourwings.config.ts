/* eslint-disable @typescript-eslint/no-explicit-any */
import { DateTime, DateTimeUnit, Duration } from 'luxon';
import { FourwingsInterval } from '../loaders/lib/types';
import { FourwingsChunk } from './fourwings-heatmap.types';
import { getUTCDateTime } from './fourwings-heatmap.utils';
import { LIMITS_BY_INTERVAL } from '../loaders/helpers/time';

export const BASE_API_TILES_URL =
  `https://gateway.api.dev.globalfishingwatch.org/v3/4wings/tile/heatmap/{z}/{x}/{y}` as const;
export const HEATMAP_ID = 'heatmap';
export const FOURWINGS_MAX_ZOOM = 12;
export const MAX_RAMP_VALUES = 10000;

export const CHUNKS_BY_INTERVAL: Record<
  FourwingsInterval,
  { unit: DateTimeUnit; value: number } | undefined
> = {
  HOUR: {
    unit: 'day',
    value: 20,
  },
  DAY: {
    unit: 'year',
    value: 1,
  },
  MONTH: undefined,
  YEAR: undefined,
};

export const getDateInIntervalResolution = (
  date: number,
  interval: FourwingsInterval
): number => {
  return DateTime.fromMillis(date)
    .toUTC()
    .startOf(interval as any)
    .toMillis();
};

export const CHUNKS_BUFFER = 1;
// TODO: validate if worth to make this dynamic for the playback
export const getChunkByInterval = (
  start: number,
  end: number,
  interval: FourwingsInterval
): FourwingsChunk => {
  const intervalUnit = LIMITS_BY_INTERVAL[interval]?.unit;
  if (!intervalUnit) {
    return {
      id: 'full-time-range',
      interval,
      start,
      end,
      bufferedStart: start,
      bufferedEnd: end,
    };
  }
  const startDate = getUTCDateTime(start)
    .startOf(intervalUnit as any)
    .minus({ [intervalUnit]: CHUNKS_BUFFER });
  const bufferedStartDate = startDate.minus({ [intervalUnit]: CHUNKS_BUFFER });
  const now = DateTime.now().toUTC().startOf('day');
  const endDate = getUTCDateTime(end)
    .endOf(intervalUnit as any)
    .plus({ [intervalUnit]: CHUNKS_BUFFER, millisecond: 1 });
  const bufferedEndDate = endDate.plus({ [intervalUnit]: CHUNKS_BUFFER });
  return {
    id: `${intervalUnit}-chunk`,
    interval,
    start: startDate.toMillis(),
    end: Math.min(endDate.toMillis(), now.toMillis()),
    bufferedStart: bufferedStartDate.toMillis(),
    bufferedEnd: Math.min(bufferedEndDate.toMillis(), now.toMillis()),
  };
};

export const getChunkBuffer = (interval: FourwingsInterval) => {
  const { buffer, unit } = LIMITS_BY_INTERVAL[interval] || {};
  if (!unit) {
    return 0;
  }
  return Duration.fromObject({ [unit]: buffer }).toMillis();
};
