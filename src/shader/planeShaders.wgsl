struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) normal: vec4f, 
    @location(1) color: vec4f
};

struct Uniforms {
    model: mat4x4f,
    view: mat4x4f,
    proj: mat4x4f,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn main_vs(@location(0) inPos: vec4f, @location(2) normal: vec4f, @location(1) color: vec4f) -> VSOut {
    var vsOut: VSOut;
    vsOut.position = uniforms.proj * uniforms.view * uniforms.model * inPos;
    vsOut.normal = normal; 
    vsOut.color = color;
    return vsOut;
}

@fragment
fn main_fs(@location(0) normal: vec4f, @location(1) color: vec4f) -> @location(0) vec4f {
    return color;
}
