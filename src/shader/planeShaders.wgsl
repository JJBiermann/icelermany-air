struct VSOut {
    @builtin(position) position: vec4f,
};

struct Uniforms {
    model: mat4x4f,
    view: mat4x4f,
    proj: mat4x4f,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn main_vs(@location(0) inPos: vec3f) -> VSOut {
    var vsOut: VSOut;
    vsOut.position = uniforms.proj * uniforms.view * uniforms.model * vec4(inPos, 1);
    return vsOut;
}

@fragment
fn main_fs() -> @location(0) vec4f {
    return vec4(1.0, 1.0, 1.0, 1.0);
}
