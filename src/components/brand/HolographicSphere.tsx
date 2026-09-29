"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Logo "esfera holográfica" — una esfera de partículas en Three.js que
 * respira/gira suavemente y reacciona sutilmente al mouse. Adaptado del
 * script vanilla que se entregó (mismo tuning: distribución Fibonacci,
 * shader de puntos con glow aditivo, pixel ratio limitado, pausa cuando la
 * pestaña está oculta o el logo sale del viewport) a un componente de
 * React que se puede usar en cualquier parte del CRM (login, sidebar).
 *
 * No es un placeholder — es el logo real de KOSMO en su variante animada,
 * pensado para acompañar (no reemplazar) el wordmark: se usa junto a
 * `KosmoWordmark` en el login, y solo (a tamaño de ícono) en el sidebar
 * cuando está recogido.
 */

const SPHERE_RADIUS = 1.6;
const MAX_PIXEL_RATIO = 2; // el logo es pequeño, así que ir más nítido aquí es barato

// El tuning original (1500 partículas, puntos de 3.6px) está pensado para
// el tamaño de referencia del login (~88px). El tamaño de punto NO escala
// solo con el contenedor (gl_PointSize es en píxeles de pantalla, no en
// unidades del mundo 3D) — a un tamaño más chico (p. ej. 30px del ícono
// del sidebar), esos mismos puntos se encimarían tanto que la esfera se ve
// como un disco sólido en vez de partículas. Por eso el conteo y el tamaño
// de punto se derivan del tamaño real solicitado.
//
// El conteo escala LINEAL con el tamaño (no cuadrático como antes): con
// scale^2, un logo chico como el de 30px del sidebar quedaba con apenas
// ~220 partículas — tan disperso que contra el degradado morado del header
// casi no se veía (reportado: "la esfera casi no se ve, ponerla más
// densa"). Lineal conserva mucha más densidad relativa a tamaños chicos,
// sin cambiar nada a tamaño de referencia o mayor (scale=1 da el mismo
// resultado de siempre). El piso de tamaño de punto también sube un poco
// por la misma razón: a 1.6px cada partícula era casi invisible.
const REFERENCE_SIZE = 88;
function particleCountForSize(size: number) {
  const scale = Math.min(1, size / REFERENCE_SIZE);
  return Math.max(420, Math.round(1500 * scale));
}
function basePointSizeForSize(size: number) {
  const scale = Math.min(1, size / REFERENCE_SIZE);
  return Math.max(2.2, 3.6 * scale);
}

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 aBasePos;
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uBreath;
  uniform vec2 uMouse;
  uniform float uHoverActive;
  uniform float uPixelRatio;
  uniform float uBaseDistance;
  varying float vBrightness;

  void main() {
    vec3 dirVec = aBasePos;
    float len = length(dirVec);
    vec3 dir = dirVec / max(len, 0.0001);

    float theta = acos(clamp(dir.y, -1.0, 1.0));
    float phi = atan(dir.z, dir.x);

    float wobble = sin(uTime * 0.6 + aSeed * 6.2831853) * 0.015
               + sin(uTime * 0.9 + aSeed * 12.0) * 0.008;
    float wave = sin(theta * 6.0 + phi * 3.0 + uTime * 0.8) * 0.012;

    float radiusScale = uBreath + wobble + wave;
    vec3 displaced = dir * (len * radiusScale);

    displaced += vec3(
      sin(uTime * 0.5 + aSeed * 3.0),
      cos(uTime * 0.4 + aSeed * 5.0),
      sin(uTime * 0.45 + aSeed * 7.0)
    ) * 0.012;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);

    float hover = 0.0;
    if (uHoverActive > 0.5) {
      vec4 projected = projectionMatrix * mvPosition;
      vec2 screenPos = projected.xy / max(projected.w, 0.0001);
      float distToMouse = length(screenPos - uMouse);
      hover = smoothstep(0.32, 0.0, distToMouse) * 0.14;
      mvPosition.xyz += normalize(mvPosition.xyz) * hover;
    }

    gl_Position = projectionMatrix * mvPosition;

    float brightnessFlicker = 0.7 + 0.3 * sin(uTime * 1.3 + aSeed * 9.0);
    vBrightness = brightnessFlicker + hover * 1.5;

    float depthAtten = clamp(uBaseDistance / max(-mvPosition.z, 0.001), 0.8, 1.25);
    gl_PointSize = aSize * uPixelRatio * depthAtten * (0.85 + 0.25 * brightnessFlicker);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying float vBrightness;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    float alpha = smoothstep(0.5, 0.0, d);
    alpha *= alpha;
    vec3 color = vec3(1.0) * min(vBrightness, 1.4);
    gl_FragColor = vec4(color, alpha * 0.85);
  }
`;

export function HolographicSphere({
  size = 88,
  className,
  enableHover = true,
}: {
  size?: number;
  className?: string;
  enableHover?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Defensivo: si WebGL no se puede inicializar en este navegador/entorno
    // (contexto perdido, GPU bloqueada, recarga a mitad de montaje por dev
    // server, etc.) no queremos una excepción sin capturar que deje el
    // logo en blanco sin ninguna pista — lo dejamos en blanco IGUAL (no
    // hay fallback visual, es solo el logo) pero con un rastro claro en
    // consola para poder diagnosticarlo.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        premultipliedAlpha: false,
        powerPreference: "low-power",
      });
    } catch (err) {
      console.error("[HolographicSphere] No se pudo crear el contexto WebGL:", err);
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 4.4);
    camera.lookAt(0, 0, 0);

    function resizeToContainer() {
      if (!container) return;
      const w = container.clientWidth || 160;
      const h = container.clientHeight || 160;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // OJO: el tercer argumento de setSize por defecto (true) hace que
      // Three.js fije tambien el tamano VISUAL en CSS del canvas ademas de
      // su resolucion interna. Antes se pasaba `false` para saltarse eso, y
      // como nada mas en este componente define el ancho/alto CSS del
      // canvas, el navegador terminaba mostrandolo al tamano de sus
      // atributos width/height internos — que Three.js ya multiplico por el
      // devicePixelRatio de la pantalla. En un monitor con DPR=1 eso
      // coincidia por casualidad con `size`, pero en cualquier pantalla con
      // DPR distinto de 1 (la gran mayoria de laptops, celulares, tablets)
      // la esfera se dibujaba mas grande que la caja que le reservo el
      // layout y se salia de su lugar (reportado: se superponia con el
      // texto de bienvenida, y el icono chico del sidebar se veia
      // desparejo/puntiagudo). Sin el `false`, el tamano visual siempre
      // queda exactamente en `size` px sin importar el DPR — la nitidez en
      // pantallas retina se sigue logrando via setPixelRatio() arriba.
      renderer.setSize(w, h);
    }
    resizeToContainer();

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(resizeToContainer);
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", resizeToContainer);
    }

    // Geometría — distribución Fibonacci (uniforme, sin rejilla visible).
    // Conteo y tamaño de punto ajustados al tamaño real del componente
    // (ver comentario junto a particleCountForSize/basePointSizeForSize).
    const particleCount = particleCountForSize(size);
    const basePointSize = basePointSizeForSize(size);

    const positions = new Float32Array(particleCount * 3);
    const basePositions = new Float32Array(particleCount * 3);
    const seeds = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < particleCount; i++) {
      const y = 1 - (i / (particleCount - 1)) * 2;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      const radialJitter = 1 + (Math.random() - 0.5) * 0.05;
      const r = SPHERE_RADIUS * radialJitter;

      const ix = i * 3;
      basePositions[ix] = x * r;
      basePositions[ix + 1] = y * r;
      basePositions[ix + 2] = z * r;

      positions[ix] = basePositions[ix];
      positions[ix + 1] = basePositions[ix + 1];
      positions[ix + 2] = basePositions[ix + 2];

      seeds[i] = Math.random() * 1000.0;
      sizes[i] = basePointSize * (0.55 + Math.random() * 0.9);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aBasePos", new THREE.BufferAttribute(basePositions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const uniforms = {
      uTime: { value: 0 },
      uBreath: { value: 1.0 },
      uMouse: { value: new THREE.Vector2(2, 2) },
      uHoverActive: { value: 0.0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uBaseDistance: { value: camera.position.length() },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);

    const rotationGroup = new THREE.Group();
    rotationGroup.add(points);

    const tiltGroup = new THREE.Group();
    tiltGroup.add(rotationGroup);
    scene.add(tiltGroup);

    // Mouse: solo dentro del propio contenedor (no en toda la ventana).
    const mouseNDC = new THREE.Vector2(2, 2);
    let targetTiltX = 0;
    let targetTiltY = 0;

    function onMouseMove(e: MouseEvent) {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseNDC.set(nx, ny);
      targetTiltY = nx * 0.18;
      targetTiltX = ny * 0.14;
      uniforms.uHoverActive.value = 1.0;
    }
    function onMouseLeave() {
      mouseNDC.set(2, 2);
      targetTiltX = 0;
      targetTiltY = 0;
      uniforms.uHoverActive.value = 0.0;
    }
    if (enableHover) {
      container.addEventListener("mousemove", onMouseMove);
      container.addEventListener("mouseleave", onMouseLeave);
    }

    // Si se pierde el contexto WebGL (recarga de página a mitad de
    // animación, GPU reiniciada por el driver, demasiados contextos
    // abiertos, etc.) el navegador dispara este evento en vez de lanzar
    // una excepción — sin este listener el logo se queda congelado o en
    // blanco sin ningún rastro. Lo dejamos registrado en consola y
    // detenemos el loop; si el navegador restaura el contexto, retomamos.
    function onContextLost(e: Event) {
      e.preventDefault();
      console.warn("[HolographicSphere] Contexto WebGL perdido — se detiene la animación.");
      isRunning = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
    }
    function onContextRestored() {
      console.info("[HolographicSphere] Contexto WebGL restaurado — se reanuda la animación.");
      setRunning(isIntersecting && !document.hidden);
    }
    renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored, false);

    // Pausa automática: nada de renderizar en segundo plano — se detiene
    // si la pestaña está oculta o si el logo sale del viewport, y retoma
    // solo cuando vuelve a ser visible.
    let isRunning = true;
    let rafId: number | null = null;
    let isIntersecting = true;

    function setRunning(shouldRun: boolean) {
      if (shouldRun && !isRunning) {
        isRunning = true;
        rafId = requestAnimationFrame(animate);
      } else if (!shouldRun && isRunning) {
        isRunning = false;
        if (rafId !== null) cancelAnimationFrame(rafId);
      }
    }

    function onVisibilityChange() {
      setRunning(!document.hidden && isIntersecting);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          isIntersecting = entries[0].isIntersecting;
          setRunning(isIntersecting && !document.hidden);
        },
        { threshold: 0.01 }
      );
      io.observe(container);
    }

    const clock = new THREE.Clock();

    function animate() {
      if (!isRunning) return;
      rafId = requestAnimationFrame(animate);

      const t = clock.getElapsedTime();

      uniforms.uTime.value = t;
      uniforms.uMouse.value.copy(mouseNDC);
      uniforms.uBreath.value = 1.0 + Math.sin(t * 0.28) * 0.01;

      rotationGroup.rotation.y += 0.0016;
      rotationGroup.rotation.x = Math.sin(t * 0.12) * 0.05;

      tiltGroup.rotation.x += (targetTiltX - tiltGroup.rotation.x) * 0.03;
      tiltGroup.rotation.y += (targetTiltY - tiltGroup.rotation.y) * 0.03;

      camera.position.x = Math.sin(t * 0.05) * 0.2;
      camera.position.y = Math.cos(t * 0.045) * 0.13;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    rafId = requestAnimationFrame(animate);

    return () => {
      isRunning = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resizeToContainer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      io?.disconnect();
      if (enableHover) {
        container.removeEventListener("mousemove", onMouseMove);
        container.removeEventListener("mouseleave", onMouseLeave);
      }
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost, false);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored, false);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [enableHover, size]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
