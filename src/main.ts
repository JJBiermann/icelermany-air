import { sizeof } from "./utils/MV";
import shader from "./shader/shaders.wgsl";
import { readOBJFile } from "./utils/OBJParser.ts";
import { Renderer } from "./renderer.ts";
import { scalem, flatten, lookAt, vec3, perspective, mult, translate } from "./utils/MV";


window.onload = (_) => {main();};

async function main() {
    const renderer: Renderer = new Renderer({
        shaderCode: shader,
        is3DRenderer: true,
        uniformBufferSize: 240,
        useBindGroup: true,
        useColorBuffer: true,
        useUniformBuffer: true,
        useIndicesBuffer: true,
    });

    await renderer.init();

    // Create identity matrices for model, view, and projection
    const identity = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];

         // NDC coordinates in WebGPU are in [-1,1]x[-1,1]x[0,1]
    var eye = vec3(0, 0, 2);      // eye is a point
    var lookat = vec3(0, 0, 0);     // lookat is a point  -> eye - point --> Direction looking at
    var up = vec3(0, 1, 0);
    const view = lookAt(eye, lookat, up);

    const modelMatrix = mult(translate(0, -1, -3), scalem(0.25, 0.25, 0.25));

    // Pinhole camera with 45° vertical FOV
    const fovy = 45;       // degrees (MV.js-style perspective usually expects degrees)
    const near = 0.1;
    const far = 100.0;    
    const projection = perspective(fovy, 1, near, far);

    /*
    light_direction: vec3f,
    light_color: vec3f,
    k_d_factor: f32,
    k_s_factor: f32,
    s: f32,
    L_e_factor: f32,
    // NOTE: same as L_i
    L_a_factor: f32,
    */
    const uniformData = new Float32Array([
        ...Array.from(flatten(modelMatrix)), // model matrix
        ...Array.from(flatten(view)), // view matrix
        ...Array.from(flatten(projection)), // proj matrix
        ...vec3(-1, -2, -1),
        0.0,
        ...vec3(1, 1, 1),
        1.0, 
        1.0, 
        20, 
        1.0, 
        0.7,
    ]);


    
    renderer.updateUniformBuffer(Array.from(uniformData));

    // Load OBJ file
    const objData = await readOBJFile("../../../teapot/teapot.obj");
    console.log(objData?.normals);
    if (objData) {
        renderer.updatePositionBuffer(Array.from(objData.vertices));
        renderer.updateColorBuffer(Array.from(objData.colors));
        renderer.updateIndicesBuffer(Array.from(objData.indices));
        renderer.updateNormals(Array.from(objData.normals));
        // also need to render the normals objData.normals
        renderer.render(objData.indices.length);
    }

    console.log("Hello World");
}


