import {
  CompositeLayer,
  Layer,
  LayerContext,
  LayersList,
  DefaultProps,
  UpdateParameters,
} from '@deck.gl/core';
import { TileLayer, TileLayerProps } from '@deck.gl/geo-layers';
import { parse } from '@loaders.gl/core';
import { debounce } from 'es-toolkit';
import isEqual from 'lodash/isEqual';
import { _Tile2DHeader, _TileLoadProps } from '@deck.gl/geo-layers';
import { scaleLinear } from 'd3-scale';
import { BASE_API_TILES_URL, FOURWINGS_MAX_ZOOM } from './fourwings.config';
import {
  getFourwingsChunk,
  getDataUrlBySublayer,
  aggregateCell,
  getIntervalFrames,
  getSteps,
  removeOutliers,
} from './fourwings-heatmap.utils';
import {
  FourwingsAggregationOperation,
  FourwingsColorObject,
  FourwingsDeckSublayer,
  FourwingsHeatmapTileLayerProps,
  FourwingsHeatmapTilesCache,
  FourwingsTileLayerColorDomain,
  FourwingsTileLayerColorRange,
  FourwingsTileLayerState,
  FourwinsTileLayerScale,
} from './fourwings-heatmap.types';
import { getFourwingsInterval, getTimeRangeKey } from '../loaders/helpers/time';
import { FourwingsLoader } from '../loaders/fourwings.loader';
import { FourwingsFeature, ParseFourwingsOptions } from '../loaders/lib/types';
import { FourwingsHeatmapLayer } from './FourwingsHeatmapLayer';
import { COLOR_RAMP_DEFAULT_NUM_STEPS, getColorRamp } from './fourwings.colors';

const defaultProps: DefaultProps<FourwingsHeatmapTileLayerProps> = {
  maxRequests: 100,
  debounceTime: 500,
  aggregationOperation: FourwingsAggregationOperation.Sum,
  tilesUrl: BASE_API_TILES_URL,
};

export class FourwingsHeatmapTileLayer extends CompositeLayer<FourwingsHeatmapTileLayerProps> {
  static layerName = 'FourwingsHeatmapTileLayer';
  static defaultProps = defaultProps;
  initialBinsLoad = false;

  declare state: FourwingsTileLayerState;

  initializeState(context: LayerContext) {
    super.initializeState(context);
    this.state = {
      error: '',
      scales: [],
      tilesCache: this._getTileDataCache({
        startTime: this.props.startTime,
        endTime: this.props.endTime,
      }),
      colorDomain: [],
      colorRanges: this._getColorRanges(),
      rampDirty: false,
    };
  }

  get isLoaded(): boolean {
    return super.isLoaded && !this.state.rampDirty;
  }

  getError(): string {
    return this.state.error;
  }

  getColorDomain = () => {
    return this.state.colorDomain;
  };

  _onLayerError = (error: Error) => {
    console.warn(error.message);
    this.setState({ error: error.message });
    return true;
  };

  _getColorRanges = () => {
    return this.props.sublayers.map(({ colorRamp }) =>
      getColorRamp({
        rampId: colorRamp,
      })
    );
  };

  _calculateColorDomain = () => {
    const { aggregationOperation, startTime, endTime } = this.props;
    const currentZoomData = this.getData();
    if (!currentZoomData.length) {
      return this.getColorDomain();
    }

    const { startFrame, endFrame } = getIntervalFrames({
      startTime,
      endTime,
      bufferedStart:
        this._getTileDataCache({
          startTime: this.props.startTime,
          endTime: this.props.endTime,
        })?.bufferedStart || 0,
    });

    const timeRangeKey = getTimeRangeKey(startFrame, endFrame);

    const allValues = currentZoomData.flatMap(
      (feature) =>
        feature.properties.initialValues[timeRangeKey] ||
        aggregateCell({
          cellValues: feature.properties.values.filter((sublayerValues) =>
            sublayerValues.map((value) => value)
          ),
          aggregationOperation,
          startFrame,
          endFrame,
          cellStartOffsets: feature.properties.startOffsets,
        })
    );
    if (!allValues.length) {
      return this.getColorDomain();
    }

    const dataFiltered = removeOutliers({ allValues, aggregationOperation });
    return getSteps(dataFiltered);
  };

  updateColorDomain = debounce(() => {
    requestAnimationFrame(() => {
      const { colorDomain: oldColorDomain } = this.state;
      const newColorDomain = this._calculateColorDomain();
      if (oldColorDomain.length) {
        const colorRanges = this._getColorRanges();
        const scales = this._getColorScales(newColorDomain, colorRanges);
        this.setState({
          colorDomain: newColorDomain,
          colorRanges,
          scales,
          rampDirty: false,
        });
      }
    });
  }, 500);

  _getColorScales = (
    colorDomain: FourwingsTileLayerColorDomain,
    colorRanges: FourwingsTileLayerColorRange
  ): FourwinsTileLayerScale[] => {
    return colorRanges.map((cr) =>
      scaleLinear(colorDomain as number[], cr as FourwingsColorObject[]).clamp(
        true
      )
    );
  };

  _onViewportLoad = (tiles: _Tile2DHeader[]) => {
    this.updateColorDomain();
    if (this.props.onViewportLoad) {
      this.props.onViewportLoad(tiles);
    }
  };

  _fetchTimeseriesTileData = async (tile: _TileLoadProps) => {
    const {
      startTime,
      endTime,
      sublayers,
      aggregationOperation,
      tilesUrl,
      extentStart,
    } = this.props;
    const { colorDomain, colorRanges } = this.state;
    const visibleSublayers = sublayers.filter((sublayer) => sublayer.visible);
    let cols: number = 0;
    let rows: number = 0;
    let scale: number = 0;
    let offset: number = 0;
    let noDataValue: number = 0;
    const interval = getFourwingsInterval(startTime, endTime);
    const chunk = getFourwingsChunk(startTime, endTime);
    this.setState({ rampDirty: true });
    const getSublayerData = async (sublayer: FourwingsDeckSublayer) => {
      const url = getDataUrlBySublayer({
        tile,
        chunk,
        sublayer,
        tilesUrl,
        extentStart,
      }) as string;
      const response = await fetch(url!, {
        signal: tile.signal,
      });
      if (response.status >= 400 && response.status !== 404) {
        throw new Error(response.statusText);
      }
      if (response.headers.get('X-columns') && !cols) {
        cols = parseInt(response.headers.get('X-columns') as string);
      }
      if (response.headers.get('X-rows') && !rows) {
        rows = parseInt(response.headers.get('X-rows') as string);
      }
      if (response.headers.get('X-scale') && !scale) {
        scale = parseFloat(response.headers.get('X-scale') as string);
      }
      if (response.headers.get('X-offset') && !offset) {
        offset = parseInt(response.headers.get('X-offset') as string);
      }
      if (response.headers.get('X-empty-value') && !noDataValue) {
        noDataValue = parseInt(response.headers.get('X-empty-value') as string);
      }
      const bins = JSON.parse(response.headers.get('X-bins-0') as string)?.map(
        (n: string) => {
          return (parseInt(n) - offset) * scale;
        }
      );
      if (
        !colorDomain?.length &&
        !this.initialBinsLoad &&
        bins?.length === COLOR_RAMP_DEFAULT_NUM_STEPS
      ) {
        const scales = this._getColorScales(bins, colorRanges);
        this.setState({ colorDomain: bins, scales });
        this.initialBinsLoad = true;
      }
      return await response.arrayBuffer();
    };

    const promises = visibleSublayers.map(
      getSublayerData
    ) as Promise<ArrayBuffer>[];
    const settledPromises = await Promise.allSettled(promises);

    const hasChunkError = settledPromises.some(
      (p) => p.status === 'rejected' && p.reason.status !== 404
    );
    if (hasChunkError) {
      const error =
        (
          settledPromises.find(
            (p) => p.status === 'rejected' && p.reason.statusText
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ) as any
        )?.reason.statuxText || 'Error loading chunk';
      throw new Error(error);
    }

    if (tile.signal?.aborted) {
      return;
    }

    const arrayBuffers = settledPromises.flatMap((d) => {
      return d.status === 'fulfilled' && d.value !== undefined ? d.value : [];
    });

    const data = await parse(
      arrayBuffers.filter(Boolean) as ArrayBuffer[],
      FourwingsLoader,
      {
        worker: true,
        fourwings: {
          sublayers: 1,
          cols,
          rows,
          scale,
          offset,
          noDataValue,
          bufferedStartDate: chunk.bufferedStart,
          initialTimeRange: {
            start: startTime,
            end: endTime,
          },
          interval,
          tile,
          aggregationOperation,
          buffersLength: settledPromises.map((p) =>
            p.status === 'fulfilled' && p.value !== undefined
              ? p.value.byteLength
              : 0
          ),
        } as ParseFourwingsOptions,
      }
    );
    return data;
  };

  _getTileData: TileLayerProps['getTileData'] = (tile) => {
    if (tile.signal?.aborted) {
      return null;
    }
    return this._fetchTimeseriesTileData(tile);
  };

  _getTileDataCache = ({
    startTime,
    endTime,
  }: {
    startTime: number;
    endTime: number;
  }): FourwingsHeatmapTilesCache => {
    const interval = getFourwingsInterval(startTime, endTime);
    const { start, end, bufferedStart } = getFourwingsChunk(startTime, endTime);
    return { start, end, bufferedStart, interval };
  };

  _getTileDataCacheKey = (): string => {
    const dataCache = Object.values(this.state.tilesCache || {}).join(',');
    const sublayersIds = this.props.sublayers?.map((s) => s.id).join(',');
    const sublayersDatasets = this.props.sublayers
      ?.flatMap((s) => s.datasets || [])
      .join(',');
    const sublayersFilters = this.props.sublayers
      ?.flatMap((s) => s.filter || [])
      .join(',');
    const sublayersVesselGroups = this.props.sublayers
      ?.map((s) => s.vesselGroups || [])
      .join(',');
    return [
      dataCache,
      sublayersIds,
      sublayersDatasets,
      sublayersFilters,
      sublayersVesselGroups,
    ].join('-');
  };

  updateState({ props }: UpdateParameters<this>) {
    const { startTime, endTime } = props;
    const { tilesCache, colorRanges, colorDomain } = this.state;
    const newSublayerColorRanges = this._getColorRanges();
    const sublayersHaveNewColors = !isEqual(
      colorRanges,
      newSublayerColorRanges
    );
    if (sublayersHaveNewColors) {
      this.setState({
        rampDirty: true,
        colorDomain: [],
        colorRanges: [],
        scales: [],
      });
      const newColorDomain = colorDomain;
      const scales = this._getColorScales(
        newColorDomain,
        newSublayerColorRanges
      );
      requestAnimationFrame(() => {
        this.setState({
          colorRanges: newSublayerColorRanges,
          colorDomain: newColorDomain,
          scales,
          rampDirty: false,
        });
      });
    }

    const isStartOutRange = startTime <= tilesCache.start;
    const isEndOutRange = endTime >= tilesCache.end;
    const needsCacheKeyUpdate =
      isStartOutRange ||
      isEndOutRange ||
      getFourwingsInterval(startTime, endTime) !== tilesCache.interval;
    if (needsCacheKeyUpdate) {
      this.setState({
        tilesCache: this._getTileDataCache({
          startTime,
          endTime,
        }),
      });
    }
  }

  renderLayers(): Layer<object> | LayersList {
    const { zoom } = this.context.viewport;
    if (!zoom) {
      return [];
    }
    const { colorDomain, colorRanges, tilesCache, scales } = this.state;
    const cacheKey = this._getTileDataCacheKey();

    return new TileLayer(
      this.props,
      this.getSubLayerProps({
        id: `tiles`,
        tileSize: 512,
        colorDomain,
        colorRanges,
        tilesCache,
        scales,
        minZoom: 0,
        onTileError: this._onLayerError,
        maxZoom: FOURWINGS_MAX_ZOOM,
        zoomOffset: 1,
        opacity: 1,
        maxRequests: this.props.maxRequests,
        debounceTime: this.props.debounceTime,
        getTileData: this._getTileData,
        updateTriggers: {
          getTileData: [cacheKey],
        },
        onViewportLoad: this._onViewportLoad,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderSubLayers: (props: any) => {
          return new FourwingsHeatmapLayer(props);
        },
      })
    );
  }

  getLayerInstance() {
    const layer = this.getSubLayers()[0] as TileLayer;
    return layer;
  }

  getTilesData({ aggregated } = {} as { aggregated?: boolean }) {
    const layer = this.getLayerInstance();
    if (layer) {
      const roudedZoom = Math.round(this.context.viewport.zoom);
      return (
        layer
          .getSubLayers()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((l: any) => {
            if (!l.props.tile.isVisible) {
              return [];
            }
            if (l.props.tile.zoom === l.props.maxZoom) {
              return l.getData({ aggregated });
            }
            return l.props.tile.zoom === roudedZoom
              ? l.getData({ aggregated })
              : [];
          })
          .filter((t) => t.length > 0) as FourwingsFeature[][]
      );
    }
    return [[]] as FourwingsFeature[][];
  }

  getData({ aggregated } = {} as { aggregated?: boolean }) {
    return this.getTilesData({ aggregated }).flat();
  }
}
