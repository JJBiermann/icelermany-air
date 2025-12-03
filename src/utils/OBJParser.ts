// OBJParser.ts from OBJViewer.js (c) 2012 matsuda and itami
//
// Modified by Jeppe Revall Frisvad, 2014, in order to
// - enable loading of OBJ files with no object or group names,
// - enable loading of files with different white spaces and returns at the end
//   of the face definitions, and
// - enable loading of larger models by improving the function getDrawingInfo.
// Modified by Jeppe Revall Frisvad 2024, in order to
// - use fetch for asynchronous data loading.
// Converted to TypeScript with proper types

//------------------------------------------------------------------------------
// Type Definitions
//------------------------------------------------------------------------------

export interface DrawingInfoInterface {
  vertices: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

//------------------------------------------------------------------------------
// OBJParser
//------------------------------------------------------------------------------

export async function readOBJFile(
  fileName: string,
  scale: number = 1.0,
  reverse: boolean = false
): Promise<DrawingInfoInterface | null> {
  const response = await fetch(fileName);
  if (response.ok) {
    const objDoc = new OBJDoc(fileName); // Create an OBJDoc object
    const fileText = await response.text();
    const result = await objDoc.parse(fileText, scale, reverse);
    if (!result) {
      console.log("OBJ file parsing error.");
      return null;
    }
    return objDoc.getDrawingInfo();
  } else {
    return null;
  }
}

//------------------------------------------------------------------------------
// OBJDoc Object
//------------------------------------------------------------------------------

class OBJDoc {
  fileName: string;
  mtls: MTLDoc[];
  objects: OBJObject[];
  vertices: Vertex[];
  normals: Normal[];

  constructor(fileName: string) {
    this.fileName = fileName;
    this.mtls = [];
    this.objects = [];
    this.vertices = [];
    this.normals = [];
  }

  // Parsing the OBJ file
  async parse(
    fileString: string,
    scale: number = 1.0,
    reverse: boolean = false
  ): Promise<boolean> {
    const lines = fileString.split('\n'); // Break up into lines and store them as array
    lines.push(null as any); // Append null
    let index = 0; // Initialize index of line

    let currentObject = new OBJObject("");
    this.objects.push(currentObject);
    let currentMaterialName = "";

    // Parse line by line
    let line: string | null;
    const sp = new StringParser(); // Create StringParser
    while ((line = lines[index++]) != null) {
      sp.init(line); // init StringParser
      const command = sp.getWord(); // Get command
      if (command == null) continue; // check null command

      switch (command) {
        case '#':
          continue; // Skip comments
        case 'mtllib': // Read Material chunk
          {
            const path = this.parseMtllib(sp, this.fileName);
            const mtl = new MTLDoc(); // Create MTL instance
            this.mtls.push(mtl);
            const mtlResponse = await fetch(path);
            if (mtlResponse.ok) {
              onReadMTLFile(await mtlResponse.text(), mtl);
            } else {
              mtl.complete = true;
            }
          }
          continue; // Go to the next line
        case 'o':
        case 'g': // Read Object name
          if (currentObject.numIndices == 0) {
            currentObject = this.parseObjectName(sp);
            this.objects[0] = currentObject;
          } else {
            const object = this.parseObjectName(sp);
            this.objects.push(object);
            currentObject = object;
          }
          continue; // Go to the next line
        case 'v': // Read vertex
          {
            const vertex = this.parseVertex(sp, scale);
            this.vertices.push(vertex);
          }
          continue; // Go to the next line
        case 'vn': // Read normal
          {
            const normal = this.parseNormal(sp);
            this.normals.push(normal);
          }
          continue; // Go to the next line
        case 'usemtl': // Read Material name
          currentMaterialName = this.parseUsemtl(sp);
          continue; // Go to the next line
        case 'f': // Read face
          {
            const face = this.parseFace(sp, currentMaterialName, this.vertices, reverse);
            currentObject.addFace(face);
          }
          continue; // Go to the next line
      }
    }

    return true;
  }

  parseMtllib(sp: StringParser, fileName: string): string {
    // Get directory path
    const i = fileName.lastIndexOf("/");
    let dirPath = "";
    if (i > 0) dirPath = fileName.substr(0, i + 1);

    return dirPath + (sp.getWord() || ""); // Get path
  }

  parseObjectName(sp: StringParser): OBJObject {
    const name = sp.getWord() || "";
    return new OBJObject(name);
  }

  parseVertex(sp: StringParser, scale: number): Vertex {
    const x = (sp.getFloat() || 0) * scale;
    const y = (sp.getFloat() || 0) * scale;
    const z = (sp.getFloat() || 0) * scale;
    return new Vertex(x, y, z);
  }

  parseNormal(sp: StringParser): Normal {
    const x = sp.getFloat() || 0;
    const y = sp.getFloat() || 0;
    const z = sp.getFloat() || 0;
    return new Normal(x, y, z);
  }

  parseUsemtl(sp: StringParser): string {
    return sp.getWord() || "";
  }

  parseFace(
    sp: StringParser,
    materialName: string,
    vertices: Vertex[],
    reverse: boolean
  ): Face {
    const face = new Face(materialName);
    // get indices
    for (;;) {
      const word = sp.getWord();
      if (word == null) break;
      const subWords = word.split('/');
      if (subWords.length >= 1) {
        const vi = parseInt(subWords[0]) - 1;
        if (!isNaN(vi)) face.vIndices.push(vi);
      }
      if (subWords.length >= 3) {
        const ni = parseInt(subWords[2]) - 1;
        face.nIndices.push(ni);
      } else {
        face.nIndices.push(-1);
      }
    }

    // calc normal
    const v0: [number, number, number] = [
      vertices[face.vIndices[0]].x,
      vertices[face.vIndices[0]].y,
      vertices[face.vIndices[0]].z,
    ];
    const v1: [number, number, number] = [
      vertices[face.vIndices[1]].x,
      vertices[face.vIndices[1]].y,
      vertices[face.vIndices[1]].z,
    ];
    const v2: [number, number, number] = [
      vertices[face.vIndices[2]].x,
      vertices[face.vIndices[2]].y,
      vertices[face.vIndices[2]].z,
    ];

    // 面の法線を計算してnormalに設定
    let normal = calcNormal(v0, v1, v2);
    // 法線が正しく求められたか調べる
    if (normal == null) {
      if (face.vIndices.length >= 4) {
        // 面が四角形なら別の3点の組み合わせで法線計算
        const v3: [number, number, number] = [
          vertices[face.vIndices[3]].x,
          vertices[face.vIndices[3]].y,
          vertices[face.vIndices[3]].z,
        ];
        normal = calcNormal(v1, v2, v3);
      }
      if (normal == null) {
        // 法線が求められなかったのでY軸方向の法線とする
        normal = [0.0, 1.0, 0.0];
      }
    }
    if (reverse) {
      normal[0] = -normal[0];
      normal[1] = -normal[1];
      normal[2] = -normal[2];
    }
    face.normal = new Normal(normal[0], normal[1], normal[2]);

    // Devide to triangles if face contains over 3 points.
    if (face.vIndices.length > 3) {
      const n = face.vIndices.length - 2;
      const newVIndices: number[] = new Array(n * 3);
      const newNIndices: number[] = new Array(n * 3);
      for (let i = 0; i < n; i++) {
        newVIndices[i * 3 + 0] = face.vIndices[0];
        newVIndices[i * 3 + 1] = face.vIndices[i + 1];
        newVIndices[i * 3 + 2] = face.vIndices[i + 2];
        newNIndices[i * 3 + 0] = face.nIndices[0];
        newNIndices[i * 3 + 1] = face.nIndices[i + 1];
        newNIndices[i * 3 + 2] = face.nIndices[i + 2];
      }
      face.vIndices = newVIndices;
      face.nIndices = newNIndices;
    }
    face.numIndices = face.vIndices.length;

    return face;
  }

  isMTLComplete(): boolean {
    if (this.mtls.length == 0) return true;
    for (let i = 0; i < this.mtls.length; i++) {
      if (!this.mtls[i].complete) return false;
    }
    return true;
  }

  findColor(name: string): Color {
    for (let i = 0; i < this.mtls.length; i++) {
      for (let j = 0; j < this.mtls[i].materials.length; j++) {
        if (this.mtls[i].materials[j].name == name) {
          return this.mtls[i].materials[j].color;
        }
      }
    }
    return new Color(0.8, 0.8, 0.8, 1);
  }

  //------------------------------------------------------------------------------
  // Retrieve the information for drawing 3D model
  getDrawingInfo(): DrawingInfoInterface {
    // Create an arrays for vertex coordinates, normals, colors, and indices
    let numIndices = 0;
    for (let i = 0; i < this.objects.length; i++) {
      numIndices += this.objects[i].numIndices;
    }
    const numVertices = this.vertices.length;
    const vertices = new Float32Array(numVertices * 4);
    const normals = new Float32Array(numVertices * 4);
    const colors = new Float32Array(numVertices * 4);
    const indices = new Uint32Array(numIndices);

    // Set vertex, normal and color
    let index_indices = 0;
    for (let i = 0; i < this.objects.length; i++) {
      const object = this.objects[i];
      for (let j = 0; j < object.faces.length; j++) {
        const face = object.faces[j];
        const color = this.findColor(face.materialName);
        const faceNormal = face.normal;
        for (let k = 0; k < face.vIndices.length; k++) {
          // Set index
          const vIdx = face.vIndices[k];
          indices[index_indices] = vIdx;
          // Copy vertex
          const vertex = this.vertices[vIdx];
          vertices[vIdx * 4 + 0] = vertex.x;
          vertices[vIdx * 4 + 1] = vertex.y;
          vertices[vIdx * 4 + 2] = vertex.z;
          vertices[vIdx * 4 + 3] = 1.0;
          // Copy color
          colors[vIdx * 4 + 0] = color.r;
          colors[vIdx * 4 + 1] = color.g;
          colors[vIdx * 4 + 2] = color.b;
          colors[vIdx * 4 + 3] = color.a;
          // Copy normal
          const nIdx = face.nIndices[k];
          if (nIdx >= 0) {
            const normal = this.normals[nIdx];
            normals[vIdx * 4 + 0] = normal.x;
            normals[vIdx * 4 + 1] = normal.y;
            normals[vIdx * 4 + 2] = normal.z;
            normals[vIdx * 4 + 3] = 0.0;
          } else {
            normals[vIdx * 4 + 0] = faceNormal.x;
            normals[vIdx * 4 + 1] = faceNormal.y;
            normals[vIdx * 4 + 2] = faceNormal.z;
            normals[vIdx * 4 + 3] = 0.0;
          }
          index_indices++;
        }
      }
    }

    return new DrawingInfo(vertices, normals, colors, indices);
  }
}

//------------------------------------------------------------------------------
// MTLDoc Object
//------------------------------------------------------------------------------

class MTLDoc {
  complete: boolean;
  materials: Material[];

  constructor() {
    this.complete = false;
    this.materials = [];
  }

  parseNewmtl(sp: StringParser): string {
    return sp.getWord() || ""; // Get name
  }

  parseRGB(sp: StringParser, name: string): Material {
    const r = sp.getFloat() || 0;
    const g = sp.getFloat() || 0;
    const b = sp.getFloat() || 0;
    return new Material(name, r, g, b, 1);
  }
}

// Analyze the material file
function onReadMTLFile(fileString: string, mtl: MTLDoc): void {
  const lines = fileString.split('\n'); // Break up into lines and store them as array
  lines.push(null as any); // Append null
  let index = 0; // Initialize index of line

  // Parse line by line
  let line: string | null;
  let name = ""; // Material name
  const sp = new StringParser(); // Create StringParser
  while ((line = lines[index++]) != null) {
    sp.init(line); // init StringParser
    const command = sp.getWord(); // Get command
    if (command == null) continue; // check null command

    switch (command) {
      case '#':
        continue; // Skip comments
      case 'newmtl': // Read Material chunk
        name = mtl.parseNewmtl(sp); // Get name
        continue; // Go to the next line
      case 'Kd': // Read diffuse color coefficient as color
        if (name == "") continue; // Go to the next line because of Error
        const material = mtl.parseRGB(sp, name);
        mtl.materials.push(material);
        name = "";
        continue; // Go to the next line
    }
  }
  mtl.complete = true;
}

//------------------------------------------------------------------------------
// Material Object
//------------------------------------------------------------------------------

class Material {
  name: string;
  color: Color;

  constructor(name: string, r: number, g: number, b: number, a: number) {
    this.name = name;
    this.color = new Color(r, g, b, a);
  }
}

//------------------------------------------------------------------------------
// Vertex Object
//------------------------------------------------------------------------------

class Vertex {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

//------------------------------------------------------------------------------
// Normal Object
//------------------------------------------------------------------------------

class Normal {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

//------------------------------------------------------------------------------
// Color Object
//------------------------------------------------------------------------------

class Color {
  r: number;
  g: number;
  b: number;
  a: number;

  constructor(r: number, g: number, b: number, a: number) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
}

//------------------------------------------------------------------------------
// OBJObject Object
//------------------------------------------------------------------------------

class OBJObject {
  name: string;
  faces: Face[];
  numIndices: number;

  constructor(name: string) {
    this.name = name;
    this.faces = [];
    this.numIndices = 0;
  }

  addFace(face: Face): void {
    this.faces.push(face);
    this.numIndices += face.numIndices;
  }
}

//------------------------------------------------------------------------------
// Face Object
//------------------------------------------------------------------------------

class Face {
  materialName: string;
  vIndices: number[];
  nIndices: number[];
  normal: Normal;
  numIndices: number;

  constructor(materialName: string) {
    this.materialName = materialName == null ? "" : materialName;
    this.vIndices = [];
    this.nIndices = [];
    this.normal = new Normal(0, 0, 0);
    this.numIndices = 0;
  }
}

//------------------------------------------------------------------------------
// DrawInfo Object
//------------------------------------------------------------------------------

class DrawingInfo implements DrawingInfoInterface {
  vertices: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;

  constructor(
    vertices: Float32Array,
    normals: Float32Array,
    colors: Float32Array,
    indices: Uint32Array
  ) {
    this.vertices = vertices;
    this.normals = normals;
    this.colors = colors;
    this.indices = indices;
  }
}

//------------------------------------------------------------------------------
// StringParser Object
//------------------------------------------------------------------------------

class StringParser {
  str: string;
  index: number;

  constructor(str: string = "") {
    this.str = str;
    this.index = 0;
    this.init(str);
  }

  // Initialize StringParser object
  init(str: string): void {
    this.str = str;
    this.index = 0;
  }

  // Skip delimiters
  skipDelimiters(): void {
    let i: number;
    for (i = this.index; i < this.str.length; i++) {
      const c = this.str.charAt(i);
      // Skip TAB, Space, '(', ')'
      if (c == '\t' || c == ' ' || c == '(' || c == ')' || c == '"') continue;
      break;
    }
    this.index = i;
  }

  // Skip to the next word
  skipToNextWord(): void {
    this.skipDelimiters();
    const n = getWordLength(this.str, this.index);
    this.index += n + 1;
  }

  // Get word
  getWord(): string | null {
    this.skipDelimiters();
    const n = getWordLength(this.str, this.index);
    if (n == 0) return null;
    const word = this.str.substr(this.index, n);
    this.index += n + 1;

    return word;
  }

  // Get integer
  getInt(): number {
    return parseInt(this.getWord() || "0");
  }

  // Get floating number
  getFloat(): number {
    return parseFloat(this.getWord() || "0");
  }
}

// Get the length of word
function getWordLength(str: string, start: number): number {
  let i: number;
  for (i = start; i < str.length; i++) {
    const c = str.charAt(i);
    if (c == '\t' || c == ' ' || c == '(' || c == ')' || c == '"') break;
  }
  return i - start;
}

//------------------------------------------------------------------------------
// Common function
//------------------------------------------------------------------------------

function calcNormal(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number]
): [number, number, number] | null {
  // v0: a vector from p1 to p0, v1; a vector from p1 to p2
  const v0 = new Float32Array(3);
  const v1 = new Float32Array(3);
  for (let i = 0; i < 3; i++) {
    v0[i] = p0[i] - p1[i];
    v1[i] = p2[i] - p1[i];
  }

  // The cross product of v0 and v1
  const c = new Float32Array(3);
  c[0] = v0[1] * v1[2] - v0[2] * v1[1];
  c[1] = v0[2] * v1[0] - v0[0] * v1[2];
  c[2] = v0[0] * v1[1] - v0[1] * v1[0];

  const x = c[0],
    y = c[1],
    z = c[2];
  let g = Math.sqrt(x * x + y * y + z * z);
  if (g) {
    if (g == 1) return [c[0], c[1], c[2]];
  } else {
    c[0] = 0;
    c[1] = 0;
    c[2] = 0;
    return [0, 0, 0];
  }
  g = 1 / g;
  c[0] = x * g;
  c[1] = y * g;
  c[2] = z * g;
  return [c[0], c[1], c[2]];
}
