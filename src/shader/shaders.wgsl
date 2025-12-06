struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) pos_eye: vec3f,
    @location(1) normal_eye: vec3f,
    @location(2) color: vec4f,
};

struct Uniforms {
    model: mat4x4f,
    view: mat4x4f,
    proj: mat4x4f,
    light_direction: vec3f,
    light_color: vec3f,
    k_d_factor: f32,
    k_s_factor: f32,
    s: f32,
    L_e_factor: f32,
    // NOTE: same as L_i
    L_a_factor: f32,
};

const K_D: vec3f = vec3(1, 0.5, 0.5);
const K_S: vec3f = vec3(1.0, 1.0, 1.0);
const L_E: vec3f = vec3(1.0, 1.0, 1.0);
const L_A: vec3f = vec3(1.0, 1.0, 1.0);

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn main_vs(@location(0) inPos: vec3f, @location(1) inColor: vec4f, @location(2) inNorm: vec4f) -> VSOut {
    var vsOut: VSOut;
    let pos_eye = (uniforms.view * uniforms.model * vec4(inPos, 1.0)).xyz;
    // For a sphere centered at origin, the normal is just the normalized position
    let n_eye = normalize(uniforms.view * uniforms.model * inNorm).xyz;

    vsOut.position = uniforms.proj * uniforms.view * uniforms.model * vec4(inPos, 1.0);
    vsOut.pos_eye = pos_eye;
    vsOut.normal_eye = n_eye;
    vsOut.color = inColor;
    // material color

    return vsOut;
}

@fragment
fn main_fs(@location(0) pos_eye: vec3f, @location(1) normal_eye: vec3f, @location(2) color: vec4f) -> @location(0) vec4f {
    let n = normalize(normal_eye);
    let w_i = normalize(- (uniforms.view * vec4(uniforms.light_direction, 0.0)).xyz);
    let w_o = normalize(- pos_eye);
    let w_r = normalize(2.0 * dot(w_i, n) * n - w_i);
    // reflection direction

    // scaling
    let k_d = uniforms.k_d_factor * K_D;
    let k_s = uniforms.k_s_factor * K_S;
    let L_a = uniforms.L_a_factor * L_A;
    let L_e = uniforms.L_e_factor * L_E;

    // Phong terms
    let L_r_d = k_d * uniforms.light_color * max(dot(n, w_i), 0.0);
    let L_r_s = k_s * uniforms.light_color * pow(max(dot(w_r, w_o), 0.0), uniforms.s);
    let L_r_a = k_d * L_a;

    var L_o = L_r_d + L_r_s + L_r_a;

    return vec4(L_o, 1.0);
}
