/**
 * DOMMatrix Polyfill for Node.js
 *
 * Provides a minimal DOMMatrix implementation for server-side environments
 * where the browser's DOMMatrix API is not available. This is needed for
 * PDF parsing libraries that may reference DOMMatrix.
 */

// Check if we're in a Node.js environment without DOMMatrix
if (typeof global !== 'undefined' && typeof (global as any).DOMMatrix === 'undefined') {
  /**
   * Minimal DOMMatrix implementation
   * Only implements the most commonly used functionality needed for PDF parsing
   */
  class DOMMatrixPolyfill {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
    m11: number;
    m12: number;
    m13: number;
    m14: number;
    m21: number;
    m22: number;
    m23: number;
    m24: number;
    m31: number;
    m32: number;
    m33: number;
    m34: number;
    m41: number;
    m42: number;
    m43: number;
    m44: number;
    is2D: boolean;
    isIdentity: boolean;

    constructor(init?: number[] | string | DOMMatrixPolyfill) {
      // Initialize with identity matrix
      this.a = this.m11 = 1;
      this.b = this.m12 = 0;
      this.c = this.m21 = 0;
      this.d = this.m22 = 1;
      this.e = this.m41 = 0;
      this.f = this.m42 = 0;

      this.m13 = 0;
      this.m14 = 0;
      this.m23 = 0;
      this.m24 = 0;
      this.m31 = 0;
      this.m32 = 0;
      this.m33 = 1;
      this.m34 = 0;
      this.m43 = 0;
      this.m44 = 1;

      this.is2D = true;
      this.isIdentity = true;

      if (init) {
        if (Array.isArray(init)) {
          if (init.length === 6) {
            [this.a, this.b, this.c, this.d, this.e, this.f] = init;
            this.m11 = this.a;
            this.m12 = this.b;
            this.m21 = this.c;
            this.m22 = this.d;
            this.m41 = this.e;
            this.m42 = this.f;
          } else if (init.length === 16) {
            [
              this.m11, this.m12, this.m13, this.m14,
              this.m21, this.m22, this.m23, this.m24,
              this.m31, this.m32, this.m33, this.m34,
              this.m41, this.m42, this.m43, this.m44
            ] = init;
            this.a = this.m11;
            this.b = this.m12;
            this.c = this.m21;
            this.d = this.m22;
            this.e = this.m41;
            this.f = this.m42;
            this.is2D = false;
          }
        }
        this.updateIsIdentity();
      }
    }

    private updateIsIdentity(): void {
      this.isIdentity =
        this.m11 === 1 && this.m12 === 0 && this.m13 === 0 && this.m14 === 0 &&
        this.m21 === 0 && this.m22 === 1 && this.m23 === 0 && this.m24 === 0 &&
        this.m31 === 0 && this.m32 === 0 && this.m33 === 1 && this.m34 === 0 &&
        this.m41 === 0 && this.m42 === 0 && this.m43 === 0 && this.m44 === 1;
    }

    translate(tx: number, ty: number, tz?: number): DOMMatrixPolyfill {
      const result = new DOMMatrixPolyfill();
      result.m11 = this.m11;
      result.m12 = this.m12;
      result.m13 = this.m13;
      result.m14 = this.m14;
      result.m21 = this.m21;
      result.m22 = this.m22;
      result.m23 = this.m23;
      result.m24 = this.m24;
      result.m31 = this.m31;
      result.m32 = this.m32;
      result.m33 = this.m33;
      result.m34 = this.m34;
      result.m41 = this.m41 + tx;
      result.m42 = this.m42 + ty;
      result.m43 = this.m43 + (tz || 0);
      result.m44 = this.m44;
      result.a = result.m11;
      result.b = result.m12;
      result.c = result.m21;
      result.d = result.m22;
      result.e = result.m41;
      result.f = result.m42;
      result.is2D = this.is2D && (tz === undefined || tz === 0);
      result.updateIsIdentity();
      return result;
    }

    scale(scaleX: number, scaleY?: number, scaleZ?: number): DOMMatrixPolyfill {
      const sy = scaleY !== undefined ? scaleY : scaleX;
      const sz = scaleZ !== undefined ? scaleZ : 1;

      const result = new DOMMatrixPolyfill();
      result.m11 = this.m11 * scaleX;
      result.m12 = this.m12 * scaleX;
      result.m13 = this.m13 * scaleX;
      result.m14 = this.m14 * scaleX;
      result.m21 = this.m21 * sy;
      result.m22 = this.m22 * sy;
      result.m23 = this.m23 * sy;
      result.m24 = this.m24 * sy;
      result.m31 = this.m31 * sz;
      result.m32 = this.m32 * sz;
      result.m33 = this.m33 * sz;
      result.m34 = this.m34 * sz;
      result.m41 = this.m41;
      result.m42 = this.m42;
      result.m43 = this.m43;
      result.m44 = this.m44;
      result.a = result.m11;
      result.b = result.m12;
      result.c = result.m21;
      result.d = result.m22;
      result.e = result.m41;
      result.f = result.m42;
      result.is2D = this.is2D && sz === 1;
      result.updateIsIdentity();
      return result;
    }

    rotate(angle: number): DOMMatrixPolyfill {
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const result = new DOMMatrixPolyfill();
      result.m11 = this.m11 * cos + this.m21 * sin;
      result.m12 = this.m12 * cos + this.m22 * sin;
      result.m13 = this.m13 * cos + this.m23 * sin;
      result.m14 = this.m14 * cos + this.m24 * sin;
      result.m21 = this.m21 * cos - this.m11 * sin;
      result.m22 = this.m22 * cos - this.m12 * sin;
      result.m23 = this.m23 * cos - this.m13 * sin;
      result.m24 = this.m24 * cos - this.m14 * sin;
      result.m31 = this.m31;
      result.m32 = this.m32;
      result.m33 = this.m33;
      result.m34 = this.m34;
      result.m41 = this.m41;
      result.m42 = this.m42;
      result.m43 = this.m43;
      result.m44 = this.m44;
      result.a = result.m11;
      result.b = result.m12;
      result.c = result.m21;
      result.d = result.m22;
      result.e = result.m41;
      result.f = result.m42;
      result.is2D = this.is2D;
      result.updateIsIdentity();
      return result;
    }

    multiply(other: DOMMatrixPolyfill): DOMMatrixPolyfill {
      const result = new DOMMatrixPolyfill();

      result.m11 = this.m11 * other.m11 + this.m12 * other.m21 + this.m13 * other.m31 + this.m14 * other.m41;
      result.m12 = this.m11 * other.m12 + this.m12 * other.m22 + this.m13 * other.m32 + this.m14 * other.m42;
      result.m13 = this.m11 * other.m13 + this.m12 * other.m23 + this.m13 * other.m33 + this.m14 * other.m43;
      result.m14 = this.m11 * other.m14 + this.m12 * other.m24 + this.m13 * other.m34 + this.m14 * other.m44;

      result.m21 = this.m21 * other.m11 + this.m22 * other.m21 + this.m23 * other.m31 + this.m24 * other.m41;
      result.m22 = this.m21 * other.m12 + this.m22 * other.m22 + this.m23 * other.m32 + this.m24 * other.m42;
      result.m23 = this.m21 * other.m13 + this.m22 * other.m23 + this.m23 * other.m33 + this.m24 * other.m43;
      result.m24 = this.m21 * other.m14 + this.m22 * other.m24 + this.m23 * other.m34 + this.m24 * other.m44;

      result.m31 = this.m31 * other.m11 + this.m32 * other.m21 + this.m33 * other.m31 + this.m34 * other.m41;
      result.m32 = this.m31 * other.m12 + this.m32 * other.m22 + this.m33 * other.m32 + this.m34 * other.m42;
      result.m33 = this.m31 * other.m13 + this.m32 * other.m23 + this.m33 * other.m33 + this.m34 * other.m43;
      result.m34 = this.m31 * other.m14 + this.m32 * other.m24 + this.m33 * other.m34 + this.m34 * other.m44;

      result.m41 = this.m41 * other.m11 + this.m42 * other.m21 + this.m43 * other.m31 + this.m44 * other.m41;
      result.m42 = this.m41 * other.m12 + this.m42 * other.m22 + this.m43 * other.m32 + this.m44 * other.m42;
      result.m43 = this.m41 * other.m13 + this.m42 * other.m23 + this.m43 * other.m33 + this.m44 * other.m43;
      result.m44 = this.m41 * other.m14 + this.m42 * other.m24 + this.m43 * other.m34 + this.m44 * other.m44;

      result.a = result.m11;
      result.b = result.m12;
      result.c = result.m21;
      result.d = result.m22;
      result.e = result.m41;
      result.f = result.m42;
      result.is2D = this.is2D && other.is2D;
      result.updateIsIdentity();
      return result;
    }

    inverse(): DOMMatrixPolyfill {
      const det = this.m11 * this.m22 - this.m12 * this.m21;

      if (det === 0) {
        throw new Error('Matrix is not invertible');
      }

      const result = new DOMMatrixPolyfill();
      result.m11 = this.m22 / det;
      result.m12 = -this.m12 / det;
      result.m21 = -this.m21 / det;
      result.m22 = this.m11 / det;
      result.m41 = (this.m21 * this.m42 - this.m22 * this.m41) / det;
      result.m42 = (this.m12 * this.m41 - this.m11 * this.m42) / det;
      result.a = result.m11;
      result.b = result.m12;
      result.c = result.m21;
      result.d = result.m22;
      result.e = result.m41;
      result.f = result.m42;
      result.is2D = this.is2D;
      result.updateIsIdentity();
      return result;
    }

    transformPoint(point: { x: number; y: number; z?: number; w?: number }): any {
      const x = point.x || 0;
      const y = point.y || 0;
      const z = point.z || 0;
      const w = point.w || 1;

      return {
        x: this.m11 * x + this.m21 * y + this.m31 * z + this.m41 * w,
        y: this.m12 * x + this.m22 * y + this.m32 * z + this.m42 * w,
        z: this.m13 * x + this.m23 * y + this.m33 * z + this.m43 * w,
        w: this.m14 * x + this.m24 * y + this.m34 * z + this.m44 * w,
      };
    }

    toFloat32Array(): Float32Array {
      return new Float32Array([
        this.m11, this.m12, this.m13, this.m14,
        this.m21, this.m22, this.m23, this.m24,
        this.m31, this.m32, this.m33, this.m34,
        this.m41, this.m42, this.m43, this.m44
      ]);
    }

    toFloat64Array(): Float64Array {
      return new Float64Array([
        this.m11, this.m12, this.m13, this.m14,
        this.m21, this.m22, this.m23, this.m24,
        this.m31, this.m32, this.m33, this.m34,
        this.m41, this.m42, this.m43, this.m44
      ]);
    }

    toString(): string {
      if (this.is2D) {
        return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
      }
      return `matrix3d(${this.m11}, ${this.m12}, ${this.m13}, ${this.m14}, ${this.m21}, ${this.m22}, ${this.m23}, ${this.m24}, ${this.m31}, ${this.m32}, ${this.m33}, ${this.m34}, ${this.m41}, ${this.m42}, ${this.m43}, ${this.m44})`;
    }
  }

  // Install the polyfill
  (global as any).DOMMatrix = DOMMatrixPolyfill;
  (global as any).DOMMatrixReadOnly = DOMMatrixPolyfill;

  console.log('[DOMMatrix Polyfill] Installed DOMMatrix polyfill for Node.js environment');
}

export {};
