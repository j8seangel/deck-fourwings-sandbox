// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import { Layer, project32, picking, UNIT } from '@deck.gl/core';
import { Geometry } from '@luma.gl/engine';
import { Model } from '@luma.gl/engine';

// import { triangleUniforms, TriangleProps } from './triangle-layer-uniforms';
// import vs from './triangle-layer-vertex.glsl';
// import fs from './triangle-layer-fragment.glsl';

import type {
  LayerProps,
  LayerDataSource,
  UpdateParameters,
  Accessor,
  Unit,
  Position,
  Color,
  DefaultProps,
} from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';

/** All props supported by the TriangleLayer */
export type TriangleLayerProps<DataT = unknown> = _TriangleLayerProps<DataT> &
  LayerProps;

/** Props added by the TriangleLayer */
type _TriangleLayerProps<DataT> = {
  getVelocity?: Accessor<DataT, number>;
  getDirection?: Accessor<DataT, number>;
};

const defaultProps: DefaultProps<TriangleLayerProps> = {
  getVelocity: { type: 'accessor', value: (d: any) => d.velocity || 0 },
  getDirection: { type: 'accessor', value: (d: any) => d.direction || 0 },
};

function getUTime() {
  return (Date.now() % 3000) / 3000;
}
/** Render circles at given coordinates. */
export default class TriangleLayer<
  DataT = unknown,
  ExtraPropsT extends object = object
> extends ScatterplotLayer<ExtraPropsT & Required<_TriangleLayerProps<DataT>>> {
  static defaultProps = defaultProps;
  static layerName: string = 'TriangleLayer';

  protected _getModel() {
    // a square that minimally cover the unit circle
    // const positions = [-1, -1, 0, 0.5, 0.5, 0, 1, 1, 0];
    const positions = [0.0, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0];
    return new Model(this.context.device, {
      ...this.getShaders(),
      id: this.props.id,
      bufferLayout: this.getAttributeManager()!.getBufferLayouts(),
      geometry: new Geometry({
        topology: 'triangle-list',
        attributes: {
          positions: { size: 3, value: new Float32Array(positions) },
        },
      }),
      isInstanced: true,
    });
  }

  initializeState() {
    super.initializeState();
    const attributeManager = this.getAttributeManager();
    this.state = {
      time: getUTime(),
    };
    setInterval(() => {
      this.setState({ time: getUTime() });
    }, 16);
    if (attributeManager) {
      attributeManager.addInstanced({
        directions: {
          size: 1,
          accessor: 'getDirection',
          shaderAttributes: {
            instanceDirections: {},
          },
        },
      });
      attributeManager.addInstanced({
        velocity: {
          size: 1,
          accessor: 'getVelocity',
          shaderAttributes: {
            instanceVelocity: {},
          },
        },
      });
    }
  }

  // updateState({ props, oldProps }: UpdateParameters<this>) {
  //   requestAnimationFrame(() => {
  //     this.setState({ time: (Date.now() % 1000) / 1000 });
  //   });
  // }

  getShaders() {
    return {
      ...super.getShaders(),
      inject: {
        'vs:#decl': `
          in float instanceDirections;
          in float instanceVelocity;

          vec2 rotate_by_angle(vec2 vertex, float angle) {
            float angle_radian = angle * PI / 180.0;
            float cos_angle = cos(angle_radian);
            float sin_angle = sin(angle_radian);
            mat2 rotationMatrix = mat2(cos_angle, -sin_angle, sin_angle, cos_angle);
            return rotationMatrix * vertex;
          }
        `,
        'vs:DECKGL_FILTER_SIZE': `
          float minWidth = 0.0; // Minimum width in pixels
          float maxWidth = 1.0; // Define your maximum width here
          float normalizedVelocity = min(instanceVelocity / 100.0, 1.0);
          float widthFactor = mix(minWidth, maxWidth, normalizedVelocity); // Interpolate between min and max based on instanceVelocity
          size.x *= widthFactor; // Scale the size based on the variable
          size.xy = rotate_by_angle(size.xy, instanceDirections);
        `,
        'fs:#decl': `
          uniform float uTime;
        `,
        'fs:DECKGL_FILTER_COLOR': `
          // float yPos = abs(geometry.uv.y - uTime);
          // color.a = mix(0.0, 1.0, 1.0 - (yPos * 2.0));
          float yPos = mod(geometry.uv.y - uTime, 1.0); // Use modulo for smooth transition
          color.a = mix(0.2, 1.0, 1.0 - sin(yPos * 3.14)); // Inverted opacity calculation
        `,
      },
    };
  }

  draw(params: any) {
    const { uniforms } = params;
    uniforms.uTime = this.state.time || 0;
    super.draw(params);
  }
}
