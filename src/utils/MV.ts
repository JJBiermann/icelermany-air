/* MV.ts — TypeScript translation of exercises/MV.js
   Kept API and behavior identical to original MV.js but added lightweight types.
*/

export type Vec = number[];
export type Mat = number[][] & { matrix?: true };

function _argumentsToArray(args: IArguments | any[]): any[] {
  // Match original: flatten one level when arrays are passed as single arg
  return ([] as any[]).concat.apply([], Array.prototype.slice.call(args));
}

export function radians(degrees: number): number {
  return degrees * Math.PI / 180.0;
}

// Vector constructors
export function vec2(..._args: any[]): Vec {
  const result = _argumentsToArray(arguments as any as IArguments);
  // @ts-ignore
  switch (result.length) {
    case 0: result.push(0.0);
    case 1: result.push(0.0);
  }
  return result.splice(0, 2);
}

export function vec3(..._args: any[]): Vec {
  const result = _argumentsToArray(arguments as any as IArguments);
  // @ts-ignore
  switch (result.length) {
    case 0: result.push(0.0);
    case 1: result.push(0.0);
    case 2: result.push(0.0);
  }
  return result.splice(0, 3);
}

export function vec4(...args: any[]): Vec {
  const result = _argumentsToArray(arguments as any as IArguments);
  //@ts-ignore
  switch (result.length) {
    case 0: result.push(0.0);
    case 1: result.push(0.0);
    case 2: result.push(0.0);
    case 3: result.push(1.0);
  }
  return result.splice(0, 4);
}

// Matrix constructors
export function mat2(...args: any[]): Mat {
  const v = _argumentsToArray(arguments as any as IArguments);
  const m: any[] = [];
  //@ts-ignore
  switch (v.length) {
    case 0:
      v[0] = 1;
    case 1:
      m[0] = vec2(v[0], 0.0);
      m[1] = vec2(0.0, v[0]);
      break;
    default:
      m.push(vec2(v)); v.splice(0, 2);
      m.push(vec2(v));
      break;
  }
  (m as Mat).matrix = true;
  return m as Mat;
}

export function mat3(..._args: any[]): Mat {
  const v = _argumentsToArray(arguments as any as IArguments);
  const m: any[] = [];
  // @ts-ignore
  switch (v.length) {
    case 0:
      v[0] = 1;
    case 1:
      m[0] = vec3(v[0], 0.0, 0.0);
      m[1] = vec3(0.0, v[0], 0.0);
      m[2] = vec3(0.0, 0.0, v[0]);
      break;
    default:
      m.push(vec3(v)); v.splice(0, 3);
      m.push(vec3(v)); v.splice(0, 3);
      m.push(vec3(v));
      break;
  }
  (m as Mat).matrix = true;
  return m as Mat;
}

export function mat4(...args: any[]): Mat {
  const v = _argumentsToArray(arguments as any as IArguments);
  const m: any[] = [];
  // @ts-ignore
  switch (v.length) {
    case 0:
      v[0] = 1;
    case 1:
      m[0] = vec4(v[0], 0.0, 0.0, 0.0);
      m[1] = vec4(0.0, v[0], 0.0, 0.0);
      m[2] = vec4(0.0, 0.0, v[0], 0.0);
      m[3] = vec4(0.0, 0.0, 0.0, v[0]);
      break;
    default:
      m.push(vec4(v)); v.splice(0, 4);
      m.push(vec4(v)); v.splice(0, 4);
      m.push(vec4(v)); v.splice(0, 4);
      m.push(vec4(v));
      break;
  }
  (m as Mat).matrix = true;
  return m as Mat;
}

// Generic operations
export function equal(u: any[], v: any[]): boolean {
  if (u.length != v.length) { return false; }
  if ((u as any).matrix && (v as any).matrix) {
    for (let i = 0; i < u.length; ++i) {
      if (u[i].length != v[i].length) { return false; }
      for (let j = 0; j < u[i].length; ++j) {
        if (u[i][j] !== v[i][j]) { return false; }
      }
    }
  } else if ((u as any).matrix && !(v as any).matrix || !(u as any).matrix && (v as any).matrix) {
    return false;
  } else {
    for (let i = 0; i < u.length; ++i) {
      if (u[i] !== v[i]) { return false; }
    }
  }
  return true;
}

export function add(u: any[], v: any[]): any[] {
  const result: any[] = [];
  if ((u as any).matrix && (v as any).matrix) {
    if (u.length != v.length) throw "add(): trying to add matrices of different dimensions";
    for (let i = 0; i < u.length; ++i) {
      if (u[i].length != v[i].length) throw "add(): trying to add matrices of different dimensions";
      result.push([]);
      for (let j = 0; j < u[i].length; ++j) {
        result[i].push(u[i][j] + v[i][j]);
      }
    }
    (result as any).matrix = true;
    return result;
  } else if ((u as any).matrix && !(v as any).matrix || !(u as any).matrix && (v as any).matrix) {
    throw "add(): trying to add matrix and non-matrix variables";
  } else {
    if (u.length != v.length) throw "add(): vectors are not the same dimension";
    for (let i = 0; i < u.length; ++i) result.push(u[i] + v[i]);
    return result;
  }
}

export function subtract(u: any[], v: any[]): any[] {
  const result: any[] = [];
  if ((u as any).matrix && (v as any).matrix) {
    if (u.length != v.length) throw "subtract(): trying to subtract matrices of different dimensions";
    for (let i = 0; i < u.length; ++i) {
      if (u[i].length != v[i].length) throw "subtract(): trying to subtact matrices of different dimensions";
      result.push([]);
      for (let j = 0; j < u[i].length; ++j) result[i].push(u[i][j] - v[i][j]);
    }
    (result as any).matrix = true;
    return result;
  } else if ((u as any).matrix && !(v as any).matrix || !(u as any).matrix && (v as any).matrix) {
    throw "subtact(): trying to subtact  matrix and non-matrix variables";
  } else {
    if (u.length != v.length) throw "subtract(): vectors are not the same length";
    for (let i = 0; i < u.length; ++i) result.push(u[i] - v[i]);
    return result;
  }
}

export function mult(u: any[], v: any[]): any[] {
  const result: any[] = [];
  if ((u as any).matrix && (v as any).matrix) {
    if (u.length != v.length) throw "mult(): trying to add matrices of different dimensions";
    for (let i = 0; i < u.length; ++i) if (u[i].length != v[i].length) throw "mult(): trying to add matrices of different dimensions";
    for (let i = 0; i < u.length; ++i) {
      result.push([]);
      for (let j = 0; j < v.length; ++j) {
        let sum = 0.0;
        for (let k = 0; k < u.length; ++k) sum += u[i][k] * v[k][j];
        result[i].push(sum);
      }
    }
    (result as any).matrix = true;
    return result;
  }

  if ((u as any).matrix && (u.length == v.length)) {
    for (let i = 0; i < v.length; i++) {
      let sum = 0.0;
      for (let j = 0; j < v.length; j++) sum += u[i][j] * v[j];
      result.push(sum);
    }
    return result;
  }
  else {
    if (u.length != v.length) throw "mult(): vectors are not the same dimension";
    for (let i = 0; i < u.length; ++i) result.push(u[i] * v[i]);
    return result;
  }
}

// Transformations
export function translate(x: number | Vec, y?: number, z?: number): Mat {
  if (Array.isArray(x) && x.length == 3) {
    z = x[2]; y = x[1]; x = x[0];
  }
  const result = mat4();
  result[0][3] = x as number;
  result[1][3] = y as number;
  result[2][3] = z as number;
  return result;
}

export function rotate(angle: number, axis?: Vec | number, _y?: number, _z?: number): Mat {
  if (!Array.isArray(axis)) {
    axis = [arguments[1], arguments[2], arguments[3]] as Vec;
  }
  const v = normalize(axis as Vec);
  const x = v[0], y = v[1], z = v[2];
  const c = Math.cos(radians(angle));
  const omc = 1.0 - c;
  const s = Math.sin(radians(angle));
  const result = mat4(
    vec4(x*x*omc + c,   x*y*omc - z*s, x*z*omc + y*s, 0.0),
    vec4(x*y*omc + z*s, y*y*omc + c,   y*z*omc - x*s, 0.0),
    vec4(x*z*omc - y*s, y*z*omc + x*s, z*z*omc + c,   0.0),
    vec4()
  );
  return result;
}

export function rotateX(theta: number): Mat {
  const c = Math.cos(radians(theta));
  const s = Math.sin(radians(theta));
  return mat4(
    1.0, 0.0, 0.0, 0.0,
    0.0, c, s, 0.0,
    0.0, -s, c, 0.0,
    0.0, 0.0, 0.0, 1.0
  );
}
export function rotateY(theta: number): Mat {
  const c = Math.cos(radians(theta));
  const s = Math.sin(radians(theta));
  return mat4(
    c, 0.0, -s, 0.0,
    0.0, 1.0, 0.0, 0.0,
    s, 0.0, c, 0.0,
    0.0, 0.0, 0.0, 1.0
  );
}
export function rotateZ(theta: number): Mat {
  const c = Math.cos(radians(theta));
  const s = Math.sin(radians(theta));
  return mat4(
    c, s, 0.0, 0.0,
    -s, c, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0
  );
}

export function scalem(x: number | Vec, y?: number, z?: number): Mat {
  if (Array.isArray(x) && x.length == 3) { z = x[2]; y = x[1]; x = x[0]; }
  const result = mat4();
  result[0][0] = x as number;
  result[1][1] = y as number;
  result[2][2] = z as number;
  return result;
}

// ModelView
export function lookAt(eye: Vec, at: Vec, up: Vec): Mat {
  if (!Array.isArray(eye) || eye.length != 3) throw "lookAt(): first parameter [eye] must be an a vec3";
  if (!Array.isArray(at) || at.length != 3) throw "lookAt(): first parameter [at] must be an a vec3";
  if (!Array.isArray(up) || up.length != 3) throw "lookAt(): first parameter [up] must be an a vec3";
  if (equal(eye, at)) return mat4();
  let v = normalize(subtract(at, eye));
  const n = normalize(cross(v, up));
  const u = normalize(cross(n, v));
  v = negate(v);
  const result = mat4(
    vec4(n, -dot(n, eye)),
    vec4(u, -dot(u, eye)),
    vec4(v, -dot(v, eye)),
    vec4()
  );
  return result;
}

// Projection
export function ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat {
  if (left == right) throw "ortho(): left and right are equal";
  if (bottom == top) throw "ortho(): bottom and top are equal";
  if (near == far) throw "ortho(): near and far are equal";
  const w = right - left;
  const h = top - bottom;
  const d = far - near;
  const result = mat4();
  result[0][0] = 2.0 / w;
  result[1][1] = 2.0 / h;
  result[2][2] = -2.0 / d;
  result[0][3] = -(left + right) / w;
  result[1][3] = -(top + bottom) / h;
  result[2][3] = -(near + far) / d;
  return result;
}

export function perspective(fovy: number, aspect: number, near: number, far: number): Mat {
  const f = 1.0 / Math.tan(radians(fovy) / 2);
  const d = far - near;
  const result = mat4();
  result[0][0] = f / aspect;
  result[1][1] = f;
  result[2][2] = -(near + far) / d;
  result[2][3] = -2 * near * far / d;
  result[3][2] = -1;
  result[3][3] = 0.0;
  return result;
}

export function transpose(m: Mat): Mat | string {
  if (!(m as any).matrix) return "transpose(): trying to transpose a non-matrix";
  const result: any[] = [];
  for (let i = 0; i < m.length; ++i) {
    result.push([]);
    for (let j = 0; j < m[i].length; ++j) result[i].push(m[j][i]);
  }
  (result as any).matrix = true;
  return result as Mat;
}

// Vector functions
export function dot(u: Vec, v: Vec): number {
  if (u.length != v.length) throw "dot(): vectors are not the same dimension";
  let sum = 0.0;
  for (let i = 0; i < u.length; ++i) sum += u[i] * v[i];
  return sum;
}

export function negate(u: Vec): Vec {
  const result: Vec = [];
  for (let i = 0; i < u.length; ++i) result.push(-u[i]);
  return result;
}

export function cross(u: Vec, v: Vec): Vec {
  if (!Array.isArray(u) || u.length < 3) throw "cross(): first argument is not a vector of at least 3";
  if (!Array.isArray(v) || v.length < 3) throw "cross(): second argument is not a vector of at least 3";
  return [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0]];
}

export function length(u: Vec): number { return Math.sqrt(dot(u, u)); }

export function normalize(u: Vec, excludeLastComponent?: boolean): Vec {
  let last: number | undefined;
  if (excludeLastComponent) { last = u.pop(); }
  const len = length(u);
  if (!isFinite(len)) throw "normalize: vector " + u + " has zero length";
  for (let i = 0; i < u.length; ++i) u[i] /= len;
  if (excludeLastComponent) u.push(last as number);
  return u;
}

export function mix(u: Vec, v: Vec, s: number): Vec {
  if (typeof s !== "number") throw "mix: the last paramter " + s + " must be a number";
  if (u.length != v.length) throw "vector dimension mismatch";
  const result: Vec = [];
  for (let i = 0; i < u.length; ++i) result.push((1.0 - s) * u[i] + s * v[i]);
  return result;
}

export function scale(s: number, u: Vec): Vec {
  if (!Array.isArray(u)) throw "scale: second parameter " + u + " is not a vector";
  const result: Vec = [];
  for (let i = 0; i < u.length; ++i) result.push(s * u[i]);
  return result;
}

export function flatten(v: any): Float32Array {
  if (v.matrix === true) v = transpose(v);
  let n = v.length;
  let elemsAreArrays = false;
  if (Array.isArray(v[0])) { elemsAreArrays = true; n *= v[0].length; }
  const floats = new Float32Array(n);
  if (elemsAreArrays) {
    let idx = 0;
    for (let i = 0; i < v.length; ++i) for (let j = 0; j < v[i].length; ++j) floats[idx++] = v[i][j];
  } else {
    for (let i = 0; i < v.length; ++i) floats[i] = v[i];
  }
  return floats;
}

export function flattenVecArray(vecs: Vec[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < vecs.length; ++i) {
    const v = vecs[i];
    for (let j = 0; j < v.length; ++j) {
      result.push(v[j]);
    }
  }
  return result;
}

export const sizeof = {
  'vec2': new Float32Array(flatten(vec2())).byteLength,
  'vec3': new Float32Array(flatten(vec3())).byteLength,
  'vec4': new Float32Array(flatten(vec4())).byteLength,
  'mat2': new Float32Array(flatten(mat2())).byteLength,
  'mat3': new Float32Array(flatten(mat3())).byteLength,
  'mat4': new Float32Array(flatten(mat4())).byteLength
};

// print
export function printm(m: any) {
  if (m.length == 2) for (let i = 0; i < m.length; i++) console.log(m[i][0], m[i][1]);
  else if (m.length == 3) for (let i = 0; i < m.length; i++) console.log(m[i][0], m[i][1], m[i][2]);
  else if (m.length == 4) for (let i = 0; i < m.length; i++) console.log(m[i][0], m[i][1], m[i][2], m[i][3]);
}

// determinants & inverses
export function det2(m: Mat): number { return m[0][0]*m[1][1] - m[0][1]*m[1][0]; }
export function det3(m: Mat): number {
  return m[0][0]*m[1][1]*m[2][2] + m[0][1]*m[1][2]*m[2][0] + m[0][2]*m[2][1]*m[1][0]
       - m[2][0]*m[1][1]*m[0][2] - m[1][0]*m[0][1]*m[2][2] - m[0][0]*m[1][2]*m[2][1];
}
export function det4(m: Mat): number {
  const m0 = [ vec3(m[1][1], m[1][2], m[1][3]), vec3(m[2][1], m[2][2], m[2][3]), vec3(m[3][1], m[3][2], m[3][3]) ];
  const m1 = [ vec3(m[1][0], m[1][2], m[1][3]), vec3(m[2][0], m[2][2], m[2][3]), vec3(m[3][0], m[3][2], m[3][3]) ];
  const m2 = [ vec3(m[1][0], m[1][1], m[1][3]), vec3(m[2][0], m[2][1], m[2][3]), vec3(m[3][0], m[3][1], m[3][3]) ];
  const m3 = [ vec3(m[1][0], m[1][1], m[1][2]), vec3(m[2][0], m[2][1], m[2][2]), vec3(m[3][0], m[3][1], m[3][2]) ];
  return m[0][0]*det3(m0 as any) - m[0][1]*det3(m1 as any) + m[0][2]*det3(m2 as any) - m[0][3]*det3(m3 as any);
}
export function det(m: Mat): number | void {
  if ((m as any).matrix !== true) console.log("not a matrix");
  if (m.length == 2) return det2(m);
  if (m.length == 3) return det3(m);
  if (m.length == 4) return det4(m);
}

export function inverse2(m: Mat): Mat {
  const a = mat2();
  const d = det2(m);
  if (!isFinite(d) || Math.abs(d) < 1e-8) {
    throw "inverse2(): singular matrix (determinant is zero)";
  }
  a[0][0] = m[1][1]/d; a[0][1] = -m[0][1]/d;
  a[1][0] = -m[1][0]/d; a[1][1] = m[0][0]/d;
  (a as any).matrix = true;
  return a;
}

export function inverse3(m: Mat): Mat {
  const a = mat3();
  const d = det3(m);
  if (!isFinite(d) || Math.abs(d) < 1e-8) {
    throw "inverse3(): singular matrix (determinant is zero)";
  }
  const a00 = [ vec2(m[1][1], m[1][2]), vec2(m[2][1], m[2][2]) ];
  const a01 = [ vec2(m[1][0], m[1][2]), vec2(m[2][0], m[2][2]) ];
  const a02 = [ vec2(m[1][0], m[1][1]), vec2(m[2][0], m[2][1]) ];
  const a10 = [ vec2(m[0][1], m[0][2]), vec2(m[2][1], m[2][2]) ];
  const a11 = [ vec2(m[0][0], m[0][2]), vec2(m[2][0], m[2][2]) ];
  const a12 = [ vec2(m[0][0], m[0][1]), vec2(m[2][0], m[2][1]) ];
  const a20 = [ vec2(m[0][1], m[0][2]), vec2(m[1][1], m[1][2]) ];
  const a21 = [ vec2(m[0][0], m[0][2]), vec2(m[1][0], m[1][2]) ];
  const a22 = [ vec2(m[0][0], m[0][1]), vec2(m[1][0], m[1][1]) ];
  a[0][0] = det2(a00)/d; a[0][1] = -det2(a10)/d; a[0][2] = det2(a20)/d;
  a[1][0] = -det2(a01)/d; a[1][1] = det2(a11)/d; a[1][2] = -det2(a21)/d;
  a[2][0] = det2(a02)/d; a[2][1] = -det2(a12)/d; a[2][2] = det2(a22)/d;
  return a;
}

export function inverse4(m: Mat): Mat {
  const a = mat4();
  const d = det4(m);
  if (!isFinite(d) || Math.abs(d) < 1e-8) {
    throw "inverse4(): singular matrix (determinant is zero)";
  }
  const a00 = [ vec3(m[1][1], m[1][2], m[1][3]), vec3(m[2][1], m[2][2], m[2][3]), vec3(m[3][1], m[3][2], m[3][3]) ];
  const a01 = [ vec3(m[1][0], m[1][2], m[1][3]), vec3(m[2][0], m[2][2], m[2][3]), vec3(m[3][0], m[3][2], m[3][3]) ];
  const a02 = [ vec3(m[1][0], m[1][1], m[1][3]), vec3(m[2][0], m[2][1], m[2][3]), vec3(m[3][0], m[3][1], m[3][3]) ];
  const a03 = [ vec3(m[1][0], m[1][1], m[1][2]), vec3(m[2][0], m[2][1], m[2][2]), vec3(m[3][0], m[3][1], m[3][2]) ];
  const a10 = [ vec3(m[0][1], m[0][2], m[0][3]), vec3(m[2][1], m[2][2], m[2][3]), vec3(m[3][1], m[3][2], m[3][3]) ];
  const a11 = [ vec3(m[0][0], m[0][2], m[0][3]), vec3(m[2][0], m[2][2], m[2][3]), vec3(m[3][0], m[3][2], m[3][3]) ];
  const a12 = [ vec3(m[0][0], m[0][1], m[0][3]), vec3(m[2][0], m[2][1], m[2][3]), vec3(m[3][0], m[3][1], m[3][3]) ];
  const a13 = [ vec3(m[0][0], m[0][1], m[0][2]), vec3(m[2][0], m[2][1], m[2][2]), vec3(m[3][0], m[3][1], m[3][2]) ];
  const a20 = [ vec3(m[0][1], m[0][2], m[0][3]), vec3(m[1][1], m[1][2], m[1][3]), vec3(m[3][1], m[3][2], m[3][3]) ];
  const a21 = [ vec3(m[0][0], m[0][2], m[0][3]), vec3(m[1][0], m[1][2], m[1][3]), vec3(m[3][0], m[3][2], m[3][3]) ];
  const a22 = [ vec3(m[0][0], m[0][1], m[0][3]), vec3(m[1][0], m[1][1], m[1][3]), vec3(m[3][0], m[3][1], m[3][3]) ];
  const a23 = [ vec3(m[0][0], m[0][1], m[0][2]), vec3(m[1][0], m[1][1], m[1][2]), vec3(m[3][0], m[3][1], m[3][2]) ];
  const a30 = [ vec3(m[0][1], m[0][2], m[0][3]), vec3(m[1][1], m[1][2], m[1][3]), vec3(m[2][1], m[2][2], m[2][3]) ];
  const a31 = [ vec3(m[0][0], m[0][2], m[0][3]), vec3(m[1][0], m[1][2], m[1][3]), vec3(m[2][0], m[2][2], m[2][3]) ];
  const a32 = [ vec3(m[0][0], m[0][1], m[0][3]), vec3(m[1][0], m[1][1], m[1][3]), vec3(m[2][0], m[2][1], m[2][3]) ];
  const a33 = [ vec3(m[0][0], m[0][1], m[0][2]), vec3(m[1][0], m[1][1], m[1][2]), vec3(m[2][0], m[2][1], m[2][2]) ];
  a[0][0] = det3(a00)/d; a[0][1] = -det3(a10)/d; a[0][2] = det3(a20)/d; a[0][3] = -det3(a30)/d;
  a[1][0] = -det3(a01)/d; a[1][1] = det3(a11)/d; a[1][2] = -det3(a21)/d; a[1][3] = det3(a31)/d;
  a[2][0] = det3(a02)/d; a[2][1] = -det3(a12)/d; a[2][2] = det3(a22)/d; a[2][3] = -det3(a32)/d;
  a[3][0] = -det3(a03)/d; a[3][1] = det3(a13)/d; a[3][2] = -det3(a23)/d; a[3][3] = det3(a33)/d;
  return a;
}

export function inverse(m: Mat): Mat {
  if ((m as any).matrix != true) console.log("not a matrix");
  if (m.length == 2) return inverse2(m);
  if (m.length == 3) return inverse3(m);
  if (m.length == 4) return inverse4(m);
  return [];
}

export function normalMatrix(m: Mat, flag?: boolean): Mat | any {
  let a = mat4();
  a = inverse(transpose(m) as Mat) as Mat;
  if (flag != true) return a;
  else {
    const b = mat3();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) (b as any)[i][j] = (a as any)[i][j];
    return b;
  }
}
