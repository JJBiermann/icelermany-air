import  type { Mat } from "./utils/MV";
import type { Vec } from "./utils/MV";
import shader from "./shader/shaders.wgsl";
import { readOBJFile } from "./utils/OBJParser.ts";
import { Renderer } from "./renderer.ts";
import { scalem, lookAt, vec3, perspective, mult, translate, rotateX, mat4, rotateY, rotateZ, vec4, add} from "./utils/MV";
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
let planeX = 0;
let planeY = 25;
let planeZ = 0;
let planeTranslation = translate(planeX, planeY, planeZ);
let planeM = mult(planeTranslation, rotateX(90));


var eye = vec3(0, -4, -50);
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
        const earthTexture = await loadTexture(`${import.meta.env.BASE_URL}/textures/earth.jpg`);
        earthView = earthTexture.createView();
    } catch (err) {
        console.warn('Falling back to white texture for earth because load failed', err);
    }

    //let modelMatrix: Mat = mult(translate(0, 0, 0), );
    //let modelMatrix = mult(translate(leftAileronTransform[0], -leftAileronTransform[1], leftAileronTransform[2]),mult(rotateX(0), translate(-leftAileronTransform[0], leftAileronTransform[1], -leftAileronTransform[2]))); //translate(-2.0116, 0.042162, +0.54629))
    // Pinhole camera with 45° vertical FOV
    const fovy = 80;       // degrees (MV.js-style perspective usually expects degrees)
    const near = 0.1;
    const far = 100.0;
    let projection = perspective(fovy, 1, near, far);

    function onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.resize(w, h);
        const aspect = w / h;
        projection = perspective(fovy, aspect, near, far);
    }
    window.addEventListener('resize', onResize);
    onResize(); // Initial call to set full screen

    // Load OBJ file
    const planeData = await readOBJFile(`${import.meta.env.BASE_URL}/blender-models/plane-parts/planebody.obj`);
    const leftAileronData = await readOBJFile(`${import.meta.env.BASE_URL}/blender-models/plane-parts/leftaileron.obj`);
    const rightAileronData = await readOBJFile(`${import.meta.env.BASE_URL}/blender-models/plane-parts/rightaileron.obj`);
    const leftElevatorData = await readOBJFile(`${import.meta.env.BASE_URL}/blender-models/plane-parts/leftelevator.obj`);
    const rightElevatorData = await readOBJFile(`${import.meta.env.BASE_URL}/blender-models/plane-parts/rightelevator.obj`);
    const rudderData = await readOBJFile(`${import.meta.env.BASE_URL}/blender-models/plane-parts/rudder.obj`);


    // create the sphere with radius 15, 32 stacks and 64 slices
    const sphereRadius = 20;
    const sphere = generateSphere(sphereRadius, 128, 256);

    const pipeline = renderer.getPipeline();


    console.log(planeData!.colors)
    let rightElevator: RenderNode = new RenderNode(rightE, Array.from(rightElevatorData!.vertices), Array.from(rightElevatorData!.indices), Array.from(rightElevatorData!.normals), Array.from(rightElevatorData!.colors), null, null, null, device, pipeline, sampler, whiteView);
    let leftElevator: RenderNode = new RenderNode(leftE, Array.from(leftElevatorData!.vertices), Array.from(leftElevatorData!.indices), Array.from(leftElevatorData!.normals), Array.from(leftElevatorData!.colors), null, rightElevator, null, device, pipeline, sampler, whiteView);
    let rightAileron: RenderNode = new RenderNode(right, Array.from(rightAileronData!.vertices), Array.from(rightAileronData!.indices), Array.from(rightAileronData!.normals), Array.from(rightAileronData!.colors), null, leftElevator, null, device, pipeline, sampler, whiteView);
    let leftAileron: RenderNode = new RenderNode(left, Array.from(leftAileronData!.vertices), Array.from(leftAileronData!.indices), Array.from(leftAileronData!.normals), Array.from(leftAileronData!.colors), null, rightAileron, null, device, pipeline, sampler, whiteView);
    let rudder: RenderNode = new RenderNode(rudderM, Array.from(rudderData!.vertices), Array.from(rudderData!.indices), Array.from(rudderData!.normals), Array.from(rudderData!.colors), null, leftAileron, null, device, pipeline, sampler, whiteView);
    let planeNode: RenderNode = new RenderNode(planeM, Array.from(planeData!.vertices), Array.from(planeData!.indices), Array.from(planeData!.normals), Array.from(planeData!.colors), null, null, rudder, device, pipeline, sampler, whiteView);
    // Sphere is a sibling of the plane; terminate its sibling to avoid cycles
    // Move sphere below the plane (e.g., y = -20) so plane flies above it
    let sphereM = mat4();
    // New matrix to track ONLY the earth's rotation (flying), not the plane's tilt
    let earthRotationM = mat4();

    let sphereNode: RenderNode = new RenderNode(sphereM, Array.from(sphere.positions), Array.from(sphere.indices), Array.from(sphere.normals), Array.from(sphere.colors), Array.from(sphere.uvs), null, null, device, pipeline, sampler, earthView);
    planeNode.sibling = sphereNode;

    // Control surface angles
    let currentAileronAngle = 0;
    let currentElevatorAngle = 0;
    let currentRudderAngle = 0;

    requestAnimationFrame(animate);

    let lastTime = performance.now();
    function animate(time: number) {

        const dt = (time - lastTime) / 1000; // seconds
        lastTime = time;

        update(dt);

        // Pass the calculated angles to the tilt functions
        let { l, r, lE, rE } = tiltAileronsAndElevators(currentAileronAngle, currentElevatorAngle);
        left = l;
        right = r;
        leftE = lE;
        rightE = rE;
        rudderM = tiltRudder(currentRudderAngle);

        leftAileron.udpateModelMatrix(left);
        rightAileron.udpateModelMatrix(right);
        leftElevator.udpateModelMatrix(leftE);
        rightElevator.udpateModelMatrix(rightE);
        rudder.udpateModelMatrix(rudderM);
        sphereNode.udpateModelMatrix(sphereM);
        planeNode.udpateModelMatrix(planeM);

        // Pass the updated lightDir from update() to the renderer
        renderer.renderHierarchy(planeNode, mat4(), view, projection, lightDir);

        requestAnimationFrame(animate);
    }

    let speed = 0.05
    let yAngle = 0;
    let xAngle = 0;
    let zAngle = 0;
    let zSpeed = 0
    let xSpeed = 0
    // Global light direction variable
    let lightDir: [number, number, number, number] = [0.0, 1.0, 0.0, 0.0];

    const planeScale = 0.03;
    const followDistance = -0.3; // how far behind the plane
    const followHeight = 0.2;    // how far above the plane
    const glideBase = 2;      // units/sec at max pitch (tune this)
    const maxPitchDeg = 30;   // matches your clamp


    function update(dt: number) {

        // Throttle control
        if (wPressed) {
            speed = Math.min(0.2, speed + 0.05 * dt); // Max speed 0.2
        }
        if (sPressed) {
            speed = Math.max(0.001, speed - 0.05 * dt); // Min speed 0.001
        }

        // Control Surface Logic
        const surfaceSpeed = 100 * dt; // degrees per second
        const returnSpeed = 80 * dt;
        const maxDeflection = 25;

        // Ailerons (Left/Right arrows)
        // Left Arrow -> Bank Left -> Left Aileron UP (-), Right Aileron DOWN (+)
        if (leftPressed) {
            currentAileronAngle = Math.max(-maxDeflection, currentAileronAngle - surfaceSpeed);
        } else if (rightPressed) {
            currentAileronAngle = Math.min(maxDeflection, currentAileronAngle + surfaceSpeed);
        } else {
            // Return to 0
            if (currentAileronAngle > 0) currentAileronAngle = Math.max(0, currentAileronAngle - returnSpeed);
            else if (currentAileronAngle < 0) currentAileronAngle = Math.min(0, currentAileronAngle + returnSpeed);
        }

        // Elevators (Up/Down arrows)
        // Up Arrow -> Pitch Up -> Elevators UP (-)
        if (upPressed) {
            currentElevatorAngle = Math.max(-maxDeflection, currentElevatorAngle - surfaceSpeed);
        } else if (downPressed) {
            currentElevatorAngle = Math.min(maxDeflection, currentElevatorAngle + surfaceSpeed);
        } else {
            if (currentElevatorAngle > 0) currentElevatorAngle = Math.max(0, currentElevatorAngle - returnSpeed);
            else if (currentElevatorAngle < 0) currentElevatorAngle = Math.min(0, currentElevatorAngle + returnSpeed);
        }

        // Rudder (Linked to turning/ailerons for now)
        // Left turn -> Rudder Left (+)
        if (leftPressed) {
            currentRudderAngle = Math.min(maxDeflection, currentRudderAngle + surfaceSpeed);
        } else if (rightPressed) {
            currentRudderAngle = Math.max(-maxDeflection, currentRudderAngle - surfaceSpeed);
        } else {
            if (currentRudderAngle > 0) currentRudderAngle = Math.max(0, currentRudderAngle - returnSpeed);
            else if (currentRudderAngle < 0) currentRudderAngle = Math.min(0, currentRudderAngle + returnSpeed);
        }


        const pitchFactor = Math.min(1, Math.abs(xAngle) / maxPitchDeg);
        if (pitchFactor > 0) {
            const glide = glideBase * pitchFactor * dt;
            if (xAngle < 0) {
                planeY -= glide; // nose-down -> descend
            } else if (xAngle > 0) {
                planeY += glide; // nose-up   -> climb
            }
        }

        // Prevent crashing into earth
        // sphereRadius is 20. We add a small buffer (0.5) so the plane sits on top.
        if (planeY < sphereRadius + 0.15) {
            planeY = sphereRadius + 0.15;

            // Auto-level: If hitting the ground nose-down, force the nose up to 0
            if (xAngle < 0) {
                xAngle = 0;
            }
        }

        /// === ADD TURNING LOGIC HERE ===
        // Calculate turning based on bank angle (zAngle)
        const TURN_GAIN = 200; // Tune this for turn responsiveness
        const rollRad = zAngle * Math.PI / 180;
        const turnRate = TURN_GAIN * speed * Math.sin(rollRad);

        // Apply the turn (yaw rotation) - this makes the plane actually turn
        earthRotationM = mult(rotateY(-turnRate * dt), earthRotationM);

        // Then apply forward motion
        earthRotationM = mult(rotateX(speed), earthRotationM);

        // Calculate visual banking/pitching effects
        xSpeed = (xAngle / 6.0) * speed;
        zSpeed = (zAngle / 6.0) * speed;

        // Apply visual tilt to the earth
        sphereM = mult(
            rotateX(-xSpeed),
            mult(rotateZ(-zSpeed), earthRotationM)
        );


        // LIGHT ATTACHED TO GROUND:
        // We use earthRotationM (pure earth spin) to rotate the light.
        // This means the light is fixed to a continent.
        // We do NOT include the tilt (xSpeed/zSpeed) in the light calculation, 
        // so the sun doesn't wobble when you bank.
        const sunFixedToEarth = vec4(0.2, 1.0, 0.2, 0.0);
        const worldLightDir = mult(sphereM, sunFixedToEarth);

        // Normalize
        const len = Math.sqrt(worldLightDir[0] * worldLightDir[0] + worldLightDir[1] * worldLightDir[1] + worldLightDir[2] * worldLightDir[2]);
        lightDir = [
            worldLightDir[0] / len,
            worldLightDir[1] / len,
            worldLightDir[2] / len,
            0.0
        ];

        planeM = mult(translate(0, 0, -planeY), mult(rotateX(90 + xAngle), mult(rotateY(yAngle), mult(rotateZ(zAngle), scalem(planeScale, planeScale, planeScale)))))
        //With speed in the x direction (forward) 
        /*planeM = mult(
            translate(0, 0, -planeY),
            mult(rotateX(90 + xAngle), mult(rotateY(yAngle), rotateZ(zAngle)))
        );
*/
        // Camera follow: chase behind and above the plane based on yaw
        // Camera follows full plane orientation
        const localCamOffset = vec3(0, followHeight, followDistance);

        // build orientation matrix of plane
        const planeRotation =
            mult(rotateX(90),
                mult(rotateY(yAngle),
                    rotateZ(0)));

        // rotate camera offset into world space
        const offset4 = mult(planeRotation, vec4(localCamOffset[0], localCamOffset[1], localCamOffset[2], 0));
        const rotatedOffset = vec3(offset4[0], offset4[1], offset4[2]);

        // plane position
        const planePos = vec3(0, 0, -planeY);

        // camera world position
        eye = add(planePos, rotatedOffset);

        // camera looks at plane
        lookat = planePos;
        up = vec3(0, planeY, 0);
        // Calculate the up vector based on the plane's orientation
        const up4 = mult(planeRotation, vec4(0, 1, 0, 0));
        // update view matrix
        view = lookAt(eye, lookat, up4.slice(0, 3) as Vec);

    }


    let leftPressed = false;
    let rightPressed = false;
    let upPressed = false;
    let downPressed = false;
    let wPressed = false;
    let sPressed = false;
    let steps = 10

    window.addEventListener("keydown", (e) => {
        // Prevent scrolling with arrow keys
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
        }
        if (e.key === "w" || e.key === "W") {
            console.log("w pressed!");
            wPressed = true;
        }
        if (e.key === "s" || e.key === "S") {
            sPressed = true;
        }
        if (e.key === "ArrowLeft") {
            console.log("left pressed!");
            leftPressed = true;
            yAngle = Math.max(-45, yAngle - (4.5 / steps));
            zAngle = Math.min(60, zAngle + (6 / steps));
            zSpeed = zAngle / 6.0 * speed;

        }
        if (e.key === "ArrowRight") {
            console.log("right pressed!");
            rightPressed = true;
            yAngle = Math.min(45, yAngle + (4.5 / steps));
            zAngle = Math.max(-60, zAngle - (6 / steps));
            zSpeed = zAngle / 6.0 * speed;
        }
        if (e.key === "ArrowUp") {
            console.log("up pressed!");
            upPressed = true;
            //planeY -= 0.1;
            //speed *= Math.max(0.05, speed / 1.01);
            xAngle = Math.max(-60, xAngle - (6 / steps));
            //xSpeed = xAngle / 6.0 * speed;
        }
        if (e.key === "ArrowDown") {
            console.log("down pressed!");
            downPressed = true;
            //speed *= Math.min(1, speed * 1.01);
            //planeY += 0.1;
            xAngle = Math.min(6.0, xAngle + (6 / steps));
            //xSpeed = xAngle / 6.0 * speed;

        }
    });

    window.addEventListener("keyup", (e) => {
        if (e.key === "w" || e.key === "W") {
            console.log("w released!");
            wPressed = false;
        }
        if (e.key === "s" || e.key === "S") {
            console.log("s released!");
            sPressed = false;
        }
        if (e.key === "ArrowLeft") {
            console.log("left released!");
            leftPressed = false;
        }

        if (e.key === "ArrowRight") {
            console.log("right released!");
            rightPressed = false;
        }
        if (e.key === "ArrowUp") {
            console.log("up released!");
            upPressed = false;
        }
        if (e.key === "ArrowDown") {
            console.log("down released!");
            downPressed = false;
        }
    })
}


function tiltAileronsAndElevators(aileronAngle: number, elevatorAngle: number): { l: Mat, r: Mat, lE: Mat, rE: Mat } {
    // Left Aileron: Up is negative rotation
    // Right Aileron: Down is positive rotation (opposite of left)
    let leftAileronTilt = mult(translate(leftAileronTransform[0], -leftAileronTransform[1], leftAileronTransform[2]), mult(rotateX(aileronAngle), translate(-leftAileronTransform[0], leftAileronTransform[1], -leftAileronTransform[2])))

    // Right aileron moves opposite to left
    let rightAileronTilt = mult(translate(rightAileronTransform[0], -rightAileronTransform[1], rightAileronTransform[2]), mult(rotateX(-aileronAngle), translate(-rightAileronTransform[0], rightAileronTransform[1], -rightAileronTransform[2])))

    let leftElevatorTilt = mult(translate(leftElevatorTransform[0], -leftElevatorTransform[1], leftElevatorTransform[2]), mult(rotateX(elevatorAngle), translate(-leftElevatorTransform[0], leftElevatorTransform[1], -leftElevatorTransform[2])))
    let rightElevatorTilt = mult(translate(rightElevatorTransform[0], -rightElevatorTransform[1], rightElevatorTransform[2]), mult(rotateX(elevatorAngle), translate(-rightElevatorTransform[0], rightElevatorTransform[1], -rightElevatorTransform[2])))
    return {
        l: leftAileronTilt,
        r: rightAileronTilt,
        lE: leftElevatorTilt,
        rE: rightElevatorTilt
    }
}

function tiltRudder(degrees: number): Mat {
    return mult(translate(rudderTransform[0], -rudderTransform[1], rudderTransform[2]), mult(rotateY(-degrees), translate(-rudderTransform[0], rudderTransform[1], -rudderTransform[2])));
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
