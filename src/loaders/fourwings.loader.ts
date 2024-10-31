import type { LoaderWithParser } from '@loaders.gl/loader-utils';
import { parseFourwings } from './lib/parse-fourwings';
import { FourwingsLoaderOptions, ParseFourwingsOptions } from './lib/types';

/**
 * Worker loader for the 4wings tile format
 */
export const FourwingsLoader: LoaderWithParser = {
  name: 'fourwings tiles',
  id: 'fourwings',
  module: 'fourwings',
  version: '1',
  extensions: ['pbf'],
  mimeTypes: [
    'application/x-protobuf',
    'application/octet-stream',
    'application/protobuf',
  ],
  parse: async (data, options?: FourwingsLoaderOptions) =>
    parseFourwings(data, options),
  parseSync: parseFourwings,
  binary: true,
  worker: false,
  category: 'geometry',
  options: {
    fourwings: {
      sublayers: 1,
      cols: 113,
      rows: 53,
      scale: 1,
      offset: 0,
      noDataValue: 0,
      bufferedStartDate: 0,
      initialTimeRange: undefined,
      tile: undefined,
      interval: 'DAY',
      aggregationOperation: 'sum',
      buffersLength: [],
    } as ParseFourwingsOptions,
  } as FourwingsLoaderOptions,
};
