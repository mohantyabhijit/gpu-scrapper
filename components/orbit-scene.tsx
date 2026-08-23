"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function OrbitScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    const group = new THREE.Group();
    scene.add(group);
    const colors = [0x635bff, 0x00d4ff, 0x7a73ff, 0xffc46b];
    const geometries = [
      new THREE.IcosahedronGeometry(1.25, 1),
      new THREE.OctahedronGeometry(0.7, 1),
      new THREE.TetrahedronGeometry(0.5, 0),
      new THREE.TorusGeometry(0.5, 0.1, 12, 48),
    ];
    const positions = [[0, 0, 0], [2.1, 0.8, -0.4], [-2.1, -0.9, -0.2], [1.65, -1.7, 0.1]];
    const meshes = geometries.map((geometry, index) => {
      const material = new THREE.MeshBasicMaterial({ color: colors[index], wireframe: true, transparent: true, opacity: index === 0 ? 0.8 : 0.55 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...(positions[index] as [number, number, number]));
      group.add(mesh);
      return mesh;
    });

    const dotGeometry = new THREE.BufferGeometry();
    const points: number[] = [];
    for (let index = 0; index < 90; index += 1) {
      const angle = index * 2.399963;
      const radius = 1.8 + (index % 13) * 0.18;
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.6, ((index * 17) % 23) / 10 - 1.15);
    }
    dotGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const dots = new THREE.Points(dotGeometry, new THREE.PointsMaterial({ color: 0x635bff, size: 0.028, transparent: true, opacity: 0.42 }));
    group.add(dots);

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const width = canvas.clientWidth || 560;
      const height = canvas.clientHeight || 420;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const move = (event: PointerEvent) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 0.35;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 0.2;
    };
    const render = (time = 0) => {
      const seconds = time / 1000;
      group.rotation.y += (pointerX - group.rotation.y) * 0.035;
      group.rotation.x += (-pointerY - group.rotation.x) * 0.035;
      meshes.forEach((mesh, index) => {
        mesh.rotation.x = seconds * (0.08 + index * 0.025);
        mesh.rotation.y = seconds * (0.12 + index * 0.02);
        mesh.position.y = positions[index][1] + Math.sin(seconds * 0.7 + index) * 0.09;
      });
      dots.rotation.z = seconds * 0.025;
      renderer.render(scene, camera);
      if (!reducedMotion) frame = requestAnimationFrame(render);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("pointermove", move, { passive: true });
    resize();
    render();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", move);
      geometries.forEach((geometry) => geometry.dispose());
      dotGeometry.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="orbit-canvas" aria-hidden="true" />;
}
