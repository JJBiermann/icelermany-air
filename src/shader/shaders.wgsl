struct VSOut {
    @builtin(position) inPos: vec4f,
    @location(0) texCoords: vec2f,
};

struct Uniforms {
    model: mat4x4f,
    view: mat4x4f,
    proj: mat4x4f,
    light_pos: vec3f,
    visibility: f32,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@group(0) @binding(1) 
var mySampler: sampler;

@group(0) @binding(2)
var myTexture: texture_2d<f32>;

@vertex
fn main_vs(@location(0) inPos: vec4f, @location(1) inTexCoords: vec2f) -> VSOut {
    var vsOut: VSOut;

    vsOut.inPos = uniforms.proj * uniforms.view * uniforms.model * inPos;
    vsOut.texCoords = inTexCoords;

    return vsOut;
}

@fragment
fn main_fs(@location(0) texCoords: vec2f) -> @location(0) vec4f {
    if (uniforms.visibility < 1.0) {
        let color = vec4f(0, 0, 0, uniforms.visibility);
        return color;
    } else {
        let color =  textureSample(myTexture, mySampler, texCoords);
        return color;
    }

}
