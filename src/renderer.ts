import { sizeof } from './utils/MV';

interface RendererConfig {
    msaaCount?: number;
    useColorBuffer?: boolean;
    useIndicesBuffer?: boolean;
    useUniformBuffer?: boolean;
    useBindGroup?: boolean;
    uniformBufferSize?: number;
    backgroundColor?: GPUColor;
    pipelinePrimitive?: GPUPrimitiveState;
    pipelineDepthStencil?: GPUDepthStencilState;
    shaderCode: string;
    is3DRenderer?: boolean;

}


// TODO: Smart reallocation of buffers, when increased / decreased.
// TODO: only build in non null values for buffers, if they are really needed.
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
            useColorBuffer: true,
            useIndicesBuffer: true,
            msaaCount: 1,
            backgroundColor: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 },
            useUniformBuffer: true,
            useBindGroup: true,
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
        if (this.config.useBindGroup) {
            this.createBindGroups();
        }
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

        if (this.config.useBindGroup && this.bindGroup) {
            pass.setBindGroup(0, this.bindGroup);
        }

        pass.setVertexBuffer(0, this.positionBuffer);

        if (this.config.useColorBuffer && this.colorBuffer) {
            pass.setVertexBuffer(1, this.colorBuffer);
        }

        pass.setVertexBuffer(2, this.normalBuffer); 

        if (this.config.useIndicesBuffer && this.indicesBuffer) {
            pass.setIndexBuffer(this.indicesBuffer, 'uint32');
            pass.drawIndexed(indicesLength, 1);
        } else {
            const vertexCount = Math.floor(this.currentVertexCapacity); // TODO: Reevaluate, whether this makes sense.
            pass.draw(vertexCount, 1);
        } 

        pass.end();
        this.device.queue.submit([encoder.finish()])
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
                buffers: [this.positionBufferLayout, this.colorBufferLayout, this.normalBufferLayout],
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
        if (this.config.is3DRenderer) {
            this.positionBufferLayout = {
                arrayStride: 16, // sizeof vec4 (4 * 4 bytes) - positions stored as vec4 in OBJParser
                attributes: [{
                    format: 'float32x3',
                    offset: 0,
                    shaderLocation: 0, // Position, see vertex shader
                }],
            };
        } else {
            this.positionBufferLayout = {
                arrayStride: sizeof['vec2'], // sizeof vec3 (3 * 4 bytes)
                attributes: [{
                    format: 'float32x2',
                    offset: 0,
                    shaderLocation: 0, // Position, see vertex shader
                }],
            };
        }

        if (this.config.useColorBuffer) {
            this.colorBufferLayout = {
                arrayStride: 16, // sizeof vec4 (4 * 4 bytes)
                attributes: [{
                    format: 'float32x4',
                    offset: 0,
                    shaderLocation: 1,
                }]
            };
        }

        this.normalBufferLayout = {
            arrayStride: 16, 
            attributes: [{
                format: 'float32x4',
                offset: 0, 
                shaderLocation: 2,
            }]
        }
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

        if (this.config.useColorBuffer) {
            this.colorBuffer = this.device.createBuffer({
                size: this.currentVertexCapacity * sizeof['vec4'],
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }
        
        if (this.config.useIndicesBuffer) {
            this.indicesBuffer = this.device.createBuffer({
                size: this.currentIndexCapacity * 4, // 4 bytes per uint32
                usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            });
        }

        if (this.config.useUniformBuffer) {
            this.uniformBuffer = this.device.createBuffer({
                size: this.config.uniformBufferSize!,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
        }
        /*
        this.positionBuffer = this.device.createBuffer({
            size: this.config.maxVertices! * 12, // sizeof vec3
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        if (this.config.useColorBuffer) {
            this.colorBuffer = this.device.createBuffer({
                size: this.config.maxVertices! * 16, // sizeof vec4
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }
        if (this.config.useIndicesBuffer) {
            this.indicesBuffer = this.device.createBuffer({
                size: this.config.maxVertices! * 3 * 4, // 3 indices per triangle * 4 bytes per uint32
                usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            });
        }

        if (this.config.useUniformBuffer) {
            this.uniformBuffer = this.device.createBuffer({
                size: this.config.uniformBufferSize!, //2 * 64 + 2 * 12 + 5 * 4 + 2 * 2, // 2 * sizeof mat4 + 2 * sizeof vec3 + 5 * 4 + 2 * 2
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
        }*/
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

        if (this.config.useColorBuffer) {
            this.colorBuffer = this.device.createBuffer({
                size: newCapacity * sizeof['vec4'],
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }

        this.currentVertexCapacity = newCapacity;

        oldPositionBuffer?.destroy();
        oldColorBuffer?.destroy();

        //Recreate bind groups if they reference the buffers
        if (this.config.useBindGroup) {
            this.createBindGroups();
        }
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
}