import { sizeof, type Mat } from "./utils/MV";
import shader from "./shader/shaders.wgsl";
import { readOBJFile } from "./utils/OBJParser.ts";
import { Renderer } from "./renderer.ts";
import { scalem, flatten, lookAt, vec3, perspective, mult, translate, rotateX, mat4, rotateY, rotateZ, rotate } from "./utils/MV";
import { RenderNode } from "./node.ts";


window.onload = (_) => { main(); };


// move to center -> rotate -> move back
// coordinates in Blender (x=2.0, y=0.54629, z=0) => (x=2.0, 0, -0.6)
const leftAileronTransform = vec3(2.0116, 0.042162, -0.54629);
const rightAileronTransform = vec3(-2.0031, 0.044753, -0.54652);
const leftElevatorTransform = vec3(1.0151, 0.048431, -4.0851);
const rightElevatorTransform = vec3(-1.0459, 0.047272, -4.0859);
const rudderTransform = vec3(0.009496, 0.59494, -4.2548);


// Model matrices for each part
let left = mat4();
let right = mat4();
let leftE = mat4();
let rightE = mat4();
let rudderM = mat4();
let planeM = mat4();

var eye = vec3(0, 15, -30);      // eye is a point
var lookat = vec3(0, 0, 0);     // lookat is a point  -> eye - point --> Direction looking at
var up = vec3(0, 1, 0);
let view = lookAt(eye, lookat, up);

async function main() {
    const renderer: Renderer = new Renderer({
        shaderCode: shader,
        is3DRenderer: true,
        uniformBufferSize: 256,
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


    // After: keep a mutable translation
    let tx = 0;
    let ty = 0;
    let tz = 0;


    //let modelMatrix: Mat = mult(translate(0, 0, 0), );
    //let modelMatrix = mult(translate(leftAileronTransform[0], -leftAileronTransform[1], leftAileronTransform[2]),mult(rotateX(0), translate(-leftAileronTransform[0], leftAileronTransform[1], -leftAileronTransform[2]))); //translate(-2.0116, 0.042162, +0.54629))
    // Pinhole camera with 45° vertical FOV
    const fovy = 45;       // degrees (MV.js-style perspective usually expects degrees)
    const near = 0.1;
    const far = 100.0;
    const projection = perspective(fovy, 1, near, far);


    // Load OBJ file
    const planeData = await readOBJFile("../../../blender-models/plane-parts/planebody.obj");
    const leftAileronData = await readOBJFile("../../../blender-models/plane-parts/leftaileron.obj");
    const rightAileronData = await readOBJFile("../../../blender-models/plane-parts/rightaileron.obj");
    const leftElevatorData = await readOBJFile("../../../blender-models/plane-parts/leftelevator.obj");
    const rightElevatorData = await readOBJFile("../../../blender-models/plane-parts/rightelevator.obj");
    const rudderData = await readOBJFile("../../../blender-models/plane-parts/rudder.obj");


    // create the sphere with radius 15, 32 stacks and 64 slices
    const sphere = generateSphere(50, 32, 64);

    const dev = renderer.getDevice();
    const pipeline = renderer.getPipeline();


    console.log(planeData!.colors)
    let rightElevator: RenderNode = new RenderNode(rightE, Array.from(rightElevatorData!.vertices), Array.from(rightElevatorData!.indices), Array.from(rightElevatorData!.normals), Array.from(rightElevatorData!.colors), null, null, dev, pipeline);
    let leftElevator: RenderNode = new RenderNode(leftE, Array.from(leftElevatorData!.vertices), Array.from(leftElevatorData!.indices), Array.from(leftElevatorData!.normals), Array.from(leftElevatorData!.colors), rightElevator, null, dev, pipeline);
    let rightAileron: RenderNode = new RenderNode(left, Array.from(rightAileronData!.vertices), Array.from(rightAileronData!.indices), Array.from(rightAileronData!.normals), Array.from(rightAileronData!.colors), leftElevator, null, dev, pipeline);
    let leftAileron: RenderNode = new RenderNode(right, Array.from(leftAileronData!.vertices), Array.from(leftAileronData!.indices), Array.from(leftAileronData!.normals), Array.from(leftAileronData!.colors), rightAileron, null, dev, pipeline);
    let rudder: RenderNode = new RenderNode(rudderM, Array.from(rudderData!.vertices), Array.from(rudderData!.indices), Array.from(rudderData!.normals), Array.from(rudderData!.colors), leftAileron, null, dev, pipeline);
    let planeNode: RenderNode = new RenderNode(planeM, Array.from(planeData!.vertices), Array.from(planeData!.indices), Array.from(planeData!.normals), Array.from(planeData!.colors), null, rudder, dev, pipeline);
    // Sphere is a sibling of the plane; terminate its sibling to avoid cycles
    // Move sphere below the plane (e.g., y = -20) so plane flies above it
        let sphereM = translate(0, -60, 40);
    let sphereNode: RenderNode = new RenderNode(sphereM, Array.from(sphere.positions), Array.from(sphere.indices), Array.from(sphere.normals), Array.from(sphere.colors), null, null, dev, pipeline);
    planeNode.sibling = sphereNode;

    let angle = 0;
    let change = 0;
    update();
    function update() {
        change += 0.02;
        angle = 45 * Math.cos(change);

        let { l, r, lE, rE } = tiltAileronsAndElevators(angle);
        left = l;
        right = r;
        leftE = lE;
        rightE = rE;
        rudderM = tiltRudder(angle);
        
        leftAileron.udpateModelMatrix(left);
        rightAileron.udpateModelMatrix(right);
        leftElevator.udpateModelMatrix(leftE);
        rightElevator.udpateModelMatrix(rightE);
        rudder.udpateModelMatrix(rudderM);
        planeNode.udpateModelMatrix(planeM);
        // Spin the sphere slowly around Y and have it little bit down 
            
            sphereM = mult(translate(0, -70, 40), rotateX(change * 20));
        sphereNode.udpateModelMatrix(sphereM);
        renderer.renderHierarchy(planeNode, mat4(), view, projection);

        requestAnimationFrame(update)
    }


    /*
    renderer.updateUniformBuffer(Array.from(coolUniformData));
    if (objData) {
        renderer.updatePositionBuffer(Array.from(objData.vertices));
        //console.log("vertices: ", objData.vertices);
        renderer.updateColorBuffer(Array.from(objData.colors));
        renderer.updateIndicesBuffer(Array.from(objData.indices));
        renderer.updateNormals(Array.from(objData.normals));
        // also need to render the normals objData.normals
        renderer.render(objData.indices.length);
    }
    */

    const moveStep = 1; // how much to move per key press

    window.addEventListener("keydown", (event: KeyboardEvent) => {
        let moved = false;

        switch (event.key) {
            case "ArrowLeft":
                tx += moveStep * 2; // move left in x
                moved = true
                break;
            case "ArrowRight":
                tx -= moveStep * 2; // move right in x
                moved = true
                break;
            case "ArrowUp":
                ty += moveStep * 2; // move up in y
                moved = true
                break;
            case "ArrowDown":
                ty -= moveStep * 2; // move down in y
                moved = true
                break;
        }

        if (moved) {
            planeM = mult(rotateZ(tx), rotateX(ty));

        }
    });
}


function tiltAileronsAndElevators(degrees: number): { l: Mat, r: Mat, lE: Mat, rE: Mat } {

    let leftAileronTilt = mult(translate(leftAileronTransform[0], -leftAileronTransform[1], leftAileronTransform[2]), mult(rotateX(degrees), translate(-leftAileronTransform[0], leftAileronTransform[1], -leftAileronTransform[2])))
    let rightAileronTilt = mult(translate(rightAileronTransform[0], -rightAileronTransform[1], rightAileronTransform[2]), mult(rotateX(degrees), translate(-rightAileronTransform[0], rightAileronTransform[1], -rightAileronTransform[2])))
    let leftElevatorTilt = mult(translate(leftElevatorTransform[0], -leftElevatorTransform[1], leftElevatorTransform[2]), mult(rotateX(degrees), translate(-leftElevatorTransform[0], leftElevatorTransform[1], -leftElevatorTransform[2])))
    let rightElevatorTilt = mult(translate(rightElevatorTransform[0], -rightElevatorTransform[1], rightElevatorTransform[2]), mult(rotateX(degrees), translate(-rightElevatorTransform[0], rightElevatorTransform[1], -rightElevatorTransform[2])))
    return {
        l: leftAileronTilt,
        r: rightAileronTilt,
        lE: leftElevatorTilt,
        rE: rightElevatorTilt
    }
}

function tiltRudder(degrees: number): Mat {
    return mult(translate(rudderTransform[0], -rudderTransform[1], rudderTransform[2]), mult(rotateY(degrees), translate(-rudderTransform[0], rudderTransform[1], -rudderTransform[2])));
}


// Generates a UV-sphere with positions/normals/colors/indices ready for RenderNode (vec4 entries)
function generateSphere(radius: number = 10, stacks: number = 32, slices: number = 64) {
    const positions: number[] = []; // vec4 (x,y,z,1)
    const normals: number[] = [];   // vec4 (nx,ny,nz,0)
    const colors: number[] = [];    // vec4 (r,g,b,1)
    const indices: number[] = [];

    for (let stack = 0; stack <= stacks; stack++) {
        const theta = Math.PI * (stack / stacks);       // 0..PI
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let slice = 0; slice <= slices; slice++) {
            const phi = 2 * Math.PI * (slice / slices); // 0..2PI
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            // Unit sphere position
            const x = sinTheta * cosPhi;
            const y = cosTheta;
            const z = sinTheta * sinPhi;

            // Scale to radius
            const px = radius * x;
            const py = radius * y;
            const pz = radius * z;

            // Position vec4
            positions.push(px, py, pz, 1.0);

            // Normal vec4 (unit length; w=0)
            normals.push(x, y, z, 0.0);

            // Simple color gradient based on latitude/longitude
            const r = 0.5 * (x + 1.0);
            const g = 0.5 * (y + 1.0);
            const b = 0.5 * (z + 1.0);
            colors.push(r, g, b, 1.0);
        }
    }

    // Build triangle indices
    const stride = slices + 1;
    for (let stack = 0; stack < stacks; stack++) {
        for (let slice = 0; slice < slices; slice++) {
            const first = stack * stride + slice;
            const second = first + stride;

            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    // Return in the order that matches RenderNode ctor: vertices, indices, normals, colors
    return { positions, indices, normals, colors };
}