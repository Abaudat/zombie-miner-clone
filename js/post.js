// Post-processing: bloom + tilt-shift miniature blur + grade (saturation, vignette)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uFocus: { value: 0.5 },
    uBand: { value: 0.16 },
    uBlur: { value: 7.0 },
    uSat: { value: 1.18 },
    uVig: { value: 0.55 },
    uTint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFocus, uBand, uBlur, uSat, uVig; uniform vec3 uTint;
    varying vec2 vUv;
    const vec2 P[12] = vec2[12](
      vec2(-0.326,-0.406), vec2(-0.840,-0.074), vec2(-0.696,0.457), vec2(-0.203,0.621),
      vec2(0.962,-0.195), vec2(0.473,-0.480), vec2(0.519,0.767), vec2(0.185,-0.893),
      vec2(0.507,0.064), vec2(0.896,0.412), vec2(-0.322,-0.933), vec2(-0.792,-0.598));
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float d = abs(vUv.y - uFocus);
      float amt = smoothstep(uBand, uBand + 0.32, d) * uBlur;
      if (amt > 0.3) {
        vec3 acc = col.rgb; float w = 1.0;
        for (int i = 0; i < 12; i++) { acc += texture2D(tDiffuse, vUv + P[i] * amt / uRes).rgb; w += 1.0; }
        col.rgb = acc / w;
      }
      float l = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      col.rgb = mix(vec3(l), col.rgb, uSat) * uTint;
      vec2 p = vUv - 0.5;
      col.rgb *= 1.0 - uVig * dot(p, p) * 1.3;
      gl_FragColor = col;
    }`,
};

export class Post {
  constructor(renderer, scene, camera, lowEnd) {
    this.renderer = renderer;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: lowEnd ? 2 : 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    // clamp extreme specular highlights so sun glints on faceted gems don't bloom across the screen
    this.composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: GradeShader.vertexShader,
      fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        void main() { vec4 c = texture2D(tDiffuse, vUv); float m = max(c.r, max(c.g, c.b)); c.rgb *= m > 2.5 ? 2.5 / m : 1.0; gl_FragColor = c; }`,
    }));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.enabled = true;
  }

  setSize(w, h, pr) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.grade.uniforms.uRes.value.set(w * pr, h * pr);
    this.grade.uniforms.uBlur.value = 6.5 * pr;
    const portrait = h > w;
    this.grade.uniforms.uBand.value = portrait ? 0.17 : 0.13;
  }

  render(dt) {
    if (this.enabled) this.composer.render(dt);
    else this.renderer.render(this.composer.passes[0].scene, this.composer.passes[0].camera);
  }
}
