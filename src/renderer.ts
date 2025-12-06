import { flatten, sizeof, type Mat } from './utils/MV';
import { RenderNode } from './node';

interface RendererConfig {
    msaaCount?: number;
    uniformBufferSize?: number;
    backgroundColor?: GPUColor;
    pipelinePrimitive?: GPUPrimitiveState;
    pipelineDepthStencil?: GPUDepthStencilState;
    shaderCode: string;
    is3DRenderer?: boolean;

}

export class Renderer {
    private positionBuffer!: GPUBuffer;
    private colorBuffer!: GPUBuffer;
    private indicesBuffer!: GPUBuffer;
    private uniformBuffer!: GPUBuffer;
    private normalBuffer!: GPUBuffer;
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private bindGroup!: GPUBindGroup;
    private depthTexture!: GPUTexture;
    private pipeline!: GPURenderPipeline;
    private wgsl!: GPUShaderModule;
    private canvasFormat!: GPUTextureFormat;
    public canvas!: HTMLCanvasElement;
    private currentVertexCapacity;
    private currentIndexCapacity;
    // NOTE: I only need Buffer Layouts for Vertex Buffers.
    private positionBufferLayout!: GPUVertexBufferLayout;
    private colorBufferLayout!: GPUVertexBufferLayout;
    private normalBufferLayout!: GPUVertexBufferLayout;

    private config!: RendererConfig;

    constructor(config: RendererConfig) {
        this.config = {
            msaaCount: 1,
            backgroundColor: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 },
            uniformBufferSize: 150,
            pipelinePrimitive: {
                topology: 'triangle-list',
                frontFace: 'ccw',
                cullMode: 'none',
            },
            pipelineDepthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
            is3DRenderer: true,
            ...config
        }
        this.currentVertexCapacity = 1_000_000;
        this.currentIndexCapacity = this.currentVertexCapacity * 3;
    }

    public async init() {
        await this.initGpuHandle();
        this.initContext();
        this.configureCanvas();
        this.loadShaders();
        this.configureVertexBufferLayouts();

        this.configurePipeline(
            {
                topology: 'triangle-list',
                frontFace: 'ccw',
                cullMode: 'none',
            },
            {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            }
        );

        this.createBuffers();
        this.createBindGroups();
        this.createTextures();
    }

    public updatePositionBuffer(inBuffer: number[]): void {
        if (!this.device || !this.positionBuffer) {
            throw new Error('Renderer not initialized');
        }
        const entriesPerVertex = this.config.is3DRenderer ? 3 : 2;
        const requiredEntries = Math.ceil(inBuffer.length / entriesPerVertex);

        // resize as long as needed.
        while (requiredEntries > this.currentVertexCapacity) {
            this.resizeVertexBuffers(requiredEntries);
        }
        this.device.queue.writeBuffer(this.positionBuffer, 0, new Float32Array(inBuffer));
    }

    public updateColorBuffer(inBuffer: number[]): void {
        if (!this.device) {
            throw new Error('Renderer not initialized');
        }
        const requiredVertices = Math.ceil(inBuffer.length / 4);

        if (requiredVertices > this.currentVertexCapacity) {
            this.resizeVertexBuffers(requiredVertices);
        }
        this.device.queue.writeBuffer(this.colorBuffer, 0, new Float32Array(inBuffer));
    }

    public updateIndicesBuffer(inBuffer: number[]): void {
        if (!this.device || !this.indicesBuffer) {
            throw new Error('Renderer not initialized');
        }

        if (inBuffer.length > this.currentIndexCapacity) {
            this.resizeIndexBuffer(inBuffer.length);
        }

        this.device.queue.writeBuffer(this.indicesBuffer, 0, new Uint32Array(inBuffer));
    }

    public updateUniformBuffer(inBuffer: number[]): void {
        if (!this.device || !this.uniformBuffer) {
            throw new Error('Renderer not initialized');
        }
        this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array(inBuffer));
    }

    public updateNormals(inBuffer: number[]): void {
        if (!this.device || !this.normalBuffer) {
            throw new Error('Renderer not initialized');
        }
        this.device.queue.writeBuffer(this.normalBuffer, 0, new Float32Array(inBuffer));
    }

    public render(indicesLength: number): void {
        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: this.config.backgroundColor,
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthLoadOp: "clear",
                depthClearValue: 1.0,
                depthStoreOp: "store",
            }
        })

        pass.setPipeline(this.pipeline);

        pass.setBindGroup(0, this.bindGroup);

        pass.setVertexBuffer(0, this.positionBuffer);
        pass.setVertexBuffer(1, this.colorBuffer);
        pass.setVertexBuffer(2, this.normalBuffer);

        pass.setIndexBuffer(this.indicesBuffer, 'uint32');
        pass.drawIndexed(indicesLength, 1);
        /*else {
            const vertexCount = Math.floor(this.currentVertexCapacity); // TODO: Reevaluate, whether this makes sense.
            pass.draw(vertexCount, 1);
        }*/

        pass.end();
        this.device.queue.submit([encoder.finish()])
    }

    public renderHierarchy(rootNode: RenderNode, model: Mat, view: Mat, proj: Mat) {
        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: this.config.backgroundColor,
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthLoadOp: "clear",
                depthClearValue: 1.0,
                depthStoreOp: "store",
            }
        });

        // inside every node, there has to be a custom render function for that node.
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        rootNode.traverse(pass, model, view, proj);
        console.log("Reached traverse end.")
        pass.end()
        this.device.queue.submit([encoder.finish()]);
    }

    // this function will be called inside of the "traverse()" function of the corresponding node.
    public renderNode(node: RenderNode, pass: GPURenderPassEncoder, model: Mat,  view: Mat, proj: Mat) {
        if (node == null) {
            throw new Error("WTF is happening lol");
        }
        console.log("view: ", view);
        console.log("proj: ", proj);
        // update the model matrix of the uniform buffer
        console.log("drawing node with model:", Array.from(flatten(model)));
        let uniform : number[] = [...Array.from(flatten(model)), ...Array.from(flatten(view)), ...Array.from(flatten(proj))]
        this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array(uniform));
        // update position buffer --> NOTE: rethink if this is the best way to approach this.
        //this.device.queue.writeBuffer(this.positionBuffer, 0, new Float32Array(node.vertices));
        // update the indices buffer --> NOTE: same as above
        //this.device.queue.writeBuffer(this.indicesBuffer, 0, new Uint32Array(node.indices));

      
        pass.setVertexBuffer(0, this.positionBuffer, node.vertexOffset);
        pass.setIndexBuffer(this.indicesBuffer, 'uint32', node.indexOffset);
        //pass.setVertexBuffer(1, this.colorBuffer);
        //pass.setVertexBuffer(2, this.normalBuffer);
        pass.drawIndexed(node.indexCount, 1);
    }

    private async initGpuHandle() {
        var adapter = await navigator.gpu?.requestAdapter();
        const device = await adapter?.requestDevice();
        if (!device) {
            this.fail("Browser does not support WebGPU");
            return;
        }
        this.device = device;
    }

    private initContext() {
        const canvas = document.getElementById('my-canvas') as HTMLCanvasElement;
        if (!canvas) {
            throw new Error('Canvas element not found');
        }
        this.canvas = canvas;

        // necessary code ugliness for null check. 
        const context = canvas.getContext('webgpu');
        if (!context) {
            throw new Error('Failed to get WebGPU context');
        }
        this.context = context;
    }

    private configureCanvas() {
        this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: this.canvasFormat,
        });
    }

    private loadShaders() {
        const wgsl = this.device.createShaderModule({
            code: this.config.shaderCode
        });
        this.wgsl = wgsl;
    }

    private configurePipeline(primitve: GPUPrimitiveState, depthStencil?: GPUDepthStencilState) {
        // Defining Render Pipeline
        const pipelineConfig: GPURenderPipelineDescriptor = {
            layout: 'auto',
            vertex: {
                module: this.wgsl,
                entryPoint: 'main_vs',
                buffers: [this.positionBufferLayout]//, this.colorBufferLayout, this.normalBufferLayout],
            },
            fragment: {
                module: this.wgsl,
                entryPoint: 'main_fs',
                targets: [{
                    format: this.canvasFormat,
                }],
            },
            primitive: primitve,
        };

        if (depthStencil) {
            pipelineConfig.depthStencil = depthStencil;
        }

        this.pipeline = this.device.createRenderPipeline(pipelineConfig);
    }

    private configureVertexBufferLayouts() {

        this.positionBufferLayout = {
            arrayStride: 12, // sizeof vec4 (4 * 4 bytes) - positions stored as vec4 in OBJParser
            attributes: [{
                format: 'float32x3',
                offset: 0,
                shaderLocation: 0, // Position, see vertex shader
            }],
        };

        /*
        this.colorBufferLayout = {
            arrayStride: 16, // sizeof vec4 (4 * 4 bytes)
            attributes: [{
                format: 'float32x4',
                offset: 0,
                shaderLocation: 1,
            }]
        };

        this.normalBufferLayout = {
            arrayStride: 16,
            attributes: [{
                format: 'float32x4',
                offset: 0,
                shaderLocation: 2,
            }]
        }
            */
    }

    private createBuffers() {
        const positionBufferSize = this.config.is3DRenderer ?
            this.currentVertexCapacity * sizeof['vec3'] :
            this.currentVertexCapacity * sizeof['vec2'];

        this.positionBuffer = this.device.createBuffer({
            size: positionBufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.normalBuffer = this.device.createBuffer({
            size: positionBufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.colorBuffer = this.device.createBuffer({
            size: this.currentVertexCapacity * sizeof['vec4'],
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.indicesBuffer = this.device.createBuffer({
            size: this.currentIndexCapacity * 4, // 4 bytes per uint32
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });

        this.uniformBuffer = this.device.createBuffer({
            size: this.config.uniformBufferSize!,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    private createBindGroups() {
        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer }
            }]
        });
    }

    private createTextures() {
        this.depthTexture = this.device.createTexture({
            size: {
                width: this.canvas.width,
                height: this.canvas.height
            },
            format: 'depth24plus',
            sampleCount: this.config.msaaCount,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    private resizeVertexBuffers(requiredEntries: number): void {

        const newCapacity = Math.ceil(requiredEntries * 2);
        console.log(`Resizing vertex buffers from ${this.currentVertexCapacity} to ${newCapacity}.`);

        const oldPositionBuffer = this.positionBuffer;
        const oldColorBuffer = this.colorBuffer;

        const positionBufferSize = this.config.is3DRenderer ? newCapacity * sizeof['vec3'] : newCapacity * sizeof['vec2'];

        this.positionBuffer = this.device.createBuffer({
            size: positionBufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.colorBuffer = this.device.createBuffer({
            size: newCapacity * sizeof['vec4'],
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.currentVertexCapacity = newCapacity;

        oldPositionBuffer?.destroy();
        oldColorBuffer?.destroy();

        //Recreate bind groups if they reference the buffers
        this.createBindGroups();
    }

    private resizeIndexBuffer(requiredIndices: number): void {
        const newCapacity = Math.ceil(requiredIndices * 2);

        console.log(`Resizing index buffer from ${this.currentIndexCapacity} to ${newCapacity} indices`);

        // Store old buffer
        const oldIndexBuffer = this.indicesBuffer;

        // Create new index buffer
        this.indicesBuffer = this.device.createBuffer({
            size: newCapacity * 4, // 4 bytes per uint32
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });

        // Update capacity
        this.currentIndexCapacity = newCapacity;

        // Destroy old buffer
        oldIndexBuffer?.destroy();
    }

    private fail(msg: string) {
        document.body.innerHTML = `<h1>${msg}</h1>`
    }

    public getDevice(): GPUDevice {
        return this.device;
    }
}