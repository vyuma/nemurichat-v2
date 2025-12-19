"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";

export default function VRMView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [models, setModels] = useState<string[]>([]);
  const [vrmUrl, setVrmUrl] = useState<string | null>(null);
  const vrmRef = useRef<VRM | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/models');
        const data = await response.json();
        if (Array.isArray(data)) {
          setModels(data);
          if (data.length > 0) {
            setVrmUrl(data[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };
    fetchModels();
  }, []);

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setVrmUrl(event.target.value);
  };

  useEffect(() => {
    if (!containerRef.current || !vrmUrl) return;

    const container = containerRef.current;

    // Clean up previous renderer
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      20.0
    );
    camera.position.set(0, 1.2, 2.2);
    camera.lookAt(0, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(3, 5, 3);
    scene.add(dirLight);

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let currentVrm: VRM | null = null;

    loader.load(
      vrmUrl,
      (gltf) => {
        const vrm = gltf.userData.vrm;
        scene.add(vrm.scene);
        vrm.scene.rotation.y = Math.PI;
        
        const bbox = new THREE.Box3().setFromObject(vrm.scene);
        vrm.scene.position.y = -bbox.min.y;

        vrm.scene.scale.set(1.2, 1.2, 1.2);
        
        currentVrm = vrm;
        vrmRef.current = vrm;
      },
      undefined,
      (error) => {
        console.error(error);
      }
    );

    let clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (currentVrm) {
        currentVrm.update(delta);
      }
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (renderer) {
        renderer.dispose();
      }
    };
  }, [vrmUrl]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      {models.length > 0 && vrmUrl && (
        <select 
          onChange={handleModelChange} 
          value={vrmUrl}
          style={{ position: "absolute", top: "10px", left: "10px", zIndex: 1 }}
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model.split("/").pop()}
            </option>
          ))}
        </select>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}