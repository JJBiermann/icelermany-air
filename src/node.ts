import { mat4, mult, sizeof } from "./utils/MV";
import type { Mat } from "./utils/MV";

export class RenderNode {
    modelM: Mat;
    vertices: number[];
    indices: number[];
    sibling: RenderNode | null;
    child: RenderNode | null;
    device: GPUDevice;
    positionBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    colorBuffer: GPUBuffer;
    normalBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
    pipeline: GPURenderPipeline;
    uniformBuffer: GPUBuffer;

    constructor(
        modelM: Mat,
        vertices: number[],
        indices: number[],
        normals: number[],
        colors: number[],
        sibling: RenderNode | null = null,
        child: RenderNode | null = null,
        device: GPUDevice,
        pipeline: GPURenderPipeline
    ) {
        this.modelM = modelM;
        this.vertices = vertices;
        this.indices = indices;
        this.sibling = sibling;
        this.child = child;
        this.device = device;
        this.pipeline = pipeline;

        this.positionBuffer = this.device.createBuffer({
            size: vertices.length * sizeof['vec4'],
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
        });


        this.colorBuffer = this.device.createBuffer({
            size: vertices.length * sizeof['vec4'],
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
        });

        this.normalBuffer = this.device.createBuffer({
            size: vertices.length * sizeof['vec4'],
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
        });

        this.indexBuffer = this.device.createBuffer({
            size: indices.length * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDEX
        })

        this.uniformBuffer = this.device.createBuffer({
            size: 256, // matrices + lighting params
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
        })

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer }
            }]
        });

        this.device.queue.writeBuffer(this.positionBuffer, 0, new Float32Array(vertices));
        this.device.queue.writeBuffer(this.colorBuffer, 0, new Float32Array(colors));
        this.device.queue.writeBuffer(this.normalBuffer, 0, new Float32Array(normals));
        this.device.queue.writeBuffer(this.indexBuffer, 0, new Uint32Array(indices));

    }

    udpateModelMatrix(modelM: Mat) {
        this.modelM = modelM;
    }
}