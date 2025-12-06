import { mat4, mult } from "./utils/MV";
import type { Mat } from "./utils/MV";

// Definition for the RenderFunction, which will be passed to each node. 
export type RenderFunc = (node: RenderNode, pass: GPURenderPassEncoder, model: Mat, view: Mat, proj: Mat) => void;

export class RenderNode {
    modelM: Mat;
    viewM: Mat;
    projM: Mat;
    renderFunc: RenderFunc;
    vertices: number[];
    indices: number[];
    sibling: RenderNode | null;
    child: RenderNode | null;
    device: GPUDevice;

    constructor(
        modelM: Mat,
        viewM: Mat,
        projM: Mat,
        renderFunc: RenderFunc,
        vertices: number[],
        indices: number[],
        sibling: RenderNode | null = null,
        child: RenderNode | null = null, 
        device: GPUDevice
    ) {
        this.modelM = modelM;
        this.viewM = viewM;
        this.projM = projM;
        this.renderFunc = renderFunc;
        this.vertices = vertices;
        this.indices = indices;
        this.sibling = sibling;
        this.child = child;
        this.device = device;
    }

    traverse(pass: GPURenderPassEncoder, parentModel: Mat, view: Mat, proj: Mat): void {
        const worldModel = mult(parentModel, this.modelM);
        this.renderFunc(this, pass, worldModel, view, proj);

        if (this.child != null) {
            this.child.traverse(pass, worldModel, view, proj);
        }

        if (this.sibling != null) {
            this.sibling.traverse(pass, parentModel, view, proj);
        }
    }
}