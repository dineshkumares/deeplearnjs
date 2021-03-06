/* Copyright 2017 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

import {Tensor} from '../graph';
import * as graph_util from '../graph_util';
import {NDArrayMath} from '../math/math';
import {NDArray, Scalar} from '../math/ndarray';
import {TensorArrayMap} from '../tensor_array_map';
import * as util from '../util';

import {Operation} from './op';

export class Subtract extends Operation {
  private dySizeScalar: Scalar;

  /**
   * Element-wise subtract operation. Broadcasts if one of the tensors is
   * scalar.
   */
  constructor(
      private t1: Tensor, private t2: Tensor, private outTensor: Tensor) {
    super();
    util.assert(
        util.sizeFromShape(t1.shape) === 1 ||
            util.sizeFromShape(t2.shape) === 1 ||
            util.arraysEqual(t1.shape, t2.shape),
        'One of t1 or t2 must be a scalar, or t1 and t2 must have ' +
            'the same shape');
  }

  feedForward(math: NDArrayMath, inferenceArrays: TensorArrayMap) {
    const t1 = inferenceArrays.get(this.t1);
    const t2 = inferenceArrays.get(this.t2);

    math.scope((keep) => {
      let result: NDArray;
      if (util.isScalarShape(t1.shape)) {
        result = math.scalarMinusArray(t1, t2);
      } else if (util.isScalarShape(t2.shape)) {
        result = math.arrayMinusScalar(t1, t2);
      } else {
        result = math.sub(t1, t2);
      }
      inferenceArrays.set(this.outTensor, keep(result));
    });
  }

  backProp(
      math: NDArrayMath, inferenceArrays: TensorArrayMap,
      gradientArrays: TensorArrayMap) {
    const dy = gradientArrays.get(this.outTensor);

    math.scope((keep) => {
      if (graph_util.shouldBackProp(this.t1)) {
        if (util.isScalarShape(this.t1.shape)) {
          const sum = math.sum(dy);
          if (this.dySizeScalar == null) {
            this.dySizeScalar = Scalar.new(dy.size);
          }
          gradientArrays.set(
              this.t1, keep(math.divide(sum, this.dySizeScalar)));
        } else {
          gradientArrays.set(this.t1, keep(dy));
        }
      }

      if (graph_util.shouldBackProp(this.t2)) {
        if (util.isScalarShape(this.t2.shape)) {
          const sum = math.sum(dy);
          const negSum = math.neg(sum);
          if (this.dySizeScalar == null) {
            this.dySizeScalar = Scalar.new(dy.size);
          }
          gradientArrays.set(
              this.t2, keep(math.divide(negSum, this.dySizeScalar)));
        } else {
          gradientArrays.set(this.t2, keep(math.neg(dy)));
        }
      }
    });
  }

  dispose() {
    if (this.dySizeScalar != null) {
      this.dySizeScalar.dispose();
    }
  }
}
