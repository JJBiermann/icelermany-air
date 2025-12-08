import { sizeof, type Mat } from "./utils/MV";
import type { Vec } from "./utils/MV";
import shader from "./shader/shaders.wgsl";
import { readOBJFile } from "./utils/OBJParser.ts";
import { Renderer } from "./renderer.ts";
import { scalem, flatten, lookAt, vec3, perspective, mult, translate, rotateX, mat4, rotateY, rotateZ, rotate, printm, vec4, add, inverse, normalize, cross, subtract, scale, dot } from "./utils/MV";
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
let planeX = 25;
let planeY = 0;
let planeZ = 0;
let lat = 0;
let lon = 0;
let Y = 0;
let planeXRotation = mat4();
let planeZRotation = mat4();
let planeYRotation = mat4();
let planeTranslation = translate(planeX, planeY, planeZ);
let planeM = planeTranslation;

/*
var eye = vec4(0, planeY, planeZ - 30, 1);      // eye is a point
var lookat = vec4(planeX, planeY, planeZ, 1);     // lookat is a point  -> eye - point --> Direction looking at
var up = vec4(0, 1, 0, 0);
//let view = lookAt(eye, lookat, up);

let eyeWorld = mult(mult(planeXRotation, planeTranslation), eye);
let lookAtWorld = mult(mult(planeXRotation, planeTranslation), lookat);
let upWorld = mult(mult(planeXRotation, planeTranslation), up);

let view = lookAt(
    vec3(eyeWorld[0], eyeWorld[1], eyeWorld[2]),
    vec3(lookAtWorld[0], lookAtWorld[1], lookAtWorld[2]),
    vec3(upWorld[0], upWorld[1], upWorld[2])
);
*/

var eye = vec3(0, 0, -80);
var lookat = vec3(0, 0, 0);
var up = vec3(0, 1, 0);

var view = lookAt(eye, lookat, up);


async function main() {
    const renderer: Renderer = new Renderer({
        shaderCode: shader,
        is3DRenderer: true,
        uniformBufferSize: 256,
    });

    await renderer.init();

    const device = renderer.getDevice();

    const toggleLightBtn = document.getElementById('toggle-circle-light') as HTMLButtonElement | null;
    let lightSpinEnabled = true;
    toggleLightBtn?.addEventListener('click', () => {
        lightSpinEnabled = renderer.toggleLightSpin();
        if (toggleLightBtn) {
            toggleLightBtn.textContent = lightSpinEnabled ? 'Circle light on (spinning)' : 'Circle light off (paused)';
        }
    });

    async function loadTexture(url: string): Promise<GPUTexture> {
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`Failed to load texture ${url}: ${res.status}`);
            throw new Error(`Texture load failed: ${url}`);
        }
        const blob = await res.blob();
        const imageBitmap = await createImageBitmap(blob);
        const texture = device.createTexture({
            size: [imageBitmap.width, imageBitmap.height, 1],
            format: 'rgba8unorm',
            // RenderAttachment is required by Dawn for copyExternalImageToTexture on some platforms
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture }, [imageBitmap.width, imageBitmap.height]);
        console.log(`Loaded texture ${url} (${imageBitmap.width}x${imageBitmap.height})`);
        return texture;
    }

    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        addressModeU: 'repeat',
        addressModeV: 'clamp-to-edge',
    });

    // 1x1 white fallback texture for meshes without textures
    const whiteTexture = device.createTexture({
        size: [1, 1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture(
        { texture: whiteTexture },
        new Uint8Array([255, 255, 255, 255]),
        { bytesPerRow: 4 },
        [1, 1, 1]
    );
    const whiteView = whiteTexture.createView();

    // Texture for earth; file should be placed at public/textures/earth.jpg
    let earthView = whiteView;
    try {
        const earthTexture = await loadTexture('/textures/earth.jpg');
        earthView = earthTexture.createView();
    } catch (err) {
        console.warn('Falling back to white texture for earth because load failed', err);
    }

    // NDC coordinates in WebGPU are in [-1,1]x[-1,1]x[0,1]




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
    const sphere = generateSphere(20, 32, 64);

    const pipeline = renderer.getPipeline();


    console.log(planeData!.colors)
    let rightElevator: RenderNode = new RenderNode(rightE, Array.from(rightElevatorData!.vertices), Array.from(rightElevatorData!.indices), Array.from(rightElevatorData!.normals), Array.from(rightElevatorData!.colors), null, null, null, device, pipeline, sampler, whiteView);
    let leftElevator: RenderNode = new RenderNode(leftE, Array.from(leftElevatorData!.vertices), Array.from(leftElevatorData!.indices), Array.from(leftElevatorData!.normals), Array.from(leftElevatorData!.colors), null, rightElevator, null, device, pipeline, sampler, whiteView);
    let rightAileron: RenderNode = new RenderNode(left, Array.from(rightAileronData!.vertices), Array.from(rightAileronData!.indices), Array.from(rightAileronData!.normals), Array.from(rightAileronData!.colors), null, leftElevator, null, device, pipeline, sampler, whiteView);
    let leftAileron: RenderNode = new RenderNode(right, Array.from(leftAileronData!.vertices), Array.from(leftAileronData!.indices), Array.from(leftAileronData!.normals), Array.from(leftAileronData!.colors), null, rightAileron, null, device, pipeline, sampler, whiteView);
    let rudder: RenderNode = new RenderNode(rudderM, Array.from(rudderData!.vertices), Array.from(rudderData!.indices), Array.from(rudderData!.normals), Array.from(rudderData!.colors), null, leftAileron, null, device, pipeline, sampler, whiteView);
    let planeNode: RenderNode = new RenderNode(planeM, Array.from(planeData!.vertices), Array.from(planeData!.indices), Array.from(planeData!.normals), Array.from(planeData!.colors), null, null, rudder, device, pipeline, sampler, whiteView);
    // Sphere is a sibling of the plane; terminate its sibling to avoid cycles
    // Move sphere below the plane (e.g., y = -20) so plane flies above it
    let sphereNode: RenderNode = new RenderNode(mat4(), Array.from(sphere.positions), Array.from(sphere.indices), Array.from(sphere.normals), Array.from(sphere.colors), Array.from(sphere.uvs), null, null, device, pipeline, sampler, earthView);
    planeNode.sibling = sphereNode;

    let angle = 0;
    let change = 0;
    requestAnimationFrame(animate);

    let lastTime = performance.now();
    function animate(time: number) {

        const dt = (time - lastTime) / 1000; // seconds
        lastTime = time;

        change += 0.02;
        angle = 45 * Math.cos(change);
        update(dt);
        /*
        TODO: THIS IS STILL NEEDED
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
        */
        planeNode.udpateModelMatrix(planeM);

        renderer.renderHierarchy(planeNode, mat4(), view, projection);

        requestAnimationFrame(animate);
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

    let theta = 0;
    let phi = 0;
    let speed = Math.PI / (100 * 3.14)
    Y = 90;
    let alpha = 0
    let deltaAlpha = 0
    let planePos = vec3(0, 25, 0)
    let r = 23;
    phi = 0
    theta = 0;
    function update(dt: number) {

        let x = Math.sin(theta) * Math.cos(phi) * r;
        let y = Math.cos(theta) * r;
        let z = Math.sin(theta) * Math.sin(phi) * r;



        // planeM = mult(rotateX(-0.5 * (1 - Math.abs(Y / 90))), planeM);
        // planeM = mult(rotateZ(-0.5 * Y / 90), planeM);
        planeM = translate(x, y, z);
        // planeM = mult(rotateZ(x), planeM);
        //printm(planeM);
        //planeM = mult(rotateZ(phi*0.5), planeM);

        //planeM = mult(rotateX(dt * -speed * Math.cos(lon) * Math.cos(lat)), planeM);
        //planeM = mult(rotateZ(dt * -speed * Math.cos(lat) * Math.sin(lon)), planeM);
    }


    /*
    let tiltChange = 5;
    window.addEventListener("keydown", (e) => {
        switch (e.key) {
            case "ArrowLeft":
                // move left in x
                tilt = Math.min(90, tilt + tiltChange);
                dx = Math.min(1, tilt * 1 / 45);
                planeZRotation = rotateZ(tilt);
                planeYRotation = rotateY(-tilt / 2)
                break;
            case "ArrowRight":
                tilt = Math.max(-90, tilt - tiltChange);
                dx = Math.max(-1, tilt * 1 / 45);
                planeZRotation = rotateZ(tilt);
                planeYRotation = rotateY(-tilt / 2)
                break;
            case "ArrowUp":
                dy += moveStep * 2; // move up in y
                break;
            case "ArrowDown":
                dy -= moveStep * 2; // move down in y
                break;
        }
    });*/




    window.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") {
            deltaAlpha += Math.PI/90;
            let deltaPhi = 0
            let deltaTheta = 0
            deltaPhi = Math.sin(alpha + deltaAlpha) - Math.sin(alpha) 
            deltaTheta = Math.cos(alpha + deltaAlpha) - Math.cos(alpha) 
            phi += deltaPhi
            theta += deltaTheta
            alpha += deltaAlpha
            // console.log("alpha: ", alpha);
            // let deltaPhi = Math.sin(alpha); 
            // phi += deltaPhi;

            // let deltaTheta = Math.cos(alpha);
            // theta += deltaTheta;
        }
        if (e.key === "ArrowRight") {
            deltaAlpha -= Math.PI/90;
            let deltaPhi = 0
            let deltaTheta = 0
            deltaPhi = Math.sin(alpha + deltaAlpha) - Math.sin(alpha) 
            deltaTheta = Math.cos(alpha + deltaAlpha) - Math.cos(alpha) 
            // deltaTheta = Math.cos(deltaAlpha)
            phi += deltaPhi
            theta += deltaTheta
            alpha += deltaAlpha
            //phi -= Math.PI/24;
            // console.log("alpha: ", alpha);
            // let deltaPhi = Math.sin(alpha); 
            // phi += deltaPhi;

            // let deltaTheta = Math.cos(alpha);
            // theta += deltaTheta;
        }

        /*
        if (e.key === "ArrowUp") {
            theta -= Math.PI/24;
        }

        if (e.key === "ArrowDown") {
            theta += Math.PI/24
        }
        */
    });

    window.addEventListener("keyup", (e) => {
        if (e.key === "ArrowLeft") {
        }

        if (e.key === "ArrowRight") {

        }
    })
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
    const uvs: number[] = [];
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

            // Use neutral white so texture colors stay untainted
            colors.push(1.0, 1.0, 1.0, 1.0);

            // UVs: longitude -> u, latitude -> v
            const u = phi / (2 * Math.PI);
            const v = 1.0 - (theta / Math.PI);
            uvs.push(u, v);
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
    return { positions, indices, normals, colors, uvs };
}

function transformVec3(m: any, v: any) {
    return vec3(
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
    );
}

/* 
P = current plane position
N = sphere normal at P
F = direction the plane wants to fly (e.g., local forward vector)
speed = movement speed
dt = timestep
R = sphere radius
*/

function moveOnSphere(P: Vec, F: Vec, R: number, dt: number, speed: number): Vec {
    const N = normalize(P);                   // sphere normal
    let T = subtract(F, scale(dot(F, N), N)); // tangent direction
    T = normalize(T);

    let Pnew = add(P, scale(speed * dt, T));  // move slightly
    Pnew = scale(R, normalize(Pnew));         // reproject to sphere
    console.log("Pnew!", Pnew)
    return Pnew;
}
