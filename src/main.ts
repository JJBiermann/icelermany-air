import { sizeof } from "./utils/MV";
import shader from "./shader/shaders.wgsl";
import { readOBJFile } from "./utils/OBJParser.ts";
import { Renderer } from "./renderer.ts";
import { scalem, flatten, lookAt, vec3, perspective, mult, translate } from "./utils/MV";


window.onload = (_) => { main(); };

async function main() {
    const renderer: Renderer = new Renderer({
        shaderCode: shader,
        is3DRenderer: true,
        uniformBufferSize: 240,
    });

    await renderer.init();

    // Create identity matrices for model, view, and projection
    const identity = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];

    const cubeVertices = [
        -0.25, 0, -0.25,  //left back down
        -0.25, 0, 0.25,   //right back down    
        0.25, 0, -0.25,   //left front down    
        0.25, 0, 0.25,   //right front down    
    ]

    const indices = [
        0, 1, 3, // left back -> right back -> right front
        3, 2, 0, // right front -> left front -> back left
    ]

    // NDC coordinates in WebGPU are in [-1,1]x[-1,1]x[0,1]
    var eye = vec3(0, 0, 2);      // eye is a point
    var lookat = vec3(0, 0, 0);     // lookat is a point  -> eye - point --> Direction looking at
    var up = vec3(0, 1, 0);
    let view = lookAt(eye, lookat, up);

    // After: keep a mutable translation
    let tx = 0;
    let ty = 0;
    let tz = 0;
    let modelMatrix = mult(translate(tx, ty, tz), scalem(0.25, 0.25, 0.25));

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
        10_000,
        1.0,
        0.7,
    ]);



    renderer.updateUniformBuffer(Array.from(uniformData));

    // Load OBJ file
    const objData = await readOBJFile("../../../blender-models/proto-plane.obj", 0.25);
    console.log(objData);
    console.log(objData?.vertices);
    if (objData) {
        renderer.updatePositionBuffer(Array.from(objData.vertices));
        console.log("vertices: ", objData.vertices);
        renderer.updateColorBuffer(Array.from(objData.colors));
        renderer.updateIndicesBuffer(Array.from(objData.indices));
        renderer.updateNormals(Array.from(objData.normals));
        // also need to render the normals objData.normals
        renderer.render(objData.indices.length);
    }

    const moveStep = 0.1; // how much to move per key press

    let egoPerspective = false;
    window.addEventListener("keydown", (event: KeyboardEvent) => {
        let moved = false;

        switch (event.key) {
            case "ArrowLeft":
                tx -= moveStep; // move left in x
                moved = true;
                break;
            case "ArrowRight":
                tx += moveStep; // move right in x
                moved = true;
                break;
            case "ArrowUp":
                ty += moveStep; // move up in y
                moved = true;
                break;
            case "ArrowDown":
                ty -= moveStep; // move down in y
                moved = true;
                break;
            case "p":
                console.log("perspective change!");
                if (!egoPerspective) {
                    // change perspective into ego
                    eye = vec3(-2, 1, 0);      // eye is a point
                    lookat = vec3(0, 0, 0);     // lookat is a point  -> eye - point --> Direction looking at
                    up = vec3(0, 1, 0);
                    view = lookAt(eye, lookat, up);
                } else {
                    eye = vec3(0, 0, 2);      // eye is a point
                    lookat = vec3(0, 0, 0);     // lookat is a point  -> eye - point --> Direction looking at
                    up = vec3(0, 1, 0);
                    view = lookAt(eye, lookat, up);

                }
                egoPerspective = !egoPerspective;
                moved = true;
                break;
        }

        if (moved) {
            // Recompute model matrix
            const scale = scalem(0.25, 0.25, 0.25);
            modelMatrix = mult(translate(tx, ty, tz), scale);

            // Rebuild uniform data with the new model matrix
            const updatedUniformData = new Float32Array([
                ...Array.from(flatten(modelMatrix)),   // updated model
                ...Array.from(flatten(view)),          // existing view
                ...Array.from(flatten(projection)),    // existing proj
                ...vec3(-1, -2, -1),
                0.0,
                ...vec3(1, 1, 1),
                1.0,
                1.0,
                10_000,
                1.0,
                0.7,
            ]);

            renderer.updateUniformBuffer(Array.from(updatedUniformData));

            // Re-render with the same index count
            if (objData) {
                renderer.render(objData.indices.length);
            }
        }
    });
}


