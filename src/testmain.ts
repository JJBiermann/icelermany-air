import { mat4, sizeof } from "./utils/MV";
import shader from "./shader/planeShaders.wgsl";
import { readOBJFile } from "./utils/OBJParser.ts";
import { Renderer } from "./renderer.ts";
import { scalem, flatten, lookAt, vec3, perspective, mult, translate } from "./utils/MV";
import { RenderNode } from "./node.ts";


window.onload = (_) => { main(); };

async function main() {
    const renderer: Renderer = new Renderer({
        shaderCode: shader,
        is3DRenderer: true,
        uniformBufferSize: 240,
    });

    await renderer.init();

    const cubeVertices = [
        -0.25, 0, -0.25,  //left back down
        -0.25, 0, 0.25,   //right back down    
        0.25, 0, -0.25,   //left front down    
        0.25, 0, 0.25,   //right front down    
    ]

    const childVertices = [
  -0.1, 0.5, -0.1,
  -0.1, 0.5,  0.1,
   0.1, 0.5, -0.1,
   0.1, 0.5,  0.1,
];

    const indices = [
        0, 1, 2, // left back -> right back -> right front
        3, 2, 1, // right front -> left front -> back left
    ]

    // NDC coordinates in WebGPU are in [-1,1]x[-1,1]x[0,1]
    var eye = vec3(0, 1, 2);      // eye is a point
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

    const uniformData = new Float32Array([
        ...Array.from(flatten(modelMatrix)), // model matrix
        ...Array.from(flatten(view)), // view matrix
        ...Array.from(flatten(projection)), // proj matrix
    ]);

    let dev = renderer.getDevice();
    let pipeline = renderer.getPipeline();

    // one position offset = 12 bytes => 12 * 6 = 72 bytes => 72
    let childNode = new RenderNode(translate(0.5, 0, 0), childVertices, indices, null, null, dev, pipeline)
    let rootNode = new RenderNode(translate(-0.5, -0.5, 0), cubeVertices, indices, null, childNode, dev, pipeline);
    renderer.renderHierarchy(rootNode, mat4(), view, projection);

    rootNode.udpateModelMatrix(translate(0, 0, 0));
    renderer.renderHierarchy(rootNode, mat4(), view, projection);
    /*
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
            renderer.render(objData.indices.length);
        }
    });*/
}


